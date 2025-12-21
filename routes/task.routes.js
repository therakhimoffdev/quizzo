import express from 'express';
import {
    getTasks,
    getTaskById,
    startTask,
    updateTaskProgress,
    completeTask,
    getUserTaskStats,
    getDailyTasks,
    resetDailyTasks,
    verifyTaskCompletion,
    getTasksLeaderboard
} from '../controllers/task.controller.js';
import { protect, adminOnly } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public routes (if any)

// Protected routes (require authentication)
router.use(protect);

// Task operations
router.get('/', getTasks);
router.get('/stats', getUserTaskStats);
router.get('/daily', getDailyTasks);
router.get('/leaderboard', getTasksLeaderboard);
router.get('/:id', getTaskById);
router.post('/:id/start', startTask);
router.put('/:id/progress', updateTaskProgress);
router.post('/:id/complete', completeTask);

// Admin routes
router.use(adminOnly);
router.post('/reset-daily', resetDailyTasks);
router.post('/verify/:userTaskId', verifyTaskCompletion);

export default router;