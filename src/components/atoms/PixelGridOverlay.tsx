"use client";

// ------------------------------------------------------------------
// PixelGridOverlay — CSS-based grid that appears at high zoom
// Pattern: Visual Aid Component
// Why: When zoomed in deeply (≥ 6×), a subtle grid overlays the plan
//      to help the admin see reference points and draw building /
//      activity zones with pixel-level precision.
// ------------------------------------------------------------------

import React from "react";

interface IPixelGridOverlayProps {
    /** Current zoom scale — grid only renders when ≥ threshold. */
    zoomScale: number;
    /** Zoom level at which the grid starts appearing (default: 6). */
    threshold?: number;
    /** Grid cell size in pixels at 1× zoom (default: 8px). */
    cellSize?: number;
}

export function PixelGridOverlay({
    zoomScale,
    threshold = 6,
    cellSize = 8,
}: IPixelGridOverlayProps) {
    if (zoomScale < threshold) return null;

    // Fade in between threshold and threshold+4
    const opacity = Math.min((zoomScale - threshold) / 4, 0.4);

    return (
        <div
            className="absolute inset-0 pointer-events-none z-5"
            style={{
                opacity,
                backgroundImage: `
                    linear-gradient(to right, rgba(99,102,241,0.2) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(99,102,241,0.2) 1px, transparent 1px)
                `,
                backgroundSize: `${cellSize}px ${cellSize}px`,
                transition: "opacity 0.3s ease",
            }}
        >
            {/* Zoom level badge */}
            <div className="absolute top-1 left-1 bg-indigo-500/80 text-white text-[8px] font-mono px-1 py-0.5 rounded select-none">
                {zoomScale.toFixed(1)}×
            </div>
        </div>
    );
}
