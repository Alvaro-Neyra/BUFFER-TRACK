"use client";

import React, { useState, useRef } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { MasterPlanHotspot } from "@/components/atoms/MasterPlanHotspot";
import { FloorSelectorModal } from "@/components/organisms/FloorSelectorModal";

interface IFloorData {
    _id: string;
    label: string;
    order: number;
}

interface IBuildingData {
    _id: string;
    name: string;
    code: string;
    coordinates: {
        xPercent: number;
        yPercent: number;
    };
    color?: string;
    floors: IFloorData[];
}

interface IMasterPlanViewerProps {
    imageUrl: string;
    buildings: IBuildingData[];
}

export const MasterPlanViewer = ({ imageUrl, buildings }: IMasterPlanViewerProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [selectedBuilding, setSelectedBuilding] = useState<IBuildingData | null>(null);

    const getRandomColor = (index: number) => {
        const colors = ["bg-purple-500", "bg-blue-500", "bg-warning", "bg-success"];
        return colors[index % colors.length];
    };

    return (
        <>
            <div className="flex-1 min-h-[500px] relative rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden bg-neutral-100 dark:bg-neutral-800 shadow-inner cursor-move">
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
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        id="master-plan-image"
                                        src={imageUrl}
                                        alt="Master Plan"
                                        className="w-full h-full object-cover pointer-events-auto"
                                        draggable={false}
                                    />
                                    <div className="absolute inset-0 bg-neutral-900/20 mix-blend-multiply pointer-events-none"></div>

                                    {/* Dynamic Hotspots from DB */}
                                    {buildings.map((building, idx) => (
                                        <MasterPlanHotspot
                                            key={building._id.toString()}
                                            xPercent={building.coordinates.xPercent}
                                            yPercent={building.coordinates.yPercent}
                                            buildingId={building.code}
                                            color={building.color || getRandomColor(idx)}
                                            onClick={() => setSelectedBuilding(building)}
                                        />
                                    ))}
                                </div>
                            </TransformComponent>

                            {/* Zoom Controls Overlay */}
                            <div className="absolute bottom-6 right-6 z-10 flex flex-col gap-2 bg-white dark:bg-neutral-800 rounded-md shadow-md border border-neutral-200 dark:border-neutral-700 p-1">
                                <button
                                    onClick={() => zoomIn()}
                                    className="p-2 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-md transition-colors shadow-none border-none cursor-pointer"
                                >
                                    <span className="material-symbols-outlined">add</span>
                                </button>
                                <div className="w-full h-px bg-neutral-200 dark:bg-neutral-700"></div>
                                <button
                                    onClick={() => zoomOut()}
                                    className="p-2 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-md transition-colors border-none shadow-none cursor-pointer"
                                >
                                    <span className="material-symbols-outlined">remove</span>
                                </button>
                            </div>

                            {/* Legend Overlay */}
                            <div className="absolute top-6 left-6 z-10 bg-white/90 dark:bg-neutral-800/90 backdrop-blur-sm rounded-md shadow-md border border-neutral-200 dark:border-neutral-700 p-4">
                                <h4 className="text-xs font-bold uppercase text-neutral-500 mb-2">Buildings</h4>
                                <div className="flex flex-col gap-2">
                                    {buildings.slice(0, 6).map((b, idx) => (
                                        <button
                                            key={b._id}
                                            onClick={() => setSelectedBuilding(b)}
                                            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                                        >
                                            <div className={`w-3 h-3 rounded-full ${b.color || getRandomColor(idx)}`} />
                                            <span className="text-sm text-neutral-700 dark:text-neutral-300">{b.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </TransformWrapper>
            </div>

            {/* Floor Selector Modal */}
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
