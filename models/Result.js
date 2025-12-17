import mongoose from 'mongoose';

const resultSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    quizId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Quiz',
        required: true
    },
    score: {
        type: Number,
        default: 0
    },
    totalQuestions: {
        type: Number,
        required: true
    },
    correctAnswers: {
        type: Number,
        default: 0
    },
    wrongAnswers: {
        type: Number,
        default: 0
    },
    timeSpent: {
        type: Number, // in seconds
        default: 0
    },
    answers: [{
        questionId: mongoose.Schema.Types.ObjectId,
        selectedOption: Number,
        isCorrect: Boolean,
        timeTaken: Number
    }],
    coinsEarned: {
        type: Number,
        default: 0
    },
    xpEarned: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

resultSchema.index({ userId: 1, quizId: 1 });

export default mongoose.model('Result', resultSchema);