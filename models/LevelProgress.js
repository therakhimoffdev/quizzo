import mongoose from 'mongoose';

const levelProgressSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    level: {
        type: Number,
        required: true,
        min: 1,
        max: 300,
    },
    act: {
        type: Number,
        required: true,
        enum: [1, 2, 3],
    },
    status: {
        type: String,
        enum: ['locked', 'current', 'completed'],
        default: 'locked',
    },
    rewards: {
        coins: {
            type: Number,
            default: 0,
        },
        xpBoost: {
            type: Number,
            default: 1,
        },
        specialReward: {
            type: String,
            default: null,
        },
    },
    claimed: {
        type: Boolean,
        default: false,
    },
    claimedAt: {
        type: Date,
        default: null,
    },
    unlockedAt: {
        type: Date,
        default: Date.now,
    },
    completedAt: {
        type: Date,
        default: null,
    },
}, {
    timestamps: true,
});

// Kompound index
levelProgressSchema.index({ user: 1, level: 1 }, { unique: true });

export default mongoose.model('LevelProgress', levelProgressSchema);