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

export default mongoose.model('User', userSchema);
