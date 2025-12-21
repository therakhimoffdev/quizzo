import mongoose from 'mongoose';

const userTaskSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    task: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: ['pending', 'in-progress', 'completed', 'failed', 'expired'],
        default: 'pending'
    },
    progress: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    coinsEarned: {
        type: Number,
        default: 0
    },
    startedAt: {
        type: Date,
        default: Date.now
    },
    completedAt: {
        type: Date,
        default: null
    },
    expiresAt: {
        type: Date,
        default: null
    },
    attempts: {
        type: Number,
        default: 0,
        min: 0
    },
    maxAttempts: {
        type: Number,
        default: 3
    },
    data: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    verificationData: {
        screenshot: String,
        proof: String,
        verified: {
            type: Boolean,
            default: false
        },
        verifiedAt: {
            type: Date,
            default: null
        },
        verifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Compound index for unique user-task combination
userTaskSchema.index({ user: 1, task: 1 }, { unique: true });

// Index for status filtering
userTaskSchema.index({ user: 1, status: 1 });

// Virtual for completion time
userTaskSchema.virtual('completionTime').get(function () {
    if (this.completedAt && this.startedAt) {
        return this.completedAt - this.startedAt;
    }
    return null;
});

// Method to check if task is expired
userTaskSchema.methods.isExpired = function () {
    if (this.expiresAt) {
        return new Date() > this.expiresAt;
    }
    return false;
};

// Method to check if task can be retried
userTaskSchema.methods.canRetry = function () {
    return this.attempts < this.maxAttempts && this.status !== 'completed';
};

// Pre-save middleware to update status if progress is 100
userTaskSchema.pre('save', function (next) {
    if (this.progress >= 100 && this.status !== 'completed') {
        this.status = 'completed';
        this.completedAt = new Date();
        this.coinsEarned = this.task.coins; // Will be populated when queried
    }

    if (this.isExpired() && this.status !== 'expired') {
        this.status = 'expired';
    }

    next();
});

export default mongoose.model('UserTask', userTaskSchema);