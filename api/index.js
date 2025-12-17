import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

import userRoutes from '../routes/user.routes.js';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check (FAQAT GET /)
app.get('/', (req, res) => {
    res.send('API is running...');
});

// Routes
app.use('/api/user', userRoutes);

// MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB error:', err));

export default app;
