import mongoose from 'mongoose';


const userSchema = new mongoose.Schema({
    telegram_id: { type: String, required: true, unique: true },
    first_name: String,
    username: String,
    photo_url: String,
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    victories: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
});


export default mongoose.model('User', userSchema);