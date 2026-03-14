"use client";

import React, { useState, useTransition } from "react";
import { updateAssignment } from "@/app/manage-project/actions";
import { ISpecialtyDTO, IStatusDTO } from "@/types/models";
import type { ISerializedAssignment } from "@/app/manage-project/ManageProjectView";
import { AlertModal } from "./AlertModal";
import { toDateInputValue, toUtcMidnightIso } from "@/lib/dateOnly";

interface IEditActivityModalProps {
    assignment: ISerializedAssignment;
    onClose: () => void;
    specialties: ISpecialtyDTO[];
    statuses: IStatusDTO[];
}

export const EditActivityModal = ({
    assignment,
    onClose,
    specialties,
    statuses,
}: IEditActivityModalProps) => {
    const [isPending, startTransition] = useTransition();
    const [title, setTitle] = useState(assignment.name || "");
    const [description, setDescription] = useState(assignment.description || "");
    const [specialtyId, setSpecialtyId] = useState(assignment.specialtyId || "");
    const [status, setStatus] = useState(assignment.status || "");
    const [requiredDate, setRequiredDate] = useState(toDateInputValue(assignment.requiredDate ?? null));

    const [alert, setAlert] = useState<{ isOpen: boolean; title: string; message: string; type: "success" | "error" } | null>(null);

    const handleSubmit = () => {
        if (!title.trim() || !specialtyId || !status || !requiredDate) return;

        startTransition(async () => {
            const res = await updateAssignment(assignment._id, {
                name: title.trim(),
                specialtyId,
                description: description.trim(),
                status,
                requiredDate: toUtcMidnightIso(requiredDate),
            });

            if (res.success) {
                onClose();
            } else {
                setAlert({ isOpen: true, title: "Error", message: res.error || "Failed to update activity", type: "error" });
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
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-2">Title *</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-lg text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-2">Description</label>
                        <input
                            type="text"
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-lg text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-2">Specialty *</label>
                            <select
                                value={specialtyId}
                                onChange={(event) => setSpecialtyId(event.target.value)}
                                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-lg text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                            >
                                <option value="">Select specialty...</option>
                                {specialties.map((specialty) => (
                                    <option key={specialty._id} value={specialty._id}>{specialty.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-2">Status *</label>
                            <select
                                value={status}
                                onChange={(event) => setStatus(event.target.value)}
                                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-lg text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                            >
                                <option value="">Select status...</option>
                                {statuses.map((s) => (
                                    <option key={s._id} value={s.name}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-2">Required Date *</label>
                        <input
                            type="date"
                            value={requiredDate}
                            onChange={(event) => setRequiredDate(event.target.value)}
                            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-lg text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                        />
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isPending || !title.trim() || !specialtyId || !status || !requiredDate}
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
