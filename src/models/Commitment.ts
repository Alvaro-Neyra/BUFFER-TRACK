import mongoose, { Schema, Document } from 'mongoose';

export type TPinStatus = 'Request' | 'Notified' | 'Committed' | 'In Progress' | 'Completed' | 'Delayed' | 'Restricted';

export interface ICommitment extends Document {
    projectId: mongoose.Types.ObjectId;
    buildingId: mongoose.Types.ObjectId;
    floorId: mongoose.Types.ObjectId;
    specialtyId: mongoose.Types.ObjectId;
    requesterId: mongoose.Types.ObjectId;
    assignedTo?: mongoose.Types.ObjectId;
    name: string;
    customId?: string;
    location?: string;
    description: string;
    status: TPinStatus;
    coordinates: {
        xPercent: number;
        yPercent: number;
    };
    // Optional free-draw polygon zone (array of percentage-based points)
    polygon?: Array<{ xPercent: number; yPercent: number }>;
    dates: {
        requestDate: Date;
        startDate?: Date;
        targetDate?: Date;
        actualCompletionDate?: Date;
    };
    weekStart?: Date;
    createdAt: Date;
    updatedAt: Date;
}

// Justification: Central model of the system acting as the "Pin" on the floor plans and the "Task" on the calendar.
// It references all location hierarchies (building, floor) for filtering on the master plan or specific levels.
// Contains target Dates and weekStart to calculate PPC accurately per week.
const CommitmentSchema: Schema = new Schema(
    {
        projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
        buildingId: { type: Schema.Types.ObjectId, ref: 'Building', required: true, index: true },
        floorId: { type: Schema.Types.ObjectId, ref: 'Floor', required: true, index: true },
        specialtyId: { type: Schema.Types.ObjectId, ref: 'Specialty', required: true, index: true },
        requesterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        assignedTo: { type: Schema.Types.ObjectId, ref: 'User', index: true },
        name: { type: String, required: true },
        customId: { type: String },
        location: { type: String },
        description: { type: String },
        status: {
            type: String,
            enum: ['Request', 'Notified', 'Committed', 'In Progress', 'Completed', 'Delayed', 'Restricted'],
            default: 'Request',
            required: true,
        },
        coordinates: {
            xPercent: { type: Number, required: true, min: 0, max: 100 },
            yPercent: { type: Number, required: true, min: 0, max: 100 },
        },
        // Optional: free-draw polygon zone for activity areas on floor plans.
        // The `coordinates` field holds the centroid for pin/label placement.
        polygon: [{
            xPercent: { type: Number, min: 0, max: 100 },
            yPercent: { type: Number, min: 0, max: 100 },
        }],
        dates: {
            requestDate: { type: Date, required: true, default: Date.now },
            startDate: { type: Date },
            targetDate: { type: Date },
            actualCompletionDate: { type: Date },
        },
        weekStart: { type: Date, index: true }, // Monday of the week it belongs to
    },
    { timestamps: true }
);

export default mongoose.models.Commitment || mongoose.model<ICommitment>('Commitment', CommitmentSchema);
