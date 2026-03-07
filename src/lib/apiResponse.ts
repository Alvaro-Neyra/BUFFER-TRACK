// ------------------------------------------------------------------
// Consistent API Response Helpers
// Pattern: Standardized Response Format
// Why: AGENTS.md mandates all API responses follow the shape:
//      { success: boolean; data?: T; error?: string }
//      These helpers enforce that contract and reduce boilerplate.
// ------------------------------------------------------------------

import { NextResponse } from 'next/server';

interface IApiSuccessResponse<T> {
    success: true;
    data: T;
}

interface IApiErrorResponse {
    success: false;
    error: string;
}

export type TApiResponse<T> = IApiSuccessResponse<T> | IApiErrorResponse;

/**
 * Return a successful JSON response.
 * @param data - The payload to return under the `data` key.
 * @param status - HTTP status code (default 200).
 */
export function apiSuccess<T>(data: T, status = 200): NextResponse<IApiSuccessResponse<T>> {
    return NextResponse.json({ success: true, data }, { status });
}

/**
 * Return an error JSON response.
 * @param error - Human-readable error message.
 * @param status - HTTP status code (default 400).
 */
export function apiError(error: string, status = 400): NextResponse<IApiErrorResponse> {
    return NextResponse.json({ success: false, error }, { status });
}
