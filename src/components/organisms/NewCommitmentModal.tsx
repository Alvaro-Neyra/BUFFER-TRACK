"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCommitment } from "@/app/detail/[floorId]/actions";
import type { ISpecialtyOption, IUserOption } from "@/app/detail/[floorId]/DetailPlanView";

interface INewCommitmentModalProps {
    onClose: () => void;
    initialX?: number;
    initialY?: number;
    specialties: ISpecialtyOption[];
    users: IUserOption[];
    projectId: string;
    buildingId: string;
    floorId: string;
}

export const NewCommitmentModal = ({
    onClose,
    initialX,
    initialY,
    specialties,
    users,
    projectId,
    buildingId,
    floorId,
}: Readonly<INewCommitmentModalProps>) => {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [description, setDescription] = useState("");
    const [specialtyId, setSpecialtyId] = useState("");
    const [assignedTo, setAssignedTo] = useState("");
    const [targetDate, setTargetDate] = useState("");
    const [xPercent, setXPercent] = useState(initialX ?? 50);
    const [yPercent, setYPercent] = useState(initialY ?? 50);

    // Filter users by selected specialty
    const filteredUsers = specialtyId
        ? users.filter(u => u.specialtyId === specialtyId)
        : users;

    const handleSubmit = () => {
        if (!description || !specialtyId) return;

        startTransition(async () => {
            const res = await createCommitment({
                projectId,
                buildingId,
                floorId,
                specialtyId,
                assignedTo: assignedTo || undefined,
                description,
                targetDate: targetDate || undefined,
                coordinates: { xPercent, yPercent },
            });

            if (res.success) {
                router.refresh();
                onClose();
            } else {
                alert(res.error || "Failed to create commitment");
            }
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-neutral-200 dark:border-neutral-800 flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center bg-neutral-50 dark:bg-neutral-800/50">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Create New Commitment</h2>
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

                    {/* Specialty + Assigned User */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-2">Specialty *</label>
                            <select
                                value={specialtyId}
                                onChange={(e) => { setSpecialtyId(e.target.value); setAssignedTo(""); }}
                                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-lg text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                            >
                                <option value="">Select specialty...</option>
                                {specialties.map(s => (
                                    <option key={s._id} value={s._id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-2">Assign To</label>
                            <select
                                value={assignedTo}
                                onChange={(e) => setAssignedTo(e.target.value)}
                                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-lg text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                            >
                                <option value="">Select user...</option>
                                {filteredUsers.map(u => (
                                    <option key={u._id} value={u._id}>{u.name} ({u.company})</option>
                                ))}
                            </select>
                            {specialtyId && filteredUsers.length === 0 && (
                                <p className="text-xs text-amber-500 mt-1">No users with this specialty found</p>
                            )}
                        </div>
                    </div>

                    {/* Target Date + Coordinates */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-2">Target Date</label>
                            <input
                                type="date" value={targetDate}
                                onChange={(e) => setTargetDate(e.target.value)}
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
                        disabled={isPending || !description || !specialtyId}
                        className="px-6 py-2 text-sm font-bold bg-primary hover:bg-primary/90 text-white rounded-lg shadow-sm transition-transform active:scale-95 disabled:opacity-50"
                    >
                        {isPending ? "Creating..." : "Create Commitment"}
                    </button>
                </div>
            </div>
        </div>
    );
};
