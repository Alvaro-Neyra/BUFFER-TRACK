"use client";

// ------------------------------------------------------------------
// FreeDrawOverlay — SVG-based freehand polygon drawing
// Pattern: Compound Component (used inside TransformComponent)
// Why: Enables users to draw free-form zones on plan images to
//      define building areas or activity zones. Uses percentage-based
//      coordinates for responsiveness across all screen sizes.
// ------------------------------------------------------------------

import React, { useRef, useState, useCallback } from "react";

/** A single percentage-based point. */
export interface IPercentPoint {
    xPercent: number;
    yPercent: number;
}

interface IExistingPolygon {
    id: string;
    points: IPercentPoint[];
    color?: string;
    label?: string;
    onClick?: () => void;
}

interface IFreeDrawOverlayProps {
    /** Whether drawing mode is active. */
    isDrawing: boolean;
    /** Called when user finishes drawing a polygon. */
    onDrawComplete: (polygon: IPercentPoint[], centroid: IPercentPoint) => void;
    /** Existing polygons to render as filled overlays. */
    existingPolygons?: IExistingPolygon[];
    /** Color for the drawn stroke and fill while drawing. */
    drawColor?: string;
}

// ─── Ramer–Douglas–Peucker path simplification ────────────────────

function perpendicularDist(p: IPercentPoint, a: IPercentPoint, b: IPercentPoint): number {
    const dx = b.xPercent - a.xPercent;
    const dy = b.yPercent - a.yPercent;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) {
        const ex = p.xPercent - a.xPercent;
        const ey = p.yPercent - a.yPercent;
        return Math.sqrt(ex * ex + ey * ey);
    }
    const t = Math.max(0, Math.min(1, ((p.xPercent - a.xPercent) * dx + (p.yPercent - a.yPercent) * dy) / lenSq));
    const projX = a.xPercent + t * dx;
    const projY = a.yPercent + t * dy;
    const ex = p.xPercent - projX;
    const ey = p.yPercent - projY;
    return Math.sqrt(ex * ex + ey * ey);
}

function rdpSimplify(points: IPercentPoint[], epsilon: number): IPercentPoint[] {
    if (points.length <= 2) return points;

    let maxDist = 0;
    let index = 0;
    for (let i = 1; i < points.length - 1; i++) {
        const d = perpendicularDist(points[i], points[0], points[points.length - 1]);
        if (d > maxDist) { maxDist = d; index = i; }
    }

    if (maxDist > epsilon) {
        const left = rdpSimplify(points.slice(0, index + 1), epsilon);
        const right = rdpSimplify(points.slice(index), epsilon);
        return [...left.slice(0, -1), ...right];
    }

    return [points[0], points[points.length - 1]];
}

/** Calculate the centroid of a polygon. */
export function calculateCentroid(points: IPercentPoint[]): IPercentPoint {
    if (points.length === 0) return { xPercent: 50, yPercent: 50 };
    const sumX = points.reduce((s, p) => s + p.xPercent, 0);
    const sumY = points.reduce((s, p) => s + p.yPercent, 0);
    return {
        xPercent: sumX / points.length,
        yPercent: sumY / points.length,
    };
}

/** Convert polygon points to an SVG points string (percentage-based). */
function toSvgPoints(points: IPercentPoint[]): string {
    return points.map(p => `${p.xPercent},${p.yPercent}`).join(" ");
}

// ─── Component ───────────────────────────────────────────────────

export function FreeDrawOverlay({
    isDrawing,
    onDrawComplete,
    existingPolygons = [],
    drawColor = "#2563EB",
}: IFreeDrawOverlayProps) {
    const svgRef = useRef<SVGSVGElement>(null);
    const [currentPath, setCurrentPath] = useState<IPercentPoint[]>([]);
    const [isMouseDown, setIsMouseDown] = useState(false);

    const getPercentCoords = useCallback((e: React.MouseEvent<SVGSVGElement>): IPercentPoint | null => {
        if (!svgRef.current) return null;
        const rect = svgRef.current.getBoundingClientRect();
        return {
            xPercent: ((e.clientX - rect.left) / rect.width) * 100,
            yPercent: ((e.clientY - rect.top) / rect.height) * 100,
        };
    }, []);

    const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        if (!isDrawing) return;
        e.preventDefault();
        e.stopPropagation();
        const point = getPercentCoords(e);
        if (point) {
            setIsMouseDown(true);
            setCurrentPath([point]);
        }
    }, [isDrawing, getPercentCoords]);

    const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        if (!isMouseDown || !isDrawing) return;
        e.preventDefault();
        const point = getPercentCoords(e);
        if (point) {
            setCurrentPath(prev => [...prev, point]);
        }
    }, [isMouseDown, isDrawing, getPercentCoords]);

    const handleMouseUp = useCallback(() => {
        if (!isMouseDown || !isDrawing) return;
        setIsMouseDown(false);

        if (currentPath.length < 5) {
            // Too few points — treat as accidental click, reset
            setCurrentPath([]);
            return;
        }

        // Simplify the path (epsilon in % — 0.3% tolerance is good for plans)
        const simplified = rdpSimplify(currentPath, 0.3);

        if (simplified.length < 3) {
            setCurrentPath([]);
            return;
        }

        const centroid = calculateCentroid(simplified);
        onDrawComplete(simplified, centroid);
        setCurrentPath([]);
    }, [isMouseDown, isDrawing, currentPath, onDrawComplete]);

    // Build the polyline string for the active drawing
    const activePolyline = currentPath.length > 1
        ? currentPath.map(p => `${p.xPercent},${p.yPercent}`).join(" ")
        : "";

    return (
        <svg
            ref={svgRef}
            className="absolute inset-0 w-full h-full z-10"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{
                pointerEvents: isDrawing ? "auto" : "none",
                cursor: isDrawing ? "crosshair" : "default",
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            {/* Existing polygons */}
            {existingPolygons.map((poly) => (
                <polygon
                    key={poly.id}
                    points={toSvgPoints(poly.points)}
                    fill={poly.color || "#2563EB"}
                    fillOpacity={0.15}
                    stroke={poly.color || "#2563EB"}
                    strokeWidth={0.2}
                    strokeOpacity={0.6}
                    style={{ pointerEvents: "auto", cursor: "pointer" }}
                    onClick={(e) => {
                        e.stopPropagation();
                        poly.onClick?.();
                    }}
                >
                    <title>{poly.label || ""}</title>
                </polygon>
            ))}

            {/* Active drawing path */}
            {activePolyline && (
                <>
                    <polyline
                        points={activePolyline}
                        fill="none"
                        stroke={drawColor}
                        strokeWidth={0.3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeOpacity={0.8}
                    />
                    {/* Close-preview fill */}
                    <polygon
                        points={activePolyline}
                        fill={drawColor}
                        fillOpacity={0.1}
                        stroke="none"
                    />
                </>
            )}
        </svg>
    );
}
