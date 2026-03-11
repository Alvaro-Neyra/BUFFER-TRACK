"use client";

import React, { useState, useTransition } from "react";
import { createRole, updateRole, deleteRole } from "@/app/manage-project/actions";
import { IRoleDTO, ISpecialtyDTO } from "@/types/models";
import { ConfirmModal } from "./ConfirmModal";
import { AlertModal } from "./AlertModal";

interface IManageRolesModalProps {
    onClose: () => void;
    roles: IRoleDTO[];
    specialties: ISpecialtyDTO[];
    currentProjectId: string;
}

export const ManageRolesModal = ({
    onClose,
    roles,
    specialties,
    currentProjectId,
}: IManageRolesModalProps) => {
    const [isPending, startTransition] = useTransition();
    const [newName, setNewName] = useState("");
    const [newIsManager, setNewIsManager] = useState(false);
    const [newSpecialtiesIds, setNewSpecialtiesIds] = useState<string[]>([]);
    
    // For editing
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editIsManager, setEditIsManager] = useState(false);
    const [editSpecialtiesIds, setEditSpecialtiesIds] = useState<string[]>([]);

    // For confirmation & alerts
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [alert, setAlert] = useState<{ isOpen: boolean; title: string; message: string; type: 'success' | 'error' } | null>(null);

    const specialtiesById = specialties.reduce<Record<string, ISpecialtyDTO>>((acc, specialty) => {
        acc[specialty._id] = specialty;
        return acc;
    }, {});

    const toggleSpecialty = (specialtyId: string, selected: string[], setSelected: (value: string[]) => void) => {
        if (selected.includes(specialtyId)) {
            setSelected(selected.filter(id => id !== specialtyId));
            return;
        }
        setSelected([...selected, specialtyId]);
    };

    const handleCreate = async () => {
        if (!newName) return;
        startTransition(async () => {
            const res = await createRole({
                projectId: currentProjectId,
                name: newName,
                isManager: newIsManager,
                specialtiesIds: newIsManager ? [] : newSpecialtiesIds,
            });
            if (res.success) {
                setNewName("");
                setNewIsManager(false);
                setNewSpecialtiesIds([]);
            } else {
                setAlert({ isOpen: true, title: "Error", message: res.error || "Failed to create role", type: 'error' });
            }
        });
    };

    const handleUpdate = async (id: string) => {
        if (!editName) return;
        startTransition(async () => {
            const res = await updateRole(id, {
                projectId: currentProjectId,
                name: editName,
                isManager: editIsManager,
                specialtiesIds: editIsManager ? [] : editSpecialtiesIds,
            });
            if (res.success) {
                setEditingId(null);
            } else {
                setAlert({ isOpen: true, title: "Error", message: res.error || "Failed to update role", type: 'error' });
            }
        });
    };

    const handleDelete = async () => {
        if (!confirmDeleteId) return;
        startTransition(async () => {
            const res = await deleteRole(confirmDeleteId, currentProjectId);
            if (res.success) {
                setConfirmDeleteId(null);
            } else {
                setAlert({ isOpen: true, title: "Error", message: res.error || "Failed to delete role", type: 'error' });
                setConfirmDeleteId(null);
            }
        });
    };

    const startEditing = (role: IRoleDTO) => {
        setEditingId(role._id);
        setEditName(role.name);
        setEditIsManager(role.isManager);
        setEditSpecialtiesIds(role.specialtiesIds || []);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-neutral-200 dark:border-neutral-800 flex flex-col max-h-[85vh]">
                <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center bg-neutral-50 dark:bg-neutral-800/50">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Manage Roles</h2>
                    <button onClick={onClose} className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {/* Add New Role */}
                    <div className="bg-neutral-50 dark:bg-neutral-800/30 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 mb-6">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-3">Add New Role</label>
                        <div className="flex flex-col gap-3">
                            <div className="flex gap-2">
                                <input
                                    type="text" value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    placeholder="Role name (e.g. Architect)..."
                                    className="flex-1 px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-lg"
                                />
                                <button
                                    onClick={handleCreate}
                                    disabled={isPending || !newName}
                                    className="bg-primary hover:bg-primary/90 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all active:scale-95 disabled:opacity-50"
                                >
                                    Add
                                </button>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input
                                    type="checkbox" checked={newIsManager}
                                    onChange={(e) => {
                                        const checked = e.target.checked;
                                        setNewIsManager(checked);
                                        if (checked) setNewSpecialtiesIds([]);
                                    }}
                                    className="w-4 h-4 rounded border-neutral-300 text-primary focus:ring-primary"
                                />
                                <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors">
                                    Has Manager Permissions (Dashboard, Admin access)
                                </span>
                            </label>
                            {!newIsManager && (
                                <div className="space-y-2">
                                    <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Allowed Specialties</p>
                                    <div className="max-h-36 overflow-y-auto border border-neutral-200 dark:border-neutral-700 rounded-lg p-2 bg-white dark:bg-neutral-900">
                                        {specialties.length === 0 && (
                                            <p className="text-xs text-neutral-500">Create specialties first.</p>
                                        )}
                                        {specialties.map((specialty) => (
                                            <label key={specialty._id} className="flex items-center gap-2 py-1 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={newSpecialtiesIds.includes(specialty._id)}
                                                    onChange={() => toggleSpecialty(specialty._id, newSpecialtiesIds, setNewSpecialtiesIds)}
                                                    className="w-3.5 h-3.5 rounded border-neutral-300 text-primary focus:ring-primary"
                                                />
                                                <span className="size-2.5 rounded-full" style={{ backgroundColor: specialty.colorHex }} />
                                                <span className="text-xs text-neutral-700 dark:text-neutral-300">{specialty.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Role List */}
                    <div className="space-y-3">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">Existing Roles ({roles.length})</label>
                        {roles.map((role) => (
                            <div key={role._id} className="group bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 flex flex-col hover:border-primary/30 transition-colors">
                                {editingId === role._id ? (
                                    <div className="space-y-2">
                                        <div className="flex gap-2">
                                            <input
                                                type="text" value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="flex-1 px-2 py-1 text-sm border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-md"
                                            />
                                            <button onClick={() => handleUpdate(role._id)} className="text-green-500 hover:text-green-600">
                                                <span className="material-symbols-outlined text-xl">check</span>
                                            </button>
                                            <button onClick={() => setEditingId(null)} className="text-neutral-400 hover:text-neutral-500">
                                                <span className="material-symbols-outlined text-xl">close</span>
                                            </button>
                                        </div>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox" checked={editIsManager}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    setEditIsManager(checked);
                                                    if (checked) setEditSpecialtiesIds([]);
                                                }}
                                                className="w-3.5 h-3.5 rounded border-neutral-300 text-primary focus:ring-primary"
                                            />
                                            <span className="text-[11px] font-medium text-neutral-500">Manager Permissions</span>
                                        </label>
                                        {!editIsManager && (
                                            <div className="space-y-2">
                                                <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Allowed Specialties</p>
                                                <div className="max-h-36 overflow-y-auto border border-neutral-200 dark:border-neutral-700 rounded-lg p-2 bg-white dark:bg-neutral-900">
                                                    {specialties.length === 0 && (
                                                        <p className="text-xs text-neutral-500">Create specialties first.</p>
                                                    )}
                                                    {specialties.map((specialty) => (
                                                        <label key={specialty._id} className="flex items-center gap-2 py-1 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={editSpecialtiesIds.includes(specialty._id)}
                                                                onChange={() => toggleSpecialty(specialty._id, editSpecialtiesIds, setEditSpecialtiesIds)}
                                                                className="w-3.5 h-3.5 rounded border-neutral-300 text-primary focus:ring-primary"
                                                            />
                                                            <span className="size-2.5 rounded-full" style={{ backgroundColor: specialty.colorHex }} />
                                                            <span className="text-xs text-neutral-700 dark:text-neutral-300">{specialty.name}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{role.name}</span>
                                            {role.isManager && (
                                                <span className="text-[10px] text-primary font-bold uppercase tracking-tight">Manager</span>
                                            )}
                                            {!role.isManager && (role.specialtiesIds?.length || 0) > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {role.specialtiesIds.map((specialtyId) => {
                                                        const specialty = specialtiesById[specialtyId];
                                                        if (!specialty) return null;
                                                        return (
                                                            <span
                                                                key={specialtyId}
                                                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                                                                style={{
                                                                    backgroundColor: `${specialty.colorHex}22`,
                                                                    color: specialty.colorHex,
                                                                }}
                                                            >
                                                                {specialty.name}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => startEditing(role)} className="p-1.5 text-neutral-400 hover:text-primary transition-colors">
                                                <span className="material-symbols-outlined text-lg">edit</span>
                                            </button>
                                            <button onClick={() => setConfirmDeleteId(role._id)} className="p-1.5 text-neutral-400 hover:text-red-500 transition-colors">
                                                <span className="material-symbols-outlined text-lg">delete</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex justify-end">
                    <button onClick={onClose} className="px-6 py-2 text-sm font-bold bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-xl transition-all active:scale-95">
                        Done
                    </button>
                </div>
            </div>

            {/* Confirm & Alert Overlays */}
            <ConfirmModal
                isOpen={!!confirmDeleteId}
                title="Delete Role"
                message="Are you sure you want to delete this role? Users currently assigned to this role may lose permissions."
                onConfirm={handleDelete}
                onCancel={() => setConfirmDeleteId(null)}
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
};
