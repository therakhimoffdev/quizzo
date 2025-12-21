import crypto from 'crypto';
import User from '../models/User.js';

// Telegram WebApp validation funksiyasi
const validateTelegramInitData = (initData) => {
    try {
        // Telegram bot tokenini environmentdan olish
        const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

        if (!BOT_TOKEN) {
            console.warn('TELEGRAM_BOT_TOKEN topilmadi, validation o\'tkazilmaydi');
            return true; // Development uchun o'tkazib yuborish
        }

        // InitData ni parse qilish
        const params = new URLSearchParams(initData);
        const hash = params.get('hash');
        params.delete('hash');

        // Data-check-string yaratish
        const dataCheckArr = [];
        for (const [key, value] of params.entries()) {
            dataCheckArr.push(`${key}=${value}`);
        }
        dataCheckArr.sort();
        const dataCheckString = dataCheckArr.join('\n');

        // Secret keyni yaratish
        const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();

        // Hashni tekshirish
        const calculatedHash = crypto
            .createHmac('sha256', secretKey)
            .update(dataCheckString)
            .digest('hex');

        return calculatedHash === hash;
    } catch (error) {
        console.error('Telegram validation error:', error);
        return false;
    }
};

// Telegram orqali authentication
export const telegramAuth = async (req, res, next) => {
    try {
        const initData = req.headers['telegram-init-data'];

        // Development rejimi uchun avtomatik ruxsat berish
        if (process.env.NODE_ENV === 'development' && !initData) {
            req.user = await User.findOne({ telegram_id: 'dev_user' }) ||
                await User.create({
                    telegram_id: 'dev_user',
                    first_name: 'Development',
                    username: 'dev',
                    coins: 1000,
                    level: 5
                });
            return next();
        }

        if (!initData) {
            return res.status(401).json({
                success: false,
                message: 'Telegram init data required'
            });
        }

        // Telegram initData ni tekshirish (agar BOT_TOKEN bo'lsa)
        if (process.env.TELEGRAM_BOT_TOKEN) {
            const isValid = validateTelegramInitData(initData);
            if (!isValid) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid Telegram init data'
                });
            }
        }

        // User ma'lumotlarini olish
        const params = new URLSearchParams(initData);
        const userData = JSON.parse(params.get('user') || '{}');

        if (!userData.id) {
            return res.status(401).json({
                success: false,
                message: 'Invalid Telegram user data'
            });
        }

        // Find or create user
        let user = await User.findOne({ telegram_id: userData.id.toString() });

        if (!user) {
            user = await User.create({
                telegram_id: userData.id.toString(),
                first_name: userData.first_name || '',
                username: userData.username || '',
                photo_url: userData.photo_url || '',
                coins: 100, // Boshlang'ich coin
                level: 1,
                xp: 0
            });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Telegram auth error:', error);
        res.status(401).json({
            success: false,
            message: 'Telegram authentication failed'
        });
    }
};

// Protect middleware (telegramAuth bilan bir xil)
export const protect = telegramAuth;

// Ruxsat berilgan routelar (auth talab qilmaydigan)
export const publicRoutes = (req, res, next) => {
    const publicPaths = ['/api/auth/telegram', '/api/health', '/api/test'];

    if (publicPaths.includes(req.path)) {
        return next();
    }

    telegramAuth(req, res, next);
};

// Admin middleware
export const adminOnly = (req, res, next) => {
    if (req.user && req.user.isAdmin) {
        next();
    } else {
        res.status(403).json({
            success: false,
            message: 'Admin huquqi talab qilinadi'
        });
    }
};