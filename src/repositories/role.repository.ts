import connectToDatabase from '@/lib/mongodb';
import Role, { IRole } from '../models/Role';
import mongoose from 'mongoose';

class RoleRepository {
  private async connect() {
    await connectToDatabase();
  }

  async getAll(projectId?: string): Promise<IRole[]> {
    await this.connect();
    if (!projectId) {
      return Role.find({}).sort({ name: 1 }).lean();
    }
    return Role.find({ projectId: new mongoose.Types.ObjectId(projectId) }).sort({ name: 1 }).lean();
  }

  async getByProjectId(projectId: string): Promise<IRole[]> {
    await this.connect();
    return Role.find({ projectId: new mongoose.Types.ObjectId(projectId) }).sort({ name: 1 }).lean();
  }

  async getById(id: string): Promise<IRole | null> {
    await this.connect();
    return Role.findById(id).lean();
  }

  async getByIdInProject(id: string, projectId: string): Promise<IRole | null> {
    await this.connect();
    return Role.findOne({
      _id: new mongoose.Types.ObjectId(id),
      projectId: new mongoose.Types.ObjectId(projectId),
    }).lean();
  }

  async create(data: Partial<IRole>): Promise<IRole> {
    await this.connect();
    const doc = await Role.create(data);
    return doc.toObject();
  }

  async update(id: string, data: Partial<IRole>): Promise<IRole | null> {
    await this.connect();
    return Role.findByIdAndUpdate(id, data, { new: true }).lean();
  }

  async delete(id: string): Promise<boolean> {
    await this.connect();
    const result = await Role.findByIdAndDelete(id);
    return !!result;
  }

  async findByName(name: string): Promise<IRole | null> {
    await this.connect();
    return Role.findOne({ name }).lean();
  }

  async findByNameInProject(name: string, projectId: string): Promise<IRole | null> {
    await this.connect();
    return Role.findOne({
      name,
      projectId: new mongoose.Types.ObjectId(projectId),
    }).lean();
  }

  async countByProjectAndSpecialty(projectId: string, specialtyId: string): Promise<number> {
    await this.connect();
    return Role.countDocuments({
      projectId: new mongoose.Types.ObjectId(projectId),
      specialtiesIds: new mongoose.Types.ObjectId(specialtyId),
    });
  }
}

export const roleRepository = new RoleRepository();
