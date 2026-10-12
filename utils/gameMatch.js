/**
 * Pure helpers for the games feature (no database needed):
 *  - pcOnly:     keep just the PC platform (no Xbox, PlayStation, Switch ...)
 *  - normKey:    normalises a game title so "A Plague Tale: Requiem (2022)" == "a plague tale requiem"
 *  - pickBest:   chooses the right catalogue result for a title taken from an uploaded file
 *  - mapLimit:   runs async work with a small concurrency limit
 */

/** The store sells PC games only, so only the "PC" platform is kept / shown. */
const pcOnly = () => ['PC'];

const normKey = (s = '') =>
  String(s)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // accents
    .toLowerCase()
    .replace(/\(\s*\d{4}\s*\)/g, ' ') // "(2016)"
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const tokens = (s) => new Set(normKey(s).split(' ').filter(Boolean));

/** 0..1 — how close two titles are. */
const similarity = (a, b) => {
  const ka = normKey(a), kb = normKey(b);
  if (!ka || !kb) return 0;
  if (ka === kb) return 1;
  const ta = tokens(a), tb = tokens(b);
  let inter = 0;
  ta.forEach((t) => { if (tb.has(t)) inter += 1; });
  return inter / Math.max(ta.size, tb.size);
};

const NUMERAL = /^(\d+|i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii|xiii|xiv|xv|xvi|xvii|xviii|xix|xx)$/;

/**
 * Sequels must not be confused: "FC 27" is not "FC 25", "Empires II" is not "Empires III".
 * A number/roman numeral in the candidate must also be in the query. A number in the query must
 * be in the candidate too (a stray trailing "1" is tolerated).
 */
const numeralsOk = (query, candidate) => {
  const tq = tokens(query), tc = tokens(candidate);
  for (const t of tc) if (NUMERAL.test(t) && !tq.has(t)) return false;
  for (const t of tq) if (NUMERAL.test(t) && !tc.has(t) && t !== '1') return false;
  return true;
};

/**
 * Picks the best candidate for `name` from catalogue results (each has { name, ratingsCount }).
 * Short titles (1-2 words) must match exactly, longer titles need a 60% word overlap.
 * Returns null when nothing is close enough (so a wrong game is never added by accident).
 */
const pickBest = (name, candidates = []) => {
  let best = null;
  for (const c of candidates) {
    if (!numeralsOk(name, c.name)) continue;
    const score = similarity(name, c.name);
    const need = Math.min(tokens(name).size, tokens(c.name).size) <= 2 ? 0.99 : 0.6;
    if (score < need) continue;
    if (!best || score > best.score || (score === best.score && (c.ratingsCount || 0) > (best.c.ratingsCount || 0))) best = { c, score };
  }
  return best ? best.c : null;
};

const mapLimit = async (items, limit, fn) => {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx], idx);
      }
    })
  );
  return out;
};

module.exports = { pcOnly, normKey, similarity, pickBest, mapLimit, numeralsOk };
