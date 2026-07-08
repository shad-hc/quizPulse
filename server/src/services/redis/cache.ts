import { redis, KEYS, CACHE_TTL } from './redis';
import Quiz, { IQuiz } from '../../models/Quiz';
import Question, { IQuestion } from '../../models/Question';

export async function getCachedQuiz(quizId: string): Promise<IQuiz | null> {
  const cached = await redis.get(KEYS.quiz(quizId));
  if (cached) return JSON.parse(cached) as IQuiz;

  const quiz = await Quiz.findById(quizId).lean();
  if (!quiz) return null;

  await redis.set(KEYS.quiz(quizId), JSON.stringify(quiz), 'EX', CACHE_TTL);
  return quiz as unknown as IQuiz;
}

export async function getCachedQuestions(quizId: string): Promise<IQuestion[]> {
  const cached = await redis.get(KEYS.questions(quizId));
  if (cached) return JSON.parse(cached) as IQuestion[];

  const questions = await Question.find({ quizId }).sort({ order: 1 }).lean();
  await redis.set(KEYS.questions(quizId), JSON.stringify(questions), 'EX', CACHE_TTL);
  return questions as unknown as IQuestion[];
}

export async function invalidateQuizCache(quizId: string): Promise<void> {
  await redis.del(KEYS.quiz(quizId));
  await redis.del(KEYS.questions(quizId));
}
