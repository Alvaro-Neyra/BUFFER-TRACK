"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import type { IUserDTO, ISpecialtyDTO, IStatusDTO, IRoleDTO } from "@/types/models";
import { deleteCommitment } from "../actions";
import { ManageStatusesModal } from "@/components/organisms/ManageStatusesModal";
import { ManageSpecialtiesModal } from "@/components/organisms/ManageSpecialtiesModal";
import { ManageRolesModal } from "@/components/organisms/ManageRolesModal";
import { EditActivityModal } from "@/components/organisms/EditActivityModal";
import { ConfirmModal } from "@/components/organisms/ConfirmModal";
import { AlertModal } from "@/components/organisms/AlertModal";
import type { ISerializedCommitment } from "../ManageProjectView";
import { formatDateOnlyUTC } from "@/lib/dateOnly";
import { isRestrictedStatus } from "@/lib/projectFeatures";

interface IActivitiesTabProps {
    commitments: ISerializedCommitment[];
    specialties: ISpecialtyDTO[];
    statuses: IStatusDTO[];
    redListEnabled: boolean;
    roles: IRoleDTO[];
    users: IUserDTO[];
    currentProjectId: string;
}

export function ActivitiesTab({ commitments, specialties, statuses, redListEnabled, roles, users, currentProjectId }: IActivitiesTabProps) {
    const [, startTransition] = useTransition();
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [filterSpecialty, setFilterSpecialty] = useState<string>("all");
    const [search, setSearch] = useState("");

    // Modal states
    const [showStatusesModal, setShowStatusesModal] = useState(false);
    const [showSpecialtiesModal, setShowSpecialtiesModal] = useState(false);
    const [showRolesModal, setShowRolesModal] = useState(false);
    const [editingCommitment, setEditingCommitment] = useState<ISerializedCommitment | null>(null);
    const [deletingCommitmentId, setDeletingCommitmentId] = useState<string | null>(null);
    const [alert, setAlert] = useState<{ isOpen: boolean; title: string; message: string; type: 'success' | 'error' } | null>(null);

    const selectableStatuses = useMemo(() => (
        redListEnabled
            ? statuses
            : statuses.filter((status) => !isRestrictedStatus(status.name))
    ), [redListEnabled, statuses]);

    useEffect(() => {
        if (filterStatus !== "all" && !selectableStatuses.some((status) => status.name === filterStatus)) {
            setFilterStatus("all");
        }
    }, [filterStatus, selectableStatuses]);

    const filteredCommitments = commitments.filter((c) => {
        if (filterStatus !== "all" && c.status !== filterStatus) return false;
        if (filterSpecialty !== "all" && c.specialtyName !== filterSpecialty) return false;
        if (search) {
            const q = search.toLowerCase();
            return (
                c.buildingName.toLowerCase().includes(q) ||
                c.floorLabel.toLowerCase().includes(q) ||
                c.name.toLowerCase().includes(q) ||
                (c.customId || "").toLowerCase().includes(q) ||
                (c.location || "").toLowerCase().includes(q) ||
                c.assignedToName.toLowerCase().includes(q) ||
                c.specialtyName.toLowerCase().includes(q) ||
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
        if (!deletingCommitmentId) return;
        startTransition(async () => {
            const res = await deleteCommitment(deletingCommitmentId);
            if (res.success) {
                setDeletingCommitmentId(null);
            } else {
                setAlert({ isOpen: true, title: "Error", message: res.error || "Failed to delete activity", type: 'error' });
                setDeletingCommitmentId(null);
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
                        type="text" placeholder="Search activities..." value={search}
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

                <div className="flex gap-2 ml-auto">
                    <button
                        onClick={() => setShowStatusesModal(true)}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-lg border border-neutral-300 dark:border-neutral-700 transition-colors"
                    >
                        <span className="material-symbols-outlined text-sm">settings</span>
                        Statuses
                    </button>
                    <button
                        onClick={() => setShowSpecialtiesModal(true)}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-lg border border-neutral-300 dark:border-neutral-700 transition-colors"
                    >
                        <span className="material-symbols-outlined text-sm">palette</span>
                        Specialties
                    </button>
                    <button
                        onClick={() => setShowRolesModal(true)}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-lg border border-neutral-300 dark:border-neutral-700 transition-colors"
                    >
                        <span className="material-symbols-outlined text-sm">badge</span>
                        Roles
                    </button>
                </div>
            </div>

            {/* Activities Table */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm overflow-hidden">
                {filteredCommitments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-neutral-500">
                        <span className="material-symbols-outlined text-4xl mb-3 text-neutral-300 dark:text-neutral-700">assignment</span>
                        <p className="font-medium text-sm">No activities found.</p>
                        <p className="text-xs mt-1 text-neutral-400">Activities will appear here once commitments are created on floor plans.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-neutral-600 dark:text-neutral-300 min-w-300">
                            <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-xs uppercase font-bold text-neutral-500 border-b border-neutral-200 dark:border-neutral-800">
                                <tr>
                                    <th className="px-5 py-3.5">Building</th>
                                    <th className="px-5 py-3.5">Floor</th>
                                    <th className="px-5 py-3.5">Title</th>
                                    <th className="px-5 py-3.5">Custom ID</th>
                                    <th className="px-5 py-3.5">Location</th>
                                    <th className="px-5 py-3.5">Specialty</th>
                                    <th className="px-5 py-3.5">Assigned To</th>
                                    <th className="px-5 py-3.5">Status</th>
                                    <th className="px-5 py-3.5">Dates</th>
                                    <th className="px-5 py-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 font-medium">
                                {filteredCommitments.map((c) => {
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
                                                <span className="font-mono text-xs text-neutral-500 dark:text-neutral-400">{c.customId || "—"}</span>
                                            </td>
                                            <td className="px-5 py-3.5 max-w-56">
                                                <span className="block truncate" title={c.location || ""}>{c.location || "—"}</span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: c.specialtyColor }} />
                                                    {c.specialtyName}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5">{c.assignedToName}</td>
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: statusColor }}></div>
                                                    <span className="text-xs font-bold text-neutral-700 dark:text-neutral-200 uppercase tracking-tight">
                                                        {c.status}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5 text-[11px] leading-tight">
                                                <div className="flex flex-col">
                                                    <span className="text-neutral-400">S: {formatDateOnlyUTC(c.startDate ?? c.dates?.startDate ?? null)}</span>
                                                    <span className="text-neutral-900 dark:text-neutral-100 font-bold">T: {formatDateOnlyUTC(c.targetDate ?? c.dates?.targetDate ?? null)}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5 text-right">
                                                <div className="flex justify-end gap-1">
                                                    <button onClick={() => setEditingCommitment(c)} className="p-1.5 text-neutral-400 hover:text-primary transition-colors">
                                                        <span className="material-symbols-outlined text-lg">edit</span>
                                                    </button>
                                                    <button onClick={() => setDeletingCommitmentId(c._id)} className="p-1.5 text-neutral-400 hover:text-red-500 transition-colors">
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
            {showStatusesModal && (
                <ManageStatusesModal
                    statuses={statuses}
                    currentProjectId={currentProjectId}
                    onClose={() => setShowStatusesModal(false)}
                />
            )}
            {showSpecialtiesModal && (
                <ManageSpecialtiesModal
                    specialties={specialties}
                    currentProjectId={currentProjectId}
                    onClose={() => setShowSpecialtiesModal(false)}
                />
            )}
            {showRolesModal && (
                <ManageRolesModal
                    roles={roles}
                    specialties={specialties}
                    currentProjectId={currentProjectId}
                    onClose={() => setShowRolesModal(false)}
                />
            )}
            {editingCommitment && (
                <EditActivityModal
                    commitment={editingCommitment}
                    specialties={specialties}
                    statuses={selectableStatuses}
                    users={users}
                    onClose={() => setEditingCommitment(null)}
                />
            )}
            <ConfirmModal
                isOpen={!!deletingCommitmentId}
                title="Delete Activity"
                message="Are you sure you want to delete this activity? This cannot be undone."
                onConfirm={handleDelete}
                onCancel={() => setDeletingCommitmentId(null)}
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
