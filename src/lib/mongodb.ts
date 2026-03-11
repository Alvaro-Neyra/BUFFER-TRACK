import mongoose from 'mongoose';

// ------------------------------------------------------------------
// Centralized MongoDB connection singleton
// Pattern: Singleton Connection with Model Registration
// Why: Next.js hot-reloads in development create new module scopes on each request.
//      Without a cached connection and pre-registered models, Mongoose loses track
//      of schemas — causing `MissingSchemaError` on `.populate()` calls.
//      By importing all models here as side-effects, we guarantee every schema
//      is registered the moment the connection is established.
// ------------------------------------------------------------------

// Side-effect imports — registers all Mongoose schemas globally.
// This is the SINGLE source of model registration for the entire app.
import '@/models/User';
import '@/models/Project';
import '@/models/Building';
import '@/models/Floor';
import '@/models/Commitment';
import '@/models/Restriction';
import '@/models/Specialty';
import '@/models/Role';
import '@/models/Status';
import '@/models/WeeklySnapshot';

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

/**
 * Global cache to maintain a single connection across hot reloads in development.
 * This prevents connections from growing exponentially during API Route usage.
 */
interface IMongooseCache {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
}

declare global {
    // eslint-disable-next-line no-var
    var mongooseCache: IMongooseCache | undefined;
}

const cached: IMongooseCache = global.mongooseCache || { conn: null, promise: null };

if (!global.mongooseCache) {
    global.mongooseCache = cached;
}

async function connectToDatabase(): Promise<typeof mongoose> {
    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
        const opts = {
            bufferCommands: false,
        };

        cached.promise = mongoose.connect(MONGODB_URI, opts).then((m) => {
            return m;
        });
    }

    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        throw e;
    }

    return cached.conn;
}

export default connectToDatabase;
