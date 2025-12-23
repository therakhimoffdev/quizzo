import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

// Routes
import taskRoutes from '../routes/task.routes.js';
import authRoutes from '../routes/auth.routes.js';
import userRoutes from '../routes/user.routes.js';
import quizRoutes from '../routes/quiz.routes.js';
import adminRoutes from '../routes/admin.routes.js'
dotenv.config();

const app = express();

// ==================== MIDDLEWARE ====================

// CORS barcha uchun ochiq
app.use(cors());
app.set('trust proxy', 1);
// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ==================== ROUTES ====================

app.use('/api/tasks', taskRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/admin', adminRoutes)
// Test endpoint
app.get('/', (req, res) => {
    res.json({ message: 'API is running' });
});

// ==================== ERROR HANDLING ====================

// 404
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Global error
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({
        success: false,
        message: err.message || 'Server error'
    });
});

// ==================== DATABASE ====================

mongoose
    .connect(process.env.MONGODB_URI || "mongodb+srv://therakhimoffdev:40g948_SA@slot.yn1tdwo.mongodb.net/quizzo?retryWrites=true&w=majority")
    .then(() => console.log('MongoDB connected'))
    .catch((err) => console.error('MongoDB error:', err));

// ==================== EXPORT ====================

export default app;

// Lokal ishga tushirish
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}
