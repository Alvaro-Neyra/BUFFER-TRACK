import mongoose, { Schema, Document } from 'mongoose';

export interface ISpecialty extends Document {
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
        name: { type: String, required: true, unique: true },
        colorHex: { type: String, required: true },
    },
    { timestamps: true }
);

export default mongoose.models.Specialty || mongoose.model<ISpecialty>('Specialty', SpecialtySchema);
