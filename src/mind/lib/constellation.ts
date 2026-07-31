// A tiny deterministic PRNG (mulberry32) seeded from a string hash — the same
// vision always lights up the same "sector of the alternatives space" (its
// own constellation), never a random one.
function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type ConstellationPoint = {
  x: number;
  y: number;
  r: number;
  duration: number;
  delay: number;
};
export type Constellation = {
  points: ConstellationPoint[];
  edges: [number, number][];
};

// Scatter `count` points across a width x height field, plus a couple of
// edges between points that happen to land near each other — no meaning
// beyond "this vision's own pattern in the sky."
export function generateConstellation(
  seed: string,
  width: number,
  height: number,
  count = 7
): Constellation {
  const rand = mulberry32(hashSeed(seed));
  // Dot radius scales with the field itself, so the same pattern reads right
  // whether it's filling a full screen or a small in-context card.
  const minDim = Math.min(width, height);
  const points: ConstellationPoint[] = Array.from({ length: count }, () => ({
    x: 0.12 * width + rand() * 0.76 * width,
    y: 0.1 * height + rand() * 0.8 * height,
    r: minDim * (0.0036 + rand() * 0.0056),
    duration: 2800 + rand() * 2400,
    delay: rand() * 2200,
  }));

  const edges: [number, number][] = [];
  const maxDist = Math.min(width, height) * 0.28;
  for (let i = 0; i < points.length && edges.length < 3; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[i].x - points[j].x;
      const dy = points[i].y - points[j].y;
      if (Math.hypot(dx, dy) < maxDist) {
        edges.push([i, j]);
        break;
      }
    }
  }

  return { points, edges };
}
