import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
    {
        // Telegram ma'lumotlari
        telegram_id: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        first_name: {
            type: String,
            default: '',
        },
        username: {
            type: String,
            default: '',
        },
        photo_url: {
            type: String,
            default: '',
        },

        // 🎮 Gamification
        level: {
            type: Number,
            default: 1,
        },
        levelProgress: {
            currentAct: {
                type: Number,
                default: 1,
                enum: [1, 2, 3],
            },
            highestLevel: {
                type: Number,
                default: 1,
            },
            totalLevelsCompleted: {
                type: Number,
                default: 0,
            },
        },
        activeBonuses: [{
            type: {
                type: String,
                enum: ['xpBoost', 'coinBoost', 'special'],
            },
            value: Number,
            expiresAt: Date,
            description: String,
        }],
        rewardsClaimed: [{
            level: Number,
            rewardType: String,
            claimedAt: Date,
        }],
        requiredXp: {
            type: Number,
            default: 100, // Level 1 uchun kerak bo'ladigan XP
        },
        xp: {
            type: Number,
            default: 0,
        },
        coins: {
            type: Number,
            default: 100, // 🔥 yangi foydalanuvchiga beriladigan boshlang‘ich coin
        },

        // 🏆 Statistika
        total_games: {
            type: Number,
            default: 0,
        },
        wins: {
            type: Number,
            default: 0,
        },
        loses: {
            type: Number,
            default: 0,
        },
        correct_answers: {
            type: Number,
            default: 0,
        },
        wrong_answers: {
            type: Number,
            default: 0,
        },

        // ⚔ Duel / Match
        rating: {
            type: Number,
            default: 1000,
        },

        // 🛍 Shop / Premium
        is_premium: {
            type: Boolean,
            default: false,
        },

        // Holat
        is_blocked: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true, // createdAt, updatedAt
    }
);

userSchema.methods.addXP = async function (xpAmount, reason = '') {
    const xpBoost = this.activeBonuses
        .filter(b => b.type === 'xpBoost' && b.expiresAt > new Date())
        .reduce((total, bonus) => total * bonus.value, 1);

    const boostedXP = Math.floor(xpAmount * xpBoost);
    this.xp += boostedXP;

    // Levelni tekshirish
    await this.checkLevelUp();

    await this.save();
    return { xpGained: boostedXP, newXP: this.xp, leveledUp: false };
};

// Level up tekshirish metod
userSchema.methods.checkLevelUp = async function () {
    let leveledUp = false;

    while (this.xp >= this.requiredXp) {
        this.xp -= this.requiredXp;
        this.level += 1;
        leveledUp = true;

        // Yangi level uchun requiredXP ni hisoblash
        this.requiredXp = Math.floor(100 * Math.pow(1.1, this.level - 1));

        // Level progressni yangilash
        await this.updateLevelProgress();

        // Yangi level uchun LevelProgress yaratish
        await this.createLevelProgress();

        // 100 yoki 200 levelda ACT o'zgarishi
        if (this.level === 100 || this.level === 200) {
            this.levelProgress.currentAct = Math.floor(this.level / 100) + 1;
        }
    }

    if (leveledUp) {
        await this.save();
    }

    return leveledUp;
};

// Level progressni yangilash
userSchema.methods.updateLevelProgress = async function () {
    this.levelProgress.highestLevel = Math.max(this.levelProgress.highestLevel, this.level);
    this.levelProgress.totalLevelsCompleted = this.level - 1;
};

// Yangi level uchun progress yaratish
userSchema.methods.createLevelProgress = async function () {
    const LevelProgress = mongoose.model('LevelProgress');

    // Avvalgi levelni completed qilish
    await LevelProgress.findOneAndUpdate(
        { user: this._id, level: this.level - 1 },
        {
            status: 'completed',
            completedAt: new Date()
        }
    );

    // Yangi levelni current qilish
    await LevelProgress.findOneAndUpdate(
        { user: this._id, level: this.level },
        {
            status: 'current',
            act: this.levelProgress.currentAct,
        },
        { upsert: true, new: true }
    );

    // Keyingi levelni locked qilish
    await LevelProgress.findOneAndUpdate(
        { user: this._id, level: this.level + 1 },
        {
            status: 'locked',
            act: this.levelProgress.currentAct,
        },
        { upsert: true, new: true }
    );
};

// Foydalanuvchi yaratilganda level progressni boshlash
userSchema.post('save', async function (doc) {
    if (doc.isNew) {
        const LevelProgress = mongoose.model('LevelProgress');

        // Level 1 ni current qilish
        await LevelProgress.create({
            user: doc._id,
            level: 1,
            act: 1,
            status: 'current',
            rewards: getLevelRewards(1),
        });

        // Level 2-10 ni locked qilish
        for (let i = 2; i <= 10; i++) {
            await LevelProgress.create({
                user: doc._id,
                level: i,
                act: 1,
                status: 'locked',
                rewards: getLevelRewards(i),
            });
        }
    }
});

// Level sovrinlarini hisoblash funksiyasi (frontend dagi bilan bir xil)
function getLevelRewards(level) {
    const rewards = {
        coins: 0,
        xpBoost: 1,
        specialReward: null
    };

    if (level <= 100) {
        rewards.coins = 20 + Math.floor(Math.random() * 31);
        rewards.xpBoost = 1.1;

        if (level % 5 === 0) {
            rewards.coins += 100;
            rewards.xpBoost = 1.2;
            rewards.specialReward = "XP Boost (1 soat)";
        }

        if (level % 10 === 0) {
            rewards.specialReward = "Mystery Box";
        }

        if ([25, 50, 75].includes(level)) {
            rewards.specialReward = "Avatar Border";
        }

        if (level === 100) {
            rewards.coins = 500;
            rewards.xpBoost = 2;
            rewards.specialReward = "Rising Star + ACT II";
        }
    }

    if (level > 100 && level <= 200) {
        rewards.coins = 80 + Math.floor(Math.random() * 41);
        rewards.xpBoost = 1.1;

        if (level % 5 === 0) {
            rewards.specialReward = "Premium Ticket";
        }

        if (level % 10 === 0) {
            rewards.specialReward = "Pro Chest";
        }

        if (level === 150) {
            rewards.specialReward = "Pro Badge";
        }

        if (level === 200) {
            rewards.coins = 1500;
            rewards.specialReward = "Elite Mind + ACT III";
        }
    }

    if (level > 200) {
        rewards.coins = 150 + Math.floor(Math.random() * 101);
        rewards.xpBoost = 1.2;

        if (level % 5 === 0) {
            rewards.specialReward = "Elite Ticket";
        }

        if (level % 10 === 0) {
            rewards.specialReward = "Legend Chest";
        }

        if (level === 250) {
            rewards.specialReward = "Legend Badge";
        }

        if (level === 300) {
            rewards.coins = 5000;
            rewards.specialReward = "IMMORTAL PLAYER";
        }
    }

    return rewards;
}

export default mongoose.model('User', userSchema);
