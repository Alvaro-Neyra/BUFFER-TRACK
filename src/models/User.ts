import mongoose, { Schema, Document } from 'mongoose';

// Interface
export interface IUser extends Document {
    name: string;
    email: string;
    password?: string;
    // Legacy global fields kept temporarily for backward compatibility.
    role: string;
    specialtyId?: mongoose.Types.ObjectId;
    company?: string;
    projects: {
        projectId: mongoose.Types.ObjectId;
        status: 'Pending' | 'Active';
        roleId?: mongoose.Types.ObjectId;
        specialtyId?: mongoose.Types.ObjectId;
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
            default: 'Subcontractor',
        },
        specialtyId: { type: Schema.Types.ObjectId, ref: 'Specialty' },
        company: { type: String },
        projects: [{
            projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
            status: { type: String, enum: ['Pending', 'Active'], default: 'Pending' },
            roleId: { type: Schema.Types.ObjectId, ref: 'Role' },
            specialtyId: { type: Schema.Types.ObjectId, ref: 'Specialty' },
        }]
    },
    {
        timestamps: true, // Automatically manages createdAt and updatedAt
    }
);

UserSchema.index({ 'projects.projectId': 1 });
UserSchema.index({ 'projects.projectId': 1, 'projects.roleId': 1 });
UserSchema.index({ 'projects.projectId': 1, 'projects.specialtyId': 1 });

// Indexes
// No highly specific indexes needed here other than email (which is unique) as global user queries are simple.

// In dev/HMR, an old cached model can miss newly added nested paths (e.g. projects.roleId),
// which triggers StrictPopulateError. Rebuild the model if schema paths are outdated.
const cachedUserModel = mongoose.models.User as mongoose.Model<IUser> | undefined;
if (cachedUserModel) {
    const hasRolePath = Boolean(cachedUserModel.schema.path('projects.roleId'));
    const hasSpecialtyPath = Boolean(cachedUserModel.schema.path('projects.specialtyId'));
    if (!hasRolePath || !hasSpecialtyPath) {
        mongoose.deleteModel('User');
    }
}

const UserModel = (mongoose.models.User as mongoose.Model<IUser>) || mongoose.model<IUser>('User', UserSchema);

export default UserModel;
