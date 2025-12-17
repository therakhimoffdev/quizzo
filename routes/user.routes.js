import express from 'express';
import {
    getUserByTelegramId,
    updateUserCoins,
    getLeaderboard
} from '../controllers/user.controller.js';

const router = express.Router();

router.get('/telegram/:telegramId', getUserByTelegramId);
router.put('/:userId/coins', updateUserCoins);
router.get('/leaderboard', getLeaderboard);

export default router;