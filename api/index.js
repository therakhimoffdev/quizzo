import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import quizRoutes from '../routes/quiz.routes.js';
import userRoutes from '../routes/user.routes.js';
import connectDB from '../lib/db.js';
import authRoutes from '../routes/auth.routes.js';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
    res.send('API is running...');
});

// Routes
app.use('/api/user', authRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/users', userRoutes);

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Something went wrong!',
        error: err.message
    });
});
// Connect MongoDB once at startup
connectDB()
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

export default app;
