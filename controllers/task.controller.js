import Task from '../models/Task.js';
import UserTask from '../models/UserTask.js';
import User from '../models/User.js';
import UserStat from '../models/UserStat.js';
import mongoose from 'mongoose';

// ==================== HELPER FUNCTIONS ====================

const calculateUserStats = async (userId) => {
    const stats = await UserStat.findOne({ user: userId });
    const userTasks = await UserTask.find({ user: userId });

    const completedTasks = userTasks.filter(task => task.status === 'completed').length;
    const pendingTasks = userTasks.filter(task =>
        ['pending', 'in-progress', 'available'].includes(task.status)
    ).length;

    const totalCoins = userTasks
        .filter(task => task.status === 'completed')
        .reduce((sum, task) => sum + (task.coinsEarned || 0), 0);

    // Get user's actual coins from User model
    const user = await User.findById(userId);

    return {
        totalCoins: user?.coins || totalCoins,
        dailyStreak: stats?.dailyStats.streak || 0,
        completedTasks,
        pendingTasks
    };
};

const filterTasksByStatus = (tasks, status) => {
    if (status === 'all') return tasks;
    return tasks.filter(task => task.status === status);
};

const calculateTaskProgress = (userTask) => {
    if (!userTask) return 0;

    switch (userTask.task.type) {
        case 'quiz':
            // Calculate based on quiz completion
            return Math.min(100, (userTask.data.questionsAnswered || 0) * 10);

        case 'streak':
            // Calculate based on streak days
            const requiredDays = userTask.task.requirements?.streakDays || 3;
            const currentStreak = userTask.data.currentStreak || 0;
            return Math.min(100, (currentStreak / requiredDays) * 100);

        case 'referral':
            // Calculate based on referrals
            const requiredReferrals = userTask.task.requirements?.referralCount || 3;
            const currentReferrals = userTask.data.referrals || 0;
            return Math.min(100, (currentReferrals / requiredReferrals) * 100);

        default:
            return userTask.progress || 0;
    }
};

// ==================== MAIN CONTROLLERS ====================

// Get all tasks for user
export const getTasks = async (req, res) => {
    try {
        const userId = req.user._id;
        const { filter = 'all', category, type, difficulty } = req.query;

        console.log('Getting tasks for user:', userId);

        // Faqat hozir vaqtda faol bo'lgan tasklarni olish
        const now = new Date();

        const tasks = await Task.find({
            isActive: true,
            $or: [
                { startDate: { $exists: false } }, // startDate mavjud emas
                { startDate: { $lte: now } } // startDate hozirdan oldin
            ],
            $or: [
                { endDate: { $exists: false } }, // endDate mavjud emas
                { endDate: null }, // endDate null
                { endDate: { $gte: now } } // endDate hozirdan keyin
            ],
            ...(category && { category }),
            ...(type && { type }),
            ...(difficulty && { difficulty })
        }).sort({ createdAt: -1 });

        console.log('Found active tasks:', tasks.length);

        if (tasks.length === 0) {
            console.log('No active tasks found in database');
            return res.status(200).json({
                success: true,
                tasks: [],
                stats: {},
                total: 0
            });
        }

        // Qolgan kod...
    } catch (error) {
        console.error('Error getting tasks:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Get single task by ID
export const getTaskById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID'
            });
        }

        const task = await Task.findById(id);
        if (!task || !task.isActive) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        // Get user's progress for this task
        const userTask = await UserTask.findOne({
            user: userId,
            task: id
        }).populate('task');

        let status = 'available';
        let progress = 0;
        let coinsEarned = 0;

        if (userTask) {
            status = userTask.status;
            progress = calculateTaskProgress(userTask);
            coinsEarned = userTask.coinsEarned || 0;

            if (userTask.isExpired() && status !== 'completed') {
                status = 'expired';
            }
        }

        // Check if user meets requirements
        const user = await User.findById(userId);
        const meetsRequirements =
            user.level >= (task.requirements.minLevel || 1) &&
            user.coins >= (task.requirements.minCoins || 0);

        // Check previous tasks requirement
        let previousTasksCompleted = true;
        if (task.requirements.previousTasks && task.requirements.previousTasks.length > 0) {
            const completedTasks = await UserTask.find({
                user: userId,
                task: { $in: task.requirements.previousTasks },
                status: 'completed'
            });
            previousTasksCompleted = completedTasks.length === task.requirements.previousTasks.length;
        }

        const canStart = meetsRequirements && previousTasksCompleted && status === 'available';

        res.status(200).json({
            success: true,
            task: {
                ...task.toObject(),
                status: canStart ? 'available' : status,
                progress,
                coinsEarned,
                canStart,
                requirements: {
                    meetsLevel: user.level >= (task.requirements.minLevel || 1),
                    meetsCoins: user.coins >= (task.requirements.minCoins || 0),
                    previousTasksCompleted,
                    minLevel: task.requirements.minLevel || 1,
                    minCoins: task.requirements.minCoins || 0
                },
                userTask: userTask || null
            }
        });

    } catch (error) {
        console.error('Error getting task:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Start a task
export const startTask = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID'
            });
        }

        const task = await Task.findById(id);
        if (!task || !task.isActive) {
            return res.status(404).json({
                success: false,
                message: 'Task not found or inactive'
            });
        }

        // Check if user can start this task
        const user = await User.findById(userId);

        // Check level requirement
        if (user.level < (task.requirements.minLevel || 1)) {
            return res.status(400).json({
                success: false,
                message: `Minimum level ${task.requirements.minLevel} required`
            });
        }

        // Check coins requirement
        if (user.coins < (task.requirements.minCoins || 0)) {
            return res.status(400).json({
                success: false,
                message: `Minimum ${task.requirements.minCoins} coins required`
            });
        }

        // Check previous tasks
        if (task.requirements.previousTasks && task.requirements.previousTasks.length > 0) {
            const completedTasks = await UserTask.find({
                user: userId,
                task: { $in: task.requirements.previousTasks },
                status: 'completed'
            });

            if (completedTasks.length !== task.requirements.previousTasks.length) {
                return res.status(400).json({
                    success: false,
                    message: 'Complete previous tasks first'
                });
            }
        }

        // Check if user already has this task
        const existingUserTask = await UserTask.findOne({
            user: userId,
            task: id
        });

        if (existingUserTask) {
            // Check if can retry
            if (existingUserTask.status === 'failed' && existingUserTask.canRetry()) {
                existingUserTask.status = 'in-progress';
                existingUserTask.attempts += 1;
                existingUserTask.progress = 0;
                existingUserTask.startedAt = new Date();
                existingUserTask.data = {};

                // Set expiration if cooldown exists
                if (task.cooldownHours > 0) {
                    const expiresAt = new Date();
                    expiresAt.setHours(expiresAt.getHours() + task.cooldownHours);
                    existingUserTask.expiresAt = expiresAt;
                }

                await existingUserTask.save();

                return res.status(200).json({
                    success: true,
                    message: 'Task restarted',
                    userTask: existingUserTask
                });
            }

            // Check if already completed
            if (existingUserTask.status === 'completed') {
                return res.status(400).json({
                    success: false,
                    message: 'Task already completed'
                });
            }

            // Check if in progress
            if (existingUserTask.status === 'in-progress') {
                return res.status(400).json({
                    success: false,
                    message: 'Task already in progress'
                });
            }

            // Check max completions
            if (existingUserTask.status === 'completed' && task.maxCompletions > 0) {
                const completionCount = await UserTask.countDocuments({
                    user: userId,
                    task: id,
                    status: 'completed'
                });

                if (completionCount >= task.maxCompletions) {
                    return res.status(400).json({
                        success: false,
                        message: 'Maximum completions reached for this task'
                    });
                }
            }
        }

        // Create new user task
        const userTask = new UserTask({
            user: userId,
            task: id,
            status: 'in-progress',
            progress: 0,
            startedAt: new Date(),
            attempts: 1,
            maxAttempts: task.maxCompletions || 3,
            data: {}
        });

        // Set expiration if cooldown exists
        if (task.cooldownHours > 0) {
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + task.cooldownHours);
            userTask.expiresAt = expiresAt;
        }

        await userTask.save();

        // Increment task views
        task.metadata.views += 1;
        await task.save();

        res.status(201).json({
            success: true,
            message: 'Task started successfully',
            userTask
        });

    } catch (error) {
        console.error('Error starting task:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Update task progress
export const updateTaskProgress = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;
        const { progress, data } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID'
            });
        }

        const userTask = await UserTask.findOne({
            user: userId,
            task: id,
            status: 'in-progress'
        }).populate('task');

        if (!userTask) {
            return res.status(404).json({
                success: false,
                message: 'Task not found or not in progress'
            });
        }

        // Check if expired
        if (userTask.isExpired()) {
            userTask.status = 'expired';
            await userTask.save();

            return res.status(400).json({
                success: false,
                message: 'Task expired'
            });
        }

        // Update progress
        const newProgress = Math.min(100, Math.max(0, progress || userTask.progress));
        userTask.progress = newProgress;

        // Update additional data
        if (data) {
            userTask.data = { ...userTask.data, ...data };
        }

        // Check if completed
        if (newProgress >= 100) {
            userTask.status = 'completed';
            userTask.completedAt = new Date();
            userTask.coinsEarned = userTask.task.coins;

            // Award coins to user
            const user = await User.findById(userId);
            user.coins += userTask.task.coins;
            await user.save();

            // Update user stats
            await updateUserStats(userId, {
                coinsEarned: userTask.task.coins,
                taskCompleted: true
            });

            // Update task completion count
            userTask.task.metadata.completions += 1;
            await userTask.task.save();
        }

        await userTask.save();

        res.status(200).json({
            success: true,
            message: 'Progress updated',
            userTask: {
                ...userTask.toObject(),
                progress: newProgress,
                isCompleted: newProgress >= 100
            }
        });

    } catch (error) {
        console.error('Error updating task progress:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Complete task (for simple tasks)
export const completeTask = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;
        const { verificationData } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID'
            });
        }

        const task = await Task.findById(id);
        if (!task || !task.isActive) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        // Find user task
        let userTask = await UserTask.findOne({
            user: userId,
            task: id
        }).populate('task');

        // If no user task exists, create one
        if (!userTask) {
            userTask = new UserTask({
                user: userId,
                task: id,
                status: 'in-progress',
                progress: 0,
                startedAt: new Date(),
                attempts: 1
            });
        }

        // Check if already completed
        if (userTask.status === 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Task already completed'
            });
        }

        // Check if expired
        if (userTask.isExpired()) {
            userTask.status = 'expired';
            await userTask.save();

            return res.status(400).json({
                success: false,
                message: 'Task expired'
            });
        }

        // Check max attempts
        if (userTask.attempts >= userTask.maxAttempts) {
            userTask.status = 'failed';
            await userTask.save();

            return res.status(400).json({
                success: false,
                message: 'Maximum attempts reached'
            });
        }

        // Update task based on type
        switch (task.type) {
            case 'subscription':
            case 'advertisement':
                // These require verification
                if (verificationData) {
                    userTask.verificationData = {
                        ...verificationData,
                        verified: false
                    };
                    userTask.status = 'pending';
                } else {
                    userTask.status = 'completed';
                    userTask.progress = 100;
                }
                break;

            default:
                userTask.status = 'completed';
                userTask.progress = 100;
                break;
        }

        // If completed, award coins
        if (userTask.status === 'completed') {
            userTask.completedAt = new Date();
            userTask.coinsEarned = task.coins;

            // Award coins to user
            const user = await User.findById(userId);
            user.coins += task.coins;
            await user.save();

            // Update user stats
            await updateUserStats(userId, {
                coinsEarned: task.coins,
                taskCompleted: true
            });

            // Update task completion count
            task.metadata.completions += 1;
            await task.save();
        }

        userTask.attempts += 1;
        await userTask.save();

        // Get updated user stats
        const userStats = await calculateUserStats(userId);

        res.status(200).json({
            success: true,
            message: userTask.status === 'completed' ? 'Task completed!' : 'Task submitted for review',
            userTask,
            stats: userStats,
            coinsAwarded: userTask.status === 'completed' ? task.coins : 0
        });

    } catch (error) {
        console.error('Error completing task:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Get user task statistics
export const getUserTaskStats = async (req, res) => {
    try {
        const userId = req.user._id;

        const stats = await calculateUserStats(userId);

        // Get additional statistics
        const userTasks = await UserTask.find({ user: userId })
            .populate('task')
            .sort({ completedAt: -1 });

        const completedTasks = userTasks.filter(task => task.status === 'completed');
        const inProgressTasks = userTasks.filter(task => task.status === 'in-progress');
        const pendingTasks = userTasks.filter(task => task.status === 'pending');

        // Calculate streaks
        const userStat = await UserStat.findOne({ user: userId });
        const streak = userStat?.dailyStats.streak || 0;

        // Calculate daily completion rate
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayCompleted = completedTasks.filter(task =>
            task.completedAt && new Date(task.completedAt) >= today
        ).length;

        // Calculate earnings by task type
        const earningsByType = {};
        completedTasks.forEach(task => {
            const type = task.task.type;
            if (!earningsByType[type]) {
                earningsByType[type] = {
                    coins: 0,
                    count: 0
                };
            }
            earningsByType[type].coins += task.coinsEarned || 0;
            earningsByType[type].count += 1;
        });

        res.status(200).json({
            success: true,
            stats: {
                ...stats,
                streak,
                todayCompleted,
                totalEarned: completedTasks.reduce((sum, task) => sum + (task.coinsEarned || 0), 0),
                byStatus: {
                    completed: completedTasks.length,
                    inProgress: inProgressTasks.length,
                    pending: pendingTasks.length
                },
                earningsByType,
                recentCompletions: completedTasks.slice(0, 5).map(task => ({
                    task: task.task.title,
                    coins: task.coinsEarned,
                    completedAt: task.completedAt
                }))
            }
        });

    } catch (error) {
        console.error('Error getting user stats:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Get daily tasks
export const getDailyTasks = async (req, res) => {
    try {
        const userId = req.user._id;

        const tasks = await Task.find({
            category: 'daily',
            isActive: true
        }).sort({ createdAt: -1 });

        // Get user's progress for these tasks
        const userTasks = await UserTask.find({
            user: userId,
            task: { $in: tasks.map(t => t._id) }
        }).populate('task');

        const tasksWithProgress = tasks.map(task => {
            const userTask = userTasks.find(ut => ut.task._id.toString() === task._id.toString());

            let status = 'available';
            let progress = 0;

            if (userTask) {
                status = userTask.status;
                progress = calculateTaskProgress(userTask);

                // Reset daily tasks if new day
                if (status === 'completed') {
                    const completedDate = new Date(userTask.completedAt);
                    const today = new Date();

                    if (completedDate.getDate() !== today.getDate() ||
                        completedDate.getMonth() !== today.getMonth() ||
                        completedDate.getFullYear() !== today.getFullYear()) {
                        status = 'available';
                        progress = 0;
                    }
                }
            }

            return {
                ...task.toObject(),
                status,
                progress
            };
        });

        res.status(200).json({
            success: true,
            tasks: tasksWithProgress,
            total: tasksWithProgress.length
        });

    } catch (error) {
        console.error('Error getting daily tasks:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Reset daily tasks (admin only)
export const resetDailyTasks = async (req, res) => {
    try {
        // This would typically be called by a cron job
        // For now, we'll just mark all completed daily tasks as available if it's a new day

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const userTasks = await UserTask.find({
            status: 'completed'
        }).populate({
            path: 'task',
            match: { category: 'daily' }
        });

        for (const userTask of userTasks) {
            if (userTask.task && userTask.completedAt) {
                const completedDate = new Date(userTask.completedAt);
                completedDate.setHours(0, 0, 0, 0);

                if (completedDate < today) {
                    userTask.status = 'available';
                    userTask.progress = 0;
                    userTask.completedAt = null;
                    userTask.coinsEarned = 0;
                    await userTask.save();
                }
            }
        }

        res.status(200).json({
            success: true,
            message: 'Daily tasks reset completed'
        });

    } catch (error) {
        console.error('Error resetting daily tasks:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Helper function to update user stats
const updateUserStats = async (userId, updates) => {
    try {
        let userStat = await UserStat.findOne({ user: userId });

        if (!userStat) {
            userStat = new UserStat({
                user: userId,
                dailyStats: {
                    date: new Date(),
                    tasksCompleted: 0,
                    coinsEarned: 0,
                    streak: 0
                },
                allTimeStats: {
                    totalTasksCompleted: 0,
                    totalCoinsEarned: 0,
                    totalTimeSpent: 0,
                    averageCompletionTime: 0,
                    streakRecord: 0
                }
            });
        }

        // Update streak
        userStat.updateStreak();

        // Update daily stats
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const statDate = new Date(userStat.dailyStats.date);
        statDate.setHours(0, 0, 0, 0);

        if (statDate.getTime() === today.getTime()) {
            // Same day
            if (updates.taskCompleted) {
                userStat.dailyStats.tasksCompleted += 1;
            }
            if (updates.coinsEarned) {
                userStat.dailyStats.coinsEarned += updates.coinsEarned;
            }
        } else {
            // New day
            userStat.dailyStats = {
                date: new Date(),
                tasksCompleted: updates.taskCompleted ? 1 : 0,
                coinsEarned: updates.coinsEarned || 0,
                streak: userStat.dailyStats.streak
            };
        }

        // Update all-time stats
        if (updates.taskCompleted) {
            userStat.allTimeStats.totalTasksCompleted += 1;
        }
        if (updates.coinsEarned) {
            userStat.allTimeStats.totalCoinsEarned += updates.coinsEarned;
        }

        await userStat.save();

    } catch (error) {
        console.error('Error updating user stats:', error);
    }
};

// Verify task completion (admin only)
export const verifyTaskCompletion = async (req, res) => {
    try {
        const { userTaskId } = req.params;
        const { verified, adminNotes } = req.body;
        const adminId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(userTaskId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user task ID'
            });
        }

        const userTask = await UserTask.findById(userTaskId).populate('task');

        if (!userTask) {
            return res.status(404).json({
                success: false,
                message: 'User task not found'
            });
        }

        if (userTask.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Task is not pending verification'
            });
        }

        if (verified) {
            // Mark as completed and award coins
            userTask.status = 'completed';
            userTask.progress = 100;
            userTask.completedAt = new Date();
            userTask.coinsEarned = userTask.task.coins;
            userTask.verificationData.verified = true;
            userTask.verificationData.verifiedAt = new Date();
            userTask.verificationData.verifiedBy = adminId;

            // Award coins to user
            const user = await User.findById(userTask.user);
            user.coins += userTask.task.coins;
            await user.save();

            // Update user stats
            await updateUserStats(userTask.user, {
                coinsEarned: userTask.task.coins,
                taskCompleted: true
            });

            // Update task completion count
            userTask.task.metadata.completions += 1;
            await userTask.task.save();

            await userTask.save();

            res.status(200).json({
                success: true,
                message: 'Task verified and completed',
                userTask
            });

        } else {
            // Reject verification
            userTask.status = 'failed';
            userTask.verificationData.verified = false;
            userTask.verificationData.verifiedAt = new Date();
            userTask.verificationData.verifiedBy = adminId;

            if (adminNotes) {
                userTask.verificationData.adminNotes = adminNotes;
            }

            await userTask.save();

            res.status(200).json({
                success: true,
                message: 'Task verification rejected',
                userTask
            });
        }

    } catch (error) {
        console.error('Error verifying task:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Get leaderboard for tasks
export const getTasksLeaderboard = async (req, res) => {
    try {
        const { period = 'weekly', limit = 10 } = req.query;

        let matchStage = {};
        const now = new Date();

        switch (period) {
            case 'daily':
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                matchStage.completedAt = { $gte: today };
                break;

            case 'weekly':
                const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                matchStage.completedAt = { $gte: oneWeekAgo };
                break;

            case 'monthly':
                const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                matchStage.completedAt = { $gte: oneMonthAgo };
                break;
        }

        const leaderboard = await UserTask.aggregate([
            { $match: { ...matchStage, status: 'completed' } },
            {
                $group: {
                    _id: '$user',
                    totalCoins: { $sum: '$coinsEarned' },
                    totalTasks: { $sum: 1 },
                    lastCompletion: { $max: '$completedAt' }
                }
            },
            { $sort: { totalCoins: -1 } },
            { $limit: parseInt(limit) },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            { $unwind: '$user' },
            {
                $project: {
                    _id: 0,
                    userId: '$user._id',
                    firstName: '$user.first_name',
                    username: '$user.username',
                    photoUrl: '$user.photo_url',
                    totalCoins: 1,
                    totalTasks: 1,
                    lastCompletion: 1
                }
            }
        ]);

        // Get current user's position
        const currentUserId = req.user._id;
        const currentUserStats = await UserTask.aggregate([
            { $match: { ...matchStage, status: 'completed', user: currentUserId } },
            {
                $group: {
                    _id: '$user',
                    totalCoins: { $sum: '$coinsEarned' },
                    totalTasks: { $sum: 1 },
                    rank: { $first: '$$CURRENT' }
                }
            }
        ]);

        res.status(200).json({
            success: true,
            leaderboard,
            period,
            currentUser: currentUserStats[0] || null,
            updatedAt: new Date()
        });

    } catch (error) {
        console.error('Error getting leaderboard:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};