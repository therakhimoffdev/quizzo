import Task from '../models/Task.js';
import UserTask from '../models/UserTask.js';
import User from '../models/User.js';
import UserStat from '../models/UserStat.js';
import mongoose from 'mongoose';

// Check and assign stat-based tasks to user
export const checkStatBasedTasks = async (req, res) => {
    try {
        const userId = req.user._id;

        // Get user's current stats
        const user = await User.findById(userId);
        const userStat = await UserStat.findOne({ user: userId });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get all active stat-based tasks
        const statTasks = await Task.find({
            isActive: true,
            isStatBased: true
        });

        const assignedTasks = [];

        for (const task of statTasks) {
            // Check if user already has this task
            const existingUserTask = await UserTask.findOne({
                user: userId,
                task: task._id
            });

            // If already completed and should be hidden, skip
            if (existingUserTask?.status === 'completed' && task.hideAfterCompletion) {
                continue;
            }

            // Check if user meets the statistic requirement
            const userStatValue = getUserStatistic(user, userStat, task.statisticType);
            const meetsRequirement = userStatValue >= task.targetValue;

            if (meetsRequirement) {
                if (!existingUserTask) {
                    // Create new user task
                    const userTask = new UserTask({
                        user: userId,
                        task: task._id,
                        status: 'available',
                        progress: 100, // Already completed the stat requirement
                        startedAt: new Date(),
                        attempts: 0,
                        maxAttempts: 1,
                        data: {
                            statisticType: task.statisticType,
                            targetValue: task.targetValue,
                            currentValue: userStatValue
                        }
                    });

                    await userTask.save();
                    assignedTasks.push({
                        task: task.title,
                        coins: task.coins,
                        status: 'assigned'
                    });
                } else if (existingUserTask.status !== 'completed') {
                    // Update existing task to available
                    existingUserTask.status = 'available';
                    existingUserTask.progress = 100;
                    existingUserTask.data.currentValue = userStatValue;
                    await existingUserTask.save();
                    assignedTasks.push({
                        task: task.title,
                        coins: task.coins,
                        status: 'updated'
                    });
                }
            }
        }

        res.status(200).json({
            success: true,
            message: 'Stat-based tasks checked',
            assignedTasks,
            totalAssigned: assignedTasks.length
        });

    } catch (error) {
        console.error('Error checking stat-based tasks:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Get available stat-based tasks for user
export const getUserStatTasks = async (req, res) => {
    try {
        const userId = req.user._id;
        const { hideCompleted = true } = req.query;

        const userTasks = await UserTask.find({
            user: userId
        })
            .populate({
                path: 'task',
                match: { isStatBased: true, isActive: true }
            })
            .sort({ createdAt: -1 });

        // Filter out null tasks and get available stat tasks
        const statTasks = userTasks.filter(ut => ut.task).map(ut => ({
            ...ut.task.toObject(),
            status: ut.status,
            progress: ut.progress,
            coinsEarned: ut.coinsEarned || 0,
            startedAt: ut.startedAt,
            data: ut.data,
            canClaim: ut.status === 'available' && ut.progress >= 100
        }));

        // Filter completed tasks if needed
        const filteredTasks = hideCompleted
            ? statTasks.filter(task => task.status !== 'completed')
            : statTasks;

        res.status(200).json({
            success: true,
            tasks: filteredTasks,
            total: filteredTasks.length
        });

    } catch (error) {
        console.error('Error getting user stat tasks:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Claim stat-based task reward
export const claimStatTaskReward = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID'
            });
        }

        // Find user task
        const userTask = await UserTask.findOne({
            user: userId,
            task: id,
            status: 'available'
        }).populate('task');

        if (!userTask) {
            return res.status(404).json({
                success: false,
                message: 'Task not found or not available for claiming'
            });
        }

        // Verify stat requirement is still met
        const user = await User.findById(userId);
        const userStat = await UserStat.findOne({ user: userId });
        const currentStatValue = getUserStatistic(user, userStat, userTask.task.statisticType);

        if (currentStatValue < userTask.task.targetValue) {
            return res.status(400).json({
                success: false,
                message: 'Statistic requirement no longer met'
            });
        }

        // Mark as completed and award coins
        userTask.status = 'completed';
        userTask.completedAt = new Date();
        userTask.coinsEarned = userTask.task.coins;

        // Award coins to user
        user.coins += userTask.task.coins;
        await user.save();

        // Update task completion count
        userTask.task.metadata.completions += 1;
        await userTask.task.save();

        await userTask.save();

        // Update user stats
        const userStats = await UserStat.findOneAndUpdate(
            { user: userId },
            {
                $inc: {
                    'dailyStats.coinsEarned': userTask.task.coins,
                    'allTimeStats.totalCoinsEarned': userTask.task.coins,
                    'allTimeStats.totalTasksCompleted': 1
                }
            },
            { new: true, upsert: true }
        );

        res.status(200).json({
            success: true,
            message: 'Task reward claimed successfully!',
            coinsAwarded: userTask.task.coins,
            newBalance: user.coins,
            task: {
                title: userTask.task.title,
                status: userTask.status,
                coinsEarned: userTask.coinsEarned
            }
        });

    } catch (error) {
        console.error('Error claiming stat task reward:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Helper function to get user statistic value
const getUserStatistic = (user, userStat, statisticType) => {
    switch (statisticType) {
        case 'total_games':
            return user.total_games || 0;
        case 'wins':
            return user.wins || 0;
        case 'loses':
            return user.loses || 0;
        case 'correct_answers':
            return user.correct_answers || 0;
        case 'wrong_answers':
            return user.wrong_answers || 0;
        case 'rating':
            return user.rating || 0;
        case 'coins':
            return user.coins || 0;
        case 'level':
            return user.level || 1;
        case 'xp':
            return user.xp || 0;
        case 'streak':
            return userStat?.dailyStats?.streak || 0;
        case 'total_duels':
            return (user.wins || 0) + (user.loses || 0);
        case 'win_rate':
            const totalGames = (user.wins || 0) + (user.loses || 0);
            return totalGames > 0 ? (user.wins || 0) / totalGames * 100 : 0;
        default:
            return 0;
    }
};