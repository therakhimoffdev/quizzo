import express from 'express';
import User from '../models/User.js';

const router = express.Router();

router.post('/login', async (req, res) => {
    try {
        const {
            telegram_id,
            first_name,
            username,
            photo_url
        } = req.body;

        if (!telegram_id) {
            return res.status(400).json({
                success: false,
                message: 'Telegram ID required'
            });
        }

        let user = await User.findOne({ telegram_id });

        if (!user) {
            user = await User.create({
                telegram_id,
                first_name: first_name || '',
                username: username || '',
                photo_url: photo_url || '',
                coins: 100,
                level: 1,
                xp: 0,
                rating: 1000,
                premium: false
            });
        }

        return res.json({
            success: true,
            user
        });

    } catch (error) {
        console.error('LOGIN ERROR:', error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

export default router;
