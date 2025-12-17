import express from 'express';
import {
    getAllQuizzes,
    getQuizById,
    submitQuiz,
    getUserQuizHistory
} from '../controllers/quiz.controller.js';

const router = express.Router();

// Public routes
router.get('/', getAllQuizzes);
router.get('/:id', getQuizById);

// Protected routes (add authentication middleware as needed)
router.post('/submit', submitQuiz);
router.get('/history/:userId', getUserQuizHistory);

export default router;