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
        claimedCoins: {
            type: Number,
            default: 0,
        },
        claimedAt: {
            type: Date,
            default: null,
        }
    },
    requiredXP: {
        type: Number,
        default: 100,
    },
    currentXP: {
        type: Number,
        default: 0,
    },
    isClaimed: {
        type: Boolean,
        default: false,
    },
    unlockedAt: {
        type: Date,
        default: null,
    },
    completedAt: {
        type: Date,
        default: null,
    },
}, {
    timestamps: true,
});

// Level bo'yicha XP hisoblash formulasi
levelProgressSchema.statics.calculateRequiredXP = function (level) {
    return Math.floor(100 * Math.pow(1.15, level - 1));
};

// Sovrinlarni hisoblash
levelProgressSchema.statics.calculateRewards = function (level) {
    const rewards = {
        coins: 0,
        xpBoost: 1,
        specialReward: null,
        claimedCoins: 0
    };

    // ACT I (1-100)
    if (level <= 100) {
        // Har 5 levelda: bonus coins + xp boost
        if (level % 5 === 0) {
            rewards.coins = 100 + (level * 2);
            rewards.xpBoost = 1.2;
            rewards.specialReward = "XP Boost (1 soat)";
        }
        // Har 10 levelda: maxsus sovrin
        else if (level % 10 === 0) {
            rewards.coins = 150 + (level * 3);
            rewards.xpBoost = 1.3;
            if (level === 10) rewards.specialReward = "Bronze Badge";
            else if (level === 20) rewards.specialReward = "Silver Avatar";
            else if (level === 30) rewards.specialReward = "Gold Frame";
            else if (level === 40) rewards.specialReward = "Platinum Title";
            else if (level === 50) rewards.specialReward = "Diamond Border";
            else if (level === 60) rewards.specialReward = "Ruby Effects";
            else if (level === 70) rewards.specialReward = "Emerald Trail";
            else if (level === 80) rewards.specialReward = "Sapphire Crown";
            else if (level === 90) rewards.specialReward = "Legendary Card";
            else if (level === 100) rewards.specialReward = "Rising Star + ACT II";
        }
        // Normal level
        else {
            rewards.coins = 20 + Math.floor(level * 0.5);
            rewards.xpBoost = 1.0 + (level * 0.001);
        }

        // BOSS level (100)
        if (level === 100) {
            rewards.coins = 500;
            rewards.xpBoost = 2.0;
        }
    }

    // ACT II (101-200)
    else if (level <= 200) {
        const relativeLevel = level - 100;

        if (level % 5 === 0) {
            rewards.coins = 200 + (relativeLevel * 3);
            rewards.xpBoost = 1.3;
            rewards.specialReward = "Pro Ticket";
        }
        else if (level % 10 === 0) {
            rewards.coins = 300 + (relativeLevel * 4);
            rewards.xpBoost = 1.4;
            if (level === 110) rewards.specialReward = "Pro Starter Pack";
            else if (level === 120) rewards.specialReward = "Pro Avatar";
            else if (level === 130) rewards.specialReward = "Pro Border";
            else if (level === 140) rewards.specialReward = "Pro Effects";
            else if (level === 150) rewards.specialReward = "Pro Master";
            else if (level === 160) rewards.specialReward = "Elite Pass";
            else if (level === 170) rewards.specialReward = "Premium Access";
            else if (level === 180) rewards.specialReward = "VIP Status";
            else if (level === 190) rewards.specialReward = "Champion Title";
            else if (level === 200) rewards.specialReward = "Legendary Mind + ACT III";
        }
        else {
            rewards.coins = 50 + Math.floor(relativeLevel * 0.8);
            rewards.xpBoost = 1.1 + (relativeLevel * 0.001);
        }

        if (level === 150) {
            rewards.coins = 1000;
            rewards.xpBoost = 1.8;
        }

        if (level === 200) {
            rewards.coins = 2000;
            rewards.xpBoost = 2.2;
        }
    }

    // ACT III (201-300)
    else {
        const relativeLevel = level - 200;

        if (level % 5 === 0) {
            rewards.coins = 400 + (relativeLevel * 5);
            rewards.xpBoost = 1.5;
            rewards.specialReward = "Legendary Ticket";
        }
        else if (level % 10 === 0) {
            rewards.coins = 600 + (relativeLevel * 6);
            rewards.xpBoost = 1.6;
            if (level === 210) rewards.specialReward = "Legendary Pack";
            else if (level === 220) rewards.specialReward = "Mythic Avatar";
            else if (level === 230) rewards.specialReward = "Ancient Frame";
            else if (level === 240) rewards.specialReward = "Immortal Title";
            else if (level === 250) rewards.specialReward = "Godlike Status";
            else if (level === 260) rewards.specialReward = "Divine Effects";
            else if (level === 270) rewards.specialReward = "Celestial Trail";
            else if (level === 280) rewards.specialReward = "Cosmic Crown";
            else if (level === 290) rewards.specialReward = "Universe Card";
            else if (level === 300) rewards.specialReward = "IMMORTAL PLAYER";
        }
        else {
            rewards.coins = 100 + Math.floor(relativeLevel * 1.2);
            rewards.xpBoost = 1.2 + (relativeLevel * 0.001);
        }

        if (level === 250) {
            rewards.coins = 3000;
            rewards.xpBoost = 2.0;
        }

        if (level === 300) {
            rewards.coins = 10000;
            rewards.xpBoost = 3.0;
        }
    }

    return rewards;
};

// Level XP progress hisoblash
levelProgressSchema.methods.calculateProgress = function () {
    const progressPercentage = (this.currentXP / this.requiredXP) * 100;
    return {
        percentage: Math.min(100, Math.max(0, progressPercentage)),
        current: this.currentXP,
        required: this.requiredXP,
        remaining: this.requiredXP - this.currentXP
    };
};

// Levelni tamomlash
levelProgressSchema.methods.completeLevel = async function (xpEarned = 0) {
    this.currentXP += xpEarned;

    if (this.currentXP >= this.requiredXP) {
        this.status = 'completed';
        this.completedAt = new Date();
        this.currentXP = this.requiredXP; // Ortiqcha XP keyingi levelga o'tkaziladi

        // Keyingi levelni ochish
        const LevelProgress = mongoose.model('LevelProgress');
        const nextLevel = await LevelProgress.findOne({
            user: this.user,
            level: this.level + 1
        });

        if (nextLevel && nextLevel.status === 'locked') {
            nextLevel.status = 'current';
            nextLevel.unlockedAt = new Date();
            await nextLevel.save();
        }

        await this.save();
        return { completed: true, overflowXP: this.currentXP - this.requiredXP };
    }

    await this.save();
    return { completed: false };
};

export default mongoose.model('LevelProgress', levelProgressSchema);    