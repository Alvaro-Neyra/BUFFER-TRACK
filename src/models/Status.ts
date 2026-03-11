import mongoose, { Schema, Document } from 'mongoose';

export interface IStatus extends Document {
  name: string;
  colorHex: string;
  isPPC: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const StatusSchema: Schema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    colorHex: { type: String, required: true, default: '#F59E0B' }, // Default to yellow/orange
    isPPC: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.models.Status || mongoose.model<IStatus>('Status', StatusSchema);
