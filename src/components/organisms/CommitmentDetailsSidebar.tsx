"use client";

import React, { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCommitmentStatus } from "@/app/detail/[floorId]/actions";
import type { ICommitmentData, ISpecialtyOption, IUserOption } from "@/app/detail/[floorId]/DetailPlanView";

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
    Request: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-600 dark:text-blue-400", label: "Request" },
    Notified: { bg: "bg-indigo-100 dark:bg-indigo-900/30", text: "text-indigo-600 dark:text-indigo-400", label: "Notified" },
    Committed: { bg: "bg-cyan-100 dark:bg-cyan-900/30", text: "text-cyan-600 dark:text-cyan-400", label: "Committed" },
    "In Progress": { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-600 dark:text-amber-400", label: "In Progress" },
    Completed: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-600 dark:text-emerald-400", label: "Completed" },
    Delayed: { bg: "bg-rose-100 dark:bg-rose-900/30", text: "text-rose-600 dark:text-rose-400", label: "Delayed" },
    Restricted: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-600 dark:text-orange-400", label: "⚠️ Restricted" },
};

interface ICommitmentDetailsSidebarProps {
    commitments: ICommitmentData[];
    selectedCommitmentId: string | null;
    floorId: string;
    specialties: ISpecialtyOption[];
    users: IUserOption[];
    onSelectCommitment: (commitment: ICommitmentData) => void;
    onClose: () => void;
}

export const CommitmentDetailsSidebar = ({ commitments, selectedCommitmentId, floorId, specialties, users, onSelectCommitment, onClose }: Readonly<ICommitmentDetailsSidebarProps>) => {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

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

    return (
        <aside className="w-80 md:w-96 bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 flex flex-col shrink-0 overflow-hidden z-20">
            {/* Header */}
            <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center shrink-0 bg-neutral-50 dark:bg-neutral-900/50">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider">Floor Activities</h3>
                <span className="text-xs font-semibold text-neutral-500 bg-neutral-200 dark:bg-neutral-800 px-2 py-0.5 rounded-full">
                    {commitments.length}
                </span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {commitments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-neutral-500">
                        <span className="material-symbols-outlined text-4xl mb-2 text-neutral-300">task_alt</span>
                        <p className="text-sm font-medium">No activities</p>
                        <p className="text-xs mt-1 text-center">Use the "Drop Pin" button to add an activity to this floor.</p>
                    </div>
                ) : (
                    commitments.map(c => {
                        const isSelected = c._id === selectedCommitmentId;
                        const statusStyle = STATUS_COLORS[c.status] || STATUS_COLORS.Request;

                        return (
                            <div
                                key={c._id}
                                onClick={() => onSelectCommitment(c)}
                                className={`bg-white dark:bg-neutral-900 border ${isSelected ? 'border-primary ring-1 ring-primary' : 'border-neutral-200 dark:border-neutral-800'} rounded-lg shadow-sm group cursor-pointer transition-all hover:border-primary/50 overflow-hidden`}
                            >
                                {/* Compact Card Content (Always visible) */}
                                <div className="p-3 flex items-start gap-3">
                                    <div className="size-3 rounded-full mt-1 shrink-0 shadow-sm border border-black/10" style={{ backgroundColor: c.specialtyColor || "#8B5CF6" }} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-neutral-900 dark:text-white leading-tight">{c.description || c.specialtyName}</p>
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                            <span className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-[10px] font-medium text-neutral-600 dark:text-neutral-400">
                                                {c.specialtyName}
                                            </span>
                                            {c.assignedToName !== "Unassigned" && (
                                                <span className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-[10px] font-medium text-neutral-600 dark:text-neutral-400 flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-[10px]">person</span>
                                                    {c.assignedToName.split(' ')[0]}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${statusStyle.bg} ${statusStyle.text}`}>
                                        {statusStyle.label}
                                    </span>
                                </div>

                                {/* Expanded Detail Content */}
                                {isSelected && (
                                    <div className="border-t border-neutral-100 dark:border-neutral-800 p-4 bg-neutral-50/50 dark:bg-neutral-900/50 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex justify-between items-center">
                                            <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Details</h4>
                                            <button onClick={() => onClose()} className="text-neutral-400 hover:text-neutral-700 dark:hover:text-white transition-colors">
                                                <span className="material-symbols-outlined text-[18px]">close</span>
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                                            <div>
                                                <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">Assigned To</label>
                                                <div className="text-sm text-neutral-900 dark:text-white font-medium">{c.assignedToName}</div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">Requested By</label>
                                                <div className="text-sm text-neutral-900 dark:text-white font-medium">{c.requesterName}</div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">Target Date</label>
                                                <div className="text-sm text-neutral-900 dark:text-white font-medium">
                                                    {c.targetDate ? new Date(c.targetDate).toLocaleDateString() : "—"}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">Location</label>
                                                <div className="text-sm text-neutral-900 dark:text-white font-medium">
                                                    X: {c.coordinates.xPercent.toFixed(1)}%, Y: {c.coordinates.yPercent.toFixed(1)}%
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex flex-col gap-2 mt-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                                            {c.status !== "Completed" && (
                                                <div className="flex gap-2">
                                                    {c.status === "Request" && (
                                                        <button onClick={() => handleStatusChange(c._id, "In Progress")} disabled={isPending}
                                                            className="flex-1 py-1.5 px-3 bg-amber-50 text-amber-600 border border-amber-200 rounded text-xs font-bold hover:bg-amber-100 transition-colors disabled:opacity-50">
                                                            Start Progress
                                                        </button>
                                                    )}
                                                    {(c.status === "In Progress" || c.status === "Request") && (
                                                        <button onClick={() => handleStatusChange(c._id, "Completed")} disabled={isPending}
                                                            className="flex-1 py-1.5 px-3 bg-emerald-500 text-white rounded text-xs font-bold hover:bg-emerald-600 transition-colors shadow-sm disabled:opacity-50">
                                                            Mark Complete
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                            {c.status !== "Restricted" && c.status !== "Completed" && (
                                                <button onClick={() => handleStatusChange(c._id, "Restricted")} disabled={isPending}
                                                    className="w-full py-1.5 px-3 bg-white dark:bg-neutral-800 border border-orange-300 dark:border-orange-700 text-orange-600 rounded text-xs font-bold hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
                                                    <span className="text-xs">⚠️</span> Report Restriction
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </aside>
    );
};
