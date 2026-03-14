"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAssignment } from "@/app/detail/[floorId]/actions";
import { AlertModal } from "@/components/organisms/AlertModal";

interface IFloorOption {
    _id: string;
    label: string;
    order: number;
    gcsImageUrl: string;
}

interface IBuildingOption {
    _id: string;
    name: string;
    code: string;
    floors: IFloorOption[];
}

interface ISpecialtyOption {
    _id: string;
    name: string;
    colorHex: string;
}

interface IStatusOption {
    _id: string;
    name: string;
    colorHex: string;
}

interface IMasterPlanCreateAssignmentPanelProps {
    building: IBuildingOption | null;
    selectedFloorId: string | null;
    specialties: ISpecialtyOption[];
    statuses: IStatusOption[];
    projectId: string;
    pinCoords: { x: number; y: number } | null;
    onSelectFloor: (floorId: string | null) => void;
    onClearBuilding: () => void;
    onClearPin: () => void;
    onCancel: () => void;
    onCreated: () => void;
}

export function MasterPlanCreateAssignmentPanel({
    building,
    selectedFloorId,
    specialties,
    statuses,
    projectId,
    pinCoords,
    onSelectFloor,
    onClearBuilding,
    onClearPin,
    onCancel,
    onCreated,
}: Readonly<IMasterPlanCreateAssignmentPanelProps>) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const [title, setTitle] = useState("");
    const [specialtyId, setSpecialtyId] = useState("");
    const [status, setStatus] = useState("Request");
    const [requiredDate, setRequiredDate] = useState("");

    const [alert, setAlert] = useState<{ isOpen: boolean; title: string; message: string; type: "success" | "error" } | null>(null);

    const availableStatuses = useMemo(() => statuses, [statuses]);

    const selectedFloor = useMemo(() => {
        if (!building || !selectedFloorId) return null;
        return building.floors.find((floor) => floor._id === selectedFloorId) || null;
    }, [building, selectedFloorId]);

    useEffect(() => {
        if (availableStatuses.length === 0) {
            setStatus("Request");
            return;
        }

        setStatus((current) => {
            const exists = availableStatuses.some((item) => item.name === current);
            return exists ? current : availableStatuses[0].name;
        });
    }, [availableStatuses]);

    const hasSelectableFloors = Boolean(
        building?.floors.some((floor) => Boolean(floor.gcsImageUrl))
    );

    const isFormReady = Boolean(
        building
        && selectedFloor
        && pinCoords
        && title.trim()
        && specialtyId
        && requiredDate
        && status
    );

    const handleCreate = () => {
        if (!building || !selectedFloor || !pinCoords || !title.trim() || !specialtyId || !requiredDate || !status) {
            return;
        }

        startTransition(async () => {
            const res = await createAssignment({
                projectId,
                buildingId: building._id,
                floorId: selectedFloor._id,
                specialtyId,
                description: title.trim(),
                status,
                requiredDate,
                coordinates: {
                    xPercent: pinCoords.x,
                    yPercent: pinCoords.y,
                },
            });

            if (!res.success) {
                setAlert({
                    isOpen: true,
                    title: "Error",
                    message: res.error || "Failed to create assignment",
                    type: "error",
                });
                return;
            }

            setTitle("");
            setSpecialtyId("");
            setRequiredDate("");
            onClearPin();
            onCreated();
            router.refresh();
        });
    };

    return (
        <aside className="w-80 lg:w-96 bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 flex flex-col shrink-0">
            <div className="p-6 pb-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 z-10 sticky top-0 space-y-3">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <h3 className="text-neutral-900 dark:text-white text-lg font-bold leading-tight flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">add_task</span>
                            Create Assignment
                        </h3>
                        <p className="text-xs text-neutral-500 mt-1">
                            Click a building hotspot, choose a floor, then click on the plan to place the pin.
                        </p>
                    </div>
                    <button
                        onClick={onCancel}
                        className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
                        title="Close"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {building ? (
                    <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-3">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Selected Building</div>
                        <div className="mt-1 flex items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-semibold text-neutral-900 dark:text-white">{building.name}</p>
                                <p className="text-xs text-neutral-500">{building.code}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    onClearBuilding();
                                    onSelectFloor(null);
                                    onClearPin();
                                }}
                                className="px-2 py-1 text-[11px] font-bold rounded-md border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                            >
                                Change
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800">
                        Waiting for building selection from the map.
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Floor</label>
                    <select
                        value={selectedFloorId || ""}
                        onChange={(event) => {
                            const value = event.target.value;
                            onSelectFloor(value || null);
                            onClearPin();
                        }}
                        disabled={!building || !hasSelectableFloors}
                        className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-lg text-sm text-neutral-900 dark:text-neutral-100 disabled:opacity-60"
                    >
                        <option value="">Select floor...</option>
                        {(building?.floors || []).map((floor) => (
                            <option
                                key={floor._id}
                                value={floor._id}
                                disabled={!floor.gcsImageUrl}
                            >
                                {floor.label}{floor.gcsImageUrl ? "" : " (No plan image)"}
                            </option>
                        ))}
                    </select>
                    {building && !hasSelectableFloors && (
                        <p className="text-[11px] text-rose-600 dark:text-rose-400">
                            This building has no floor plans uploaded yet.
                        </p>
                    )}
                </div>

                <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Pin Coordinates</label>
                    {pinCoords ? (
                        <div className="flex items-center justify-between rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                            <span>
                                X {pinCoords.x.toFixed(1)}% · Y {pinCoords.y.toFixed(1)}%
                            </span>
                            <button
                                type="button"
                                onClick={onClearPin}
                                className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:underline"
                            >
                                Clear
                            </button>
                        </div>
                    ) : (
                        <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 px-3 py-2 text-xs text-neutral-500">
                            Click on the floor plan to place the assignment pin.
                        </div>
                    )}
                </div>

                <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Title</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="e.g. Install HVAC Ductwork"
                        disabled={!selectedFloor}
                        className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-lg text-sm text-neutral-900 dark:text-neutral-100 disabled:opacity-60"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Specialty</label>
                    <select
                        value={specialtyId}
                        onChange={(event) => setSpecialtyId(event.target.value)}
                        disabled={!selectedFloor}
                        className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-lg text-sm text-neutral-900 dark:text-neutral-100 disabled:opacity-60"
                    >
                        <option value="">Select specialty...</option>
                        {specialties.map((specialty) => (
                            <option key={specialty._id} value={specialty._id}>
                                {specialty.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Status</label>
                        <select
                            value={status}
                            onChange={(event) => setStatus(event.target.value)}
                            disabled={!selectedFloor || availableStatuses.length === 0}
                            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-lg text-sm text-neutral-900 dark:text-neutral-100 disabled:opacity-60"
                        >
                            {availableStatuses.length === 0 && <option value="">No statuses</option>}
                            {availableStatuses.map((item) => (
                                <option key={item._id} value={item.name}>{item.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Required Date</label>
                        <input
                            type="date"
                            value={requiredDate}
                            onChange={(event) => setRequiredDate(event.target.value)}
                            disabled={!selectedFloor}
                            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-lg text-sm text-neutral-900 dark:text-neutral-100 disabled:opacity-60"
                        />
                    </div>
                </div>
            </div>

            <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
                <button
                    type="button"
                    onClick={handleCreate}
                    disabled={isPending || !isFormReady}
                    className="w-full py-2.5 text-sm font-bold bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                    {isPending ? "Creating..." : "Create Assignment"}
                </button>
            </div>

            {alert && (
                <AlertModal
                    isOpen={alert.isOpen}
                    title={alert.title}
                    message={alert.message}
                    type={alert.type}
                    onClose={() => setAlert(null)}
                />
            )}
        </aside>
    );
}
