import Player from '../models/player.model';

/**
 * Load player and append to req.
 */
function load(req, res, next, id) {
  Player.get(id)
    .then((player) => {
      req.player = player; // eslint-disable-line no-param-reassign
      return next();
    })
    .catch(e => next(e));
}

/**
 * Get player
 * @returns {Player}
 */
function get(req, res) {
  return res.json(req.player);
}

/**
 * Get index of players based on passed params
 * @returns{Player[]}
 */
function index(req, res, next) {
  return Player.index(req.query)
    .then(players => res.json(players))
    .catch(e => next(e));
}

/**
 * Get player list.
 * @property {number} req.query.skip - Number of players to be skipped.
 * @property {number} req.query.limit - Limit number of players to be returned.
 * @returns {Player[]}
 */
function list(req, res, next) {
  const { limit = 50, skip = 0 } = req.query;
  Player.list({ limit, skip })
    .then(players => res.json(players))
    .catch(e => next(e));
}


export default { load, get, list, index };
