import Rank from '../models/rank.model';

/**
 * Get Rank
 * @returns {Rank}
 */
function getRanks(req, res, next) {
  Rank.getRanks({ playerId: req.query.playerId, limit: req.query.limit, format: req.query.format })
    .then(ranks => res.json(ranks))
    .catch(e => next(e));
}

export default { getRanks };
