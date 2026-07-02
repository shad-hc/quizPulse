import mongoose, { Document, Schema } from 'mongoose';

export interface IAnswerRecord {
  questionId: mongoose.Types.ObjectId;
  selectedIndex: number;
  correct: boolean;
  points: number;
  timeTakenMs: number;
  late: boolean;
}

export interface IResult extends Document {
  userId: mongoose.Types.ObjectId;
  quizId: mongoose.Types.ObjectId;
  totalScore: number;
  correctCount: number;
  questionsAttempted: number;
  answers: IAnswerRecord[];
  finishedAt: Date;
}

const AnswerRecordSchema = new Schema<IAnswerRecord>(
  {
    questionId: { type: Schema.Types.ObjectId, ref: 'Question', required: true },
    selectedIndex: { type: Number, required: true },
    correct: { type: Boolean, required: true },
    points: { type: Number, default: 0 },
    timeTakenMs: { type: Number, default: 0 },
    late: { type: Boolean, default: false },
  },
  { _id: false }
);

const ResultSchema = new Schema<IResult>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    quizId: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true },
    totalScore: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    questionsAttempted: { type: Number, default: 0 },
    answers: [AnswerRecordSchema],
    finishedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

ResultSchema.index({ quizId: 1, userId: 1 }, { unique: true });

export default mongoose.model<IResult>('Result', ResultSchema);
