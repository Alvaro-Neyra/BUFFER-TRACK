"use client";

import { useState } from "react";
import { GlobalHeader } from "@/components/organisms/GlobalHeader";
import { ProjectKPIs } from "@/components/organisms/ProjectKPIs";
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
}

export function MasterPlanPage({ masterPlanImageUrl, buildings, commitments }: IMasterPlanPageProps) {
    const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
    const [selectedBuildingForModal, setSelectedBuildingForModal] = useState<IBuildingData | null>(null);

    return (
        <div className="flex flex-col h-[100dvh] w-full bg-[#18181A] dark:bg-neutral-950 font-sans">
            <GlobalHeader showSearch={true} showLinks={true} />

            <main className="flex-1 flex overflow-hidden">
                <aside className="w-16 hover:w-64 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 flex flex-col shrink-0 transition-all duration-300 overflow-hidden group z-20 shadow-md">
                    <nav className="flex-1 overflow-y-auto py-4 flex flex-col gap-2 px-2">
                        <a href="/dashboard" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors w-full whitespace-nowrap">
                            <span className="material-symbols-outlined shrink-0">home</span>
                            <span className="font-semibold text-sm opacity-0 group-hover:opacity-100 transition-opacity">Dashboard</span>
                        </a>
                        <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-primary bg-primary/10 transition-colors w-full whitespace-nowrap border border-primary/20 shadow-sm">
                            <span className="material-symbols-outlined shrink-0 text-primary">map</span>
                            <span className="font-semibold text-sm opacity-0 group-hover:opacity-100 transition-opacity">Master Plan</span>
                        </a>
                        <a href={`/manage-project`} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors w-full whitespace-nowrap">
                            <span className="material-symbols-outlined shrink-0">settings</span>
                            <span className="font-semibold text-sm opacity-0 group-hover:opacity-100 transition-opacity">Manage Project</span>
                        </a>
                    </nav>
                </aside>

                <div className="flex-1 flex flex-col overflow-hidden bg-[#F4F7F6] relative">
                    <ProjectKPIs />

                    <div className="flex flex-1 overflow-hidden">
                        <div className="flex flex-col flex-1 overflow-y-auto p-4 lg:p-6 border-r border-neutral-200 dark:border-neutral-800">
                            <div className="flex flex-wrap justify-between items-end gap-4 mb-4">
                                <h1 className="text-neutral-900 dark:text-white text-2xl font-black leading-tight tracking-tight">Master Plan Overview</h1>
                            </div>

                            {masterPlanImageUrl ? (
                                <InteractivePlanViewer
                                    imageUrl={masterPlanImageUrl}
                                    hotspots={buildings}
                                    mode="view"
                                    selectedHotspotId={selectedHotspotId}
                                    onHotspotSelect={(hotspot) => {
                                        const b = buildings.find(bld => bld._id === hotspot._id);
                                        if (b) setSelectedBuildingForModal(b);
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
                            onTaskClick={(buildingId) => setSelectedHotspotId(buildingId)}
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
