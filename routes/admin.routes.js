import express from 'express';
import {
    adminLogin,
    adminLogout,
    getAdminProfile,
    createAdmin
} from '../controllers/admin.controller.js';
import { adminAuth, adminRole } from '../middleware/adminAuth.js';

const router = express.Router();

// Public routes
router.post('/login', adminLogin);

// Protected routes
router.post('/logout', adminAuth, adminLogout);
router.get('/profile', adminAuth, getAdminProfile);

// Admin management (faqat super_admin uchun)
router.post('/create', adminAuth, adminRole('super_admin'), createAdmin);

export default router;