"use client";

import React, { useRef } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

interface IPlanViewerProps {
    imageUrl: string;
    children?: React.ReactNode;
    onMapClick?: (xPercent: number, yPercent: number) => void;
}

export const PlanViewer = ({ imageUrl, children, onMapClick }: Readonly<IPlanViewerProps>) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current || !onMapClick) return;

        // We only trigger add pin on exact map click, not when dragging or clicking a pin
        if ((e.target as HTMLElement).id !== "map-image-target") return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Compute percentages
        const xPercent = (x / rect.width) * 100;
        const yPercent = (y / rect.height) * 100;

        onMapClick(xPercent, yPercent);
    };

    return (
        <div className="flex-1 relative rounded-xl shadow-inner bg-neutral-200 dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 overflow-hidden cursor-move">
            <TransformWrapper
                initialScale={1}
                minScale={0.5}
                maxScale={4}
                centerOnInit={true}
                doubleClick={{ disabled: true }}
            >
                {({ zoomIn, zoomOut }) => (
                    <>
                        <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
                            <div
                                ref={containerRef}
                                className="relative inline-block w-full h-full min-h-[600px] min-w-[800px]"
                                onClick={handleContainerClick}
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    id="map-image-target"
                                    src={imageUrl}
                                    alt="Floor Plan"
                                    className="w-full h-full object-cover pointer-events-auto"
                                    draggable={false}
                                />

                                {/* Pins and Overlays render relative to this container */}
                                {children}
                            </div>
                        </TransformComponent>

                        <div className="absolute bottom-4 right-4 flex flex-col gap-2 bg-white/90 dark:bg-neutral-900/90 backdrop-blur rounded-md shadow-md p-1 border border-neutral-200 dark:border-neutral-700 z-10">
                            <button
                                onClick={() => zoomIn()}
                                className="p-2 text-neutral-600 dark:text-neutral-300 hover:text-primary hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                                title="Zoom In"
                            >
                                <span className="material-symbols-outlined text-sm">add</span>
                            </button>
                            <button
                                onClick={() => zoomOut()}
                                className="p-2 text-neutral-600 dark:text-neutral-300 hover:text-primary hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                                title="Zoom Out"
                            >
                                <span className="material-symbols-outlined text-sm">remove</span>
                            </button>
                        </div>
                    </>
                )}
            </TransformWrapper>
        </div>
    );
};
