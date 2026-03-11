// ------------------------------------------------------------------
// Floor Plan Image Upload API
// Pattern: Thin Route Handler
// Why: Handles multipart form data for floor plan image uploads.
//      Saves files to public/uploads/floors/ with unique names.
// ------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { auth } from '@/lib/auth';
import { roleRepository } from '@/repositories/role.repository';
import mongoose from 'mongoose';

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

        // Create upload directory if it doesn't exist
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'floors');
        await mkdir(uploadDir, { recursive: true });

        // Generate unique filename
        const ext = path.extname(file.name) || '.jpg';
        const uniqueName = `floor_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
        const filePath = path.join(uploadDir, uniqueName);

        // Write file to disk
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filePath, buffer);

        // Return the public URL
        const publicUrl = `/uploads/floors/${uniqueName}`;

        return NextResponse.json({
            success: true,
            data: { url: publicUrl, filename: uniqueName },
        });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Upload failed' },
            { status: 500 }
        );
    }
}
