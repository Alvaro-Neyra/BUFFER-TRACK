"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAssignment } from "@/app/detail/[floorId]/actions";
import type { ISpecialtyOption } from "@/app/detail/[floorId]/DetailPlanView";

interface IAssignmentCreateSidebarProps {
    floorId: string;
    projectId: string;
    buildingId: string;
    specialties: ISpecialtyOption[];
    pinCoords: { x: number; y: number } | null;
    onPickAnotherPoint: () => void;
    onCancel: () => void;
    onCreated: () => void;
}

export function AssignmentCreateSidebar({
    floorId,
    projectId,
    buildingId,
    specialties,
    pinCoords,
    onPickAnotherPoint,
    onCancel,
    onCreated,
}: Readonly<IAssignmentCreateSidebarProps>) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const [title, setTitle] = useState("");
    const [specialtyId, setSpecialtyId] = useState("");
    const [requiredDate, setRequiredDate] = useState("");

    const canSubmit = Boolean(pinCoords && title.trim() && specialtyId && requiredDate);

    const handleCreate = () => {
        if (!canSubmit || !pinCoords) return;

        startTransition(async () => {
            const res = await createAssignment({
                projectId,
                buildingId,
                floorId,
                specialtyId,
                description: title.trim(),
                requiredDate,
                coordinates: {
                    xPercent: pinCoords.x,
                    yPercent: pinCoords.y,
                },
            });

            if (!res.success) {
                alert(res.error || "Failed to create assignment");
                return;
            }

            setTitle("");
            setSpecialtyId("");
            setRequiredDate("");
            onCreated();
            router.refresh();
        });
    };

    return (
        <aside className="w-80 md:w-96 bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 flex flex-col shrink-0 shadow-xl overflow-y-auto z-20">
            <div className="px-6 py-5 border-b border-neutral-200 dark:border-neutral-800 sticky top-0 bg-white/95 dark:bg-neutral-900/95 backdrop-blur z-10">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h3 className="text-sm font-bold text-neutral-900 dark:text-white">New Assignment</h3>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                            Pick a point on the plan and fill in title, specialty, and required date.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
            </div>

            <div className="p-6 flex-1 flex flex-col gap-4">
                <div>
                    <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
                        Point
                    </label>
                    {pinCoords ? (
                        <div className="flex items-center justify-between rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                            <span>X: {pinCoords.x.toFixed(1)}% · Y: {pinCoords.y.toFixed(1)}%</span>
                            <button
                                type="button"
                                onClick={onPickAnotherPoint}
                                className="text-xs font-bold hover:underline"
                            >
                                Pick again
                            </button>
                        </div>
                    ) : (
                        <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 px-3 py-2 text-xs text-neutral-500 dark:text-neutral-400">
                            Click on the plan to choose the assignment location.
                        </div>
                    )}
                </div>

                <div>
                    <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
                        Title
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="e.g. Install HVAC Ductwork"
                        disabled={!pinCoords}
                        className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                    />
                </div>

                <div>
                    <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
                        Specialty
                    </label>
                    <select
                        value={specialtyId}
                        onChange={(event) => setSpecialtyId(event.target.value)}
                        disabled={!pinCoords}
                        className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                    >
                        <option value="">Select specialty...</option>
                        {specialties.map((specialty) => (
                            <option key={specialty._id} value={specialty._id}>
                                {specialty.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
                        Required Date
                    </label>
                    <input
                        type="date"
                        value={requiredDate}
                        onChange={(event) => setRequiredDate(event.target.value)}
                        disabled={!pinCoords}
                        className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                    />
                </div>
            </div>

            <div className="p-6 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 shrink-0">
                <button
                    type="button"
                    onClick={handleCreate}
                    disabled={isPending || !canSubmit}
                    className="w-full py-2.5 px-4 bg-primary text-white rounded-md text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    {isPending ? "Creating..." : "Create Assignment"}
                </button>
            </div>
        </aside>
    );
}
