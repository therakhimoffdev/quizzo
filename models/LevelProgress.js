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

// Sovrinlarni hisoblash (sizning misollaringizga ko'ra)
levelProgressSchema.statics.calculateRewards = function (level) {
    const rewards = {
        coins: 0,
        xpBoost: 1,
        specialReward: null,
        claimedCoins: 0
    };

    // Level 1-10 uchun sovrinlar
    if (level >= 1 && level <= 10) {
        // Level 1: 20 coin + basic reward
        if (level === 1) {
            rewards.coins = 20;
            rewards.xpBoost = 1.0;
            rewards.specialReward = "Beginner's Luck";
        }
        // Level 2-10
        else {
            rewards.coins = 20 + (level * 2);
            rewards.xpBoost = 1.0 + (level * 0.01);
        }
    }
    // Level 11-100
    else if (level <= 100) {
        if (level % 5 === 0) {
            rewards.coins = 100 + (level * 2);
            rewards.xpBoost = 1.2;
            rewards.specialReward = "XP Boost (1 soat)";
        }
        else if (level % 10 === 0) {
            rewards.coins = 150 + (level * 3);
            rewards.xpBoost = 1.3;
            // Har xil maxsus sovrinlar
            const specialRewards = {
                10: "Bronze Badge",
                20: "Silver Avatar",
                30: "Gold Frame",
                40: "Platinum Title",
                50: "Diamond Border",
                60: "Ruby Effects",
                70: "Emerald Trail",
                80: "Sapphire Crown",
                90: "Legendary Card",
                100: "Rising Star + ACT II"
            };
            rewards.specialReward = specialRewards[level] || "Special Reward";
        }
        else {
            rewards.coins = 20 + Math.floor(level * 0.5);
            rewards.xpBoost = 1.0 + (level * 0.001);
        }

        if (level === 100) {
            rewards.coins = 500;
            rewards.xpBoost = 2.0;
        }
    }
    // Level 101-200
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
            const specialRewards = {
                110: "Pro Starter Pack",
                120: "Pro Avatar",
                130: "Pro Border",
                140: "Pro Effects",
                150: "Pro Master",
                160: "Elite Pass",
                170: "Premium Access",
                180: "VIP Status",
                190: "Champion Title",
                200: "Legendary Mind + ACT III"
            };
            rewards.specialReward = specialRewards[level] || "Pro Reward";
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
    // Level 201-300
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
            const specialRewards = {
                210: "Legendary Pack",
                220: "Mythic Avatar",
                230: "Ancient Frame",
                240: "Immortal Title",
                250: "Godlike Status",
                260: "Divine Effects",
                270: "Celestial Trail",
                280: "Cosmic Crown",
                290: "Universe Card",
                300: "IMMORTAL PLAYER"
            };
            rewards.specialReward = specialRewards[level] || "Legendary Reward";
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

// Foydalanuvchi uchun barcha level progresslarni yaratish
levelProgressSchema.statics.createAllLevelsForUser = async function (userId, currentLevel = 1) {
    const LevelProgress = mongoose.model('LevelProgress');

    for (let level = 1; level <= 300; level++) {
        const status = level < currentLevel ? 'completed' :
            level === currentLevel ? 'current' : 'locked';

        const act = Math.floor((level - 1) / 100) + 1;
        const requiredXP = LevelProgress.calculateRequiredXP(level);
        const rewards = LevelProgress.calculateRewards(level);

        await LevelProgress.findOneAndUpdate(
            { user: userId, level },
            {
                user: userId,
                level,
                act,
                status,
                requiredXP,
                rewards,
                currentXP: status === 'current' ? 0 : (status === 'completed' ? requiredXP : 0),
                unlockedAt: status !== 'locked' ? new Date() : null,
                completedAt: status === 'completed' ? new Date() : null
            },
            { upsert: true, new: true }
        );
    }
};

export default mongoose.model('LevelProgress', levelProgressSchema);