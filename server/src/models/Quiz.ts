import mongoose, { Document, Schema } from 'mongoose';

export type QuizStatus = 'draft' | 'active' | 'ended';

export interface IQuiz extends Document {
  title: string;
  description: string;
  hostId: mongoose.Types.ObjectId;
  status: QuizStatus;
  currentQuestionIndex: number;
  startedAt?: Date;
  endedAt?: Date;
  participantCount: number;
}

const QuizSchema = new Schema<IQuiz>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    hostId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['draft', 'active', 'ended'], default: 'draft' },
    currentQuestionIndex: { type: Number, default: -1 },
    startedAt: { type: Date },
    endedAt: { type: Date },
    participantCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model<IQuiz>('Quiz', QuizSchema);
