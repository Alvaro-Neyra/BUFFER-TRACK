"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptAssignment, updateAssignmentStatus, updateAssignmentDetails } from "@/app/detail/[floorId]/actions";
import type { IAssignmentData, IStatusOption } from "@/app/detail/[floorId]/DetailPlanView";
import { formatDateOnlyUTC, toDateInputValue, toUtcMidnightIso } from "@/lib/dateOnly";

interface IAssignmentDetailsSidebarProps {
    assignments: IAssignmentData[];
    selectedAssignmentId: string | null;
    floorId: string;
    statuses: IStatusOption[];
    currentUserId: string;
    onSelectAssignment: (assignment: IAssignmentData) => void;
    onClose: () => void;
}

export const AssignmentDetailsSidebar = ({
    assignments,
    selectedAssignmentId,
    floorId,
    statuses,
    currentUserId,
    onSelectAssignment,
    onClose,
}: Readonly<IAssignmentDetailsSidebarProps>) => {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const selectedAssignment = assignments.find((assignment) => assignment._id === selectedAssignmentId) || null;

    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ requiredDate: "", status: "" });

    const getStatusColor = (statusName: string) => {
        const found = statuses.find((status) => status.name === statusName);
        return found?.colorHex || "#94a3b8";
    };

    const handleStatusChange = (assignmentId: string, newStatus: string) => {
        startTransition(async () => {
            const res = await updateAssignmentStatus(assignmentId, newStatus, floorId);
            if (res.success) {
                router.refresh();
            } else {
                alert(res.error || "Failed to update status");
            }
        });
    };

    const handleAccept = (assignmentId: string) => {
        startTransition(async () => {
            const res = await acceptAssignment(assignmentId, floorId);
            if (res.success) {
                router.refresh();
            } else {
                alert(res.error || "Failed to accept assignment");
            }
        });
    };

    const handleEditClick = () => {
        if (!selectedAssignment) return;

        setEditForm({
            requiredDate: toDateInputValue(selectedAssignment.requiredDate),
            status: selectedAssignment.status,
        });
        setIsEditing(true);
    };

    const handleSaveEdit = () => {
        if (!selectedAssignment) return;
        if (!editForm.requiredDate) {
            alert("Required date is mandatory");
            return;
        }

        startTransition(async () => {
            const res = await updateAssignmentDetails(
                selectedAssignment._id,
                {
                    requiredDate: toUtcMidnightIso(editForm.requiredDate),
                    status: editForm.status,
                },
                floorId
            );

            if (res.success) {
                setIsEditing(false);
                router.refresh();
            } else {
                alert(res.error || "Failed to save details");
            }
        });
    };

    if (!selectedAssignment) {
        return (
            <aside className="w-80 md:w-96 bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 flex flex-col shrink-0 shadow-xl overflow-y-auto z-20">
                <div className="px-6 py-5 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-start sticky top-0 bg-white/95 dark:bg-neutral-900/95 backdrop-blur z-10">
                    <div>
                        <h3 className="text-sm font-bold text-neutral-900 dark:text-white">Assignment details</h3>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Select a pin on the plan or from the list.</p>
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
                    {assignments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-neutral-500 dark:text-neutral-400 text-sm">
                            <span className="material-symbols-outlined text-4xl mb-2 text-neutral-300">task_alt</span>
                            <p className="font-medium">No assignments on this floor</p>
                        </div>
                    ) : (
                        assignments.map((assignment) => {
                            const statusColor = getStatusColor(assignment.status);
                            return (
                                <div
                                    key={assignment._id}
                                    onClick={() => onSelectAssignment(assignment)}
                                    className="group relative bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3.5 transition-all duration-200 hover:shadow-md hover:border-primary/40 cursor-pointer overflow-hidden"
                                >
                                    <div
                                        className="absolute left-0 top-0 bottom-0 w-1 opacity-80 group-hover:opacity-100 transition-opacity"
                                        style={{ backgroundColor: assignment.specialtyColor || "#8B5CF6" }}
                                    />
                                    <div className="pl-2">
                                        <h4 className="text-sm font-bold text-neutral-900 dark:text-white line-clamp-2">
                                            {assignment.name || assignment.description || assignment.specialtyName}
                                        </h4>
                                        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800">
                                                <span className="size-1.5 rounded-full" style={{ backgroundColor: assignment.specialtyColor }}></span>
                                                {assignment.specialtyName}
                                            </span>
                                            <span className="font-semibold" style={{ color: statusColor }}>
                                                {assignment.status}
                                            </span>
                                        </div>
                                        <div className="mt-1 text-[11px] text-neutral-500">
                                            Required: {formatDateOnlyUTC(assignment.requiredDate, { day: "numeric", month: "short", year: undefined }, "TBD")}
                                        </div>
                                        <div className="mt-1 text-[11px] text-neutral-500">
                                            Accepted: {assignment.acceptedByName || "Unaccepted"}
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

    const statusColor = getStatusColor(selectedAssignment.status);

    return (
        <aside className="w-80 md:w-96 bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 flex flex-col shrink-0 shadow-xl overflow-y-auto z-20">
            <div className="px-6 py-5 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-start sticky top-0 bg-white/95 dark:bg-neutral-900/95 backdrop-blur z-10">
                <div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider" style={{ backgroundColor: `${statusColor}20`, color: statusColor }}>
                        {selectedAssignment.status}
                    </span>
                    <h3 className="mt-2 text-lg font-bold text-neutral-900 dark:text-white">
                        {selectedAssignment.name || selectedAssignment.description || selectedAssignment.specialtyName}
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

            <div className="p-6 flex-1 flex flex-col gap-5">
                <div>
                    <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Specialty</label>
                    <div className="flex items-center gap-2 text-sm text-neutral-900 dark:text-white font-medium">
                        <span className="size-4 rounded-full inline-block" style={{ backgroundColor: selectedAssignment.specialtyColor || "#8B5CF6" }} />
                        {selectedAssignment.specialtyName}
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Requester</label>
                    <div className="text-sm text-neutral-900 dark:text-white">{selectedAssignment.requesterName}</div>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Accepted By</label>
                    <div className="text-sm text-neutral-900 dark:text-white">
                        {selectedAssignment.acceptedByName || "Unaccepted"}
                    </div>
                    {selectedAssignment.acceptedAt && (
                        <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                            {formatDateOnlyUTC(selectedAssignment.acceptedAt, { day: "2-digit", month: "short", year: "numeric" }, "")}
                        </div>
                    )}
                </div>

                {isEditing ? (
                    <div className="space-y-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                        <div>
                            <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Status</label>
                            <select
                                value={editForm.status}
                                onChange={(event) => setEditForm((prev) => ({ ...prev, status: event.target.value }))}
                                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                            >
                                {statuses.map((status) => (
                                    <option key={status._id} value={status.name}>{status.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Required Date</label>
                            <input
                                type="date"
                                value={editForm.requiredDate}
                                onChange={(event) => setEditForm((prev) => ({ ...prev, requiredDate: event.target.value }))}
                                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                            />
                        </div>
                    </div>
                ) : (
                    <>
                        <div>
                            <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Required Date</label>
                            <div className="text-sm text-neutral-900 dark:text-white">
                                {formatDateOnlyUTC(selectedAssignment.requiredDate)}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Description</label>
                            <div className="text-sm text-neutral-900 dark:text-white">{selectedAssignment.description || "—"}</div>
                        </div>
                    </>
                )}
            </div>

            <div className="p-6 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 shrink-0 flex flex-col gap-3">
                {!isEditing ? (
                    <div className="flex flex-col gap-3">
                        {!selectedAssignment.acceptedById && selectedAssignment.requesterId !== currentUserId && (
                            <button
                                type="button"
                                onClick={() => handleAccept(selectedAssignment._id)}
                                disabled={isPending}
                                className="w-full py-2 px-4 bg-emerald-600 text-white rounded-md text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                Accept Assignment
                            </button>
                        )}

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
                                onClick={() => handleStatusChange(selectedAssignment._id, "Completed")}
                                disabled={isPending || selectedAssignment.status === "Completed"}
                                className="flex-1 py-2 px-4 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                Mark Complete
                            </button>
                        </div>
                    </div>
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
