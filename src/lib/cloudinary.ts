// ------------------------------------------------------------------
// Cloudinary Utility Layer
// Pattern: Utility Module
// Why: Centralize Cloudinary configuration and asset lifecycle helpers
//      (public id parsing + safe asset deletion) used across routes
//      and service/actions to keep DB and storage consistent.
// ------------------------------------------------------------------

import { v2 as cloudinary } from 'cloudinary';

let cloudinaryConfigured = false;

function normalizePublicId(value?: string | null): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export function configureCloudinary(): void {
    if (cloudinaryConfigured) return;

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
        throw new Error('Cloudinary environment variables are not configured');
    }

    cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
    });

    cloudinaryConfigured = true;
}

export function extractCloudinaryPublicId(url?: string | null): string | null {
    if (typeof url !== 'string' || url.trim().length === 0) {
        return null;
    }

    try {
        const parsedUrl = new URL(url);
        const segments = parsedUrl.pathname.split('/').filter(Boolean);
        const uploadIndex = segments.findIndex((segment) => segment === 'upload');

        if (uploadIndex === -1 || uploadIndex + 2 > segments.length) {
            return null;
        }

        const versionSegment = segments[uploadIndex + 1];
        if (!/^v\d+$/.test(versionSegment)) {
            return null;
        }

        const publicIdSegments = segments.slice(uploadIndex + 2);
        if (publicIdSegments.length === 0) {
            return null;
        }

        const lastSegment = publicIdSegments[publicIdSegments.length - 1] || '';
        const withoutExtension = lastSegment.replace(/\.[^/.]+$/, '');

        publicIdSegments[publicIdSegments.length - 1] = withoutExtension;
        return publicIdSegments.join('/');
    } catch {
        return null;
    }
}

interface IDeleteCloudinaryAssetArgs {
    url?: string | null;
    publicId?: string | null;
    context: string;
}

export async function deleteCloudinaryAsset({
    url,
    publicId,
    context,
}: IDeleteCloudinaryAssetArgs): Promise<void> {
    const resolvedPublicId = normalizePublicId(publicId) ?? extractCloudinaryPublicId(url);
    if (!resolvedPublicId) {
        return;
    }

    try {
        configureCloudinary();

        const result = await cloudinary.uploader.destroy(resolvedPublicId, {
            resource_type: 'image',
            type: 'upload',
            invalidate: true,
        });

        if (result.result !== 'ok' && result.result !== 'not found') {
            console.warn(`[Cloudinary cleanup] Unexpected destroy result for ${context}:`, {
                publicId: resolvedPublicId,
                result: result.result,
            });
        }
    } catch (error) {
        console.error(`[Cloudinary cleanup] Failed for ${context}:`, {
            publicId: resolvedPublicId,
            error,
        });
    }
}
