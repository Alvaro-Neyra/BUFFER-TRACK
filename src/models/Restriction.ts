import mongoose, { Schema, Document } from 'mongoose';

export interface IRestriction extends Document {
    commitmentId: mongoose.Types.ObjectId;
    projectId: mongoose.Types.ObjectId;
    description: string;
    reportedBy: mongoose.Types.ObjectId;
    solver: string; // e.g. "Purchasing", "Engineering"
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

// Justification: The "Red List" restrictions. They are intrinsically tied to a Commitment (the pin that turns Red ⚠️).
// We keep it separate to allow rich querying of the Log without loading all commitments.
const RestrictionSchema: Schema = new Schema(
    {
        commitmentId: { type: Schema.Types.ObjectId, ref: 'Commitment', required: true, index: true },
        projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
        description: { type: String, required: true },
        reportedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        solver: { type: String, required: true },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

export default mongoose.models.Restriction || mongoose.model<IRestriction>('Restriction', RestrictionSchema);
