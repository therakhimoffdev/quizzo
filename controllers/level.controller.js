import LevelProgress from '../models/LevelProgress.js';
import User from '../models/User.js';

// ACT ma'lumotlari
const ACTS = [
    {
        id: 1,
        name: "STARTER",
        shortName: "I",
        theme: "growth",
        color: "emerald",
        gradient: "from-emerald-500 to-teal-600",
        range: [1, 100],
        description: "Boshlang'ich bosqich"
    },
    {
        id: 2,
        name: "PRO",
        shortName: "II",
        theme: "mastery",
        color: "blue",
        gradient: "from-blue-500 to-indigo-600",
        range: [101, 200],
        description: "Professional bosqich"
    },
    {
        id: 3,
        name: "LEGEND",
        shortName: "III",
        theme: "prestige",
        color: "purple",
        gradient: "from-purple-500 to-pink-600",
        range: [201, 300],
        description: "Afsonaviy bosqich"
    }
];

// Level map ma'lumotlarini olish
export const getLevelMap = async (req, res) => {
    try {
        const userId = req.user._id;

        // User ma'lumotlarini olish
        const user = await User.findById(userId)
            .select('level xp requiredXp coins levelProgress activeBonuses');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Foydalanuvchi topilmadi"
            });
        }

        // Level progresslarni olish yoki yaratish
        let levelProgress = await LevelProgress.find({ user: userId })
            .sort({ level: 1 })
            .limit(300);

        // Agar progress bo'lmasa, barcha level progresslarini yaratish
        if (levelProgress.length === 0) {
            await initializeUserLevels(userId);
            levelProgress = await LevelProgress.find({ user: userId }).sort({ level: 1 });
        }

        // ACT bo'yicha guruhlash
        const acts = ACTS.map(act => {
            const actProgress = levelProgress.filter(lp =>
                lp.level >= act.range[0] && lp.level <= act.range[1]
            );

            return {
                ...act,
                progress: actProgress.map(lp => ({
                    level: lp.level,
                    status: lp.status,
                    rewards: lp.rewards,
                    currentXP: lp.currentXP,
                    requiredXP: lp.requiredXP,
                    isClaimed: lp.isClaimed,
                    act: lp.act
                }))
            };
        });

        // Joriy ACT ni aniqlash
        const currentAct = Math.floor((user.level - 1) / 100) + 1;

        // XP progress hisoblash
        const currentLevelProgress = levelProgress.find(lp => lp.level === user.level) || {};
        const xpProgress = {
            current: user.xp,
            required: user.requiredXp,
            percentage: (user.xp / user.requiredXp) * 100
        };

        res.json({
            success: true,
            data: {
                user: {
                    level: user.level,
                    xp: user.xp,
                    requiredXp: user.requiredXp,
                    coins: user.coins,
                    levelProgress: user.levelProgress,
                    activeBonuses: user.activeBonuses,
                    xpProgress: xpProgress
                },
                acts,
                currentAct
            }
        });

    } catch (error) {
        console.error('Level map error:', error);
        res.status(500).json({
            success: false,
            message: "Server xatosi"
        });
    }
};

// Level sovrinlarini olish
export const claimLevelReward = async (req, res) => {
    try {
        const userId = req.user._id;
        const { level } = req.params;
        const levelNum = parseInt(level);

        if (levelNum < 1 || levelNum > 300) {
            return res.status(400).json({
                success: false,
                message: "Noto'g'ri level raqami"
            });
        }

        // Level progressni tekshirish
        const progress = await LevelProgress.findOne({
            user: userId,
            level: levelNum
        });

        if (!progress) {
            return res.status(404).json({
                success: false,
                message: "Level topilmadi"
            });
        }

        // Level tamomlanganligini tekshirish
        if (progress.status !== 'completed' && progress.status !== 'current') {
            return res.status(400).json({
                success: false,
                message: "Bu level hali tamomlanmagan"
            });
        }

        // Sovrin olib bo'linganligini tekshirish
        if (progress.isClaimed) {
            return res.status(400).json({
                success: false,
                message: "Sovrin allaqachon olingan"
            });
        }

        // Foydalanuvchini topish
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Foydalanuvchi topilmadi"
            });
        }

        // Sovrinlarni berish
        user.coins += progress.rewards.coins;

        // XP boost ni qo'llash (agar mavjud bo'lsa)
        if (progress.rewards.xpBoost > 1) {
            user.activeBonuses.push({
                type: 'xpBoost',
                value: progress.rewards.xpBoost,
                expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 soat
                description: `Level ${levelNum} XP Boost`
            });
        }

        // Maxsus sovrinni qo'shish
        if (progress.rewards.specialReward) {
            user.rewardsClaimed.push({
                level: levelNum,
                rewardType: progress.rewards.specialReward,
                claimedAt: new Date()
            });
        }

        // Level progressni yangilash
        progress.isClaimed = true;
        progress.rewards.claimedCoins = progress.rewards.coins;
        progress.rewards.claimedAt = new Date();

        // Saqlash
        await Promise.all([
            user.save(),
            progress.save()
        ]);

        res.json({
            success: true,
            data: {
                level: progress.level,
                rewards: progress.rewards,
                user: {
                    coins: user.coins,
                    level: user.level,
                    xp: user.xp,
                    activeBonuses: user.activeBonuses
                }
            },
            message: `Sovrin muvaffaqiyatli olindi! ${progress.rewards.coins} coin qo'shildi.`
        });

    } catch (error) {
        console.error('Claim reward error:', error);
        res.status(500).json({
            success: false,
            message: "Server xatosi"
        });
    }
};

// XP qo'shish
export const addXP = async (req, res) => {
    try {
        const userId = req.user._id;
        const { xpAmount, reason } = req.body;

        if (!xpAmount || xpAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Noto'g'ri XP miqdori"
            });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Foydalanuvchi topilmadi"
            });
        }

        // Aktive bonuslarni hisoblash
        const activeXpBonuses = user.activeBonuses.filter(bonus =>
            bonus.type === 'xpBoost' &&
            bonus.expiresAt > new Date()
        );

        const totalXpBoost = activeXpBonuses.reduce((total, bonus) => total * bonus.value, 1);
        const boostedXP = Math.floor(xpAmount * totalXpBoost);

        // XP qo'shish
        user.xp += boostedXP;

        // Levelni tekshirish
        let leveledUp = false;
        let newLevel = user.level;

        while (user.xp >= user.requiredXp) {
            // Ortiqcha XP ni olib tashlash
            user.xp -= user.requiredXp;
            user.level += 1;
            leveledUp = true;
            newLevel = user.level;

            // Yangi level uchun requiredXP ni hisoblash
            user.requiredXp = Math.floor(100 * Math.pow(1.15, user.level - 1));

            // Level progressni yangilash
            await updateLevelProgress(userId, user.level);

            // 100 yoki 200 levelda ACT o'zgarishi
            if (user.level === 100 || user.level === 200) {
                user.levelProgress.currentAct = Math.floor(user.level / 100) + 1;

                // Yangi ACT uchun level progresslarni yaratish
                await createLevelProgressForAct(userId, user.levelProgress.currentAct);
            }
        }

        // Saqlash
        await user.save();

        // Yangi user ma'lumotlarini olish
        const updatedUser = await User.findById(userId)
            .select('level xp requiredXp coins levelProgress');

        res.json({
            success: true,
            data: {
                xpAdded: boostedXP,
                oldLevel: user.level - (leveledUp ? 1 : 0),
                newLevel: updatedUser.level,
                user: updatedUser,
                leveledUp: leveledUp,
                xpBoost: totalXpBoost
            },
            message: `+${boostedXP} XP qo'shildi! ${leveledUp ? `Level ${newLevel} ga chiqdingiz!` : ''}`
        });

    } catch (error) {
        console.error('Add XP error:', error);
        res.status(500).json({
            success: false,
            message: "Server xatosi"
        });
    }
};

// Foydalanuvchi level progresslarini boshlash
const initializeUserLevels = async (userId) => {
    for (let level = 1; level <= 300; level++) {
        const status = level === 1 ? 'current' : 'locked';
        const act = Math.floor((level - 1) / 100) + 1;
        const requiredXP = Math.floor(100 * Math.pow(1.15, level - 1));
        const rewards = LevelProgress.calculateRewards(level);

        await LevelProgress.create({
            user: userId,
            level,
            act,
            status,
            requiredXP,
            rewards
        });
    }
};

// Level progressni yangilash
const updateLevelProgress = async (userId, newLevel) => {
    // Oldingi levelni completed qilish
    await LevelProgress.findOneAndUpdate(
        { user: userId, level: newLevel - 1 },
        {
            status: 'completed',
            completedAt: new Date(),
            currentXP: 0
        }
    );

    // Yangi levelni current qilish
    await LevelProgress.findOneAndUpdate(
        { user: userId, level: newLevel },
        {
            status: 'current',
            unlockedAt: new Date()
        }
    );

    // Keyingi levelni ochish
    if (newLevel < 300) {
        await LevelProgress.findOneAndUpdate(
            { user: userId, level: newLevel + 1 },
            {
                status: 'locked'
            },
            { upsert: true }
        );
    }
};

// Yangi ACT uchun level progresslarni yaratish
const createLevelProgressForAct = async (userId, act) => {
    const startLevel = (act - 1) * 100 + 1;
    const endLevel = act * 100;

    for (let level = startLevel; level <= endLevel; level++) {
        const exists = await LevelProgress.findOne({ user: userId, level });
        if (!exists) {
            const requiredXP = Math.floor(100 * Math.pow(1.15, level - 1));
            const rewards = LevelProgress.calculateRewards(level);

            await LevelProgress.create({
                user: userId,
                level,
                act,
                status: level === startLevel ? 'current' : 'locked',
                requiredXP,
                rewards
            });
        }
    }
};

// Levelning batafsil ma'lumotlarini olish
export const getLevelDetails = async (req, res) => {
    try {
        const userId = req.user._id;
        const { level } = req.params;
        const levelNum = parseInt(level);

        if (levelNum < 1 || levelNum > 300) {
            return res.status(400).json({
                success: false,
                message: "Noto'g'ri level raqami"
            });
        }

        const progress = await LevelProgress.findOne({
            user: userId,
            level: levelNum
        });

        if (!progress) {
            return res.status(404).json({
                success: false,
                message: "Level topilmadi"
            });
        }

        // ACT ni aniqlash
        const act = ACTS.find(a =>
            levelNum >= a.range[0] && levelNum <= a.range[1]
        );

        res.json({
            success: true,
            data: {
                level: progress.level,
                act,
                status: progress.status,
                rewards: progress.rewards,
                currentXP: progress.currentXP,
                requiredXP: progress.requiredXP,
                isClaimed: progress.isClaimed,
                claimedAt: progress.rewards.claimedAt,
                completedAt: progress.completedAt
            }
        });

    } catch (error) {
        console.error('Get level details error:', error);
        res.status(500).json({
            success: false,
            message: "Server xatosi"
        });
    }
};