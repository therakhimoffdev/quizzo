import mongoose from "mongoose";
const userTaskSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    task: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
        required: true
    },
    status: {
        type: String,
        enum: ['completed'],
        default: 'completed'
    },
    coinsEarned: Number,
    xpEarned: Number,
    completedAt: {
        type: Date,
        default: Date.now
    }
});

userTaskSchema.index({ user: 1, task: 1 }, { unique: true });

export default mongoose.model('UserTask', userTaskSchema);
