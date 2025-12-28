import express from 'express';
import {
    getTasks,
    completeTask
} from '../controllers/task.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// Foydalanuvchi tasklarni ko‘rishi
router.get('/', protect, getTasks);

// Taskni bajarib tekshirish
router.post('/:id/complete', protect, completeTask);

export default router;
