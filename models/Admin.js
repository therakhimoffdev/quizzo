import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const adminSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    role: {
        type: String,
        enum: ['super_admin', 'admin', 'moderator'],
        default: 'admin'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        type: Date
    },
    loginAttempts: {
        type: Number,
        default: 0
    },
    lockUntil: {
        type: Date
    },
    tokens: [{
        token: {
            type: String,
            required: true
        },
        expiresAt: {
            type: Date,
            required: true
        },
        deviceInfo: {
            type: String
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

// Mongoose 7+ uchun - pre hook async function
adminSchema.pre('save', async function () {
    // Agar password o'zgartirilmagan bo'lsa, hash qilish kerak emas
    if (!this.isModified('password')) return;

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    } catch (error) {
        throw new Error(`Password hash qilishda xatolik: ${error.message}`);
    }
});

// Passwordni solishtirish metod
adminSchema.methods.comparePassword = async function (candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw new Error(`Password solishtirishda xatolik: ${error.message}`);
    }
};

// Token yaratish metod
adminSchema.methods.generateAuthToken = function (deviceInfo = '') {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 kun

    // Tokenni saqlash
    this.tokens.push({
        token,
        expiresAt,
        deviceInfo
    });

    // Faqat 5 ta token saqlash
    if (this.tokens.length > 5) {
        this.tokens = this.tokens.slice(-5);
    }

    return { token, expiresAt };
};

// Tokenni tekshirish metod
adminSchema.methods.validateToken = function (token) {
    const tokenData = this.tokens.find(t => t.token === token);

    if (!tokenData) return false;
    if (new Date() > tokenData.expiresAt) return false;

    return true;
};

// Tokenni o'chirish metod
adminSchema.methods.removeToken = function (token) {
    this.tokens = this.tokens.filter(t => t.token !== token);
    return this;
};

// Block qilish metod
adminSchema.methods.incLoginAttempts = function () {
    // Agar bloklanmagan bo'lsa yoki blok vaqti o'tgan bo'lsa
    if (this.lockUntil && this.lockUntil < Date.now()) {
        return this.updateOne({
            $set: { loginAttempts: 1 },
            $unset: { lockUntil: 1 }
        });
    }

    const updates = { $inc: { loginAttempts: 1 } };

    // Agar loginAttempts 5 dan oshsa, 30 daqiqa bloklash
    if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
        updates.$set = { lockUntil: Date.now() + 30 * 60 * 1000 }; // 30 daqiqa
    }

    return this.updateOne(updates);
};

// Account bloklanganligini tekshirish
adminSchema.virtual('isLocked').get(function () {
    return !!(this.lockUntil && this.lockUntil > Date.now());
});

export default mongoose.model('Admin', adminSchema);