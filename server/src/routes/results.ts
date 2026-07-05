import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getQuizResults, getUserResult, getMyResults } from '../controllers/resultController';

const router = Router();

router.use(authenticate);

router.get('/me', getMyResults);
router.get('/:quizId', getQuizResults);
router.get('/:quizId/user/:userId', getUserResult);

export default router;
