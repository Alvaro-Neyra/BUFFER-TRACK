// ------------------------------------------------------------------
// User Credential Verification API Endpoint
// Pattern: Thin Route Handler → Service
// Why: Route handles only HTTP concerns. Business logic in AuthService.
// ------------------------------------------------------------------

import { loginSchema } from '@/schemas/auth.schema';
import { apiSuccess, apiError } from '@/lib/apiResponse';
import { AuthService, ServiceError } from '@/services/auth.service';

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // Zod validation
        const parsed = loginSchema.safeParse(body);
        if (!parsed.success) {
            const firstError = parsed.error.issues[0]?.message || 'Validation failed';
            return apiError(firstError, 400);
        }

        // Delegate to service
        const result = await AuthService.verifyCredentials(parsed.data);

        return apiSuccess(result);
    } catch (error) {
        if (error instanceof ServiceError) {
            return apiError(error.message, error.statusCode);
        }
        console.error('Verification error:', error);
        return apiError('Internal Server Error', 500);
    }
}
