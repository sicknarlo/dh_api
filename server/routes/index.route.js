import express from 'express';
import userRoutes from './user.route';
import authRoutes from './auth.route';
import playerRoutes from './player.route';
import rankRoutes from './rank.route';

const router = express.Router(); // eslint-disable-line new-cap

/** GET /health-check - Check service health */
router.get('/health-check', (req, res) => res.send('OK'));

// mount user routes at /users
router.use('/users', userRoutes);

// mount auth routes at /auth
router.use('/auth', authRoutes);

// mount player routes at /player
router.use('/player', playerRoutes);

// mount rank routes at /rank
router.use('/rank', rankRoutes);

export default router;
