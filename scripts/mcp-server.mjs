#!/usr/bin/env node
// An MCP server exposing the app's real data to Claude Desktop.
//
// The app stays deliberately simple: it logs, it reminds, it shows state. When
// there's a question worth actually thinking about — why a dose landed the way
// it did, whether the training is working — that thinking happens in Claude,
// with the real numbers in front of it. This is the pipe that carries them.
//
// Read-only by construction. There is no tool here that writes, and the file
// it reads is a copy — nothing in this process can reach back to the phone.
//
// Dependency-free on purpose: MCP over stdio is newline-delimited JSON-RPC,
// which is small enough to implement directly, and a tool meant to still work
// in a year shouldn't carry an SDK that needs upgrading to get there.

import path from 'node:path';
import { loadStore } from './lib/store.mjs';

const CACHE_DIR = path.join(import.meta.dirname, '..', '.roof-data');

const readStore = () => loadStore(CACHE_DIR);

function daysSince(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const then = new Date(y, m - 1, d);
  const now = new Date();
  return Math.round(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()) - then) / 864e5
  );
}

const workSets = (sets = []) => sets.filter((s) => !s.isWarmup);

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    name: 'get_supplements',
    description:
      'The supplement stack and the logged history: what each item is, the mechanism it works by, and for each day which doses were taken (with the time and how they were taken) or deliberately skipped. Use for questions about adherence, timing, interactions, or what a dose actually did.',
    inputSchema: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: 'How many recent days of log to include. Default 30.',
        },
      },
    },
  },
  {
    name: 'get_training',
    description:
      'Training history and current program state: pull-up and push-up sessions with target-vs-actual reps per set, the autoregulation state (cycle, week, load, streaks, volume tune), personal records, runs, and joint check-ins. Use for questions about whether the programming is working.',
    inputSchema: {
      type: 'object',
      properties: {
        sessions: {
          type: 'number',
          description: 'How many recent sessions per space to include. Default 20.',
        },
      },
    },
  },
  {
    name: 'get_raw_store',
    description:
      'The entire raw store as JSON, unsummarised. Use only when the shaped tools do not carry the field you need — it is large.',
    inputSchema: { type: 'object', properties: {} },
  },
];

function callTool(name, args) {
  const { store, source } = readStore();
  const meta = {
    storeWrittenAt: store.updatedAt,
    readFrom: source === 'icloud' ? 'iCloud (current)' : 'local cache (may be stale)',
  };

  if (name === 'get_raw_store') {
    return { ...meta, store };
  }

  if (name === 'get_supplements') {
    const limit = args?.days ?? 30;
    const items = (store.supItems ?? []).map((i) => ({
      id: i.id,
      name: i.name,
      slot: i.slot,
      mechanism: i.mech,
      kind: i.kind ?? null,
      active: i.active,
      remindAt: i.remindAt ?? null,
      whyItSitsHere: i.why ?? null,
      whatToNotice: i.notice ?? null,
    }));
    const byId = Object.fromEntries(items.map((i) => [i.id, i.name]));
    const days = (store.supDays ?? [])
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit)
      .map((d) => ({
        date: d.date,
        daysAgo: daysSince(d.date),
        taken: Object.entries(d.taken ?? {}).map(([id, at]) => ({
          item: byId[id] ?? id,
          at,
          howTaken: d.ctx?.[id] ?? null,
        })),
        skipped: Object.keys(d.skipped ?? {}).map((id) => byId[id] ?? id),
      }));
    return {
      ...meta,
      note:
        'howTaken is what the user answered at log time (empty stomach / with food / with fat). Null means they did not say — do not assume.',
      stack: items,
      log: days,
    };
  }

  if (name === 'get_training') {
    const n = args?.sessions ?? 20;
    const shape = (s) => ({
      date: s.date,
      daysAgo: daysSince(s.date),
      dayKind: s.dayKind,
      cycle: s.cycle,
      week: s.week,
      lastSetEffort: s.lastSetEffort ?? null,
      progressionExempt: !!s.progressionExempt,
      sets: workSets(s.sets).map((x) => ({
        target: x.targetReps,
        actual: x.actualReps,
        addedKg: x.loadKg || 0,
      })),
    });
    return {
      ...meta,
      profile: store.profile ?? null,
      pullups: {
        state: store.state ?? null,
        lifetimeReps: store.lifetimeReps ?? 0,
        sessions: (store.sessions ?? []).slice(-n).map(shape),
      },
      pushups: {
        state: store.pushState ?? null,
        lifetimeReps: store.pushLifetimeReps ?? 0,
        startingMax: store.pushStartingMax ?? null,
        sessions: (store.pushSessions ?? []).slice(-n).map(shape),
      },
      runs: (store.runs ?? [])
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, n)
        .map((r) => ({
          date: r.date,
          daysAgo: daysSince(r.date),
          km: r.distanceKm,
          minutes: Math.round(r.durationSec / 60),
          paceMinPerKm: r.distanceKm > 0 ? r.durationSec / 60 / r.distanceKm : null,
          source: r.source,
        })),
      personalRecords: store.prs ?? [],
      jointCheckins: store.jointLog ?? [],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
}

// ---------------------------------------------------------------------------
// JSON-RPC over stdio
// ---------------------------------------------------------------------------

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

function handle(req) {
  const { id, method, params } = req;

  // Notifications carry no id and expect no reply.
  if (id === undefined) return;

  try {
    if (method === 'initialize') {
      return send({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: params?.protocolVersion ?? '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'roof', version: '1.0.0' },
        },
      });
    }
    if (method === 'tools/list') {
      return send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    }
    if (method === 'tools/call') {
      const out = callTool(params?.name, params?.arguments ?? {});
      return send({
        jsonrpc: '2.0',
        id,
        result: { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] },
      });
    }
    if (method === 'ping') return send({ jsonrpc: '2.0', id, result: {} });

    send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
  } catch (err) {
    send({
      jsonrpc: '2.0',
      id,
      error: { code: -32603, message: err instanceof Error ? err.message : String(err) },
    });
  }
}

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let nl;
  while ((nl = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    try {
      handle(JSON.parse(line));
    } catch {
      // a malformed line is not worth killing the server over
    }
  }
});
