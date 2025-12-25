import mongoose from 'mongoose';

const quizSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true,
        enum: ['mathematics', 'history', 'english', 'geography', 'physics', 'chemistry', 'biology', 'programming']
    },
    difficulty: {
        type: String,
        enum: ['easy', 'medium', 'hard'],
        default: 'medium'
    },
    timeLimit: {
        type: Number, // in seconds
        required: true,
        min: 60
    },
    totalQuestions: {
        type: Number,
        required: true,
        min: 1
    },
    color: {
        type: String,
        default: 'blue'
    },
    isPremium: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    rating: {
        type: Number,
        default: 4.8,
        min: 0,
        max: 5
    },
    playCount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

export default mongoose.model('Quiz', quizSchema);