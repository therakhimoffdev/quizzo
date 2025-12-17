// routes/quizRoutes.js
import express from 'express';
import {
    getAllQuizzes,
    getQuizById,
    submitQuiz,
    getUserQuizHistory,
    getCompletedQuizzes  // Add this
} from '../controllers/quiz.controller.js';

const router = express.Router();

// Public routes
router.get('/', getAllQuizzes);
router.get('/completed', getCompletedQuizzes);  // New route
router.get('/:id', getQuizById);

// Protected routes
router.post('/submit', submitQuiz);
router.get('/history/:userId', getUserQuizHistory);

export default router;