/**
 * RAWG games API client (server-side so the API key never reaches the browser).
 * Includes a small in-memory cache to keep the site fast and save API quota.
 */
const GAME_PRICE = () => Number(process.env.GAME_PRICE) || 250;
const TTL = 5 * 60 * 1000;
const cache = new Map();

const rawgFetch = async (path, params = {}) => {
  const base = (process.env.GAMES_API_URL || 'https://api.rawg.io/api').replace(/\/$/, '');
  const url = new URL(`${base}${path}`);
  url.searchParams.set('key', process.env.GAMES_API_KEY || '');
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });

  const key = url.toString();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < TTL) return hit.data;

  const res = await fetch(key, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) {
    const err = new Error(`Games API responded with ${res.status}`);
    err.statusCode = res.status === 404 ? 404 : 502;
    throw err;
  }
  const data = await res.json();
  if (cache.size > 300) cache.delete(cache.keys().next().value);
  cache.set(key, { t: Date.now(), data });
  return data;
};

/** Normalizes a RAWG game to the shape the frontend/cart/orders use. */
const normalizeGame = (g) => ({
  id: String(g.id),
  name: g.name,
  slug: g.slug,
  image: g.background_image || null,
  rating: g.rating || 0,
  ratingsCount: g.ratings_count || 0,
  metacritic: g.metacritic || null,
  released: g.released || null,
  platforms: (g.platforms || []).map((p) => p.platform?.name).filter(Boolean),
  genres: (g.genres || []).map((x) => x.name),
  price: GAME_PRICE(),
});

const platformParam = () => process.env.GAMES_PLATFORMS || '4';

const listGames = async ({ page = 1, pageSize = 16, search, ordering, genres, dates } = {}) => {
  const data = await rawgFetch('/games', {
    platforms: platformParam(),
    page,
    page_size: pageSize,
    search,
    search_precise: search ? 'true' : undefined,
    ordering,
    genres,
    dates,
  });
  return { count: data.count || 0, results: (data.results || []).map(normalizeGame) };
};

const getGame = async (id) => {
  const g = await rawgFetch(`/games/${encodeURIComponent(id)}`);
  return {
    ...normalizeGame(g),
    description: g.description_raw || '',
    website: g.website || '',
    developers: (g.developers || []).map((d) => d.name),
    publishers: (g.publishers || []).map((d) => d.name),
    esrb: g.esrb_rating?.name || null,
    backgroundAdditional: g.background_image_additional || null,
    tags: (g.tags || []).slice(0, 8).map((t) => t.name),
  };
};

const getScreenshots = async (id) => {
  const data = await rawgFetch(`/games/${encodeURIComponent(id)}/screenshots`, { page_size: 6 });
  return (data.results || []).map((s) => s.image);
};

const getGenres = async () => {
  const data = await rawgFetch('/genres');
  return (data.results || []).map((g) => ({ id: g.id, name: g.name, slug: g.slug }));
};

module.exports = { listGames, getGame, getScreenshots, getGenres, GAME_PRICE };
