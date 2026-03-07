// ------------------------------------------------------------------
// Client-Side Image Compression Utility
// Pattern: Utility Module
// Why: Compresses images in the browser using Canvas API before
//      uploading to reduce bandwidth and handle large floor plans.
//      ALWAYS downscales to MAX_VIEWER_DIMENSION to ensure smooth
//      zoom/pan performance in the browser (GPU limitation).
//      Preserves aspect ratio during downscaling.
// ------------------------------------------------------------------

/** Result of the compression attempt. */
export interface ICompressionResult {
    /** The compressed file ready for upload. */
    file: File;
    /** Original file size in bytes. */
    originalSize: number;
    /** Compressed file size in bytes. */
    compressedSize: number;
    /** Compression ratio (e.g. 0.65 = 35% smaller). */
    ratio: number;
    /** Format used for compression. */
    format: string;
}

const MAX_UPLOAD_SIZE = 50 * 1024 * 1024; // 50MB after compression

/**
 * Maximum dimension (width or height) for the viewer image.
 * - 2048px is the sweet spot: enough detail for 50× zoom on a 1920×1080 screen,
 *   while keeping the pixel count under ~4M (2048×1536) for smooth GPU compositing.
 * - For reference: 4000×3000 = 12M pixels → GPU struggles on integrated graphics.
 *   2048×1536 = 3.1M pixels → smooth on virtually any device.
 */
const MAX_VIEWER_DIMENSION = 2048;

/**
 * Compress an image file client-side using the Canvas API.
 *
 * Strategy:
 * 1. ALWAYS load the image and check dimensions
 * 2. If larger than MAX_VIEWER_DIMENSION → downscale preserving aspect ratio
 * 3. Compress using JPEG/WebP quality steps if needed
 * 4. If already small + within dimensions → return as-is
 *
 * @param file - The original image File
 * @returns The compression result or throws with a user-friendly message
 */
export async function compressImage(file: File): Promise<ICompressionResult> {
    const mimeType = file.type;
    const isSupported = ['image/jpeg', 'image/png', 'image/webp'].includes(mimeType);

    if (!isSupported) {
        throw new Error(
            `Unsupported format: ${file.name}. Please upload a JPEG, PNG, or WebP image.`
        );
    }

    const originalSize = file.size;
    const formatName = mimeType === 'image/jpeg' ? 'JPEG' : mimeType === 'image/png' ? 'PNG' : 'WebP';

    // Always load image to check dimensions
    const img = await loadImage(file);
    const { naturalWidth: w, naturalHeight: h } = img;

    const needsDownscale = w > MAX_VIEWER_DIMENSION || h > MAX_VIEWER_DIMENSION;
    const needsCompress = originalSize > MAX_UPLOAD_SIZE;

    // ── Fast path: small file + small dimensions → return as-is ──
    if (!needsDownscale && !needsCompress) {
        URL.revokeObjectURL(img.src);
        return {
            file,
            originalSize,
            compressedSize: originalSize,
            ratio: 1,
            format: `${formatName} (original ${w}×${h}, no processing needed)`,
        };
    }

    // ── Calculate target dimensions ──────────────────────────────
    let targetW = w;
    let targetH = h;

    if (needsDownscale) {
        const scale = Math.min(MAX_VIEWER_DIMENSION / w, MAX_VIEWER_DIMENSION / h);
        targetW = Math.round(w * scale);
        targetH = Math.round(h * scale);
    }

    // ── Draw to canvas at target resolution ──────────────────────
    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
        URL.revokeObjectURL(img.src);
        throw new Error("Could not create canvas context");
    }

    // Use high-quality bicubic interpolation for downscaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, targetW, targetH);

    // Release object URL to free memory
    URL.revokeObjectURL(img.src);

    // ── Determine output format ─────────────────────────────────
    // PNG → convert to JPEG for smaller file size (plans don't need transparency)
    const outputMime = mimeType === 'image/png' ? 'image/jpeg' : mimeType;
    const outputExt = outputMime === 'image/jpeg' ? '.jpg' : '.webp';
    const outputFormatName = outputMime === 'image/jpeg' ? 'JPEG' : 'WebP';

    // ── Try quality steps ───────────────────────────────────────
    const qualitySteps: { q: number; label: string }[] = [
        { q: 0.92, label: 'high quality' },
        { q: 0.85, label: 'good quality' },
        { q: 0.75, label: 'standard quality' },
    ];

    for (const step of qualitySteps) {
        const blob = await canvasToBlob(canvas, outputMime, step.q);
        if (blob && blob.size <= MAX_UPLOAD_SIZE) {
            const compressed = new File([blob], replaceExt(file.name, outputExt), { type: outputMime });
            const dimInfo = needsDownscale ? `${w}×${h} → ${targetW}×${targetH}` : `${w}×${h}`;
            return {
                file: compressed,
                originalSize,
                compressedSize: compressed.size,
                ratio: compressed.size / originalSize,
                format: `${outputFormatName} ${step.label} (${dimInfo})`,
            };
        }
    }

    // All strategies failed
    const sizeMB = (originalSize / (1024 * 1024)).toFixed(1);
    throw new Error(
        `The ${formatName} image (${sizeMB}MB, ${w}×${h}) is too large even after compression and downscaling. ` +
        `Limit: ${MAX_UPLOAD_SIZE / (1024 * 1024)}MB. Try using a lower resolution image.`
    );
}

/** Format file size for display. */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Internal helpers ──────────────────────────────────────────────

function loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = URL.createObjectURL(file);
    });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
    return new Promise((resolve) => {
        try {
            canvas.toBlob(
                (blob) => resolve(blob),
                type,
                quality
            );
        } catch {
            resolve(null);
        }
    });
}

function replaceExt(filename: string, newExt: string): string {
    const lastDot = filename.lastIndexOf(".");
    if (lastDot === -1) return filename + newExt;
    return filename.substring(0, lastDot) + newExt;
}
