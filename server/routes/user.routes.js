import express from 'express';
import User from '../models/User.js';

const router = express.Router();

// Telegram auto-login va auto-register (agar foydalanuvchi mavjud bo'lmasa yaratiladi)
router.post('/login', async (req, res) => {
    const { telegram_id, first_name, username, photo_url } = req.body;

    if (!telegram_id) return res.status(400).json({ error: 'Telegram ID required' });

    try {
        let user = await User.findOne({ telegram_id });
        if (!user) {
            user = await User.create({ telegram_id, first_name, username, photo_url });
        }
        return res.json({ success: true, user });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
    }
});

export default router;