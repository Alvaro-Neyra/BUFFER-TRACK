import mongoose, { Schema, Document } from 'mongoose';

// Interface
export interface IUser extends Document {
    name: string;
    email: string;
    password?: string;
    role: 'Subcontractor' | 'Coordinator' | 'Production Lead' | 'Production Engineer' | 'Production Manager' | 'Superintendent' | 'Project Manager' | 'Project Director' | 'Admin';
    specialtyId?: mongoose.Types.ObjectId;
    company?: string;
    projects: {
        projectId: mongoose.Types.ObjectId;
        status: 'Pending' | 'Active';
    }[];
    createdAt: Date;
    updatedAt: Date;
}

// Justification: Single collection for users with role-based access control.
// Users can belong to multiple projects, each with their own approval status.
const UserSchema: Schema = new Schema(
    {
        name: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        password: { type: String, select: false },
        role: {
            type: String,
            required: true,
            enum: [
                'Subcontractor', 'Coordinator', 'Production Lead', 'Production Engineer',
                'Production Manager', 'Superintendent', 'Project Manager', 'Project Director', 'Admin'
            ],
            default: 'Subcontractor',
        },
        specialtyId: { type: Schema.Types.ObjectId, ref: 'Specialty' },
        company: { type: String },
        projects: [{
            projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
            status: { type: String, enum: ['Pending', 'Active'], default: 'Pending' }
        }]
    },
    {
        timestamps: true, // Automatically manages createdAt and updatedAt
    }
);

// Indexes
// No highly specific indexes needed here other than email (which is unique) as global user queries are simple.

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
