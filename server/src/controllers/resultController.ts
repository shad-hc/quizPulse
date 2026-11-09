import { Response } from 'express';
import Result from '../models/Result';
import User from '../models/User';
import { getTopLeaderboard } from '../services/redis/redis';
import { AuthRequest } from '../middleware/auth';
import { apiSuccess,apiServerError,apiUnauthorized, apiNotFound, apiForbidden } from '../utils/apiResponse';

export async function getQuizResults(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { quizId } = req.params;
    const results = await Result.find({ quizId })
      .populate('userId', 'name email')
      .sort({ totalScore: -1 })
      .lean();

    const leaderboard = await getTopLeaderboard(quizId, 50);
    apiSuccess(res,'success',{
      results,
      leaderboard
    })
  } catch (err) {
    apiServerError(res,'Internal Server Error',{
      error: String(err)
    })
  }
}

export async function getUserResult(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { quizId, userId } = req.params;

    // Users can only see their own results unless admin/organizer
    if (req.user!.role === 'user' && req.user!.userId !== userId) {
      apiForbidden(res);
      return;
    }

    const result = await Result.findOne({ quizId, userId })
      .populate('userId', 'name email')
      .lean();

     if(!result){
      apiNotFound(res,'Result not found');
      return;
     }

   apiSuccess(res,'success',{
    result
   })
  } catch (err) {
   apiServerError(res,'Internal Server Error',{
      error: String(err)
    })
  }
}

export async function getMyResults(req: AuthRequest, res: Response): Promise<void> {
  try {
    const results = await Result.find({ userId: req.user!.userId })
      .populate('quizId', 'title')
      .sort({ createdAt: -1 })
      .lean();
    apiSuccess(res,'success',{
      results
    })
  } catch (err) {
    apiServerError(res,'Internal Server Error',{
      error: String(err)
    })
  }
}
