import express from 'express';
import {
    createTask,
    getAllTasks,
    getTaskDetails,
    updateTask,
    deleteTask,
    toggleTaskStatus,
    getPendingVerifications
} from '../../controllers/admin/task.controller.js';
import { adminAuth, adminRole } from '../../middleware/adminAuth.js';
const router = express.Router();


router.use(adminAuth);
router.use(adminRole('admin', 'superadmin'));

// Task CRUD operations
router.post('/', createTask);
router.get('/', getAllTasks);
router.get('/pending-verifications', getPendingVerifications);
router.get('/:id', getTaskDetails);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);
router.patch('/:id/status', toggleTaskStatus);

export default router;