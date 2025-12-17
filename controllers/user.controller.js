import User from '../models/User.js';

// Get user by Telegram ID
export const getUserByTelegramId = async (req, res) => {
    try {
        const { telegramId } = req.params;

        let user = await User.findOne({ telegram_id: telegramId });

        if (!user) {
            // Create new user if not exists
            user = new User({
                telegram_id: telegramId,
                first_name: req.body.first_name || '',
                username: req.body.username || '',
                photo_url: req.body.photo_url || '',
                coins: 100
            });
            await user.save();
        }

        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Update user coins
export const updateUserCoins = async (req, res) => {
    try {
        const { userId } = req.params;
        const { coins, action } = req.body; // action: 'add', 'subtract'

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (action === 'add') {
            user.coins += coins;
        } else if (action === 'subtract') {
            if (user.coins < coins) {
                return res.status(400).json({
                    success: false,
                    message: 'Insufficient coins'
                });
            }
            user.coins -= coins;
        }

        await user.save();

        res.json({
            success: true,
            data: {
                coins: user.coins
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Get leaderboard
export const getLeaderboard = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;

        const leaderboard = await User.find()
            .select('first_name username photo_url level xp coins rating')
            .sort({ xp: -1 })
            .limit(limit)
            .lean();

        res.json({
            success: true,
            data: leaderboard
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};