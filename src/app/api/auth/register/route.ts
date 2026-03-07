// ------------------------------------------------------------------
// User Registration API Endpoint
// Pattern: Thin Route Handler → Service
// Why: Route handles only HTTP concerns (parse body, catch errors,
//      format response). All business logic lives in AuthService.
// ------------------------------------------------------------------

import { registerSchema } from '@/schemas/auth.schema';
import { apiSuccess, apiError } from '@/lib/apiResponse';
import { AuthService, ServiceError } from '@/services/auth.service';

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // Zod validation
        const parsed = registerSchema.safeParse(body);
        if (!parsed.success) {
            const firstError = parsed.error.issues[0]?.message || 'Validation failed';
            return apiError(firstError, 400);
        }

        // Delegate to service
        const result = await AuthService.registerUser(parsed.data);

        return apiSuccess(result, 201);
    } catch (error) {
        if (error instanceof ServiceError) {
            return apiError(error.message, error.statusCode);
        }
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return apiError(message, 500);
    }
}
