import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

import taskRoutes from '../routes/task.routes.js';
import authRoutes from '../routes/auth.routes.js';
import userRoutes from '../routes/user.routes.js';
import quizRoutes from '../routes/quiz.routes.js';
import adminRoutes from '../routes/admin.routes.js';
import adminTaskRoutes from '../routes/admin/task.routes.js';
import statsTaskRoutes from '../routes/statsTask.routes.js';
import adminUsers from '../routes/admin/adminuser.routes.js'
dotenv.config();

const app = express();

/* ================= DATABASE FIRST ================= */

mongoose.set('bufferCommands', false);

const MONGO_URI =
    process.env.MONGODB_URI ||
    "mongodb+srv://therakhimoffdev:40g948_SA@slot.yn1tdwo.mongodb.net/quizzo?retryWrites=true&w=majority";

await mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 30000,
});

console.log('✅ MongoDB connected');

/* ================= MIDDLEWARE ================= */

app.use(cors());
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/* ================= ROUTES ================= */

app.use('/api/tasks', taskRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/tasks', statsTaskRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/tasks', adminTaskRoutes);
app.use('/api/admin/users', adminUsers)
app.get('/', (req, res) => {
    res.json({ message: 'API is running' });
});

/* ================= ERRORS ================= */

app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({
        success: false,
        message: err.message || 'Server error'
    });
});

/* ================= START ================= */

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
    });
}

export default app;