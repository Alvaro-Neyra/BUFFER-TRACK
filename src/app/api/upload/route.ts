// ------------------------------------------------------------------
// Floor Plan Image Upload API
// Pattern: Thin Route Handler
// Why: Handles multipart form data for floor plan image uploads.
//      Uploads compressed files to Cloudinary while enforcing
//      non-adaptive delivery URLs (no auto format/quality/DPR transforms).
// ------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { auth } from '@/lib/auth';
import { configureCloudinary } from '@/lib/cloudinary';
import { roleRepository } from '@/repositories/role.repository';
import mongoose from 'mongoose';

export const runtime = 'nodejs';

const CLOUDINARY_ADAPTIVE_TOKEN_REGEX = /(f_auto|q_auto|dpr_auto|w_auto|h_auto|g_auto|c_(?:fill|fit|scale|thumb|pad|crop|limit))/i;

function uploadImageToCloudinary(fileBuffer: Buffer, projectId: string): Promise<UploadApiResponse> {
    const baseFolder = process.env.CLOUDINARY_UPLOAD_FOLDER?.trim() || 'buffertrack/floors';
    const folder = `${baseFolder}/${projectId}`;

    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder,
                resource_type: 'image',
                overwrite: false,
                unique_filename: true,
                use_filename: false,
            },
            (error, result) => {
                if (error || !result) {
                    reject(error ?? new Error('Cloudinary upload failed'));
                    return;
                }
                resolve(result);
            }
        );

        stream.end(fileBuffer);
    });
}

function buildOriginalCloudinaryUrl(uploadResult: UploadApiResponse): string {
    return cloudinary.url(uploadResult.public_id, {
        secure: true,
        resource_type: 'image',
        type: 'upload',
        version: uploadResult.version,
        format: uploadResult.format,
    });
}

function ensureNonAdaptiveDeliveryUrl(url: string): string {
    if (CLOUDINARY_ADAPTIVE_TOKEN_REGEX.test(url)) {
        throw new Error('Adaptive Cloudinary transformations are not allowed for floor plan delivery URLs');
    }

    if (!/\/image\/upload\/v\d+\//.test(url)) {
        throw new Error('Invalid Cloudinary delivery URL format');
    }

    return url;
}

export async function POST(req: Request) {
    try {
        // Auth check
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const projectId = formData.get('projectId');

        if (typeof projectId !== 'string' || !mongoose.isValidObjectId(projectId)) {
            return NextResponse.json({ error: 'Invalid project id' }, { status: 400 });
        }

        const membership = session.user.projects?.find(
            (project) => project.projectId === projectId && project.status === 'Active'
        );
        if (!membership) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const membershipRole = membership.roleId
            ? await roleRepository.getByIdInProject(membership.roleId, projectId)
            : null;
        const canUpload = Boolean(membershipRole?.isManager);
        if (!canUpload) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json(
                { error: 'Invalid file type. Allowed: JPEG, PNG, WebP' },
                { status: 400 }
            );
        }

        // Validate file size (max 50MB — client compresses before upload)
        const maxSize = 50 * 1024 * 1024;
        if (file.size > maxSize) {
            return NextResponse.json(
                { error: 'File too large. Maximum size: 50MB' },
                { status: 400 }
            );
        }

        configureCloudinary();

        // Upload compressed file buffer to Cloudinary
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const uploadResult = await uploadImageToCloudinary(buffer, projectId);

        // Always persist canonical delivery URL without adaptive transformations.
        const publicUrl = ensureNonAdaptiveDeliveryUrl(buildOriginalCloudinaryUrl(uploadResult));

        return NextResponse.json({
            success: true,
            data: {
                url: publicUrl,
                publicId: uploadResult.public_id,
                // Keep backward compatibility for existing consumers.
                filename: uploadResult.public_id,
            },
        });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Upload failed' },
            { status: 500 }
        );
    }
}
