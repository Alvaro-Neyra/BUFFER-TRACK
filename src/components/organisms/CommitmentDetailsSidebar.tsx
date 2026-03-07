"use client";

import React, { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCommitmentStatus } from "@/app/detail/[floorId]/actions";
import type { ICommitmentData } from "@/app/detail/[floorId]/DetailPlanView";

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
    commitment: ICommitmentData;
    floorId: string;
    onClose: () => void;
}

export const CommitmentDetailsSidebar = ({ commitment, floorId, onClose }: Readonly<ICommitmentDetailsSidebarProps>) => {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const statusStyle = STATUS_COLORS[commitment.status] || STATUS_COLORS.Request;

    const handleStatusChange = (newStatus: string) => {
        startTransition(async () => {
            const res = await updateCommitmentStatus(commitment._id, newStatus, floorId);
            if (res.success) {
                router.refresh();
                onClose();
            } else {
                alert(res.error || "Failed to update status");
            }
        });
    };

    return (
        <aside className="w-80 md:w-96 bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 flex flex-col shrink-0 shadow-xl overflow-y-auto z-20">
            {/* Header */}
            <div className="px-6 py-5 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-start sticky top-0 bg-white/95 dark:bg-neutral-900/95 backdrop-blur z-10">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusStyle.bg} ${statusStyle.text}`}>
                            {statusStyle.label}
                        </span>
                    </div>
                    <h3 className="text-lg font-bold text-neutral-900 dark:text-white">{commitment.description}</h3>
                </div>
                <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors">
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>

            {/* Details */}
            <div className="p-6 flex-1 flex flex-col gap-5">
                <div>
                    <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Specialty</label>
                    <div className="flex items-center gap-2 text-sm text-neutral-900 dark:text-white font-medium">
                        <span className="size-4 rounded-full inline-block" style={{ backgroundColor: commitment.specialtyColor }} />
                        {commitment.specialtyName}
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Assigned To</label>
                    <div className="flex items-center gap-3 bg-neutral-50 dark:bg-neutral-800/50 p-3 rounded-lg border border-neutral-100 dark:border-neutral-700">
                        <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                            {commitment.assignedToName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div className="text-sm font-medium text-neutral-900 dark:text-white">{commitment.assignedToName}</div>
                            {commitment.assignedToCompany && (
                                <div className="text-xs text-neutral-500">{commitment.assignedToCompany}</div>
                            )}
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Requested By</label>
                    <div className="text-sm text-neutral-900 dark:text-white">{commitment.requesterName}</div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Request Date</label>
                        <div className="text-sm text-neutral-900 dark:text-white">
                            {commitment.requestDate ? new Date(commitment.requestDate).toLocaleDateString() : "—"}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Target Date</label>
                        <div className="text-sm text-neutral-900 dark:text-white">
                            {commitment.targetDate ? new Date(commitment.targetDate).toLocaleDateString() : "—"}
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Location</label>
                    <div className="text-sm text-neutral-900 dark:text-white">
                        X: {commitment.coordinates.xPercent.toFixed(1)}%, Y: {commitment.coordinates.yPercent.toFixed(1)}%
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="p-6 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 shrink-0 flex flex-col gap-3">
                {commitment.status !== "Completed" && (
                    <div className="flex gap-2">
                        {commitment.status === "Request" && (
                            <button onClick={() => handleStatusChange("In Progress")} disabled={isPending}
                                className="flex-1 py-2 px-4 bg-amber-50 text-amber-600 border border-amber-200 rounded-lg text-sm font-bold hover:bg-amber-100 transition-colors disabled:opacity-50">
                                Start Progress
                            </button>
                        )}
                        {(commitment.status === "In Progress" || commitment.status === "Request") && (
                            <button onClick={() => handleStatusChange("Completed")} disabled={isPending}
                                className="flex-1 py-2 px-4 bg-emerald-500 text-white rounded-lg text-sm font-bold hover:bg-emerald-600 transition-colors shadow-sm disabled:opacity-50">
                                Mark Complete
                            </button>
                        )}
                    </div>
                )}
                {commitment.status !== "Restricted" && commitment.status !== "Completed" && (
                    <button onClick={() => handleStatusChange("Restricted")} disabled={isPending}
                        className="w-full py-2 px-4 bg-white dark:bg-neutral-800 border border-orange-300 dark:border-orange-700 text-orange-600 rounded-lg text-sm font-bold hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                        <span className="text-sm">⚠️</span> Report Restriction
                    </button>
                )}
            </div>
        </aside>
    );
};
