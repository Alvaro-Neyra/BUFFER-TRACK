import Status, { IStatus } from '../models/Status';

class StatusRepository {
  async getAll(): Promise<IStatus[]> {
    return Status.find({}).sort({ name: 1 }).lean();
  }

  async getById(id: string): Promise<IStatus | null> {
    return Status.findById(id).lean();
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

  async findByName(name: string): Promise<IStatus | null> {
    return Status.findOne({ name }).lean();
  }
}

export const statusRepository = new StatusRepository();
