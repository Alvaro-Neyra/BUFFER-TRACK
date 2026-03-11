import mongoose, { Schema, Document } from 'mongoose';

export interface IRole extends Document {
  projectId: mongoose.Types.ObjectId;
  name: string;
  isManager: boolean; // Flag to identify administrative/manager roles
  specialtiesIds: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const RoleSchema: Schema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    name: { type: String, required: true },
    isManager: { type: Boolean, default: false },
    specialtiesIds: [{ type: Schema.Types.ObjectId, ref: 'Specialty' }],
  },
  { timestamps: true }
);

// Composite uniqueness keeps role names unique only inside each project.
RoleSchema.index({ projectId: 1, name: 1 }, { unique: true });
RoleSchema.index({ projectId: 1 });

// Justification: Dynamic roles allow the organization to define their own hierarchy
// without changing the codebase. isManager flag simplifies UI permissions.

export default mongoose.models.Role || mongoose.model<IRole>('Role', RoleSchema);
