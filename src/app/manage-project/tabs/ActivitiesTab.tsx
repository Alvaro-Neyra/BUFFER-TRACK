"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { ISpecialtyDTO, IStatusDTO } from "@/types/models";
import { deleteAssignment } from "../actions";
import { EditActivityModal } from "@/components/organisms/EditActivityModal";
import { ConfirmModal } from "@/components/organisms/ConfirmModal";
import { AlertModal } from "@/components/organisms/AlertModal";
import type { ISerializedAssignment } from "../ManageProjectView";
import { formatDateOnlyUTC } from "@/lib/dateOnly";

interface IActivitiesTabProps {
    assignments: ISerializedAssignment[];
    specialties: ISpecialtyDTO[];
    statuses: IStatusDTO[];
}

export function ActivitiesTab({ assignments, specialties, statuses }: IActivitiesTabProps) {
    const [, startTransition] = useTransition();
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [filterSpecialty, setFilterSpecialty] = useState<string>("all");
    const [search, setSearch] = useState("");

    const [editingAssignment, setEditingAssignment] = useState<ISerializedAssignment | null>(null);
    const [viewingAssignment, setViewingAssignment] = useState<ISerializedAssignment | null>(null);
    const [deletingAssignmentId, setDeletingAssignmentId] = useState<string | null>(null);
    const [alert, setAlert] = useState<{ isOpen: boolean; title: string; message: string; type: 'success' | 'error' } | null>(null);

    const selectableStatuses = useMemo(() => statuses, [statuses]);

    useEffect(() => {
        if (filterStatus !== "all" && !selectableStatuses.some((status) => status.name === filterStatus)) {
            setFilterStatus("all");
        }
    }, [filterStatus, selectableStatuses]);

    const filteredAssignments = assignments.filter((c) => {
        if (filterStatus !== "all" && c.status !== filterStatus) return false;
        if (filterSpecialty !== "all" && c.specialtyName !== filterSpecialty) return false;
        if (search) {
            const q = search.toLowerCase();
            return (
                c.buildingName.toLowerCase().includes(q) ||
                c.floorLabel.toLowerCase().includes(q) ||
                c.name.toLowerCase().includes(q) ||
                c.specialtyName.toLowerCase().includes(q) ||
                c.requesterName.toLowerCase().includes(q) ||
                c.acceptedByName.toLowerCase().includes(q) ||
                c.description.toLowerCase().includes(q)
            );
        }
        return true;
    });

    const getStatusColor = (statusName: string) => {
        const found = statuses.find(s => s.name === statusName);
        return found?.colorHex || "#94a3b8"; // Default slate-400
    };

    const handleDelete = async () => {
        if (!deletingAssignmentId) return;
        startTransition(async () => {
            const res = await deleteAssignment(deletingAssignmentId);
            if (res.success) {
                setDeletingAssignmentId(null);
            } else {
                setAlert({ isOpen: true, title: "Error", message: res.error || "Failed to delete activity", type: 'error' });
                setDeletingAssignmentId(null);
            }
        });
    };

    return (
        <div className="space-y-6">
            {/* Filters & Actions */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">search</span>
                    <input
                        type="text" placeholder="Search assignments..." value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 pr-4 py-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-lg text-sm text-neutral-900 dark:text-neutral-100 focus:ring-primary focus:border-primary shadow-sm min-w-52"
                    />
                </div>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-3 py-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-lg text-sm text-neutral-900 dark:text-neutral-100 focus:ring-primary focus:border-primary shadow-sm">
                    <option value="all">All Statuses</option>
                    {selectableStatuses.map((s) => (<option key={s._id} value={s.name}>{s.name}</option>))}
                </select>
                <select value={filterSpecialty} onChange={(e) => setFilterSpecialty(e.target.value)}
                    className="px-3 py-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-lg text-sm text-neutral-900 dark:text-neutral-100 focus:ring-primary focus:border-primary shadow-sm">
                    <option value="all">All Specialties</option>
                    {specialties.map((s) => (<option key={s._id} value={s.name}>{s.name}</option>))}
                </select>
            </div>

            {/* Assignments Table */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm overflow-hidden">
                {filteredAssignments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-neutral-500">
                        <span className="material-symbols-outlined text-4xl mb-3 text-neutral-300 dark:text-neutral-700">assignment</span>
                        <p className="font-medium text-sm">No assignments found.</p>
                        <p className="text-xs mt-1 text-neutral-400">Assignments will appear here once they are created on floor plans.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-neutral-600 dark:text-neutral-300 min-w-320">
                            <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-xs uppercase font-bold text-neutral-500 border-b border-neutral-200 dark:border-neutral-800">
                                <tr>
                                    <th className="px-5 py-3.5">Building</th>
                                    <th className="px-5 py-3.5">Floor</th>
                                    <th className="px-5 py-3.5">Title</th>
                                    <th className="px-5 py-3.5">Specialty</th>
                                    <th className="px-5 py-3.5">Created By</th>
                                    <th className="px-5 py-3.5">Accepted By</th>
                                    <th className="px-5 py-3.5">Status</th>
                                    <th className="px-5 py-3.5">Required Date</th>
                                    <th className="px-5 py-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 font-medium">
                                {filteredAssignments.map((c) => {
                                    const statusColor = getStatusColor(c.status);
                                    return (
                                        <tr key={c._id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors group">
                                            <td className="px-5 py-3.5">
                                                <span className="font-semibold text-neutral-900 dark:text-white">{c.buildingName}</span>
                                                <span className="text-xs text-neutral-400 ml-1.5">{c.buildingCode}</span>
                                            </td>
                                            <td className="px-5 py-3.5">{c.floorLabel}</td>
                                            <td className="px-5 py-3.5">
                                                <span className="font-semibold text-neutral-900 dark:text-white">{c.name || "—"}</span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: c.specialtyColor }} />
                                                    {c.specialtyName}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5">{c.requesterName}</td>
                                            <td className="px-5 py-3.5">{c.acceptedByName || "Unaccepted"}</td>
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: statusColor }}></div>
                                                    <span className="text-xs font-bold text-neutral-700 dark:text-neutral-200 uppercase tracking-tight">
                                                        {c.status}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5 text-[11px] leading-tight">
                                                <span className="text-neutral-900 dark:text-neutral-100 font-bold">{formatDateOnlyUTC(c.requiredDate ?? null)}</span>
                                            </td>
                                            <td className="px-5 py-3.5 text-right">
                                                <div className="flex justify-end gap-1">
                                                    <button onClick={() => setViewingAssignment(c)} className="p-1.5 text-neutral-400 hover:text-cyan-500 transition-colors" title="View">
                                                        <span className="material-symbols-outlined text-lg">visibility</span>
                                                    </button>
                                                    <button onClick={() => setEditingAssignment(c)} className="p-1.5 text-neutral-400 hover:text-primary transition-colors">
                                                        <span className="material-symbols-outlined text-lg">edit</span>
                                                    </button>
                                                    <button onClick={() => setDeletingAssignmentId(c._id)} className="p-1.5 text-neutral-400 hover:text-red-500 transition-colors">
                                                        <span className="material-symbols-outlined text-lg">delete</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modals */}
            {editingAssignment && (
                <EditActivityModal
                    assignment={editingAssignment}
                    specialties={specialties}
                    statuses={selectableStatuses}
                    onClose={() => setEditingAssignment(null)}
                />
            )}
            {viewingAssignment && (
                <ViewAssignmentModal
                    assignment={viewingAssignment}
                    onClose={() => setViewingAssignment(null)}
                />
            )}
            <ConfirmModal
                isOpen={!!deletingAssignmentId}
                title="Delete Assignment"
                message="Are you sure you want to delete this assignment? This cannot be undone."
                onConfirm={handleDelete}
                onCancel={() => setDeletingAssignmentId(null)}
                confirmLabel="Delete"
                isDanger
            />
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
}

function ViewAssignmentModal({
    assignment,
    onClose,
}: {
    assignment: ISerializedAssignment;
    onClose: () => void;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-neutral-200 dark:border-neutral-800">
                <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center bg-neutral-50 dark:bg-neutral-800/50">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Assignment Detail</h2>
                    <button onClick={onClose} className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="p-6 space-y-3 text-sm">
                    <p><span className="font-semibold text-neutral-900 dark:text-white">Building:</span> {assignment.buildingName} ({assignment.buildingCode})</p>
                    <p><span className="font-semibold text-neutral-900 dark:text-white">Floor:</span> {assignment.floorLabel}</p>
                    <p><span className="font-semibold text-neutral-900 dark:text-white">Title:</span> {assignment.name || "—"}</p>
                    <p><span className="font-semibold text-neutral-900 dark:text-white">Specialty:</span> {assignment.specialtyName}</p>
                    <p><span className="font-semibold text-neutral-900 dark:text-white">Created By:</span> {assignment.requesterName}</p>
                    <p><span className="font-semibold text-neutral-900 dark:text-white">Accepted By:</span> {assignment.acceptedByName || "Unaccepted"}</p>
                    <p><span className="font-semibold text-neutral-900 dark:text-white">Required Date:</span> {formatDateOnlyUTC(assignment.requiredDate)}</p>
                </div>

                <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-lg transition-colors">
                        Close
                    </button>
                    <Link
                        href={`/detail/${assignment.floorId}?assignmentId=${assignment._id}`}
                        className="px-4 py-2 text-sm font-bold bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                    >
                        Open in Detail Plan
                    </Link>
                </div>
            </div>
        </div>
    );
}
