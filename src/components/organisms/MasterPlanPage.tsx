"use client";

import { useCallback, useEffect, useState } from "react";
import { GlobalHeader } from "@/components/organisms/GlobalHeader";
import { PendingTasksSidebar } from "@/components/organisms/PendingTasksSidebar";
import { InteractivePlanViewer } from "@/components/organisms/InteractivePlanViewer";
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
    coordinates: { xPercent: number; yPercent: number };
    polygon?: Array<{ xPercent: number; yPercent: number }>;
    color?: string;
    floors: IFloorData[];
}

export interface IPendingCommitment {
    _id: string;
    name: string;
    status: string;
    specialtyName: string;
    specialtyColor: string;
    assignedToName: string;
    buildingCode: string;
    buildingId: string;
    floorLabel: string;
    floorId: string;
    isOverdue: boolean;
    createdAt: string;
}

interface IMasterPlanPageProps {
    masterPlanImageUrl: string;
    buildings: IBuildingData[];
    commitments: IPendingCommitment[];
    initialOpenBuildingId?: string | null;
}

export function MasterPlanPage({
    masterPlanImageUrl,
    buildings,
    commitments,
    initialOpenBuildingId = null,
}: IMasterPlanPageProps) {
    const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
    const [focusPulse, setFocusPulse] = useState(0);
    const [selectedBuildingForModal, setSelectedBuildingForModal] = useState<IBuildingData | null>(null);

    const commitmentCountsByBuilding = commitments.reduce<Record<string, number>>((acc, commitment) => {
        acc[commitment.buildingId] = (acc[commitment.buildingId] ?? 0) + 1;
        return acc;
    }, {});

    const focusAndOpenBuilding = useCallback((buildingId: string) => {
        const building = buildings.find((b) => b._id === buildingId);
        if (!building) return;

        // Force focus animation each click, even if the same building is selected.
        setSelectedHotspotId(buildingId);
        setFocusPulse((p) => p + 1);
        setSelectedBuildingForModal(building);
    }, [buildings]);

    useEffect(() => {
        if (!initialOpenBuildingId) return;

        const buildingExists = buildings.some((building) => building._id === initialOpenBuildingId);
        if (!buildingExists) return;

        focusAndOpenBuilding(initialOpenBuildingId);
    }, [focusAndOpenBuilding, initialOpenBuildingId, buildings]);

    return (
        <div className="flex flex-col h-dvh w-full bg-[#18181A] dark:bg-neutral-950 font-sans">
            <GlobalHeader
                showSearch={true}
                showLinks={true}
                onOpenBuildingFromSearch={focusAndOpenBuilding}
            />

            <main className="flex-1 flex overflow-hidden">
                <div className="flex-1 flex flex-col overflow-hidden bg-[#F4F7F6] relative">
                    <div className="flex flex-1 overflow-hidden">
                        <div className="flex flex-col flex-1 overflow-y-auto p-4 lg:p-6 border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
                            <div className="flex flex-wrap justify-between items-end gap-4 mb-4">
                                <h1 className="text-neutral-900 dark:text-white text-2xl font-black leading-tight tracking-tight">Master Plan Overview</h1>
                            </div>

                            {masterPlanImageUrl ? (
                                <InteractivePlanViewer
                                    imageUrl={masterPlanImageUrl}
                                    hotspots={buildings.map((building) => ({
                                        ...building,
                                        commitmentCount: commitmentCountsByBuilding[building._id] ?? 0,
                                    }))}
                                    mode="view"
                                    selectedHotspotId={selectedHotspotId}
                                    focusPulse={focusPulse}
                                    onHotspotSelect={(hotspot) => {
                                        focusAndOpenBuilding(hotspot._id);
                                    }}
                                />
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 min-h-100">
                                    <span className="material-symbols-outlined text-5xl text-neutral-300 mb-3">map</span>
                                    <p className="text-sm font-medium text-neutral-500">No master plan image uploaded yet</p>
                                    <p className="text-xs text-neutral-400 mt-1">Go to Manage Project → Buildings to upload one</p>
                                </div>
                            )}
                        </div>

                        <PendingTasksSidebar
                            commitments={commitments}
                            onTaskClick={focusAndOpenBuilding}
                        />
                    </div>

                    {selectedBuildingForModal && (
                        <FloorSelectorModal
                            buildingName={selectedBuildingForModal.name}
                            buildingCode={selectedBuildingForModal.code}
                            floors={selectedBuildingForModal.floors}
                            onClose={() => setSelectedBuildingForModal(null)}
                        />
                    )}
                </div>
            </main>
        </div>
    );
}
