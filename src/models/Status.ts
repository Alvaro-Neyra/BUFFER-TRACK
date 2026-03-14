import mongoose, { Schema, Document } from 'mongoose';

export interface IStatus extends Document {
  projectId: mongoose.Types.ObjectId;
  name: string;
  colorHex: string;
  isPPC: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const StatusSchema: Schema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    name: { type: String, required: true, trim: true },
    colorHex: { type: String, required: true, default: '#F59E0B' }, // Default to yellow/orange
    isPPC: { type: Boolean, default: false },
  },
  { 
    timestamps: true,
    collection: 'statuses' 
  }
);

// Status names must be unique inside a project, but can repeat across projects.
StatusSchema.index({ projectId: 1, name: 1 }, { unique: true });

export default mongoose.models.Status || mongoose.model<IStatus>('Status', StatusSchema);
