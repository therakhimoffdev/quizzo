import express from 'express';
import {
    getLevelMap,
    claimLevelReward,
    addXP,
    getActInfo,
    updateLevelProgress,
    getLevelDetails
} from '../controllers/level.controller.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// Auth middleware bilan barcha route'lar
router.use(auth);

// Level map ma'lumotlari
router.get('/map', getLevelMap);

// Level sovrinlarini olish
router.post('/:level/claim', claimLevelReward);

// XP qo'shish
router.post('/xp/add', addXP);

// ACT ma'lumotlari
router.get('/act/:actId', getActInfo);

// Level batafsil ma'lumotlari
router.get('/:level/details', getLevelDetails);

// Admin route'lari
router.post('/admin/update-progress', updateLevelProgress);

export default router;