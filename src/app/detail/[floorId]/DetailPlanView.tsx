"use client";

import React, { useState } from "react";
import { GlobalHeader } from "@/components/organisms/GlobalHeader";
import { CalendarBar } from "@/components/organisms/CalendarBar";
import { InteractivePlanViewer } from "@/components/organisms/InteractivePlanViewer";
import { CommitmentDetailsSidebar } from "@/components/organisms/CommitmentDetailsSidebar";
import { NewCommitmentModal } from "@/components/organisms/NewCommitmentModal";
import { getSpecialtyIcon } from "@/lib/getSpecialtyIcon";

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

export interface ICommitmentData {
    _id: string;
    customId?: string;
    location?: string;
    name: string;
    description: string;
    status: string;
    specialtyName: string;
    specialtyColor: string;
    specialtyId: string;
    assignedToId: string;
    assignedToName: string;
    assignedToCompany: string;
    requesterId: string;
    requesterName: string;
    coordinates: { xPercent: number; yPercent: number };
    startDate: string | null;
    targetDate: string | null;
    requestDate: string | null;
    weekStart: string | null;
}

export interface ISpecialtyOption {
    _id: string;
    name: string;
    colorHex: string;
}

export interface IUserOption {
    _id: string;
    name: string;
    company: string;
    role: string;
    specialtyId: string;
}

export interface IStatusOption {
    _id: string;
    name: string;
    colorHex: string;
}

interface IDetailPlanViewProps {
    floorData: IFloorData;
    commitments: ICommitmentData[];
    specialties: ISpecialtyOption[];
    users: IUserOption[];
    statuses: IStatusOption[];
    currentUserId: string;
}

// ─── Component ───────────────────────────────────────────────────

export function DetailPlanView({
    floorData,
    commitments,
    specialties,
    users,
    statuses,
}: IDetailPlanViewProps) {
    const [showNewModal, setShowNewModal] = useState(false);
    const [newPinCoords, setNewPinCoords] = useState<{ x: number; y: number } | null>(null);
    const [highlightedPinId, setHighlightedPinId] = useState<string | null>(null);
    const [highlightedDay, setHighlightedDay] = useState<string | null>(null);
    const [mapMode, setMapMode] = useState<"view" | "placing">("view");
    const [focusPulse, setFocusPulse] = useState(0);

    // Click on plan → open commitment creation modal (only if in placing mode)
    const handleMapClick = (xPercent: number, yPercent: number) => {
        if (mapMode === "placing") {
            setNewPinCoords({ x: xPercent, y: yPercent });
            setShowNewModal(true);
            setMapMode("view"); // Reset to view mode after dropping a pin
        }
    };

    // Click on pin → open sidebar + highlight calendar day
    const handlePinClick = (commitment: ICommitmentData) => {
        setHighlightedPinId(commitment._id);
        setFocusPulse(p => p + 1);
        if (commitment.targetDate) {
            setHighlightedDay(commitment.targetDate);
        }
    };

    // Click on calendar day → highlight corresponding pins
    const handleDayClick = (dateStr: string) => {
        setHighlightedDay(dateStr);
        // Find the first commitment for that day
        const match = commitments.find(c => {
            if (!c.targetDate) return false;
            const cDay = new Date(c.targetDate).toDateString();
            return cDay === new Date(dateStr).toDateString();
        });
        if (match) {
            setHighlightedPinId(match._id);
        }
    };

    // Helper to get dynamic status color
    const getStatusColor = (statusName: string) => {
        const found = statuses.find(s => s.name === statusName);
        return found?.colorHex || "#94a3b8"; // Default slate-400
    };

    return (
        <div className="flex flex-col h-full w-full overflow-hidden bg-[#F4F7F6] dark:bg-neutral-950">
            <GlobalHeader title={`${floorData.buildingName} · ${floorData.label}`} showLinks={true} />

            <main className="flex-1 flex overflow-hidden">
                <div className="flex-1 flex flex-col overflow-hidden relative">
                    {/* Calendar Bar */}
                    <CalendarBar
                        commitments={commitments}
                        highlightedDay={highlightedDay}
                        onDayClick={handleDayClick}
                        onCommitmentClick={handlePinClick}
                    />

                    {/* Plan Area */}
                    <div className="flex-1 p-4 md:p-6 relative bg-neutral-100 dark:bg-neutral-800 overflow-hidden flex flex-col">
                        <div className="flex justify-between items-center mb-4 shrink-0">
                            <div>
                                <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
                                    {floorData.buildingCode} · {floorData.label}
                                </h1>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                    {commitments.length} commitment{commitments.length !== 1 ? "s" : ""} on this floor
                                </p>
                            </div>
                        </div>

                        <InteractivePlanViewer
                            imageUrl={floorData.gcsImageUrl}
                            hotspots={commitments.map(c => ({
                                _id: c._id,
                                name: c.name || c.description || c.specialtyName,
                                coordinates: c.coordinates,
                                color: getStatusColor(c.status),
                                icon: getSpecialtyIcon(c.specialtyName),
                            }))}
                            onHotspotSelect={(hotspot: { _id: string }) => {
                                const matched = commitments.find(c => c._id === hotspot._id);
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

                {/* Commitment Details Sidebar - Always Open */}
                <CommitmentDetailsSidebar
                    commitments={commitments}
                    selectedCommitmentId={highlightedPinId}
                    floorId={floorData._id}
                    statuses={statuses}
                    onSelectCommitment={(commitment) => {
                        setHighlightedPinId(commitment._id);
                        setFocusPulse(p => p + 1);
                        if (commitment.targetDate) {
                            setHighlightedDay(commitment.targetDate);
                        }
                    }}
                    onClose={() => {
                        setHighlightedPinId(null);
                        setHighlightedDay(null);
                    }}
                />
            </main >

            {/* New Commitment Modal */}
            {
                showNewModal && (
                    <NewCommitmentModal
                        onClose={() => { setShowNewModal(false); setNewPinCoords(null); setMapMode("view"); }}
                        initialX={newPinCoords?.x}
                        initialY={newPinCoords?.y}
                        specialties={specialties}
                        users={users}
                        statuses={statuses}
                        projectId={floorData.projectId}
                        buildingId={floorData.buildingId}
                        floorId={floorData._id}
                    />
                )
            }
        </div >
    );
}
