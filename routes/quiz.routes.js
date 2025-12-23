import express from 'express';
import {
    getAllQuizzes,
    getQuizById,
    submitQuiz,
    getUserQuizHistory,
    getCompletedQuizzes,
    createQuiz,       // Yangi qo'shildi
    getMyQuizzes,      // Yangi qo'shildi
    deleteQuiz
} from '../controllers/quiz.controller.js';
import { adminAuth, adminRole } from '../middleware/adminAuth.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public routes
router.get('/', getAllQuizzes);
router.get('/completed', getCompletedQuizzes);
router.get('/:id', getQuizById);

// Protected routes
router.post('/submit', protect, submitQuiz);
router.get('/history/:userId', protect, getUserQuizHistory);

// Admin routes (faqat adminlar uchun)
router.post('/create', adminAuth, adminRole('admin', 'super_admin'), createQuiz);
router.get('/my-quizzes', adminAuth, adminRole('admin', 'super_admin'), getMyQuizzes);
router.delete('/:id', adminAuth, adminRole('admin', 'super_admin'), deleteQuiz);


export default router;