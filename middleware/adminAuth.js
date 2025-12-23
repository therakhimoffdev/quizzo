import Admin from '../models/Admin.js';

export const adminAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Admin token talab qilinadi'
            });
        }

        const token = authHeader.split(' ')[1];

        // Adminni tokenni tekshirish orqali topish
        const admin = await Admin.findOne({
            isActive: true,
            'tokens.token': token
        });

        if (!admin) {
            return res.status(401).json({
                success: false,
                message: 'Yaroqsiz admin token'
            });
        }

        // Tokenni validatsiya qilish
        const isValidToken = admin.validateToken(token);
        if (!isValidToken) {
            return res.status(401).json({
                success: false,
                message: 'Token muddati tugagan yoki yaroqsiz'
            });
        }

        // Admin ma'lumotlarini requestga qo'shish
        req.admin = {
            _id: admin._id,
            username: admin.username,
            email: admin.email,
            role: admin.role
        };
        req.user = req.admin; // Oldingi kod bilan moslashish uchun

        // Login vaqti va urinishlarni yangilash
        admin.lastLogin = new Date();
        admin.loginAttempts = 0;
        await admin.save();

        next();
    } catch (error) {
        console.error('Admin auth error:', error);
        res.status(500).json({
            success: false,
            message: 'Autentifikatsiya jarayonida xatolik'
        });
    }
};

// Admin huquqlarini tekshirish
export const adminRole = (...roles) => {
    return (req, res, next) => {
        if (!req.admin) {
            return res.status(401).json({
                success: false,
                message: 'Autentifikatsiya talab qilinadi'
            });
        }

        if (!roles.includes(req.admin.role)) {
            return res.status(403).json({
                success: false,
                message: `Bu amalni bajarish uchun ${roles.join(' yoki ')} huquqi kerak`
            });
        }

        next();
    };
};