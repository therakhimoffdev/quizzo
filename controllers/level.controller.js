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
            .select('level xp requiredXp coins levelProgress');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Foydalanuvchi topilmadi"
            });
        }

        // Level progresslarni olish
        const levelProgress = await LevelProgress.find({ user: userId })
            .sort({ level: 1 })
            .limit(300);

        // ACT bo'yicha guruhlash
        const acts = ACTS.map(act => {
            const actProgress = levelProgress.filter(lp =>
                lp.level >= act.range[0] && lp.level <= act.range[1]
            );

            return {
                ...act,
                progress: actProgress
            };
        });

        // Joriy ACT ni aniqlash
        const currentAct = Math.floor((user.level - 1) / 100) + 1;

        res.json({
            success: true,
            data: {
                user: {
                    level: user.level,
                    xp: user.xp,
                    requiredXp: user.requiredXp,
                    coins: user.coins,
                    levelProgress: user.levelProgress
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
        if (progress.claimed) {
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
        progress.claimed = true;
        progress.claimedAt = new Date();

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
                    xp: user.xp
                }
            },
            message: "Sovrin muvaffaqiyatli olindi!"
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

        // XP qo'shish
        const result = await user.addXP(xpAmount, reason);

        // Yangi user ma'lumotlarini olish
        const updatedUser = await User.findById(userId)
            .select('level xp requiredXp coins levelProgress');

        res.json({
            success: true,
            data: {
                xpAdded: result.xpGained,
                oldLevel: user.level,
                newLevel: updatedUser.level,
                user: updatedUser,
                leveledUp: result.leveledUp
            },
            message: `+${result.xpGained} XP qo'shildi!`
        });

    } catch (error) {
        console.error('Add XP error:', error);
        res.status(500).json({
            success: false,
            message: "Server xatosi"
        });
    }
};

// ACT ma'lumotlarini olish
export const getActInfo = async (req, res) => {
    try {
        const { actId } = req.params;
        const actNum = parseInt(actId);

        if (actNum < 1 || actNum > 3) {
            return res.status(400).json({
                success: false,
                message: "Noto'g'ri ACT raqami"
            });
        }

        const act = ACTS.find(a => a.id === actNum);

        if (!act) {
            return res.status(404).json({
                success: false,
                message: "ACT topilmadi"
            });
        }

        // ACT dagi level progresslarni olish (agar user autentifikatsiyadan o'tgan bo'lsa)
        let actProgress = [];
        if (req.user) {
            actProgress = await LevelProgress.find({
                user: req.user._id,
                level: { $gte: act.range[0], $lte: act.range[1] }
            }).sort({ level: 1 });
        }

        res.json({
            success: true,
            data: {
                act,
                progress: actProgress
            }
        });

    } catch (error) {
        console.error('Get act info error:', error);
        res.status(500).json({
            success: false,
            message: "Server xatosi"
        });
    }
};

// Level progressni qo'lda yangilash (admin uchun)
export const updateLevelProgress = async (req, res) => {
    try {
        const { userId, level } = req.body;

        if (!userId || !level) {
            return res.status(400).json({
                success: false,
                message: "User ID va Level talab qilinadi"
            });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Foydalanuvchi topilmadi"
            });
        }

        // Levelni yangilash
        user.level = level;
        user.xp = 0;
        user.requiredXp = Math.floor(100 * Math.pow(1.1, level - 1));

        // Level progressni yangilash
        await user.updateLevelProgress();
        await user.save();

        // Barcha oldingi level progresslarni completed qilish
        await LevelProgress.updateMany(
            {
                user: userId,
                level: { $lte: level }
            },
            {
                status: 'completed',
                completedAt: new Date()
            }
        );

        // Joriy levelni current qilish
        await LevelProgress.findOneAndUpdate(
            { user: userId, level: level },
            {
                status: 'current',
                act: Math.floor((level - 1) / 100) + 1,
            },
            { upsert: true, new: true }
        );

        // Keyingi levelni locked qilish
        if (level < 300) {
            await LevelProgress.findOneAndUpdate(
                { user: userId, level: level + 1 },
                {
                    status: 'locked',
                    act: Math.floor((level) / 100) + 1,
                },
                { upsert: true, new: true }
            );
        }

        res.json({
            success: true,
            data: {
                user: {
                    level: user.level,
                    xp: user.xp,
                    requiredXp: user.requiredXp
                }
            },
            message: `Level ${level} ga yangilandi`
        });

    } catch (error) {
        console.error('Update level progress error:', error);
        res.status(500).json({
            success: false,
            message: "Server xatosi"
        });
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
                claimed: progress.claimed,
                claimedAt: progress.claimedAt,
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