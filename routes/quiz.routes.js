import express from 'express';
import {
    getAllQuizzes,
    getQuizById,
    submitQuiz,
    getUserQuizHistory,
    getCompletedQuizzes,
    createQuiz,
    getMyQuizzes,
    deleteQuiz
} from '../controllers/quiz.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { adminAuth } from '../middleware/adminAuth.js';

const router = express.Router();

// Public routes - hammaga ochiq
router.get('/', getAllQuizzes);
router.get('/completed', getCompletedQuizzes);

// Protected routes - faqat tizimga kirganlar uchun
router.get('/:id', protect, getQuizById);
router.post('/submit', protect, submitQuiz);
router.get('/history/:userId', protect, getUserQuizHistory);

// Admin routes - faqat adminlar uchun
router.post('/create', adminAuth, createQuiz);
router.get('/my-quizzes', adminAuth, getMyQuizzes);
router.delete('/:id', adminAuth, deleteQuiz);

export default router;