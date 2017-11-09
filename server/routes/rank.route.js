import express from 'express';
import rankCtrl from '../controllers/rank.controller';

const router = express.Router(); // eslint-disable-line new-cap

router
  .route('/')
  /** GET /api/rank */
  .get(rankCtrl.getRanks);

export default router;
