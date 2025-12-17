import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
    quizId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Quiz',
        required: true
    },
    questionText: {
        type: String,
        required: true
    },
    options: [{
        text: String,
        isCorrect: Boolean
    }],
    explanation: {
        type: String,
        default: ''
    },
    points: {
        type: Number,
        default: 10
    },
    timeLimit: {
        type: Number, // in seconds
        default: 30
    }
}, {
    timestamps: true
});

export default mongoose.model('Question', questionSchema);