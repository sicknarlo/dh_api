import express from 'express';
import playerCtrl from '../controllers/player.controller';

const router = express.Router(); // eslint-disable-line new-cap

router.route('/')
  /** GET /api/players - Get list of players */
  .get(playerCtrl.index);

router.route('/:playerId')
  /** GET /api/players/:playerId - Get player */
  .get(playerCtrl.get);

/** Load player when API with playerId route parameter is hit */
router.param('playerId', playerCtrl.load);

export default router;
