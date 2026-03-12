"use client";

import React, { useState, useTransition } from "react";
import { updateCommitment } from "@/app/manage-project/actions";
import { ISpecialtyDTO, IStatusDTO, IUserDTO } from "@/types/models";
import type { ISerializedCommitment } from "@/app/manage-project/ManageProjectView";
import { AlertModal } from "./AlertModal";
import { toDateInputValue, toUtcMidnightIso } from "@/lib/dateOnly";

interface IEditActivityModalProps {
    commitment: ISerializedCommitment;
    onClose: () => void;
    specialties: ISpecialtyDTO[];
    statuses: IStatusDTO[];
    users: IUserDTO[];
}

export const EditActivityModal = ({
    commitment,
    onClose,
    specialties,
    statuses,
    users,
}: IEditActivityModalProps) => {
    const [isPending, startTransition] = useTransition();
    const [title, setTitle] = useState(commitment.name || "");
    const [customId, setCustomId] = useState(commitment.customId || "");
    const [location, setLocation] = useState(commitment.location || "");
    const [description, setDescription] = useState(commitment.description || "");
    const [specialtyId, setSpecialtyId] = useState(commitment.specialtyId || "");
    const [assignedTo, setAssignedTo] = useState(commitment.assignedToId || "");
    const [status, setStatus] = useState(commitment.status || "");
    const [startDate, setStartDate] = useState(toDateInputValue(commitment.startDate ?? commitment.dates?.startDate ?? null));
    const [targetDate, setTargetDate] = useState(toDateInputValue(commitment.targetDate ?? commitment.dates?.targetDate ?? null));
    
    const [alert, setAlert] = useState<{ isOpen: boolean; title: string; message: string; type: 'success' | 'error' } | null>(null);

    // Filter users by selected specialty
    const filteredUsers = specialtyId
        ? users.filter((user) => user.specialtyId === specialtyId)
        : users;

    const handleSubmit = () => {
        if (!title.trim() || !specialtyId || !status) return;

        if (startDate && targetDate && targetDate < startDate) {
            setAlert({
                isOpen: true,
                title: "Invalid dates",
                message: "Target Date cannot be before Start Date.",
                type: 'error',
            });
            return;
        }

        startTransition(async () => {
            const res = await updateCommitment(commitment._id, {
                name: title.trim(),
                customId: customId.trim() || "",
                location: location.trim() || "",
                specialtyId,
                assignedTo: assignedTo || null,
                description: description.trim(),
                status,
                dates: {
                    ...(commitment.dates || {}),
                    // Keep date-only values pinned to UTC midnight to avoid timezone drift.
                    startDate: startDate ? toUtcMidnightIso(startDate) : null,
                    targetDate: targetDate ? toUtcMidnightIso(targetDate) : null,
                }
            });

            if (res.success) {
                onClose();
            } else {
                setAlert({ isOpen: true, title: "Error", message: res.error || "Failed to update activity", type: 'error' });
            }
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-neutral-200 dark:border-neutral-800 flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center bg-neutral-50 dark:bg-neutral-800/50">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Edit Activity</h2>
                    <button onClick={onClose} className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-5">
                    {/* Core Fields */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-2">Title *</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-lg text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-2">Custom ID</label>
                            <input
                                type="text"
                                value={customId}
                                onChange={(e) => setCustomId(e.target.value)}
                                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-lg text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-2">Location</label>
                            <input
                                type="text"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-lg text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-2">Description</label>
                        <input
                            type="text" value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-lg text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                        />
                    </div>

                    {/* Status */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-2">Status *</label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-lg text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                        >
                            <option value="">Select status...</option>
                            {statuses.map(s => (
                                <option key={s._id} value={s.name}>{s.name}</option>
                            ))}
                        </select>
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
                        </div>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-2">Start Date</label>
                            <input
                                type="date" value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-lg text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-2">Target Date</label>
                            <input
                                type="date" value={targetDate}
                                onChange={(e) => setTargetDate(e.target.value)}
                                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-lg text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                            />
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isPending || !title.trim() || !specialtyId || !status}
                        className="px-6 py-2 text-sm font-bold bg-primary hover:bg-primary/90 text-white rounded-lg shadow-sm transition-transform active:scale-95 disabled:opacity-50"
                    >
                        {isPending ? "Saving..." : "Save Changes"}
                    </button>
                </div>
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
        </div>
    );
};
