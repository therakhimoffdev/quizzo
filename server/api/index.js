// server/index.js
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

import userRoutes from '../routes/user.routes.js';
// import quizRoutes, leaderboardRoutes, premiumRoutes when ready

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());


app.use('/', (req, res) => {
    res.send('API is running...');
});
// Routes
app.use('/api/user', userRoutes);
// app.use('/api/quiz', quizRoutes); 
// app.use('/api/leaderboard', leaderboardRoutes);
// app.use('/api/premium', premiumRoutes);

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});