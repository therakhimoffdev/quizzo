// controllers/adminUserController.js
import User from '../../models/User.js';
import UserStat from '../../models/UserStat.js';
import UserTask from '../../models/UserTask.js';
import mongoose from 'mongoose';

// 1. Barcha foydalanuvchilarni olish (pagination va search bilan)
export const getAllUsers = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            search = '',
            sortBy = 'createdAt',
            sortOrder = 'desc',
            status,
            is_premium
        } = req.query;

        const skip = (page - 1) * limit;
        const sortDirection = sortOrder === 'desc' ? -1 : 1;

        // Filter object
        let filter = {};

        // Search filter
        if (search) {
            filter.$or = [
                { first_name: { $regex: search, $options: 'i' } },
                { username: { $regex: search, $options: 'i' } },
                { telegram_id: { $regex: search, $options: 'i' } }
            ];
        }

        // Status filter
        if (status === 'active') {
            filter.is_blocked = false;
        } else if (status === 'blocked') {
            filter.is_blocked = true;
        }

        // Premium filter
        if (is_premium === 'true') {
            filter.is_premium = true;
        } else if (is_premium === 'false') {
            filter.is_premium = false;
        }

        // Get users with pagination
        const users = await User.find(filter)
            .sort({ [sortBy]: sortDirection })
            .skip(skip)
            .limit(parseInt(limit))
            .select('-__v')
            .lean();

        // Get total count for pagination
        const total = await User.countDocuments(filter);

        // Get some stats for dashboard
        const stats = {
            total: await User.countDocuments(),
            active: await User.countDocuments({ is_blocked: false }),
            blocked: await User.countDocuments({ is_blocked: true }),
            premium: await User.countDocuments({ is_premium: true }),
            today: await User.countDocuments({
                createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
            })
        };

        res.json({
            success: true,
            data: {
                users,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / limit),
                    totalUsers: total,
                    usersPerPage: parseInt(limit)
                },
                stats
            }
        });
    } catch (error) {
        console.error('Get all users error:', error);
        res.status(500).json({
            success: false,
            message: 'Foydalanuvchilarni olishda xatolik',
            error: error.message
        });
    }
};

// 2. Bitta foydalanuvchini ID bo'yicha olish
export const getUserById = async (req, res) => {
    try {
        const { userId } = req.params;

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Noto\'g\'ri foydalanuvchi ID formati'
            });
        }

        const user = await User.findById(userId).select('-__v').lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Foydalanuvchi topilmadi'
            });
        }

        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Get user by id error:', error);
        res.status(500).json({
            success: false,
            message: 'Foydalanuvchi ma\'lumotlarini olishda xatolik',
            error: error.message
        });
    }
};

// 3. Foydalanuvchi ma'lumotlarini yangilash
export const updateUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const updateData = req.body;

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Noto\'g\'ri foydalanuvchi ID formati'
            });
        }

        // Allowed fields for update
        const allowedUpdates = [
            'first_name',
            'username',
            'photo_url',
            'level',
            'xp',
            'coins',
            'total_games',
            'wins',
            'loses',
            'correct_answers',
            'wrong_answers',
            'rating',
            'is_premium',
            'is_blocked'
        ];

        // Filter out non-allowed fields
        const filteredUpdate = {};
        Object.keys(updateData).forEach(key => {
            if (allowedUpdates.includes(key)) {
                filteredUpdate[key] = updateData[key];
            }
        });

        const user = await User.findByIdAndUpdate(
            userId,
            { $set: filteredUpdate },
            { new: true, runValidators: true }
        ).select('-__v');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Foydalanuvchi topilmadi'
            });
        }

        res.json({
            success: true,
            message: 'Foydalanuvchi ma\'lumotlari muvaffaqiyatli yangilandi',
            data: user
        });
    } catch (error) {
        console.error('Update user error:', error);

        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({
                success: false,
                message: 'Validatsiya xatosi',
                errors: messages
            });
        }

        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Bu Telegram ID yoki username allaqachon mavjud'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Foydalanuvchi ma\'lumotlarini yangilashda xatolik',
            error: error.message
        });
    }
};

// 4. Foydalanuvchini bloklash/blokdan chiqarish
export const blockUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { is_blocked, reason } = req.body;

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Noto\'g\'ri foydalanuvchi ID formati'
            });
        }

        if (typeof is_blocked !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'is_blocked qiymati boolean turida bo\'lishi kerak'
            });
        }

        const user = await User.findByIdAndUpdate(
            userId,
            {
                $set: {
                    is_blocked,
                    blocked_reason: reason || '',
                    blocked_at: is_blocked ? new Date() : null
                }
            },
            { new: true }
        ).select('-__v');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Foydalanuvchi topilmadi'
            });
        }

        res.json({
            success: true,
            message: is_blocked
                ? 'Foydalanuvchi muvaffaqiyatli bloklandi'
                : 'Foydalanuvchi blokdan muvaffaqiyatli chiqarildi',
            data: user
        });
    } catch (error) {
        console.error('Block user error:', error);
        res.status(500).json({
            success: false,
            message: 'Foydalanuvchini bloklashda xatolik',
            error: error.message
        });
    }
};

// 5. Foydalanuvchi coinlarini boshqarish
export const updateUserCoins = async (req, res) => {
    try {
        const { userId } = req.params;
        const { amount, action, reason } = req.body;

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Noto\'g\'ri foydalanuvchi ID formati'
            });
        }

        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Miqdor noto\'g\'ri kiritilgan'
            });
        }

        if (!['add', 'subtract', 'set'].includes(action)) {
            return res.status(400).json({
                success: false,
                message: 'Amal noto\'g\'ri. Qabul qilinadigan amallar: add, subtract, set'
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Foydalanuvchi topilmadi'
            });
        }

        let newCoins = user.coins;
        const coinAmount = parseInt(amount);

        switch (action) {
            case 'add':
                newCoins += coinAmount;
                break;
            case 'subtract':
                if (user.coins < coinAmount) {
                    return res.status(400).json({
                        success: false,
                        message: 'Foydalanuvchida yetarli coin mavjud emas',
                        currentCoins: user.coins
                    });
                }
                newCoins -= coinAmount;
                break;
            case 'set':
                newCoins = coinAmount;
                break;
        }

        // Update user coins
        user.coins = newCoins;
        await user.save();

        // Log the transaction
        const transaction = {
            type: action,
            amount: coinAmount,
            reason: reason || 'Admin tomonidan boshqarildi',
            admin: req.admin?._id,
            previousBalance: user.coins,
            newBalance: newCoins,
            timestamp: new Date()
        };

        // You might want to save this to a separate transactions collection
        // For now, we'll just include it in response

        res.json({
            success: true,
            message: `Coinlar muvaffaqiyatli ${action === 'add' ? 'qo\'shildi' : action === 'subtract' ? 'ayirildi' : 'o\'rnatildi'}`,
            data: {
                userId: user._id,
                previousCoins: user.coins,
                newCoins,
                transaction
            }
        });
    } catch (error) {
        console.error('Update user coins error:', error);
        res.status(500).json({
            success: false,
            message: 'Coinlarni yangilashda xatolik',
            error: error.message
        });
    }
};

// 6. Foydalanuvchi statistikasini olish
export const getUserStats = async (req, res) => {
    try {
        const { userId } = req.params;

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Noto\'g\'ri foydalanuvchi ID formati'
            });
        }

        const userExists = await User.findById(userId);
        if (!userExists) {
            return res.status(404).json({
                success: false,
                message: 'Foydalanuvchi topilmadi'
            });
        }

        const stats = await UserStat.findOne({ user: userId }).populate('user', 'first_name username photo_url');

        if (!stats) {
            // Create initial stats if not exists
            const newStats = new UserStat({
                user: userId,
                dailyStats: {
                    date: new Date(),
                    tasksCompleted: 0,
                    coinsEarned: 0,
                    streak: 0
                }
            });
            await newStats.save();

            return res.json({
                success: true,
                data: newStats
            });
        }

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Get user stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Statistika ma\'lumotlarini olishda xatolik',
            error: error.message
        });
    }
};

// 7. Foydalanuvchi vazifalarini olish
export const getUserTasks = async (req, res) => {
    try {
        const { userId } = req.params;
        const {
            status,
            page = 1,
            limit = 10,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Noto\'g\'ri foydalanuvchi ID formati'
            });
        }

        const skip = (page - 1) * limit;
        const sortDirection = sortOrder === 'desc' ? -1 : 1;

        // Build filter
        let filter = { user: userId };
        if (status) {
            filter.status = status;
        }

        // Get tasks with pagination
        const tasks = await UserTask.find(filter)
            .populate('task', 'title description coins category difficulty')
            .populate('verifiedBy', 'first_name username')
            .sort({ [sortBy]: sortDirection })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        // Get total count
        const total = await UserTask.countDocuments(filter);

        // Get task statistics
        const taskStats = {
            total: await UserTask.countDocuments({ user: userId }),
            completed: await UserTask.countDocuments({ user: userId, status: 'completed' }),
            pending: await UserTask.countDocuments({ user: userId, status: 'pending' }),
            inProgress: await UserTask.countDocuments({ user: userId, status: 'in-progress' }),
            failed: await UserTask.countDocuments({ user: userId, status: 'failed' }),
            expired: await UserTask.countDocuments({ user: userId, status: 'expired' })
        };

        // Calculate total coins earned
        const completedTasks = await UserTask.find({
            user: userId,
            status: 'completed'
        }).populate('task', 'coins');

        const totalCoinsEarned = completedTasks.reduce((sum, task) => {
            return sum + (task.task?.coins || task.coinsEarned || 0);
        }, 0);

        res.json({
            success: true,
            data: {
                tasks,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / limit),
                    totalTasks: total,
                    tasksPerPage: parseInt(limit)
                },
                statistics: {
                    ...taskStats,
                    totalCoinsEarned,
                    averageProgress: taskStats.total > 0
                        ? (await UserTask.aggregate([
                            { $match: { user: new mongoose.Types.ObjectId(userId) } },
                            { $group: { _id: null, avgProgress: { $avg: "$progress" } } }
                        ]))[0]?.avgProgress || 0
                        : 0
                }
            }
        });
    } catch (error) {
        console.error('Get user tasks error:', error);
        res.status(500).json({
            success: false,
            message: 'Vazifa ma\'lumotlarini olishda xatolik',
            error: error.message
        });
    }
};

// 8. Foydalanuvchi o'yin statistikasini olish
export const getUserGameStats = async (req, res) => {
    try {
        const { userId } = req.params;

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Noto\'g\'ri foydalanuvchi ID formati'
            });
        }

        const user = await User.findById(userId).select('-__v').lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Foydalanuvchi topilmadi'
            });
        }

        // Calculate game statistics
        const gameStats = {
            basic: {
                totalGames: user.total_games || 0,
                wins: user.wins || 0,
                loses: user.loses || 0,
                correctAnswers: user.correct_answers || 0,
                wrongAnswers: user.wrong_answers || 0,
                rating: user.rating || 1000,
                level: user.level || 1,
                xp: user.xp || 0,
                coins: user.coins || 0
            },
            calculated: {
                winRate: user.total_games > 0
                    ? ((user.wins || 0) / user.total_games * 100).toFixed(2)
                    : 0,
                accuracy: (user.correct_answers || 0) + (user.wrong_answers || 0) > 0
                    ? ((user.correct_answers || 0) / ((user.correct_answers || 0) + (user.wrong_answers || 0)) * 100).toFixed(2)
                    : 0,
                averageCorrectPerGame: user.total_games > 0
                    ? ((user.correct_answers || 0) / user.total_games).toFixed(2)
                    : 0,
                averageWrongPerGame: user.total_games > 0
                    ? ((user.wrong_answers || 0) / user.total_games).toFixed(2)
                    : 0
            },
            progression: {
                xpToNextLevel: (user.level || 1) * 1000, // Example formula
                xpProgress: user.xp % 1000 || 0,
                levelProgress: ((user.xp % 1000) / 1000 * 100).toFixed(2)
            }
        };

        res.json({
            success: true,
            data: gameStats
        });
    } catch (error) {
        console.error('Get user game stats error:', error);
        res.status(500).json({
            success: false,
            message: 'O\'yin statistikasini olishda xatolik',
            error: error.message
        });
    }
};

// 9. Foydalanuvchini o'chirish (soft delete)
export const deleteUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { hardDelete = false } = req.body;

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Noto\'g\'ri foydalanuvchi ID formati'
            });
        }

        if (hardDelete) {
            // Hard delete - completely remove from database
            const user = await User.findByIdAndDelete(userId);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'Foydalanuvchi topilmadi'
                });
            }

            // Also delete related data
            await UserStat.deleteOne({ user: userId });
            await UserTask.deleteMany({ user: userId });

            res.json({
                success: true,
                message: 'Foydalanuvchi butunlay o\'chirildi',
                data: { deletedUserId: userId }
            });
        } else {
            // Soft delete - mark as deleted
            const user = await User.findByIdAndUpdate(
                userId,
                {
                    $set: {
                        is_blocked: true,
                        deleted: true,
                        deleted_at: new Date(),
                        deleted_by: req.admin?._id
                    }
                },
                { new: true }
            ).select('-__v');

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'Foydalanuvchi topilmadi'
                });
            }

            res.json({
                success: true,
                message: 'Foydalanuvchi o\'chirish belgilandi',
                data: user
            });
        }
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({
            success: false,
            message: 'Foydalanuvchini o\'chirishda xatolik',
            error: error.message
        });
    }
};

// 10. Leaderboard olish
export const getLeaderboard = async (req, res) => {
    try {
        const {
            limit = 10,
            type = 'rating', // rating, xp, coins, wins
            timeframe = 'all' // today, week, month, all
        } = req.query;

        let matchStage = {};
        let sortStage = {};

        // Timeframe filter
        const now = new Date();
        switch (timeframe) {
            case 'today':
                const startOfDay = new Date(now.setHours(0, 0, 0, 0));
                matchStage.createdAt = { $gte: startOfDay };
                break;
            case 'week':
                const startOfWeek = new Date(now.setDate(now.getDate() - 7));
                matchStage.createdAt = { $gte: startOfWeek };
                break;
            case 'month':
                const startOfMonth = new Date(now.setDate(now.getDate() - 30));
                matchStage.createdAt = { $gte: startOfMonth };
                break;
            // 'all' - no time filter
        }

        // Sort by type
        switch (type) {
            case 'rating':
                sortStage = { rating: -1 };
                break;
            case 'xp':
                sortStage = { xp: -1 };
                break;
            case 'coins':
                sortStage = { coins: -1 };
                break;
            case 'wins':
                sortStage = { wins: -1 };
                break;
            case 'level':
                sortStage = { level: -1, xp: -1 };
                break;
            default:
                sortStage = { rating: -1 };
        }

        // Get leaderboard
        const leaderboard = await User.find(matchStage)
            .select('first_name username photo_url level xp coins rating wins total_games is_premium telegram_id')
            .sort(sortStage)
            .limit(parseInt(limit))
            .lean();

        // Add ranks
        const rankedLeaderboard = leaderboard.map((user, index) => ({
            ...user,
            rank: index + 1,
            winRate: user.total_games > 0
                ? ((user.wins || 0) / user.total_games * 100).toFixed(1)
                : 0
        }));

        res.json({
            success: true,
            data: rankedLeaderboard,
            metadata: {
                type,
                timeframe,
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Get leaderboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Leaderboard ma\'lumotlarini olishda xatolik',
            error: error.message
        });
    }
};

// 11. Foydalanuvchilarni eksport qilish (CSV/Excel)
export const exportUsers = async (req, res) => {
    try {
        const { format = 'json' } = req.query;

        const users = await User.find()
            .select('-__v -photo_url')
            .sort({ createdAt: -1 })
            .lean();

        if (format === 'csv') {
            // Convert to CSV
            const csvData = users.map(user => {
                return [
                    user.telegram_id,
                    user.first_name || '',
                    user.username || '',
                    user.level,
                    user.xp,
                    user.coins,
                    user.rating,
                    user.total_games,
                    user.wins,
                    user.loses,
                    user.correct_answers,
                    user.wrong_answers,
                    user.is_premium ? 'Premium' : 'Oddiy',
                    user.is_blocked ? 'Bloklangan' : 'Faol',
                    new Date(user.createdAt).toLocaleDateString()
                ].join(',');
            }).join('\n');

            const headers = [
                'Telegram ID',
                'Ism',
                'Username',
                'Level',
                'XP',
                'Coins',
                'Reyting',
                'Jami O\'yinlar',
                'G\'alabalar',
                'Mag\'lubiyatlar',
                'To\'g\'ri Javoblar',
                'Noto\'g\'ri Javoblar',
                'Premium Status',
                'Holat',
                'Ro\'yxatdan o\'tgan sana'
            ].join(',');

            const csv = headers + '\n' + csvData;

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=users.csv');
            return res.send(csv);
        }

        // Default: JSON format
        res.json({
            success: true,
            data: users,
            count: users.length,
            exportedAt: new Date()
        });
    } catch (error) {
        console.error('Export users error:', error);
        res.status(500).json({
            success: false,
            message: 'Foydalanuvchilarni eksport qilishda xatolik',
            error: error.message
        });
    }
};

// 12. Ko'p foydalanuvchilarni bir vaqtda yangilash (bulk update)
export const bulkUpdateUsers = async (req, res) => {
    try {
        const { userIds, updates } = req.body;

        if (!Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Kamida bitta foydalanuvchi ID si berilishi kerak'
            });
        }

        if (!updates || typeof updates !== 'object') {
            return res.status(400).json({
                success: false,
                message: 'Yangilanish ma\'lumotlari berilishi kerak'
            });
        }

        // Validate ObjectIds
        const validIds = userIds.filter(id => mongoose.Types.ObjectId.isValid(id));
        if (validIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Noto\'g\'ri foydalanuvchi ID lari'
            });
        }

        // Allowed fields for bulk update
        const allowedUpdates = [
            'is_blocked',
            'is_premium',
            'coins',
            'level'
        ];

        // Filter out non-allowed fields
        const filteredUpdate = {};
        Object.keys(updates).forEach(key => {
            if (allowedUpdates.includes(key)) {
                filteredUpdate[key] = updates[key];
            }
        });

        // Perform bulk update
        const result = await User.updateMany(
            { _id: { $in: validIds } },
            { $set: filteredUpdate }
        );

        // Get updated users
        const updatedUsers = await User.find({ _id: { $in: validIds } })
            .select('first_name username telegram_id is_blocked is_premium coins level')
            .lean();

        res.json({
            success: true,
            message: `${result.modifiedCount} ta foydalanuvchi yangilandi`,
            data: {
                matchedCount: result.matchedCount,
                modifiedCount: result.modifiedCount,
                updatedUsers
            }
        });
    } catch (error) {
        console.error('Bulk update users error:', error);
        res.status(500).json({
            success: false,
            message: 'Ko\'p foydalanuvchilarni yangilashda xatolik',
            error: error.message
        });
    }
};

// 13. Foydalanuvchi faollik statistikasi
export const getUserActivityStats = async (req, res) => {
    try {
        const { days = 30 } = req.query;

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));

        // Daily user registration stats
        const registrationStats = await User.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: "$createdAt" },
                        month: { $month: "$createdAt" },
                        day: { $dayOfMonth: "$createdAt" }
                    },
                    count: { $sum: 1 },
                    premiumCount: {
                        $sum: { $cond: [{ $eq: ["$is_premium", true] }, 1, 0] }
                    }
                }
            },
            {
                $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 }
            },
            {
                $project: {
                    date: {
                        $dateFromParts: {
                            year: "$_id.year",
                            month: "$_id.month",
                            day: "$_id.day"
                        }
                    },
                    count: 1,
                    premiumCount: 1,
                    _id: 0
                }
            }
        ]);

        // User activity by time of day
        const hourlyActivity = await User.aggregate([
            {
                $group: {
                    _id: { $hour: "$createdAt" },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { "_id": 1 }
            }
        ]);

        // User statistics by level ranges
        const levelStats = await User.aggregate([
            {
                $bucket: {
                    groupBy: "$level",
                    boundaries: [1, 5, 10, 20, 50, 100],
                    default: "100+",
                    output: {
                        count: { $sum: 1 },
                        avgXP: { $avg: "$xp" },
                        avgCoins: { $avg: "$coins" },
                        avgRating: { $avg: "$rating" }
                    }
                }
            }
        ]);

        // Premium vs Regular user comparison
        const premiumStats = await User.aggregate([
            {
                $group: {
                    _id: "$is_premium",
                    count: { $sum: 1 },
                    avgLevel: { $avg: "$level" },
                    avgXP: { $avg: "$xp" },
                    avgCoins: { $avg: "$coins" },
                    avgRating: { $avg: "$rating" },
                    avgWins: { $avg: "$wins" }
                }
            }
        ]);

        res.json({
            success: true,
            data: {
                registrationStats,
                hourlyActivity,
                levelStats,
                premiumStats,
                timeframe: {
                    days: parseInt(days),
                    startDate,
                    endDate: new Date()
                },
                summary: {
                    totalUsers: await User.countDocuments(),
                    activeUsers: await User.countDocuments({ is_blocked: false }),
                    premiumUsers: await User.countDocuments({ is_premium: true }),
                    averageLevel: await User.aggregate([
                        { $group: { _id: null, avg: { $avg: "$level" } } }
                    ]).then(result => result[0]?.avg || 0),
                    averageCoins: await User.aggregate([
                        { $group: { _id: null, avg: { $avg: "$coins" } } }
                    ]).then(result => result[0]?.avg || 0)
                }
            }
        });
    } catch (error) {
        console.error('Get user activity stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Faollik statistikasini olishda xatolik',
            error: error.message
        });
    }
};