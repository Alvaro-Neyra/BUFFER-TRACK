"use client";

import React, { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { updateCommitmentStatus, updateCommitmentDetails } from "@/app/detail/[floorId]/actions";
import type { ICommitmentData, IStatusOption } from "@/app/detail/[floorId]/DetailPlanView";
import { formatDateOnlyUTC, toDateInputValue, toUtcMidnightIso } from "@/lib/dateOnly";

interface ICommitmentDetailsSidebarProps {
    commitments: ICommitmentData[];
    selectedCommitmentId: string | null;
    floorId: string;
    statuses: IStatusOption[];
    onSelectCommitment: (commitment: ICommitmentData) => void;
    onClose: () => void;
}

export const CommitmentDetailsSidebar = ({ commitments, selectedCommitmentId, floorId, statuses, onSelectCommitment, onClose }: Readonly<ICommitmentDetailsSidebarProps>) => {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const selectedCommitment = commitments.find(c => c._id === selectedCommitmentId) || null;

    // Helper to get dynamic status style
    const getStatusStyle = (statusName: string) => {
        const found = statuses.find(s => s.name === statusName);
        const color = found?.colorHex || "#94a3b8";
        return {
            color,
            bg: `${color}15`, // ~8% opacity hex
            label: statusName
        };
    };

    const handleStatusChange = (commitmentId: string, newStatus: string) => {
        startTransition(async () => {
            const res = await updateCommitmentStatus(commitmentId, newStatus, floorId);
            if (res.success) {
                router.refresh();
            } else {
                alert(res.error || "Failed to update status");
            }
        });
    };

    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ startDate: "", targetDate: "", status: "" });

    const handleEditClick = () => {
        setEditForm({
            startDate: toDateInputValue(selectedCommitment?.startDate),
            targetDate: toDateInputValue(selectedCommitment?.targetDate),
            status: selectedCommitment?.status || "In Progress"
        });
        setIsEditing(true);
    };

    const handleSaveEdit = () => {
        if (!selectedCommitment) return;

        if (editForm.startDate && editForm.targetDate && editForm.targetDate < editForm.startDate) {
            alert("Target End cannot be before Start Date");
            return;
        }

        startTransition(async () => {
            const res = await updateCommitmentDetails(selectedCommitment._id, {
                startDate: editForm.startDate ? toUtcMidnightIso(editForm.startDate) : null,
                targetDate: editForm.targetDate ? toUtcMidnightIso(editForm.targetDate) : null,
                status: editForm.status
            }, floorId);
            if (res.success) {
                setIsEditing(false);
                router.refresh();
            } else {
                alert(res.error || "Failed to save details");
            }
        });
    };

    if (!selectedCommitment) {
        return (
            <aside className="w-80 md:w-96 bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 flex flex-col shrink-0 shadow-xl overflow-y-auto z-20">
                <div className="px-6 py-5 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-start sticky top-0 bg-white/95 dark:bg-neutral-900/95 backdrop-blur z-10">
                    <div>
                        <h3 className="text-sm font-bold text-neutral-900 dark:text-white">Activity details</h3>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Selecciona un pin en el plano o una actividad de la lista.</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {commitments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-neutral-500 dark:text-neutral-400 text-sm">
                            <span className="material-symbols-outlined text-4xl mb-2 text-neutral-300">task_alt</span>
                            <p className="font-medium">Sin actividades asignadas a este piso</p>
                            <p className="text-xs mt-1 text-center px-4">Agrega una nueva actividad usando &quot;Drop Pin&quot; en el plano.</p>
                        </div>
                    ) : (
                        commitments.map(c => {
                            const statusStyle = getStatusStyle(c.status);
                            return (
                                <div
                                    key={c._id}
                                    onClick={() => onSelectCommitment(c)}
                                    className="group relative bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3.5 transition-all duration-200 hover:shadow-md hover:border-primary/40 cursor-pointer overflow-hidden"
                                >
                                    {/* Left Accent Bar */}
                                    <div
                                        className="absolute left-0 top-0 bottom-0 w-1 opacity-80 group-hover:opacity-100 transition-opacity"
                                        style={{ backgroundColor: c.specialtyColor || "#8B5CF6" }}
                                    />

                                    <div className="flex flex-col gap-2.5">
                                        <div className="flex justify-between items-start gap-3">
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-bold text-neutral-900 dark:text-white leading-snug group-hover:text-primary transition-colors line-clamp-2">
                                                    {c.name || c.description || c.specialtyName}
                                                </h4>
                                            </div>
                                            <span
                                                className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0 shadow-sm border border-black/5"
                                                style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
                                            >
                                                {statusStyle.label}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between mt-0.5">
                                            <div className="flex flex-wrap gap-2">
                                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/50 dark:border-neutral-700/50">
                                                    <div className="size-1.5 rounded-full" style={{ backgroundColor: c.specialtyColor || "#8B5CF6" }} />
                                                    <span className="text-[10px] font-semibold text-neutral-600 dark:text-neutral-400 capitalize">
                                                        {c.specialtyName.toLowerCase()}
                                                    </span>
                                                </div>

                                                {c.assignedToName !== "Unassigned" && (
                                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/50 dark:border-neutral-700/50">
                                                        <span className="material-symbols-outlined text-[12px] text-neutral-500">person</span>
                                                        <span className="text-[10px] font-semibold text-neutral-600 dark:text-neutral-400">
                                                            {c.assignedToName.split(' ')[0]}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {c.targetDate && (
                                                <div className="flex items-center gap-1 text-[10px] font-medium text-neutral-400 italic">
                                                    <span className="material-symbols-outlined text-[12px]">calendar_today</span>
                                                    {formatDateOnlyUTC(c.targetDate, { day: "numeric", month: "short", year: undefined })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </aside>
        );
    }

    const statusStyle = getStatusStyle(selectedCommitment.status);

    return (
        <aside className="w-80 md:w-96 bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 flex flex-col shrink-0 shadow-xl overflow-y-auto z-20">
            <div className="px-6 py-5 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-start sticky top-0 bg-white/95 dark:bg-neutral-900/95 backdrop-blur z-10">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider" style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}>
                            {statusStyle.label}
                        </span>
                        <span className="text-xs text-neutral-500">
                            ID: {selectedCommitment.customId || selectedCommitment._id.slice(-6).toUpperCase()}
                        </span>
                    </div>
                    <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                        {selectedCommitment.name || selectedCommitment.description || selectedCommitment.specialtyName}
                    </h3>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
                >
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>

            <div className="p-6 flex-1 flex flex-col gap-6">
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
                            Specialty
                        </label>
                        <div className="flex items-center gap-2 text-sm text-neutral-900 dark:text-white font-medium">
                            <span
                                className="size-4 rounded-full inline-block"
                                style={{ backgroundColor: selectedCommitment.specialtyColor || "#8B5CF6" }}
                            />
                            {selectedCommitment.specialtyName}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
                            Responsible
                        </label>
                        <div className="flex items-center gap-3 bg-neutral-50 dark:bg-neutral-800/50 p-2 rounded-md border border-neutral-100 dark:border-neutral-700">
                            <div className="size-8 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-xs font-bold text-neutral-700 dark:text-neutral-200 shrink-0">
                                {selectedCommitment.assignedToName && selectedCommitment.assignedToName !== "Unassigned"
                                    ? selectedCommitment.assignedToName
                                        .split(" ")
                                        .filter(Boolean)
                                        .slice(0, 2)
                                        .map((n) => n[0])
                                        .join("")
                                    : "?"}
                            </div>
                            <div>
                                <div className="text-sm font-medium text-neutral-900 dark:text-white">
                                    {selectedCommitment.assignedToName !== "Unassigned"
                                        ? selectedCommitment.assignedToName
                                        : "Unassigned"}
                                </div>
                                {selectedCommitment.assignedToCompany && (
                                    <div className="text-xs text-neutral-500">
                                        {selectedCommitment.assignedToCompany}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
                            Location
                        </label>
                        <div className="text-sm text-neutral-900 dark:text-white">
                            {selectedCommitment.location ? (
                                <div className="flex flex-col">
                                    <span>{selectedCommitment.location}</span>
                                    <span className="text-xs text-neutral-500">Coordinates: (X: {selectedCommitment.coordinates.xPercent.toFixed(1)}%, Y: {selectedCommitment.coordinates.yPercent.toFixed(1)}%)</span>
                                </div>
                            ) : (
                                <span>Coordinates: (X: {selectedCommitment.coordinates.xPercent.toFixed(1)}%, Y: {selectedCommitment.coordinates.yPercent.toFixed(1)}%)</span>
                            )}
                        </div>
                    </div>
                    {isEditing ? (
                        <div className="space-y-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                            <div>
                                <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Status</label>
                                <select
                                    value={editForm.status}
                                    onChange={e => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500"
                                >
                                    {statuses.map(s => (
                                        <option key={s._id} value={s.name}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Start Date</label>
                                    <input
                                        type="date"
                                        value={editForm.startDate}
                                        onChange={e => setEditForm(prev => ({ ...prev, startDate: e.target.value }))}
                                        className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Target End</label>
                                    <input
                                        type="date"
                                        value={editForm.targetDate}
                                        onChange={e => setEditForm(prev => ({ ...prev, targetDate: e.target.value }))}
                                        className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            {selectedCommitment.startDate && (
                                <div>
                                    <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
                                        Start Date
                                    </label>
                                    <div className="text-sm text-neutral-900 dark:text-white">
                                        {formatDateOnlyUTC(selectedCommitment.startDate)}
                                    </div>
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
                                    Target End
                                </label>
                                <div className="text-sm text-neutral-900 dark:text-white">
                                    {selectedCommitment.targetDate
                                        ? formatDateOnlyUTC(selectedCommitment.targetDate)
                                        : "—"}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
                                    Description
                                </label>
                                <div className="text-sm text-neutral-900 dark:text-white">
                                    {selectedCommitment.description}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="p-6 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 shrink-0 flex flex-col gap-3">
                {!isEditing ? (
                    <>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={handleEditClick}
                                className="flex-1 py-2 px-4 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-md text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                            >
                                Edit
                            </button>
                            <button
                                type="button"
                                onClick={() => handleStatusChange(selectedCommitment._id, "Completed")}
                                disabled={isPending || selectedCommitment.status === "Completed"}
                                className="flex-1 py-2 px-4 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                Mark Complete
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => setIsEditing(false)}
                            disabled={isPending}
                            className="flex-1 py-2 px-4 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-md text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSaveEdit}
                            disabled={isPending}
                            className="flex-1 py-2 px-4 bg-primary text-white rounded-md text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
                        >
                            {isPending ? "Saving..." : "Save"}
                        </button>
                    </div>
                )}
            </div>
        </aside>
    );
};
