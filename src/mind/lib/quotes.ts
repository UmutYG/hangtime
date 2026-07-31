import { Lang } from "./i18n";
import { citations } from "./citations";
import { dateKey } from "./dates";

// A daily lens: one line a day that flips the negativity bias — from the
// Stoics, from writers who saw the same thing, and from the book itself.
// Attributions are kept honest; nothing is put in a mouth it didn't come from.
export type Quote = { tr: string; en: string; source: string };

const CURATED: Quote[] = [
  {
    tr: "Bana ilişkin hiçbir alamet uğursuz değildir — ben istersem, karga bile hayra işaret eder.",
    en: "No omen concerns me — if I choose, even the raven croaks in my favor.",
    source: "Epiktetos",
  },
  {
    tr: "İnsanları sarsan olaylar değil, olaylara dair yargılarıdır.",
    en: "People are disturbed not by things, but by their judgments about things.",
    source: "Epiktetos",
  },
  {
    tr: "Hayatımız, düşüncelerimizin onu yaptığı şeydir.",
    en: "Our life is what our thoughts make it.",
    source: "Marcus Aurelius",
  },
  {
    tr: "Yolun üstünde duran şey, yolun kendisi olur.",
    en: "What stands in the way becomes the way.",
    source: "Marcus Aurelius",
  },
  {
    tr: "Gerçekte olduğundan çok, hayalimizde acı çekeriz.",
    en: "We suffer more often in imagination than in reality.",
    source: "Seneca",
  },
  {
    tr: "Şeyleri oldukları gibi değil, olduğumuz gibi görürüz.",
    en: "We don't see things as they are; we see them as we are.",
    source: "Anaïs Nin",
  },
  {
    tr: "Baktığın şeylere bakışını değiştir; baktığın şeyler değişir.",
    en: "Change the way you look at things, and the things you look at change.",
    source: "Wayne Dyer",
  },
  {
    tr: "Kuşağımızın en büyük keşfi, insanın zihnini değiştirerek hayatını değiştirebilmesidir.",
    en: "The greatest discovery of my generation is that human beings can alter their lives by altering their attitudes of mind.",
    source: "William James",
  },
  {
    tr: "Gerçek keşif yolculuğu yeni manzaralar aramak değil, yeni gözlere sahip olmaktır.",
    en: "The real voyage of discovery consists not in seeking new landscapes, but in having new eyes.",
    source: "Marcel Proust",
  },
];

// The book's own verified lines join the pool, labeled simply "Kitap" — the
// same quiet label the rest of the app uses.
const POOL: Quote[] = [
  ...CURATED,
  ...citations.map((c) => ({ tr: c.tr, en: c.en, source: "Kitap" })),
];

function hashDate(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// One quote per day, deterministic — everyone's "today" holds still all day,
// and tomorrow brings a different lens.
export function dailyQuote(lang: Lang, date = dateKey()): { text: string; source: string } {
  const q = POOL[hashDate(date) % POOL.length];
  return { text: lang === "tr" ? q.tr : q.en, source: q.source };
}
