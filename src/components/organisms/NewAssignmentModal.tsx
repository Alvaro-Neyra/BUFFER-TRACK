"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAssignment } from "@/app/detail/[floorId]/actions";
import type { ISpecialtyOption, IStatusOption } from "@/app/detail/[floorId]/DetailPlanView";

interface INewAssignmentModalProps {
    onClose: () => void;
    initialX?: number;
    initialY?: number;
    specialties: ISpecialtyOption[];
    statuses: IStatusOption[];
    projectId: string;
    buildingId: string;
    floorId: string;
}

export const NewAssignmentModal = ({
    onClose,
    initialX,
    initialY,
    specialties,
    statuses,
    projectId,
    buildingId,
    floorId,
}: Readonly<INewAssignmentModalProps>) => {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [description, setDescription] = useState("");
    const [specialtyId, setSpecialtyId] = useState("");
    const [status, setStatus] = useState(statuses.length > 0 ? statuses[0].name : "Request");
    const [requiredDate, setRequiredDate] = useState("");
    const [xPercent, setXPercent] = useState(initialX ?? 50);
    const [yPercent, setYPercent] = useState(initialY ?? 50);

    const handleSubmit = () => {
        if (!description || !specialtyId || !status || !requiredDate) return;

        startTransition(async () => {
            const res = await createAssignment({
                projectId,
                buildingId,
                floorId,
                specialtyId,
                description,
                status,
                requiredDate,
                coordinates: { xPercent, yPercent },
            });

            if (res.success) {
                router.refresh();
                onClose();
            } else {
                alert(res.error || "Failed to create assignment");
            }
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-neutral-200 dark:border-neutral-800 flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center bg-neutral-50 dark:bg-neutral-800/50">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Create New Assignment</h2>
                    <button onClick={onClose} className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-5">
                    {/* Coordinates indicator */}
                    {initialX !== undefined && initialY !== undefined && (
                        <div className="bg-primary/10 text-primary px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">location_on</span>
                            Pin at X {xPercent.toFixed(1)}%, Y {yPercent.toFixed(1)}%
                        </div>
                    )}

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-2">Description *</label>
                        <input
                            type="text" value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-lg text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                            placeholder="e.g. Install HVAC Ductwork"
                        />
                    </div>

                    {/* Specialty */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-2">Specialty *</label>
                            <select
                                value={specialtyId}
                                onChange={(e) => setSpecialtyId(e.target.value)}
                                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-lg text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                            >
                                <option value="">Select specialty...</option>
                                {specialties.map(s => (
                                    <option key={s._id} value={s._id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Status Selection */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-2">Initial Status *</label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-lg text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                        >
                            {statuses.map(s => (
                                <option key={s._id} value={s.name}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Required Date + Coordinates */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-2">Required Date *</label>
                            <input
                                type="date" value={requiredDate}
                                onChange={(e) => setRequiredDate(e.target.value)}
                                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-lg text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                            />
                        </div>
                        {initialX === undefined && (
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-2">X %</label>
                                    <input type="number" value={xPercent} min={0} max={100}
                                        onChange={(e) => setXPercent(parseFloat(e.target.value) || 0)}
                                        className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-lg text-sm text-neutral-900 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-2">Y %</label>
                                    <input type="number" value={yPercent} min={0} max={100}
                                        onChange={(e) => setYPercent(parseFloat(e.target.value) || 0)}
                                        className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-lg text-sm text-neutral-900 dark:text-white" />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex justify-end gap-3 shrink-0">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isPending || !description || !specialtyId || !requiredDate}
                        className="px-6 py-2 text-sm font-bold bg-primary hover:bg-primary/90 text-white rounded-lg shadow-sm transition-transform active:scale-95 disabled:opacity-50"
                    >
                        {isPending ? "Creating..." : "Create Assignment"}
                    </button>
                </div>
            </div>
        </div>
    );
};
