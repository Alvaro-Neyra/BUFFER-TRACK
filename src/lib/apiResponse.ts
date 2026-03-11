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
 * Sanitize data for Next.js Server Components / Actions by converting
 * MongoDB ObjectIds to strings and removing Mongoose internals.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeData<T = any>(data: T): T {
    if (!data) return data;
    return JSON.parse(JSON.stringify(data));
}

/**
 * Return a standardized object for Server Actions.
 * Ensures the result is a plain object (POJO) to prevent serialization errors.
 */
export function actionSuccess<T>(data: T): TApiResponse<T> {
    return { success: true, data: serializeData(data) };
}

export function actionError(error: string): IApiErrorResponse {
    return { success: false, error };
}

/**
 * Return a successful JSON response.
...
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
