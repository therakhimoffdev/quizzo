import Task from '../models/Task.js';
import UserTask from '../models/UserTask.js';

// Check if user can access a task
export const canAccessTask = async (userId, taskId) => {
    try {
        const task = await Task.findById(taskId);
        if (!task || !task.isActive) {
            return { canAccess: false, reason: 'Task not found or inactive' };
        }

        // Check user level requirement
        const user = await User.findById(userId);
        if (user.level < (task.requirements.minLevel || 1)) {
            return {
                canAccess: false,
                reason: `Minimum level ${task.requirements.minLevel} required`
            };
        }

        // Check coins requirement
        if (user.coins < (task.requirements.minCoins || 0)) {
            return {
                canAccess: false,
                reason: `Minimum ${task.requirements.minCoins} coins required`
            };
        }

        // Check previous tasks requirement
        if (task.requirements.previousTasks && task.requirements.previousTasks.length > 0) {
            const completedTasks = await UserTask.find({
                user: userId,
                task: { $in: task.requirements.previousTasks },
                status: 'completed'
            });

            if (completedTasks.length !== task.requirements.previousTasks.length) {
                return {
                    canAccess: false,
                    reason: 'Complete previous tasks first'
                };
            }
        }

        // Check max completions
        const userTaskCompletions = await UserTask.countDocuments({
            user: userId,
            task: taskId,
            status: 'completed'
        });

        if (userTaskCompletions >= task.maxCompletions) {
            return {
                canAccess: false,
                reason: 'Maximum completions reached'
            };
        }

        return { canAccess: true };
    } catch (error) {
        console.error('Error checking task access:', error);
        return { canAccess: false, reason: 'Server error' };
    }
};

// Calculate task expiration date
export const calculateExpirationDate = (task, startDate = new Date()) => {
    const expiration = new Date(startDate);

    switch (task.category) {
        case 'daily':
            expiration.setDate(expiration.getDate() + 1);
            expiration.setHours(23, 59, 59, 999);
            break;

        case 'weekly':
            expiration.setDate(expiration.getDate() + 7);
            expiration.setHours(23, 59, 59, 999);
            break;

        case 'monthly':
            expiration.setMonth(expiration.getMonth() + 1);
            expiration.setHours(23, 59, 59, 999);
            break;

        default:
            if (task.cooldownHours > 0) {
                expiration.setHours(expiration.getHours() + task.cooldownHours);
            }
            break;
    }

    return expiration;
};

// Generate task completion certificate
export const generateCompletionCertificate = (userTask, user) => {
    const completionDate = userTask.completedAt || new Date();

    return {
        certificateId: `CERT-${userTask._id.toString().substring(0, 8).toUpperCase()}`,
        userName: user.first_name || user.username || 'User',
        taskName: userTask.task.title,
        coinsEarned: userTask.coinsEarned,
        completionDate: completionDate.toISOString().split('T')[0],
        completionTime: completionDate.toLocaleTimeString(),
        issuedAt: new Date().toISOString(),
        verificationUrl: `${process.env.APP_URL}/verify/${userTask._id}`
    };
};

// Calculate task statistics
export const calculateTaskStatistics = async (taskId) => {
    const task = await Task.findById(taskId);
    if (!task) return null;

    const userTasks = await UserTask.find({ task: taskId });
    const completedTasks = userTasks.filter(ut => ut.status === 'completed');
    const inProgressTasks = userTasks.filter(ut => ut.status === 'in-progress');
    const failedTasks = userTasks.filter(ut => ut.status === 'failed');

    const totalCompletions = completedTasks.length;
    const totalAttempts = userTasks.length;
    const completionRate = totalAttempts > 0 ? (totalCompletions / totalAttempts) * 100 : 0;

    // Calculate average completion time
    let avgCompletionTime = 0;
    if (completedTasks.length > 0) {
        const totalTime = completedTasks.reduce((sum, ut) => {
            if (ut.completedAt && ut.startedAt) {
                return sum + (ut.completedAt - ut.startedAt);
            }
            return sum;
        }, 0);
        avgCompletionTime = totalTime / completedTasks.length;
    }

    // Calculate average progress for in-progress tasks
    const avgProgress = inProgressTasks.length > 0
        ? inProgressTasks.reduce((sum, ut) => sum + ut.progress, 0) / inProgressTasks.length
        : 0;

    return {
        taskId,
        totalCompletions,
        totalAttempts,
        completionRate: Math.round(completionRate * 100) / 100,
        avgCompletionTime: Math.round(avgCompletionTime / 1000), // Convert to seconds
        avgProgress: Math.round(avgProgress * 100) / 100,
        inProgress: inProgressTasks.length,
        failed: failedTasks.length,
        lastUpdated: new Date()
    };
};

// Award bonus for streak
export const awardStreakBonus = async (userId, streakDays) => {
    const bonuses = [
        { days: 3, coins: 10 },
        { days: 7, coins: 25 },
        { days: 14, coins: 50 },
        { days: 30, coins: 100 },
        { days: 90, coins: 250 },
        { days: 180, coins: 500 },
        { days: 365, coins: 1000 }
    ];

    const applicableBonus = bonuses
        .filter(bonus => streakDays >= bonus.days)
        .pop();

    if (applicableBonus) {
        const user = await User.findById(userId);
        user.coins += applicableBonus.coins;
        await user.save();

        return {
            awarded: true,
            streakDays,
            coins: applicableBonus.coins,
            message: `🎉 ${streakDays} kunlik streak uchun ${applicableBonus.coins} coin bonus!`
        };
    }

    return { awarded: false };
};