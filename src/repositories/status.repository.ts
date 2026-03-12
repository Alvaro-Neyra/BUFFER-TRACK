import Status, { IStatus } from '../models/Status';

class StatusRepository {
  private static readonly DEFAULT_RESTRICTED_STATUS = {
    name: 'Restricted',
    colorHex: '#EF4444',
    isPPC: false,
  } as const;

  private async findRestrictedStatusCaseInsensitive(): Promise<IStatus | null> {
    return Status.findOne({ name: { $regex: /^restricted$/i } })
      .sort({ createdAt: 1 })
      .lean();
  }

  async ensureRestrictedStatusExists(): Promise<IStatus> {
    const existing = await this.findRestrictedStatusCaseInsensitive();
    if (existing) {
      return existing;
    }

    try {
      const created = await Status.create(StatusRepository.DEFAULT_RESTRICTED_STATUS);
      return created.toObject();
    } catch (error) {
      // Another request may have created it concurrently.
      if (error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 11000) {
        const createdByConcurrentRequest = await this.findRestrictedStatusCaseInsensitive();
        if (createdByConcurrentRequest) {
          return createdByConcurrentRequest;
        }
      }
      throw error;
    }
  }

  async getAll(): Promise<IStatus[]> {
    await this.ensureRestrictedStatusExists();
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
    if (/^restricted$/i.test(name.trim())) {
      await this.ensureRestrictedStatusExists();
    }

    return Status.findOne({ name }).lean();
  }
}

export const statusRepository = new StatusRepository();
