import { DEFAULT_PROJECT_STATUSES } from '@/constants/defaultStatuses';
import mongoose from 'mongoose';
import Status, { IStatus } from '../models/Status';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class StatusRepository {
  async getAll(projectId: string): Promise<IStatus[]> {
    return Status.find({ projectId: new mongoose.Types.ObjectId(projectId) }).sort({ name: 1 }).lean();
  }

  async getById(id: string): Promise<IStatus | null> {
    return Status.findById(id).lean();
  }

  async getByIdInProject(id: string, projectId: string): Promise<IStatus | null> {
    return Status.findOne({
      _id: new mongoose.Types.ObjectId(id),
      projectId: new mongoose.Types.ObjectId(projectId),
    }).lean();
  }

  async create(data: Partial<IStatus>): Promise<IStatus> {
    const doc = await Status.create(data);
    return doc.toObject();
  }

  async update(id: string, data: Partial<IStatus>): Promise<IStatus | null> {
    return Status.findByIdAndUpdate(id, data, { new: true }).lean();
  }

  async delete(id: string): Promise<boolean> {
    const result = await Status.findByIdAndDelete(id);
    return !!result;
  }

  async findByName(name: string, projectId: string): Promise<IStatus | null> {
    const trimmedName = name.trim();
    const escapedName = escapeRegex(trimmedName);

    return Status.findOne({
      name: { $regex: `^${escapedName}$`, $options: 'i' },
      projectId: new mongoose.Types.ObjectId(projectId),
    }).lean();
  }

  async ensureDefaultStatuses(projectId: string): Promise<void> {
    const projectObjectId = new mongoose.Types.ObjectId(projectId);

    for (const status of DEFAULT_PROJECT_STATUSES) {
      const escapedName = escapeRegex(status.name);
      const existing = await Status.findOne({
        projectId: projectObjectId,
        name: { $regex: `^${escapedName}$`, $options: 'i' },
      }).lean();

      if (existing) {
        continue;
      }

      await Status.updateOne(
        { projectId: projectObjectId, name: status.name },
        {
          $setOnInsert: {
            projectId: projectObjectId,
            name: status.name,
            colorHex: status.colorHex,
            isPPC: status.isPPC,
          },
        },
        { upsert: true }
      );
    }
  }
}

export const statusRepository = new StatusRepository();
