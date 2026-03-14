import mongoose, { Schema, Document } from 'mongoose';

export type TPinStatus = string;

export interface IAssignment extends Document {
    projectId: mongoose.Types.ObjectId;
    buildingId: mongoose.Types.ObjectId;
    floorId: mongoose.Types.ObjectId;
    specialtyId: mongoose.Types.ObjectId;
    requesterId: mongoose.Types.ObjectId;
    acceptedById?: mongoose.Types.ObjectId;
    acceptedAt?: Date;
    description: string;
    status: TPinStatus;
    coordinates: {
        xPercent: number;
        yPercent: number;
    };
    // Optional free-draw polygon zone (array of percentage-based points)
    polygon?: Array<{ xPercent: number; yPercent: number }>;
    requiredDate: Date;
    weekStart?: Date;
    createdAt: Date;
    updatedAt: Date;
}

// Justification: Central model of the system acting as the "Pin" on the floor plans and the "Task" on the calendar.
// It references all location hierarchies (building, floor) for filtering on the master plan or specific levels.
// Stores a single date contract (`requiredDate`) plus weekStart for weekly PPC consistency.
const AssignmentSchema: Schema = new Schema(
    {
        projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
        buildingId: { type: Schema.Types.ObjectId, ref: 'Building', required: true, index: true },
        floorId: { type: Schema.Types.ObjectId, ref: 'Floor', required: true, index: true },
        specialtyId: { type: Schema.Types.ObjectId, ref: 'Specialty', required: true, index: true },
        requesterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        acceptedById: { type: Schema.Types.ObjectId, ref: 'User', index: true },
        acceptedAt: { type: Date },
        description: { type: String, required: true },
        status: {
            type: String,
            default: 'Pending',
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
        requiredDate: { type: Date, required: true, index: true },
        weekStart: { type: Date, index: true }, // Monday of the week it belongs to
    },
    { timestamps: true }
);

// Project-scoped search indexes for quick header autocomplete on activities.
AssignmentSchema.index({ projectId: 1, description: 1 });
AssignmentSchema.index({ projectId: 1, status: 1 });
AssignmentSchema.index({ projectId: 1, weekStart: 1 });

// Cutover: assignments now live in the dedicated `assignments` collection.
// In development, if a stale cached model points to `commitments`, recreate it. (commitments collection is currently deleted)
const cachedAssignmentModel = mongoose.models.Assignment as mongoose.Model<IAssignment> | undefined;
const requiredSchemaPaths = ['acceptedById', 'acceptedAt', 'requiredDate'] as const;
const missingRequiredPath = requiredSchemaPaths.some((pathName) => !cachedAssignmentModel?.schema.path(pathName));

if (cachedAssignmentModel && (cachedAssignmentModel.collection?.name !== 'assignments' || missingRequiredPath)) {
    delete mongoose.models.Assignment;
}

export default (mongoose.models.Assignment as mongoose.Model<IAssignment> | undefined)
    || mongoose.model<IAssignment>('Assignment', AssignmentSchema, 'assignments');
