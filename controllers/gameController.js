const { listGames, getGame, getScreenshots, getGenres } = require('../utils/rawg');
const { AppError, asyncHandler, sendSuccess } = require('../utils/apiResponse');

const MAX_PAGES = 100;
const ORDERINGS = ['-added', '-rating', '-released', 'name', '-metacritic', 'released'];

const isoDate = (d) => d.toISOString().slice(0, 10);

exports.getGames = asyncHandler(async (req, res) => {
  const { search, genres, type } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(40, Math.max(1, parseInt(req.query.pageSize, 10) || 16));
  let ordering = ORDERINGS.includes(req.query.ordering) ? req.query.ordering : undefined;
  let dates;

  if (type === 'latest') {
    const now = new Date();
    const from = new Date(now);
    from.setFullYear(now.getFullYear() - 1);
    dates = `${isoDate(from)},${isoDate(now)}`;
    ordering = '-released';
  } else if (type === 'popular') {
    ordering = '-added';
  }

  let data;
  try {
    data = await listGames({ page, pageSize, search: search && String(search).slice(0, 80), ordering, genres, dates });
  } catch (e) {
    throw new AppError('Unable to load games right now. Please try again.', 502);
  }

  const totalPages = Math.min(MAX_PAGES, Math.ceil(data.count / pageSize));
  sendSuccess(res, { games: data.results, pagination: { page, pageSize, total: data.count, totalPages } });
});

exports.getGame = asyncHandler(async (req, res) => {
  try {
    const [game, shots] = await Promise.all([getGame(req.params.id), getScreenshots(req.params.id).catch(() => [])]);
    sendSuccess(res, { game: { ...game, screenshots: shots } });
  } catch (e) {
    throw new AppError(e.statusCode === 404 ? 'Game not found' : 'Unable to load this game right now', e.statusCode === 404 ? 404 : 502);
  }
});

exports.getGenres = asyncHandler(async (_req, res) => {
  try {
    sendSuccess(res, { genres: await getGenres() });
  } catch {
    sendSuccess(res, { genres: [] });
  }
});
