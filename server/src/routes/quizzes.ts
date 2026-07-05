import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import {
  createQuiz,
  listQuizzes,
  getQuiz,
  startQuiz,
  endQuiz,
  updateQuiz,
} from '../controllers/quizController';

const router = Router();

router.use(authenticate);

router.get('/', listQuizzes);
router.get('/:id', getQuiz);
router.post('/', requireRole('organizer', 'admin'), createQuiz);
router.put('/:id', requireRole('organizer', 'admin'), updateQuiz);
router.put('/:id/start', requireRole('organizer', 'admin'), startQuiz);
router.put('/:id/end', requireRole('organizer', 'admin'), endQuiz);

export default router;
