import express from 'express';
import {
    createTask,
    getAllTasks,
    getTaskDetails,
    updateTask,
    deleteTask,
    toggleTaskStatus
} from '../../controllers/admin/task.controller.js';

import { adminAuth, adminRole } from '../../middleware/adminAuth.js';

const router = express.Router();

router.use(adminAuth);
router.use(adminRole('admin', 'super_admin'));

router.post('/', createTask);
router.get('/', getAllTasks);
router.get('/:id', getTaskDetails);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);
router.patch('/:id/status', toggleTaskStatus);

export default router;
