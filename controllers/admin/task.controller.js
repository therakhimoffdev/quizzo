import Task from '../../models/Task.js';
import UserTask from '../../models/UserTask.js';
import User from '../../models/User.js';
import mongoose from 'mongoose';

// ==================== ADMIN TASK MANAGEMENT ====================

// Create new task
export const createTask = async (req, res) => {
    try {
        const {
            title,
            description,
            icon,
            type,
            coins,
            requiredAction,
            link,
            externalLink,
            timeEstimate,
            color,
            category,
            difficulty,
            maxCompletions,
            cooldownHours,
            startDate,
            endDate,
            tags,
            requirements,
            isStatBased = false,
            statisticType,
            targetValue,
            hideAfterCompletion = true
        } = req.body;

        // Basic validation
        if (!title || !description || !type || !coins) {
            return res.status(400).json({
                success: false,
                message: 'Title, description, type and coins are required'
            });
        }

        // Check if statistic-based task
        if (isStatBased && (!statisticType || !targetValue)) {
            return res.status(400).json({
                success: false,
                message: 'Statistic type and target value are required for stat-based tasks'
            });
        }

        // Create task
        const task = new Task({
            title,
            description,
            icon: icon || '🎯',
            type,
            coins,
            requiredAction,
            link,
            externalLink,
            timeEstimate: timeEstimate || '5 daqiqa',
            color: color || 'from-blue-600 to-blue-800',
            category: category || 'one-time',
            difficulty: difficulty || 'medium',
            maxCompletions: maxCompletions || 1,
            cooldownHours: cooldownHours || 0,
            startDate: startDate ? new Date(startDate) : new Date(),
            endDate: endDate ? new Date(endDate) : null,
            tags: tags || [],
            requirements: {
                minLevel: requirements?.minLevel || 1,
                minCoins: requirements?.minCoins || 0,
                previousTasks: requirements?.previousTasks || []
            },
            isStatBased,
            statisticType,
            targetValue,
            hideAfterCompletion,
            metadata: {
                views: 0,
                completions: 0,
                avgCompletionTime: 0
            }
        });

        await task.save();

        // If task is stat-based, assign to eligible users
        if (isStatBased) {
            await assignStatBasedTaskToUsers(task._id, statisticType, targetValue);
        }

        res.status(201).json({
            success: true,
            message: 'Task created successfully',
            task
        });

    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Get all tasks (admin view)
export const getAllTasks = async (req, res) => {
    try {
        const { page = 1, limit = 20, type, category, isActive } = req.query;
        const skip = (page - 1) * limit;

        const filter = {};
        if (type) filter.type = type;
        if (category) filter.category = category;
        if (isActive !== undefined) filter.isActive = isActive === 'true';

        const tasks = await Task.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Task.countDocuments(filter);

        // Get statistics for each task
        const tasksWithStats = await Promise.all(tasks.map(async (task) => {
            const completions = await UserTask.countDocuments({
                task: task._id,
                status: 'completed'
            });

            const inProgress = await UserTask.countDocuments({
                task: task._id,
                status: 'in-progress'
            });

            const pending = await UserTask.countDocuments({
                task: task._id,
                status: 'pending'
            });

            return {
                ...task.toObject(),
                stats: {
                    completions,
                    inProgress,
                    pending,
                    totalUsers: completions + inProgress + pending
                }
            };
        }));

        res.status(200).json({
            success: true,
            tasks: tasksWithStats,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Error getting tasks:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Get task details (admin view)
export const getTaskDetails = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID'
            });
        }

        const task = await Task.findById(id);
        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        // Get task statistics
        const userTasks = await UserTask.find({ task: id })
            .populate('user', 'first_name username photo_url coins level')
            .sort({ completedAt: -1 });

        const completions = userTasks.filter(ut => ut.status === 'completed');
        const inProgress = userTasks.filter(ut => ut.status === 'in-progress');
        const pending = userTasks.filter(ut => ut.status === 'pending');

        // Calculate completion rate
        const totalUsers = userTasks.length;
        const completionRate = totalUsers > 0 ? (completions.length / totalUsers) * 100 : 0;

        // Get recent completions
        const recentCompletions = completions.slice(0, 10).map(ut => ({
            user: {
                id: ut.user._id,
                name: ut.user.first_name,
                username: ut.user.username,
                photoUrl: ut.user.photo_url,
                level: ut.user.level
            },
            completedAt: ut.completedAt,
            coinsEarned: ut.coinsEarned
        }));

        res.status(200).json({
            success: true,
            task,
            statistics: {
                totalUsers,
                completions: completions.length,
                inProgress: inProgress.length,
                pending: pending.length,
                completionRate: completionRate.toFixed(2),
                totalCoinsEarned: completions.reduce((sum, ut) => sum + (ut.coinsEarned || 0), 0)
            },
            recentCompletions
        });

    } catch (error) {
        console.error('Error getting task details:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Update task
export const updateTask = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID'
            });
        }

        const task = await Task.findById(id);
        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        // Update task
        Object.keys(updateData).forEach(key => {
            if (key !== '_id' && key !== '__v') {
                task[key] = updateData[key];
            }
        });

        await task.save();

        // If task becomes stat-based, assign to eligible users
        if (task.isStatBased && task.statisticType && task.targetValue) {
            await assignStatBasedTaskToUsers(task._id, task.statisticType, task.targetValue);
        }

        res.status(200).json({
            success: true,
            message: 'Task updated successfully',
            task
        });

    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Delete task
export const deleteTask = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID'
            });
        }

        const task = await Task.findById(id);
        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        // Check if task has completions
        const completions = await UserTask.countDocuments({ task: id, status: 'completed' });
        if (completions > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete task with completions. Deactivate instead.'
            });
        }

        // Delete all related user tasks
        await UserTask.deleteMany({ task: id });

        // Delete task
        await Task.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: 'Task deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Toggle task active status
export const toggleTaskStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID'
            });
        }

        const task = await Task.findByIdAndUpdate(
            id,
            { isActive },
            { new: true }
        );

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        res.status(200).json({
            success: true,
            message: `Task ${isActive ? 'activated' : 'deactivated'} successfully`,
            task
        });

    } catch (error) {
        console.error('Error toggling task status:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Get tasks that need verification
export const getPendingVerifications = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        const userTasks = await UserTask.find({ status: 'pending' })
            .populate('task', 'title type coins')
            .populate('user', 'first_name username photo_url')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await UserTask.countDocuments({ status: 'pending' });

        res.status(200).json({
            success: true,
            verifications: userTasks,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Error getting pending verifications:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// ==================== HELPER FUNCTIONS ====================

// Assign stat-based tasks to eligible users
const assignStatBasedTaskToUsers = async (taskId, statisticType, targetValue) => {
    try {
        const users = await User.find({
            [getStatisticField(statisticType)]: { $gte: targetValue }
        });

        for (const user of users) {
            // Check if user already has this task
            const existingUserTask = await UserTask.findOne({
                user: user._id,
                task: taskId
            });

            if (!existingUserTask) {
                const userTask = new UserTask({
                    user: user._id,
                    task: taskId,
                    status: 'available',
                    progress: 100, // Already completed the requirement
                    startedAt: new Date(),
                    attempts: 0,
                    maxAttempts: 1,
                    data: {
                        statisticType,
                        targetValue,
                        currentValue: user[getStatisticField(statisticType)] || 0
                    }
                });

                await userTask.save();
            }
        }
    } catch (error) {
        console.error('Error assigning stat-based tasks:', error);
    }
};

// Map statistic type to user field
const getStatisticField = (statisticType) => {
    const map = {
        'total_games': 'total_games',
        'wins': 'wins',
        'loses': 'loses',
        'correct_answers': 'correct_answers',
        'wrong_answers': 'wrong_answers',
        'rating': 'rating',
        'coins': 'coins',
        'level': 'level',
        'xp': 'xp',
        'streak': 'dailyStats.streak'
    };
    return map[statisticType] || statisticType;
};