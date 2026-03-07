import mongoose, { Schema, Document } from 'mongoose';

export interface IWeeklySnapshot extends Document {
    projectId: mongoose.Types.ObjectId;
    weekStart: Date;
    weekEnd: Date;
    globalPPC: number;
    totalCommitments: number;
    completedCommitments: number;
    specialtyData: Array<{
        specialtyId: mongoose.Types.ObjectId;
        ppc: number;
    }>;
    subcontractorData: Array<{
        subcontractorId: mongoose.Types.ObjectId;
        ppc: number;
    }>;
    createdAt: Date;
    updatedAt: Date;
}

// Justification: Required for the PPC Dashboard. 
// "Cierre de Semana: El sistema debe permitir 'congelar' la semana".
// Storing historical aggregated PPC here prevents extremely costly aggregations on the fly across
// thousands of commitments for historical reporting.
const WeeklySnapshotSchema: Schema = new Schema(
    {
        projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
        weekStart: { type: Date, required: true, index: true },
        weekEnd: { type: Date, required: true },
        globalPPC: { type: Number, required: true },
        totalCommitments: { type: Number, required: true },
        completedCommitments: { type: Number, required: true },
        specialtyData: [
            {
                specialtyId: { type: Schema.Types.ObjectId, ref: 'Specialty', required: true },
                ppc: { type: Number, required: true },
            },
        ],
        subcontractorData: [
            {
                subcontractorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
                ppc: { type: Number, required: true },
            },
        ],
    },
    { timestamps: true }
);

export default mongoose.models.WeeklySnapshot || mongoose.model<IWeeklySnapshot>('WeeklySnapshot', WeeklySnapshotSchema);
