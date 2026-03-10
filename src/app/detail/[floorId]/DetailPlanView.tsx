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

interface IDetailPlanViewProps {
    floorData: IFloorData;
    commitments: ICommitmentData[];
    specialties: ISpecialtyOption[];
    users: IUserOption[];
    weekStart: string;
    currentUserId: string;
}

// ─── Component ───────────────────────────────────────────────────

export function DetailPlanView({
    floorData,
    commitments,
    specialties,
    users,
    weekStart,
}: IDetailPlanViewProps) {
    const [selectedCommitment, setSelectedCommitment] = useState<ICommitmentData | null>(null);
    const [showNewModal, setShowNewModal] = useState(false);
    const [newPinCoords, setNewPinCoords] = useState<{ x: number; y: number } | null>(null);
    const [highlightedPinId, setHighlightedPinId] = useState<string | null>(null);
    const [highlightedDay, setHighlightedDay] = useState<string | null>(null);

    // Click on plan → open commitment creation modal
    const handleMapClick = (xPercent: number, yPercent: number) => {
        setNewPinCoords({ x: xPercent, y: yPercent });
        setShowNewModal(true);
    };

    // Click on pin → open sidebar + highlight calendar day
    const handlePinClick = (commitment: ICommitmentData) => {
        setSelectedCommitment(commitment);
        setHighlightedPinId(commitment._id);
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
            setSelectedCommitment(match);
        }
    };

    // Map pin status to visual status for CommitmentPin
    const mapPinStatus = (status: string): 'In Progress' | 'Completed' | 'Delayed' | 'Restricted' => {
        switch (status) {
            case 'In Progress': return 'In Progress';
            case 'Completed': return 'Completed';
            case 'Delayed': return 'Delayed';
            case 'Restricted': return 'Restricted';
            default: return 'In Progress'; // Request, Notified, Committed show as in-progress
        }
    };

    return (
        <div className="flex flex-col h-full w-full overflow-hidden bg-[#F4F7F6] dark:bg-neutral-950">
            <GlobalHeader title={`${floorData.buildingName} · ${floorData.label}`} showLinks={true} />

            <main className="flex-1 flex overflow-hidden">
                <div className="flex-1 flex flex-col overflow-hidden relative">
                    {/* Calendar Bar */}
                    <CalendarBar
                        commitments={commitments}
                        weekStart={weekStart}
                        highlightedDay={highlightedDay}
                        onDayClick={handleDayClick}
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
                            <button
                                onClick={() => { setNewPinCoords(null); setShowNewModal(true); }}
                                className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-bold transition-colors shadow-sm flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined text-sm">add_location_alt</span>
                                Drop Pin
                            </button>
                        </div>

                        <InteractivePlanViewer
                            imageUrl={floorData.gcsImageUrl}
                            hotspots={commitments.map(c => ({
                                _id: c._id,
                                name: c.description || c.specialtyName, // Fallback if no desc
                                coordinates: c.coordinates,
                                color: c.specialtyColor,
                                icon: getSpecialtyIcon(c.specialtyName),
                            }))}
                            onHotspotSelect={(hotspot: any) => {
                                const matched = commitments.find(c => c._id === hotspot._id);
                                if (matched) {
                                    handlePinClick(matched);
                                }
                            }}
                            selectedHotspotId={highlightedPinId}
                            onMapClick={handleMapClick}
                            mode="view"
                        />
                    </div>
                </div>

                {/* Commitment Details Sidebar - Always Open */}
                <CommitmentDetailsSidebar
                    commitments={commitments}
                    selectedCommitmentId={highlightedPinId}
                    floorId={floorData._id}
                    specialties={specialties}
                    users={users}
                    onSelectCommitment={(commitment) => {
                        setSelectedCommitment(commitment);
                        setHighlightedPinId(commitment._id);
                        if (commitment.targetDate) {
                            setHighlightedDay(commitment.targetDate);
                        }
                    }}
                    onClose={() => {
                        setSelectedCommitment(null);
                        setHighlightedPinId(null);
                        setHighlightedDay(null);
                    }}
                />
            </main>

            {/* New Commitment Modal */}
            {showNewModal && (
                <NewCommitmentModal
                    onClose={() => { setShowNewModal(false); setNewPinCoords(null); }}
                    initialX={newPinCoords?.x}
                    initialY={newPinCoords?.y}
                    specialties={specialties}
                    users={users}
                    projectId={floorData.projectId}
                    buildingId={floorData.buildingId}
                    floorId={floorData._id}
                />
            )}
        </div>
    );
}
