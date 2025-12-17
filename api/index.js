import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import connectDB from '../lib/db.js';
import userRoutes from '../routes/user.routes.js';

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
app.use('/api/user', userRoutes);

// Connect MongoDB once at startup
connectDB()
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

export default app;
