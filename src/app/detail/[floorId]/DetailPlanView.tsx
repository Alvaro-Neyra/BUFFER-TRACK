"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { GlobalHeader } from "@/components/organisms/GlobalHeader";
import { CalendarBar } from "@/components/organisms/CalendarBar";
import { InteractivePlanViewer } from "@/components/organisms/InteractivePlanViewer";
import { AssignmentDetailsSidebar } from "@/components/organisms/AssignmentDetailsSidebar";
import { getSpecialtyIcon } from "@/lib/getSpecialtyIcon";
import { toUtcDateKey } from "@/lib/dateOnly";
import { AssignmentCreateSidebar } from "@/components/organisms/AssignmentCreateSidebar";

// ─── Types ───────────────────────────────────────────────────────

export interface IFloorData {
    _id: string;
    label: string;
    order: number;
    gcsImageUrl: string;
    buildingId: string;
    buildingName: string;
    buildingCode: string;
    projectId: string;
}

export interface IAssignmentData {
    _id: string;
    name: string;
    description: string;
    status: string;
    specialtyName: string;
    specialtyColor: string;
    specialtyId: string;
    requesterId: string;
    requesterName: string;
    acceptedById: string;
    acceptedByName: string;
    acceptedAt: string | null;
    coordinates: { xPercent: number; yPercent: number };
    requiredDate: string | null;
    createdAt: string | null;
    weekStart: string | null;
}

export interface ISpecialtyOption {
    _id: string;
    name: string;
    colorHex: string;
}

export interface IStatusOption {
    _id: string;
    name: string;
    colorHex: string;
}

interface IDetailPlanViewProps {
    floorData: IFloorData;
    assignments: IAssignmentData[];
    specialties: ISpecialtyOption[];
    statuses: IStatusOption[];
    currentUserId: string;
}

// ─── Component ───────────────────────────────────────────────────

export function DetailPlanView({
    floorData,
    assignments,
    specialties,
    statuses,
    currentUserId,
}: IDetailPlanViewProps) {
    const searchParams = useSearchParams();
    const [isCreatingAssignment, setIsCreatingAssignment] = useState(false);
    const [newPinCoords, setNewPinCoords] = useState<{ x: number; y: number } | null>(null);
    const [highlightedPinId, setHighlightedPinId] = useState<string | null>(null);
    const [highlightedDayKey, setHighlightedDayKey] = useState<string | null>(null);
    const [mapMode, setMapMode] = useState<"view" | "placing">("view");
    const [focusPulse, setFocusPulse] = useState(0);

    const selectedAssignmentFromQuery = searchParams?.get("assignmentId") || null;

    useEffect(() => {
        if (!selectedAssignmentFromQuery) return;

        const matchingAssignment = assignments.find((assignment) => assignment._id === selectedAssignmentFromQuery);
        if (!matchingAssignment) return;

        setHighlightedPinId(matchingAssignment._id);
        setFocusPulse((pulse) => pulse + 1);
        setHighlightedDayKey(toUtcDateKey(matchingAssignment.requiredDate));
    }, [assignments, selectedAssignmentFromQuery]);

    const startNewAssignmentFlow = () => {
        setIsCreatingAssignment(true);
        setNewPinCoords(null);
        setHighlightedPinId(null);
        setHighlightedDayKey(null);
        setMapMode("placing");
    };

    // Click on plan while placing mode is active.
    const handleMapClick = (xPercent: number, yPercent: number) => {
        if (mapMode === "placing") {
            setNewPinCoords({ x: xPercent, y: yPercent });
            setMapMode("view");
        }
    };

    // Click on pin → open sidebar + highlight calendar day
    const handlePinClick = (assignment: IAssignmentData) => {
        setHighlightedPinId(assignment._id);
        setFocusPulse(p => p + 1);
        setHighlightedDayKey(toUtcDateKey(assignment.requiredDate));
    };

    // Click on calendar day → highlight corresponding pins
    const handleDayClick = (dayKey: string) => {
        setHighlightedDayKey(dayKey);
        const match = assignments.find((assignment) => toUtcDateKey(assignment.requiredDate) === dayKey);
        if (match) {
            setHighlightedPinId(match._id);
        }
    };

    return (
        <div className="flex flex-col h-full w-full overflow-hidden bg-[#F4F7F6] dark:bg-neutral-950">
            <GlobalHeader title={`${floorData.buildingName} · ${floorData.label}`} showLinks={true} />

            <main className="flex-1 flex overflow-hidden">
                <div className="flex-1 flex flex-col overflow-hidden relative">
                    {/* Calendar Bar */}
                    <CalendarBar
                        assignments={assignments}
                        highlightedDayKey={highlightedDayKey}
                        onDayClick={handleDayClick}
                        onAssignmentClick={handlePinClick}
                    />

                    {/* Plan Area */}
                    <div className="flex-1 p-4 md:p-6 relative bg-neutral-100 dark:bg-neutral-800 overflow-hidden flex flex-col">
                        <div className="flex justify-between items-center mb-4 shrink-0">
                            <div>
                                <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
                                    {floorData.buildingCode} · {floorData.label}
                                </h1>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                    {assignments.length} assignment{assignments.length !== 1 ? "s" : ""} on this floor
                                </p>
                            </div>

                            {!isCreatingAssignment ? (
                                <button
                                    type="button"
                                    onClick={startNewAssignmentFlow}
                                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[18px]">add_task</span>
                                    New Assignment
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMapMode("placing");
                                        setNewPinCoords(null);
                                    }}
                                    className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-2 text-sm font-bold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[18px]">my_location</span>
                                    Pick Point
                                </button>
                            )}
                        </div>

                        <InteractivePlanViewer
                            imageUrl={floorData.gcsImageUrl}
                            hotspots={assignments.map(c => ({
                                _id: c._id,
                                name: c.name || c.description || c.specialtyName,
                                coordinates: c.coordinates,
                                color: c.specialtyColor || "#8B5CF6",
                                icon: getSpecialtyIcon(c.specialtyName),
                            }))}
                            onHotspotSelect={(hotspot: { _id: string }) => {
                                const matched = assignments.find(c => c._id === hotspot._id);
                                if (matched) {
                                    handlePinClick(matched);
                                }
                            }}
                            selectedHotspotId={highlightedPinId}
                            focusPulse={focusPulse}
                            onMapClick={handleMapClick}
                            mode={mapMode}
                        />
                    </div>
                </div>

                {isCreatingAssignment ? (
                    <AssignmentCreateSidebar
                        floorId={floorData._id}
                        projectId={floorData.projectId}
                        buildingId={floorData.buildingId}
                        specialties={specialties}
                        pinCoords={newPinCoords}
                        onPickAnotherPoint={() => {
                            setMapMode("placing");
                            setNewPinCoords(null);
                        }}
                        onCancel={() => {
                            setIsCreatingAssignment(false);
                            setMapMode("view");
                            setNewPinCoords(null);
                        }}
                        onCreated={() => {
                            setIsCreatingAssignment(false);
                            setMapMode("view");
                            setNewPinCoords(null);
                        }}
                    />
                ) : (
                    <AssignmentDetailsSidebar
                        assignments={assignments}
                        selectedAssignmentId={highlightedPinId}
                        floorId={floorData._id}
                        statuses={statuses}
                        currentUserId={currentUserId}
                        onSelectAssignment={(assignment) => {
                            setHighlightedPinId(assignment._id);
                            setFocusPulse((p) => p + 1);
                            setHighlightedDayKey(toUtcDateKey(assignment.requiredDate));
                        }}
                        onClose={() => {
                            setHighlightedPinId(null);
                            setHighlightedDayKey(null);
                        }}
                    />
                )}
            </main >
        </div >
    );
}
