import mongoose, { Schema, Document } from 'mongoose';

export interface IProject extends Document {
    name: string;
    description?: string;
    connectionCode: string; // e.g. "EdificioA-123456"
    masterPlanImageUrl?: string; // Uploaded master plan image
    configuration: {
        startWeek: Date;
        endWeek: Date;
    };
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

// Justification: Independent Project model to allow the system to scale for multiple projects.
// Start and end weeks help to define the global boundaries of the calendar for this particular project.
// connectionCode acts as a unique hash users enter to request join access.
const ProjectSchema: Schema = new Schema(
    {
        name: { type: String, required: true },
        description: { type: String },
        connectionCode: { type: String, required: true, unique: true },
        masterPlanImageUrl: { type: String },
        configuration: {
            startWeek: { type: Date, required: true },
            endWeek: { type: Date, required: true },
        },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

export default mongoose.models.Project || mongoose.model<IProject>('Project', ProjectSchema);
