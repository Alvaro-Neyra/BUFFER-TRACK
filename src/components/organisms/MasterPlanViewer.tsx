"use client";

// ------------------------------------------------------------------
// MasterPlanViewer — Zero-lag zoom/pan via image-overlay separation
// 
// Architecture:
//   Parent (overflow:hidden)
//     ├── <img> ← panzoom transforms ONLY this (single DOM node, fast)
//     ├── Overlay div ← transform synced via DOM manipulation (no React re-renders)
//     │     ├── SVG polygons
//     │     └── Hotspot divs
//     └── UI controls (fixed position, outside transform)
//
// Key: panzoom fires "panzoomchange" on every frame → we copy the
// img's style.transform to the overlay div via ref (no setState).
// ------------------------------------------------------------------

import React, { useState, useRef, useEffect, useCallback } from "react";
import Panzoom from "@panzoom/panzoom";
import type { PanzoomEventDetail } from "@panzoom/panzoom";
import { FloorSelectorModal } from "@/components/organisms/FloorSelectorModal";

interface IFloorData { _id: string; label: string; order: number }

interface IBuildingData {
    _id: string;
    name: string;
    code: string;
    coordinates: { xPercent: number; yPercent: number };
    polygon?: Array<{ xPercent: number; yPercent: number }>;
    color?: string;
    floors: IFloorData[];
}

interface IMasterPlanViewerProps {
    imageUrl: string;
    buildings: IBuildingData[];
}

const POLY_COLORS = ["#8B5CF6", "#3B82F6", "#F59E0B", "#10B981", "#EC4899", "#06B6D4"];

export const MasterPlanViewer = ({ imageUrl, buildings }: IMasterPlanViewerProps) => {
    const imgRef = useRef<HTMLImageElement>(null);
    const parentRef = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const panzoomRef = useRef<ReturnType<typeof Panzoom> | null>(null);
    const rafIdRef = useRef<number>(0);
    const [selectedBuilding, setSelectedBuilding] = useState<IBuildingData | null>(null);
    const [scale, setScale] = useState(1);

    useEffect(() => {
        const img = imgRef.current;
        const parent = parentRef.current;
        if (!img || !parent) return;

        // Panzoom on the <img> ONLY — single DOM node, maximum performance
        const pz = Panzoom(img, {
            maxScale: 50,
            minScale: 0.02,
            startScale: 1,
            step: 0.15,
            cursor: "grab",
            touchAction: "none",
            // No animate — avoids CSS transition overhead during continuous pan
        });

        panzoomRef.current = pz;

        // Sync overlay transform on every frame (direct DOM, zero React re-renders)
        const syncOverlay = (e: Event) => {
            const overlay = overlayRef.current;
            if (!overlay || !img) return;
            overlay.style.transform = img.style.transform;
        };

        // Throttle scale state update via rAF to avoid React re-renders mid-gesture
        const updateScale = () => {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = requestAnimationFrame(() => {
                setScale(pz.getScale());
            });
        };

        // Wheel zoom — bind to parent
        const handleWheel = (e: WheelEvent) => pz.zoomWithWheel(e);
        parent.addEventListener("wheel", handleWheel, { passive: false });

        // Sync on every panzoom event
        img.addEventListener("panzoomchange", syncOverlay);
        img.addEventListener("panzoompan", syncOverlay);
        img.addEventListener("panzoomzoom", syncOverlay);
        img.addEventListener("panzoomzoom", updateScale);
        img.addEventListener("panzoomend", syncOverlay);
        img.addEventListener("panzoomend", updateScale);

        return () => {
            cancelAnimationFrame(rafIdRef.current);
            parent.removeEventListener("wheel", handleWheel);
            img.removeEventListener("panzoomchange", syncOverlay);
            img.removeEventListener("panzoompan", syncOverlay);
            img.removeEventListener("panzoomzoom", syncOverlay);
            img.removeEventListener("panzoomzoom", updateScale);
            img.removeEventListener("panzoomend", syncOverlay);
            img.removeEventListener("panzoomend", updateScale);
            pz.destroy();
            panzoomRef.current = null;
        };
    }, []);

    const handleZoomIn = useCallback(() => panzoomRef.current?.zoomIn(), []);
    const handleZoomOut = useCallback(() => panzoomRef.current?.zoomOut(), []);
    const handleReset = useCallback(() => {
        panzoomRef.current?.reset();
        // Also reset overlay
        if (overlayRef.current) overlayRef.current.style.transform = "";
    }, []);

    const imageRendering = scale >= 8 ? "pixelated" as const : "auto" as const;

    return (
        <>
            {/* Parent — overflow hidden, no scroll */}
            <div
                ref={parentRef}
                className="flex-1 min-h-[500px] relative rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 shadow-inner"
                style={{ overflow: "hidden" }}
            >
                {/* Layer 1: Image — panzoom transforms ONLY this element */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    ref={imgRef}
                    id="master-plan-image"
                    src={imageUrl}
                    alt="Master Plan"
                    className="w-full h-full object-contain select-none"
                    draggable={false}
                    decoding="async"
                    style={{ imageRendering, transformOrigin: "50% 50%" }}
                />

                {/* Layer 2: Overlay — transform synced via DOM ref (not React state) */}
                <div
                    ref={overlayRef}
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    style={{ transformOrigin: "50% 50%" }}
                >
                    {/* SVG polygon zones */}
                    <svg
                        className="absolute inset-0 w-full h-full"
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                    >
                        {buildings.map((building, idx) => {
                            if (!building.polygon || building.polygon.length < 3) return null;
                            const color = POLY_COLORS[idx % POLY_COLORS.length];
                            const points = building.polygon.map(p => `${p.xPercent},${p.yPercent}`).join(" ");
                            return (
                                <polygon
                                    key={`poly-${building._id}`}
                                    points={points}
                                    fill={color}
                                    fillOpacity={0.15}
                                    stroke={color}
                                    strokeWidth={0.2}
                                    strokeOpacity={0.6}
                                    style={{ pointerEvents: "auto", cursor: "pointer" }}
                                    onClick={(e) => { e.stopPropagation(); setSelectedBuilding(building); }}
                                >
                                    <title>{building.name} ({building.code})</title>
                                </polygon>
                            );
                        })}
                    </svg>

                    {/* Point hotspots — tiny dots */}
                    {buildings.map((building, idx) => (
                        <div
                            key={building._id}
                            className="absolute group"
                            style={{
                                top: `${building.coordinates.yPercent}%`,
                                left: `${building.coordinates.xPercent}%`,
                                transform: `translate(-50%, -50%) scale(${1 / Math.max(scale, 1)})`,
                                pointerEvents: "auto",
                                cursor: "pointer",
                            }}
                            onClick={(e) => { e.stopPropagation(); setSelectedBuilding(building); }}
                        >
                            <div className={`w-1 h-1 rounded-full shadow-sm ${building.color || ["bg-purple-500", "bg-blue-500", "bg-amber-500", "bg-emerald-500"][idx % 4]} hover:scale-[4] transition-transform`} />
                            <div className="absolute left-1/2 -translate-x-1/2 -top-6 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                                <div className="bg-neutral-900 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-lg">
                                    {building.code}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* UI Controls — fixed, outside transforms */}
                <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-1 bg-white dark:bg-neutral-800 rounded-md shadow-md border border-neutral-200 dark:border-neutral-700 p-0.5">
                    <button onClick={handleZoomIn} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition-colors border-none shadow-none cursor-pointer" title="Zoom In">
                        <span className="material-symbols-outlined text-neutral-600 dark:text-neutral-300 text-[16px]">add</span>
                    </button>
                    <button onClick={handleReset} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition-colors border-none shadow-none cursor-pointer" title="Fit">
                        <span className="material-symbols-outlined text-neutral-600 dark:text-neutral-300 text-[16px]">fit_screen</span>
                    </button>
                    <button onClick={handleZoomOut} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition-colors border-none shadow-none cursor-pointer" title="Zoom Out">
                        <span className="material-symbols-outlined text-neutral-600 dark:text-neutral-300 text-[16px]">remove</span>
                    </button>
                </div>

                <div className="absolute bottom-4 left-4 z-10 bg-neutral-900/80 text-white text-[10px] font-mono px-1.5 py-0.5 rounded select-none">
                    {Math.round(scale * 100)}%
                </div>

                {buildings.length > 0 && (
                    <div className="absolute top-3 left-3 z-10 bg-white/90 dark:bg-neutral-800/90 backdrop-blur-sm rounded-md shadow-md border border-neutral-200 dark:border-neutral-700 p-2.5">
                        <h4 className="text-[9px] font-bold uppercase text-neutral-500 mb-1">Buildings</h4>
                        <div className="flex flex-col gap-0.5">
                            {buildings.slice(0, 6).map((b, idx) => (
                                <button key={b._id} onClick={() => setSelectedBuilding(b)} className="flex items-center gap-1 hover:opacity-80 transition-opacity">
                                    <div className={`w-1.5 h-1.5 rounded-full ${b.color || ["bg-purple-500", "bg-blue-500", "bg-amber-500", "bg-emerald-500"][idx % 4]}`} />
                                    <span className="text-[10px] text-neutral-700 dark:text-neutral-300">{b.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {selectedBuilding && (
                <FloorSelectorModal
                    buildingName={selectedBuilding.name}
                    buildingCode={selectedBuilding.code}
                    floors={selectedBuilding.floors}
                    onClose={() => setSelectedBuilding(null)}
                />
            )}
        </>
    );
};
