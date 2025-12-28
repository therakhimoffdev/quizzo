import axios from 'axios';
import mongoose from 'mongoose';

import Task from '../models/Task.js';
import UserTask from '../models/UserTask.js';
import User from '../models/User.js';

const checkTelegramSubscription = async (telegramId, channelLink) => {
    try {
        const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
        const channel = channelLink.replace('https://t.me/', '@');

        const url = `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember`;

        const res = await axios.get(url, {
            params: {
                chat_id: channel,
                user_id: telegramId
            }
        });

        const status = res.data?.result?.status;
        return ['member', 'administrator', 'creator'].includes(status);
    } catch (e) {
        console.error('Telegram check failed:', e.response?.data || e.message);
        return false;
    }
};

export const getTasks = async (req, res) => {
    try {
        const userId = req.user._id;

        const tasks = await Task.find({ isActive: true })
            .sort({ createdAt: -1 });

        const completed = await UserTask.find({ user: userId });
        const completedIds = completed.map(t => t.task.toString());

        const result = tasks.map(task => ({
            ...task.toObject(),
            completed: completedIds.includes(task._id.toString())
        }));

        res.json({
            success: true,
            tasks: result
        });
    } catch (error) {
        console.error('Get tasks error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const completeTask = async (req, res) => {
    try {
        const userId = req.user._id;
        const telegramId = req.user.telegram_id;
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid task id' });
        }

        const task = await Task.findById(id);
        if (!task || !task.isActive) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }

        // Oldin bajarilganmi?
        const exists = await UserTask.findOne({ user: userId, task: id });
        if (exists) {
            return res.status(400).json({
                success: false,
                message: 'Task already completed'
            });
        }

        // 🔍 Telegram bo‘lsa — tekshiramiz
        if (task.externalLink.includes('t.me')) {
            const subscribed = await checkTelegramSubscription(
                telegramId,
                task.externalLink
            );

            if (!subscribed) {
                return res.status(400).json({
                    success: false,
                    message: 'Avval Telegram kanalga obuna bo‘ling'
                });
            }
        }

        // 📝 UserTask yozish
        await UserTask.create({
            user: userId,
            task: id,
            status: 'completed',
            coinsEarned: task.reward.coins,
            xpEarned: task.reward.xp
        });

        // 🎁 Coin + XP
        await User.findByIdAndUpdate(userId, {
            $inc: {
                coins: task.reward.coins,
                xp: task.reward.xp
            }
        });

        res.json({
            success: true,
            message: 'Task bajarildi',
            coinsAwarded: task.reward.coins,
            xpAwarded: task.reward.xp
        });

    } catch (error) {
        console.error('Complete task error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const verifyTask = async (req, res) => {
    try {
        const userId = req.user._id;
        const telegramId = req.user.telegram_id;
        const { id } = req.params;

        const task = await Task.findById(id);
        if (!task) {
            return res.status(404).json({ success: false, message: 'Task topilmadi' });
        }

        const userTask = await UserTask.findOne({ user: userId, task: id });
        if (!userTask || userTask.status !== 'in-progress') {
            return res.status(400).json({
                success: false,
                message: 'Avval vazifani bajaring'
            });
        }

        // 🔍 Telegram subscription tekshiruvi
        if (task.externalLink?.includes('t.me')) {
            const subscribed = await checkTelegramSubscription(
                telegramId,
                task.externalLink
            );

            if (!subscribed) {
                return res.status(400).json({
                    success: false,
                    message: 'Siz hali kanalga obuna bo‘lmagansiz'
                });
            }
        }

        // 🎁 Mukofot berish
        userTask.status = 'completed';
        userTask.coinsEarned = task.reward.coins;
        userTask.completedAt = new Date();
        await userTask.save();

        await User.findByIdAndUpdate(userId, {
            $inc: {
                coins: task.reward.coins,
                xp: task.reward.xp
            }
        });

        res.json({
            success: true,
            coinsAwarded: task.reward.coins,
            xpAwarded: task.reward.xp
        });

    } catch (e) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

