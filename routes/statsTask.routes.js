import express from 'express';
import {
    checkStatBasedTasks,
    getUserStatTasks,
    claimStatTaskReward
} from '../controllers/statsTask.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(protect);

// Stat-based task routes
router.get('/stats/check', checkStatBasedTasks);
router.get('/stats/tasks', getUserStatTasks);
router.post('/stats/:id/claim', claimStatTaskReward);

export default router;