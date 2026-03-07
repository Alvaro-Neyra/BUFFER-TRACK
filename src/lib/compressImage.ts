// ------------------------------------------------------------------
// Client-Side Image Compression Utility
// Pattern: Utility Module
// Why: Compresses images in the browser using Canvas API before
//      uploading to reduce bandwidth and handle large floor plans.
//      Uses lossless WebP first, then falls back to high-quality JPEG.
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
 * Compress an image file client-side using the Canvas API.
 *
 * Strategy:
 * 1. Draw the original image to a canvas at full resolution (no downscale)
 * 2. Export as WebP at quality 1.0 (effectively lossless)
 * 3. If still over limit, try WebP at 0.95 (near-lossless, imperceptible loss)
 * 4. If still over limit, return an error
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

    // Load image into an HTMLImageElement
    const img = await loadImage(file);

    // Create canvas at original dimensions (no quality loss from resizing)
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create canvas context");

    // Draw the original image at full resolution
    ctx.drawImage(img, 0, 0);

    const ext = mimeType === 'image/jpeg' ? '.jpg' : mimeType === 'image/png' ? '.png' : '.webp';
    const formatName = mimeType === 'image/jpeg' ? 'JPEG' : mimeType === 'image/png' ? 'PNG' : 'WebP';

    if (mimeType === 'image/png') {
        // PNG doesn't support lossy compression via Canvas API quality parameter
        const pngBlob = await canvasToBlob(canvas, "image/png", 1.0);
        if (pngBlob.size <= MAX_UPLOAD_SIZE) {
            const compressed = new File([pngBlob], replaceExt(file.name, ext), { type: mimeType });
            return {
                file: compressed,
                originalSize,
                compressedSize: compressed.size,
                ratio: compressed.size / originalSize,
                format: "PNG (lossless)",
            };
        }

        const bestSizeMB = (pngBlob.size / (1024 * 1024)).toFixed(1);
        throw new Error(
            `The PNG image is too large (${bestSizeMB}MB vs limits of ${MAX_UPLOAD_SIZE / (1024 * 1024)}MB). ` +
            `PNG formats cannot be compressed further without losing quality. Try converting it to JPEG or WebP.`
        );
    }

    // Strategy 1: max quality / lossless (quality 1.0)
    const blobMax = await canvasToBlob(canvas, mimeType, 1.0);
    if (blobMax.size <= MAX_UPLOAD_SIZE) {
        const compressed = new File([blobMax], replaceExt(file.name, ext), { type: mimeType });
        return {
            file: compressed,
            originalSize,
            compressedSize: compressed.size,
            ratio: compressed.size / originalSize,
            format: `${formatName} (max quality)`,
        };
    }

    // Strategy 2: near-lossless (quality 0.95)
    const blobNearLossless = await canvasToBlob(canvas, mimeType, 0.95);
    if (blobNearLossless.size <= MAX_UPLOAD_SIZE) {
        const compressed = new File([blobNearLossless], replaceExt(file.name, ext), { type: mimeType });
        return {
            file: compressed,
            originalSize,
            compressedSize: compressed.size,
            ratio: compressed.size / originalSize,
            format: `${formatName} (near-lossless)`,
        };
    }

    // Strategy 3: high quality (quality 0.90)
    const blobHigh = await canvasToBlob(canvas, mimeType, 0.90);
    if (blobHigh.size <= MAX_UPLOAD_SIZE) {
        const compressed = new File([blobHigh], replaceExt(file.name, ext), { type: mimeType });
        return {
            file: compressed,
            originalSize,
            compressedSize: compressed.size,
            ratio: compressed.size / originalSize,
            format: `${formatName} (high quality)`,
        };
    }

    // All strategies failed
    const bestSizeMB = (blobHigh.size / (1024 * 1024)).toFixed(1);
    throw new Error(
        `The ${formatName} image is too large even after compression. ` +
        `Best compressed size: ${bestSizeMB}MB (limit: ${MAX_UPLOAD_SIZE / (1024 * 1024)}MB). ` +
        `Try using a lower resolution image.`
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

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) resolve(blob);
                else reject(new Error(`Failed to convert canvas to ${type}`));
            },
            type,
            quality
        );
    });
}

function replaceExt(filename: string, newExt: string): string {
    const lastDot = filename.lastIndexOf(".");
    if (lastDot === -1) return filename + newExt;
    return filename.substring(0, lastDot) + newExt;
}
