import mongoose, { Schema, Document } from 'mongoose';

export interface IBuilding extends Document {
    projectId: mongoose.Types.ObjectId;
    name: string;
    code: string;
    number: number;
    coordinates: {
        xPercent: number; // 0 to 100
        yPercent: number; // 0 to 100
    };
    // Optional free-draw polygon zone (array of percentage-based points)
    polygon?: Array<{ xPercent: number; yPercent: number }>;
    color?: string; // Hex color for the building marker
    createdAt: Date;
    updatedAt: Date;
}

// Justification: Buildings belong to A project and contain coordinates to be displayed 
// as hotspots on the Level 1 Master Plan viewer.
// We use xPercent and yPercent to ensure responsivenes irrespective of screen size or zoom level.
const BuildingSchema: Schema = new Schema(
    {
        projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
        name: { type: String, required: true },
        code: { type: String, required: true },
        number: { type: Number, required: true },
        coordinates: {
            xPercent: { type: Number, required: true, min: 0, max: 100 },
            yPercent: { type: Number, required: true, min: 0, max: 100 },
        },
        // Optional: free-draw polygon zone stored as array of percentage points.
        // When present, the building is rendered as a filled polygon on the plan.
        // The `coordinates` field still holds the centroid for label placement.
        polygon: [{
            xPercent: { type: Number, min: 0, max: 100 },
            yPercent: { type: Number, min: 0, max: 100 },
        }],
        color: { type: String }, // Optional hex color
    },
    { timestamps: true }
);

export default mongoose.models.Building || mongoose.model<IBuilding>('Building', BuildingSchema);
