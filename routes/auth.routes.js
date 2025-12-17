import express from 'express';
import connectDB from '../lib/db.js';
import User from '../models/User.js';

const router = express.Router();

// Telegram auto-login / auto-register
router.post('/login', async (req, res) => {
    const { telegram_id, first_name, username, photo_url } = req.body;

    if (!telegram_id) {
        return res.status(400).json({ error: 'Telegram ID required' });
    }

    try {
        await connectDB(); // har safar connection tayyor bo‘lishi

        let user = await User.findOne({ telegram_id });

        if (!user) {
            user = await User.create({
                telegram_id,
                first_name,
                username,
                photo_url,
                coins: 100, // boshlang‘ich bonus
                level: 1,
                xp: 0,
                rating: 1000,
            });
        }

        return res.json({
            success: true,
            user, // frontend uchun barcha qiymatlar
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
    }
});

export default router;
