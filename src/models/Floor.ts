import mongoose, { Schema, Document } from 'mongoose';

export interface IFloor extends Document {
    buildingId: mongoose.Types.ObjectId;
    label: string;
    order: number;
    gcsImageUrl: string;
    cloudinaryPublicId?: string;
    createdAt: Date;
    updatedAt: Date;
}

// Justification: Floors represent the Level 2 Detail plans. 
// They are explicitly referencing the Building they belong to via ObjectId.
// gcsImageUrl retains the high-resolution 300 DPI layout path.
// cloudinaryPublicId keeps a direct reference to the storage asset id so
// floor image replacements/deletions can safely clean up orphan files.
const FloorSchema: Schema = new Schema(
    {
        buildingId: { type: Schema.Types.ObjectId, ref: 'Building', required: true, index: true },
        label: { type: String, required: true },
        order: { type: Number, required: true },
        gcsImageUrl: { type: String, required: true },
        cloudinaryPublicId: { type: String },
    },
    { timestamps: true }
);

export default mongoose.models.Floor || mongoose.model<IFloor>('Floor', FloorSchema);
