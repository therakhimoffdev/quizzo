import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    icon: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['subscription', 'advertisement', 'quiz', 'referral', 'streak',
            'achievement', 'profile', 'score', 'premium', 'category', 'social'],
        required: true
    },
    coins: {
        type: Number,
        required: true,
        min: 0
    },
    requiredAction: {
        type: String,
        required: true
    },
    link: {
        type: String,
        default: null
    },
    externalLink: {
        type: String,
        default: null
    },
    timeEstimate: {
        type: String,
        required: true
    },
    color: {
        type: String,
        default: 'from-blue-600 to-blue-800'
    },
    status: {
        type: String,
        enum: ['pending', 'available', 'in-progress', 'completed'],
        default: 'available'
    },
    category: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'one-time', 'special'],
        default: 'daily'
    },
    difficulty: {
        type: String,
        enum: ['easy', 'medium', 'hard', 'expert'],
        default: 'medium'
    },
    maxCompletions: {
        type: Number,
        default: 1
    },
    cooldownHours: {
        type: Number,
        default: 0
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    endDate: {
        type: Date,
        default: null
    },
    isActive: {
        type: Boolean,
        default: true
    },
    tags: [{
        type: String
    }],
    requirements: {
        minLevel: {
            type: Number,
            default: 1
        },
        minCoins: {
            type: Number,
            default: 0
        },
        previousTasks: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Task'
        }]
    },
    isStatBased: {
        type: Boolean,
        default: false
    },
    statisticType: {
        type: String,
        enum: [
            'total_games', 'wins', 'loses', 'correct_answers', 'wrong_answers',
            'rating', 'coins', 'level', 'xp', 'streak', 'total_duels', 'win_rate'
        ],
        default: null
    },
    targetValue: {
        type: Number,
        default: 0
    },
    hideAfterCompletion: {
        type: Boolean,
        default: true
    },
    metadata: {
        views: {
            type: Number,
            default: 0
        },
        completions: {
            type: Number,
            default: 0
        },
        avgCompletionTime: {
            type: Number,
            default: 0
        }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual field for progress percentage
taskSchema.virtual('progress').get(function () {
    return 0; // Default progress
});

// Indexes for better performance
taskSchema.index({ type: 1, isActive: 1 });
taskSchema.index({ category: 1, status: 1 });
taskSchema.index({ 'requirements.minLevel': 1 });

export default mongoose.model('Task', taskSchema);