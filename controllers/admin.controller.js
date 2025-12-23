import Admin from '../models/Admin.js';
import crypto from 'crypto';

// Admin login
export const adminLogin = async (req, res) => {
    try {
        const { username, password, deviceInfo = '' } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username va password kiritishingiz kerak'
            });
        }

        // Adminni topish
        const admin = await Admin.findOne({
            username,
            isActive: true
        });

        if (!admin) {
            return res.status(401).json({
                success: false,
                message: 'Username yoki password xato'
            });
        }

        // Account block holatini tekshirish
        if (admin.lockUntil && admin.lockUntil > Date.now()) {
            const lockMinutes = Math.ceil((admin.lockUntil - Date.now()) / (1000 * 60));
            return res.status(423).json({
                success: false,
                message: `Hisob ${lockMinutes} daqiqa bloklangan. Iltimos keyinroq urinib ko'ring.`
            });
        }

        // Passwordni tekshirish
        const isPasswordValid = await admin.comparePassword(password);

        if (!isPasswordValid) {
            // Noto'g'ri urinishlarni hisoblash
            admin.loginAttempts += 1;

            if (admin.loginAttempts >= 5) {
                // 5 marta xato kiritilsa, 30 daqiqa bloklash
                admin.lockUntil = new Date(Date.now() + 30 * 60 * 1000);
                await admin.save();

                return res.status(423).json({
                    success: false,
                    message: '5 marta noto\'g\'ri urinish. Hisob 30 daqiqa bloklandi.'
                });
            }

            await admin.save();

            return res.status(401).json({
                success: false,
                message: `Username yoki password xato. ${5 - admin.loginAttempts} urinish qoldi.`
            });
        }

        // Token yaratish
        const { token, expiresAt } = admin.generateAuthToken(deviceInfo);
        admin.loginAttempts = 0;
        admin.lockUntil = null;
        admin.lastLogin = new Date();

        await admin.save();

        // Response
        res.json({
            success: true,
            data: {
                token,
                expiresAt,
                admin: {
                    id: admin._id,
                    username: admin.username,
                    email: admin.email,
                    role: admin.role,
                    lastLogin: admin.lastLogin
                }
            }
        });
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Admin logout
export const adminLogout = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (token && req.admin) {
            const admin = await Admin.findById(req.admin._id);
            if (admin) {
                admin.removeToken(token);
                await admin.save();
            }
        }

        res.json({
            success: true,
            message: 'Muvaffaqiyatli chiqildi'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Admin profile
export const getAdminProfile = async (req, res) => {
    try {
        const admin = await Admin.findById(req.admin._id)
            .select('-password -tokens -__v');

        res.json({
            success: true,
            data: admin
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Admin yaratish (faqat super_admin uchun)
export const createAdmin = async (req, res) => {
    try {
        const { username, password, email, role = 'admin' } = req.body;

        // Faqat super_admin yangi admin yarata oladi
        if (req.admin.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Faqat super_admin yangi admin yarata oladi'
            });
        }

        // Validatsiya
        if (!username || !password || !email) {
            return res.status(400).json({
                success: false,
                message: 'Barcha maydonlarni to\'ldiring'
            });
        }

        // Username va email unikal ekanligini tekshirish
        const existingAdmin = await Admin.findOne({
            $or: [{ username }, { email }]
        });

        if (existingAdmin) {
            return res.status(400).json({
                success: false,
                message: 'Username yoki email allaqachon mavjud'
            });
        }

        // Yangi admin yaratish
        const admin = new Admin({
            username,
            password,
            email,
            role
        });

        await admin.save();

        res.status(201).json({
            success: true,
            message: 'Admin muvaffaqiyatli yaratildi',
            data: {
                id: admin._id,
                username: admin.username,
                email: admin.email,
                role: admin.role
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};