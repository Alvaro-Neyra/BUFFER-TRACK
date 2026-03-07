// ------------------------------------------------------------------
// Database Seed API Endpoint
// Pattern: Thin Route Handler → Service
// Why: Route handles only HTTP concerns. Seeding logic in SeedService.
// ------------------------------------------------------------------

import connectToDatabase from '@/lib/mongodb';
import { apiSuccess, apiError } from '@/lib/apiResponse';
import { SeedService } from '@/services/seed.service';

export async function GET() {
    try {
        await connectToDatabase();
        const result = await SeedService.seedDatabase();
        return apiSuccess(result);
    } catch (error) {
        return apiError(error instanceof Error ? error.message : 'Unknown error', 500);
    }
}
