import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
    try {
        let token;

        // Check for token in Authorization header
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        // Check for Telegram WebApp initData
        else if (req.headers['telegram-init-data']) {
            const initData = new URLSearchParams(req.headers['telegram-init-data']);
            const userData = JSON.parse(initData.get('user') || '{}');

            if (userData.id) {
                // Find or create user from Telegram data
                let user = await User.findOne({ telegram_id: userData.id.toString() });

                if (!user) {
                    user = await User.create({
                        telegram_id: userData.id.toString(),
                        first_name: userData.first_name || '',
                        username: userData.username || '',
                        photo_url: userData.photo_url || ''
                    });
                }

                req.user = user;
                return next();
            }
        }

        // Check for token in cookies
        else if (req.cookies?.token) {
            token = req.cookies.token;
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized, no token provided'
            });
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id).select('-password');

        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(401).json({
            success: false,
            message: 'Not authorized'
        });
    }
};

export const adminOnly = (req, res, next) => {
    if (req.user && req.user.isAdmin) {
        next();
    } else {
        res.status(403).json({
            success: false,
            message: 'Access denied, admin only'
        });
    }
};

export const telegramAuth = async (req, res, next) => {
    try {
        const initData = req.headers['telegram-init-data'];

        if (!initData) {
            return res.status(401).json({
                success: false,
                message: 'Telegram init data required'
            });
        }

        // Parse initData
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
                photo_url: userData.photo_url || ''
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