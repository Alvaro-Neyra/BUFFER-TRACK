"use client";

import React, { useState, useTransition } from "react";
import { createSpecialty, updateSpecialty, deleteSpecialty } from "@/app/manage-project/actions";
import { ISpecialtyDTO } from "@/types/models";
import { ConfirmModal } from "./ConfirmModal";
import { AlertModal } from "./AlertModal";

interface IManageSpecialtiesModalProps {
    onClose: () => void;
    specialties: ISpecialtyDTO[];
    currentProjectId: string;
}

export const ManageSpecialtiesModal = ({
    onClose,
    specialties,
    currentProjectId,
}: IManageSpecialtiesModalProps) => {
    const [isPending, startTransition] = useTransition();
    const [newName, setNewName] = useState("");
    const [newColor, setNewColor] = useState("#2563EB");
    
    // For editing
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editColor, setEditColor] = useState("");

    // For confirmation & alerts
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [alert, setAlert] = useState<{ isOpen: boolean; title: string; message: string; type: 'success' | 'error' } | null>(null);

    const handleCreate = async () => {
        if (!newName) return;
        startTransition(async () => {
            const res = await createSpecialty({ projectId: currentProjectId, name: newName, colorHex: newColor });
            if (res.success) {
                setNewName("");
                setNewColor("#2563EB");
            } else {
                setAlert({ isOpen: true, title: "Error", message: res.error || "Failed to create specialty", type: 'error' });
            }
        });
    };

    const handleUpdate = async (id: string) => {
        if (!editName) return;
        startTransition(async () => {
            const res = await updateSpecialty(id, { projectId: currentProjectId, name: editName, colorHex: editColor });
            if (res.success) {
                setEditingId(null);
            } else {
                setAlert({ isOpen: true, title: "Error", message: res.error || "Failed to update specialty", type: 'error' });
            }
        });
    };

    const handleDelete = async () => {
        if (!confirmDeleteId) return;
        startTransition(async () => {
            const res = await deleteSpecialty(confirmDeleteId, currentProjectId);
            if (res.success) {
                setConfirmDeleteId(null);
            } else {
                setAlert({ isOpen: true, title: "Error", message: res.error || "Failed to delete specialty", type: 'error' });
                setConfirmDeleteId(null);
            }
        });
    };

    const startEditing = (specialty: ISpecialtyDTO) => {
        setEditingId(specialty._id);
        setEditName(specialty.name);
        setEditColor(specialty.colorHex);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-neutral-200 dark:border-neutral-800 flex flex-col max-h-[85vh]">
                <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center bg-neutral-50 dark:bg-neutral-800/50">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Manage Specialties</h2>
                    <button onClick={onClose} className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {/* Add New Specialty */}
                    <div className="bg-neutral-50 dark:bg-neutral-800/30 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 mb-6">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-3">Add New Specialty</label>
                        <div className="flex gap-2">
                            <input
                                type="text" value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="Specialty name..."
                                className="flex-1 px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-lg"
                            />
                            <input
                                type="color" value={newColor}
                                onChange={(e) => setNewColor(e.target.value)}
                                className="w-10 h-9 p-1 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-lg cursor-pointer"
                            />
                            <button
                                onClick={handleCreate}
                                disabled={isPending || !newName}
                                className="bg-primary hover:bg-primary/90 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all active:scale-95 disabled:opacity-50"
                            >
                                Add
                            </button>
                        </div>
                    </div>

                    {/* Specialty List */}
                    <div className="space-y-3">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">Existing Specialties ({specialties.length})</label>
                        {specialties.map((specialty) => (
                            <div key={specialty._id} className="group bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 flex items-center justify-between hover:border-primary/30 transition-colors">
                                {editingId === specialty._id ? (
                                    <div className="flex-1 flex gap-2">
                                        <input
                                            type="text" value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            className="flex-1 px-2 py-1 text-sm border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-md"
                                        />
                                        <input
                                            type="color" value={editColor}
                                            onChange={(e) => setEditColor(e.target.value)}
                                            className="w-8 h-8 p-1 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-md cursor-pointer"
                                        />
                                        <button onClick={() => handleUpdate(specialty._id)} className="text-green-500 hover:text-green-600">
                                            <span className="material-symbols-outlined text-xl">check</span>
                                        </button>
                                        <button onClick={() => setEditingId(null)} className="text-neutral-400 hover:text-neutral-500">
                                            <span className="material-symbols-outlined text-xl">close</span>
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-3">
                                            <div className="w-4 h-4 rounded-full border border-neutral-200 dark:border-neutral-700" style={{ backgroundColor: specialty.colorHex }}></div>
                                            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{specialty.name}</span>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => startEditing(specialty)} className="p-1.5 text-neutral-400 hover:text-primary transition-colors">
                                                <span className="material-symbols-outlined text-lg">edit</span>
                                            </button>
                                            <button onClick={() => setConfirmDeleteId(specialty._id)} className="p-1.5 text-neutral-400 hover:text-red-500 transition-colors">
                                                <span className="material-symbols-outlined text-lg">delete</span>
                                            </button>
                                        </div>
                                    </>
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
                title="Delete Specialty"
                message="Are you sure you want to delete this specialty? This cannot be undone."
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
