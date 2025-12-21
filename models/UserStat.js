import mongoose from 'mongoose';

const userStatSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    dailyStats: {
        date: {
            type: Date,
            default: Date.now
        },
        tasksCompleted: {
            type: Number,
            default: 0
        },
        coinsEarned: {
            type: Number,
            default: 0
        },
        streak: {
            type: Number,
            default: 0
        }
    },
    weeklyStats: {
        week: {
            type: Number,
            default: () => {
                const now = new Date();
                const start = new Date(now.getFullYear(), 0, 1);
                const days = Math.floor((now - start) / (24 * 60 * 60 * 1000));
                return Math.ceil(days / 7);
            }
        },
        tasksCompleted: {
            type: Number,
            default: 0
        },
        coinsEarned: {
            type: Number,
            default: 0
        }
    },
    monthlyStats: {
        month: {
            type: Number,
            default: () => new Date().getMonth() + 1
        },
        tasksCompleted: {
            type: Number,
            default: 0
        },
        coinsEarned: {
            type: Number,
            default: 0
        }
    },
    allTimeStats: {
        totalTasksCompleted: {
            type: Number,
            default: 0
        },
        totalCoinsEarned: {
            type: Number,
            default: 0
        },
        totalTimeSpent: { // milliseconds
            type: Number,
            default: 0
        },
        averageCompletionTime: {
            type: Number,
            default: 0
        },
        streakRecord: {
            type: Number,
            default: 0
        }
    },
    achievements: [{
        achievementId: String,
        unlockedAt: Date,
        progress: Number,
        maxProgress: Number
    }],
    lastActive: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Update streak logic
userStatSchema.methods.updateStreak = function () {
    const now = new Date();
    const lastActive = new Date(this.lastActive);
    const diffDays = Math.floor((now - lastActive) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
        this.dailyStats.streak += 1;
    } else if (diffDays > 1) {
        this.dailyStats.streak = 1;
    }

    if (this.dailyStats.streak > this.allTimeStats.streakRecord) {
        this.allTimeStats.streakRecord = this.dailyStats.streak;
    }

    this.lastActive = now;
};

export default mongoose.model('UserStat', userStatSchema);