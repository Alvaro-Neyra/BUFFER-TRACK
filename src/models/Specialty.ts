import mongoose, { Schema, Document } from 'mongoose';

export interface ISpecialty extends Document {
    projectId: mongoose.Types.ObjectId;
    name: string;
    colorHex: string;
    createdAt: Date;
    updatedAt: Date;
}

// Justification: Extracted to its own collection per AGENTS.md. 
// "Gestión de Colores: El Administrador debe tener un panel para asignar un color Hexadecimal único a cada especialidad."
// By separating this, admins can easily manage colors globally without modifying hardcoded data.
const SpecialtySchema: Schema = new Schema(
    {
        projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
        name: { type: String, required: true },
        colorHex: { type: String, required: true },
    },
    { timestamps: true }
);

// Composite uniqueness keeps specialty names unique only inside each project.
SpecialtySchema.index({ projectId: 1, name: 1 }, { unique: true });
SpecialtySchema.index({ projectId: 1 });

export default mongoose.models.Specialty || mongoose.model<ISpecialty>('Specialty', SpecialtySchema);
