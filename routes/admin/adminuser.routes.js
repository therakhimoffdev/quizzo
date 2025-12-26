// routes/adminUsers.js
import express from 'express';
import {
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
    blockUser,
    updateUserCoins,
    getUserStats,
    getUserTasks,
    getUserGameStats,
    getLeaderboard,
    exportUsers,
    bulkUpdateUsers,
    getUserActivityStats
} from '../../controllers/admin/adminUser.controller.js';
import { adminAuth, adminRole } from '../../middleware/adminAuth.js';

const router = express.Router();

// Barcha route'lar admin autentifikatsiyasini talab qiladi
router.use(adminAuth);

// super_admin va admin uchun ochiq route'lar
router.get('/users', adminRole('admin', 'super_admin'), getAllUsers);
router.get('/users/export', adminRole('admin', 'super_admin'), exportUsers);
router.get('/leaderboard', adminRole('admin', 'super_admin'), getLeaderboard);
router.get('/stats/activity', adminRole('admin', 'super_admin'), getUserActivityStats);

// super_admin uchun maxsus route'lar
router.post('/users/bulk-update', adminRole('super_admin'), bulkUpdateUsers);
router.delete('/users/:userId', adminRole('super_admin'), deleteUser);

// Admin va super_admin uchun umumiy route'lar
router.get('/users/:userId', adminRole('admin', 'super_admin'), getUserById);
router.put('/users/:userId', adminRole('admin', 'super_admin'), updateUser);
router.put('/users/:userId/block', adminRole('admin', 'super_admin'), blockUser);
router.put('/users/:userId/coins', adminRole('admin', 'super_admin'), updateUserCoins);
router.get('/users/:userId/stats', adminRole('admin', 'super_admin'), getUserStats);
router.get('/users/:userId/tasks', adminRole('admin', 'super_admin'), getUserTasks);
router.get('/users/:userId/game-stats', adminRole('admin', 'super_admin'), getUserGameStats);

export default router;