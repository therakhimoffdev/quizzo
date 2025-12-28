import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },

    description: {
        type: String,
        required: true
    },

    // Istalgan link: telegram, youtube, instagram, website
    externalLink: {
        type: String,
        required: true
    },

    // Mukofot HAR DOIM BOR
    reward: {
        coins: {
            type: Number,
            required: true,
            min: 1
        },
        xp: {
            type: Number,
            default: 0
        }
    },

    isActive: {
        type: Boolean,
        default: true
    },

    category: {
        type: String,
        enum: ['daily', 'one-time'],
        default: 'one-time'
    }

}, { timestamps: true });

export default mongoose.model('Task', taskSchema);
