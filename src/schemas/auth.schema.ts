// ------------------------------------------------------------------
// Zod Validation Schemas for Authentication
// Pattern: Validation Layer (Zod v4)
// Why: AGENTS.md mandates Zod for all API inputs. These schemas
//      replace manual `if (!field)` checks with type-safe,
//      declarative validation that produces clear error messages.
// Note: Zod v4 uses `error` instead of `required_error` and
//       `z.issues` instead of `z.errors`.
// ------------------------------------------------------------------

import { z } from 'zod';

/**
 * Schema for the user registration endpoint.
 * Validates all required fields and enforces business rules
 * (e.g., specialtyId required when role has configured specialties).
 */
export const registerSchema = z.object({
    name: z
        .string({ error: 'Full name is required' })
        .min(2, 'Name must be at least 2 characters')
        .max(100, 'Name must be at most 100 characters')
        .trim(),
    email: z
        .string({ error: 'Email is required' })
        .email('Invalid email format')
        .toLowerCase()
        .trim(),
    password: z
        .string({ error: 'Password is required' })
        .min(6, 'Password must be at least 6 characters'),
    roleId: z
        .string({ error: 'Role is required' })
        .min(1, 'Role is required')
        .refine((val) => /^[0-9a-fA-F]{24}$/.test(val), {
            message: 'Invalid role id',
        }),
    projectId: z
        .string({ error: 'Project ID is required' })
        .refine(
            (val) => /^[0-9a-fA-F]{24}$/.test(val) || /^[0-9a-zA-Z_]+-\d+$/.test(val),
            { message: 'Invalid project code format. Expected: PROJECTNAME-123456789' }
        ),
    company: z
        .string()
        .max(200, 'Company name too long')
        .trim()
        .optional(),
    specialtyId: z
        .string()
        .optional(),
});

/** Inferred TypeScript type from the register schema. */
export type TRegisterInput = z.infer<typeof registerSchema>;

/**
 * Schema for the login / verify endpoint.
 */
export const loginSchema = z.object({
    email: z
        .string({ error: 'Email is required' })
        .email('Invalid email format')
        .toLowerCase()
        .trim(),
    password: z
        .string({ error: 'Password is required' })
        .min(1, 'Password is required'),
});

/** Inferred TypeScript type from the login schema. */
export type TLoginInput = z.infer<typeof loginSchema>;
