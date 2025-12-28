import Task from '../../models/Task.js';
import UserTask from '../../models/UserTask.js';
import mongoose from 'mongoose';

/* ================= CREATE TASK ================= */
export const createTask = async (req, res) => {
    try {
        const {
            title,
            description,
            type,
            coins,
            requiredAction,
            externalLink,
            timeEstimate,
            category = 'one-time',
            difficulty = 'medium',
            isActive = true
        } = req.body;

        if (!title || !description || !type || !coins || !requiredAction) {
            return res.status(400).json({
                success: false,
                message: 'Majburiy maydonlar to‘liq emas'
            });
        }

        const task = await Task.create({
            title,
            description,
            type,
            coins,
            requiredAction,
            externalLink,
            timeEstimate: timeEstimate || '1–2 daqiqa',
            category,
            difficulty,
            isActive,
            icon: '🎯',
            color: 'from-blue-600 to-purple-700'
        });

        res.status(201).json({
            success: true,
            message: 'Task muvaffaqiyatli yaratildi',
            task
        });

    } catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

/* ================= GET ALL TASKS ================= */
export const getAllTasks = async (req, res) => {
    try {
        const tasks = await Task.find().sort({ createdAt: -1 });

        res.json({
            success: true,
            tasks
        });
    } catch (error) {
        console.error('Get tasks error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/* ================= GET TASK DETAILS ================= */
export const getTaskDetails = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid ID' });
        }

        const task = await Task.findById(id);
        if (!task) {
            return res.status(404).json({ success: false, message: 'Task topilmadi' });
        }

        const completedCount = await UserTask.countDocuments({
            task: id,
            status: 'completed'
        });

        res.json({
            success: true,
            task,
            stats: {
                completed: completedCount
            }
        });

    } catch (error) {
        console.error('Get task detail error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/* ================= UPDATE TASK ================= */
export const updateTask = async (req, res) => {
    try {
        const { id } = req.params;

        const task = await Task.findByIdAndUpdate(
            id,
            req.body,
            { new: true }
        );

        if (!task) {
            return res.status(404).json({ success: false, message: 'Task topilmadi' });
        }

        res.json({
            success: true,
            message: 'Task yangilandi',
            task
        });

    } catch (error) {
        console.error('Update task error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/* ================= DELETE TASK ================= */
export const deleteTask = async (req, res) => {
    try {
        const { id } = req.params;

        const completed = await UserTask.countDocuments({
            task: id,
            status: 'completed'
        });

        if (completed > 0) {
            return res.status(400).json({
                success: false,
                message: 'Bajarilgan taskni o‘chirish mumkin emas'
            });
        }

        await UserTask.deleteMany({ task: id });
        await Task.findByIdAndDelete(id);

        res.json({
            success: true,
            message: 'Task o‘chirildi'
        });

    } catch (error) {
        console.error('Delete task error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/* ================= TOGGLE ACTIVE ================= */
export const toggleTaskStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;

        const task = await Task.findByIdAndUpdate(
            id,
            { isActive },
            { new: true }
        );

        res.json({
            success: true,
            task
        });

    } catch (error) {
        console.error('Toggle status error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
