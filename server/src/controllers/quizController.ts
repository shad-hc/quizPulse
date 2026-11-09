import { Response } from 'express';
import mongoose from 'mongoose';
import Quiz from '../models/Quiz';
import Question from '../models/Question';
import { AuthRequest } from '../middleware/auth';
import { getCachedQuiz, getCachedQuestions, invalidateQuizCache } from '../services/redis/cache';
import { setRoomState, deleteRoomState } from '../services/redis/redis';
import { apiBadRequest, apiCreated, apiForbidden, apiServerError, apiSuccess, apiUnauthorized } from '../utils/apiResponse';

export async function createQuiz(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { title, description, questions } = req.body;
    if (!title || !questions?.length) {
      apiBadRequest(res,'title and atleast one question required');
      return;
    }

    const quiz = await Quiz.create({
      title,
      description: description || '',
      hostId: req.user!.userId,
    });

    const questionDocs = await Question.insertMany(
      questions.map((q: any, i: number) => ({
        quizId: quiz._id,
        text: q.text,
        options: q.options,
        correctOptionIndex: q.correctOptionIndex,
        points: q.points || 10,
        timeLimitSeconds: q.timeLimitSeconds || 30,
        order: i,
      }))
    );
    
    apiCreated(res,'quiz created successfully', {
      quiz,
      questions: questionDocs
    })
  } catch (err) {
    apiServerError(res,'Internal Server Error',{
      error: String(err)
    })
  }
}

export async function listQuizzes(req: AuthRequest, res: Response): Promise<void> {
  try {
    const filter: any = {};
    // Organizers see their own; admins see all; users see active/ended
    if (req.user!.role === 'organizer') filter.hostId = req.user!.userId;
    else if (req.user!.role === 'user') filter.status = { $in: ['active', 'ended'] };

    const quizzes = await Quiz.find(filter)
      .populate('hostId', 'name email')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ quizzes });
  } catch (err) {
    apiServerError(res,'Internal Server Error',{
        error: String(err)
        })
  }
}

export async function getQuiz(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const quiz = await getCachedQuiz(id);
    if (!quiz) { res.status(404).json({ error: 'Quiz not found' }); return; }

    const questions = await getCachedQuestions(id);
    // Hide correct answers from regular users during active quiz
    const sanitized = req.user!.role === 'user'
      ? questions.map((q: any) => ({ ...q, correctOptionIndex: undefined }))
      : questions;

    // res.json({ quiz, questions: sanitized });
    apiSuccess(res,'Success',{
      quiz,
      questions: sanitized
    })
  } catch (err) {
    apiServerError(res,'Internal Server Error',{
      error: String(err)
    })
  }
}

export async function startQuiz(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const quiz = await Quiz.findById(id);
    if (!quiz) { res.status(404).json({ error: 'Quiz not found' }); return; }

    if (String(quiz.hostId) !== req.user!.userId && req.user!.role !== 'admin') {
      apiUnauthorized(res,403,'Not authorized to start this quiz');
      return;
    }
    if (quiz.status !== 'draft') {
      res.status(400).json({ error: `Quiz is already ${quiz.status}` });
      return;
    }

    quiz.status = 'active';
    quiz.startedAt = new Date();
    quiz.currentQuestionIndex = -1;
    await quiz.save();
    await invalidateQuizCache(id);

    // Initialize Redis room state
    await setRoomState(id, {
      quizId: id,
      currentQuestionIndex: -1,
      qStartedAt: 0,
      status: 'waiting',
      hostId: req.user!.userId,
    });

    res.json({ quiz, message: 'Quiz started — open the WebSocket room' });
  } catch (err) {
    apiServerError(res,'Internal Server Error',{
      error: String(err)
    })
  }
}

export async function endQuiz(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const quiz = await Quiz.findById(id);
    if (!quiz) { res.status(404).json({ error: 'Quiz not found' }); return; }

    if (String(quiz.hostId) !== req.user!.userId && req.user!.role !== 'admin') {
      apiUnauthorized(res,403,'Not authorized');
      return;
    }

    quiz.status = 'ended';
    quiz.endedAt = new Date();
    await quiz.save();
    await invalidateQuizCache(id);
    await deleteRoomState(id);

    // res.json({ quiz, message: 'Quiz ended' });
    apiSuccess(res,'Quiz ended',{
      quiz
    })
  } catch (err) {
    apiServerError(res,'Internal Server Error',{
      error: String(err)
    })
  }
}

export async function updateQuiz(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const quiz = await Quiz.findById(id);
    if (!quiz) { res.status(404).json({ error: 'Quiz not found' }); return; }
    if (String(quiz.hostId) !== req.user!.userId && req.user!.role !== 'admin') {
      apiUnauthorized(res,403,'Unauthorized');
      return;
    }
    if (quiz.status !== 'draft') {
      apiForbidden(res,'Cannot edit an active or ended quiz');
      return;
    }

    const { title, description } = req.body;
    if (title) quiz.title = title;
    if (description !== undefined) quiz.description = description;
    await quiz.save();
    await invalidateQuizCache(id);
    apiSuccess(res,'success',{
      quiz
    })
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
