"use client";

import React, { useState } from "react";
import type { ISpecialtyDTO, IStatusDTO, IRoleDTO } from "@/types/models";
import { ManageStatusesModal } from "@/components/organisms/ManageStatusesModal";
import { ManageSpecialtiesModal } from "@/components/organisms/ManageSpecialtiesModal";
import { ManageRolesModal } from "@/components/organisms/ManageRolesModal";

interface ISettingsTabProps {
    specialties: ISpecialtyDTO[];
    statuses: IStatusDTO[];
    roles: IRoleDTO[];
    currentProjectId: string;
}

export function SettingsTab({
    specialties,
    statuses,
    roles,
    currentProjectId,
}: Readonly<ISettingsTabProps>) {
    const [showStatusesModal, setShowStatusesModal] = useState(false);
    const [showSpecialtiesModal, setShowSpecialtiesModal] = useState(false);
    const [showRolesModal, setShowRolesModal] = useState(false);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Project Settings</h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                    Manage statuses, specialties, and roles from a dedicated settings workspace.
                </p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <section className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm overflow-hidden">
                    <header className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px] text-primary">tune</span>
                            <h3 className="font-bold text-sm text-neutral-900 dark:text-white">Statuses</h3>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowStatusesModal(true)}
                            className="text-xs font-bold text-primary hover:text-primary/80"
                        >
                            Manage
                        </button>
                    </header>
                    <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
                        {statuses.map((status) => (
                            <div key={status._id} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                    <span className="size-2.5 rounded-full" style={{ backgroundColor: status.colorHex }}></span>
                                    <span className="text-neutral-800 dark:text-neutral-100">{status.name}</span>
                                </div>
                                {status.isPPC && (
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">PPC</span>
                                )}
                            </div>
                        ))}
                    </div>
                </section>

                <section className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm overflow-hidden">
                    <header className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px] text-primary">palette</span>
                            <h3 className="font-bold text-sm text-neutral-900 dark:text-white">Specialties</h3>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowSpecialtiesModal(true)}
                            className="text-xs font-bold text-primary hover:text-primary/80"
                        >
                            Manage
                        </button>
                    </header>
                    <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
                        {specialties.map((specialty) => (
                            <div key={specialty._id} className="flex items-center gap-2 text-sm text-neutral-800 dark:text-neutral-100">
                                <span className="size-2.5 rounded-full" style={{ backgroundColor: specialty.colorHex }}></span>
                                {specialty.name}
                            </div>
                        ))}
                    </div>
                </section>

                <section className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm overflow-hidden">
                    <header className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px] text-primary">badge</span>
                            <h3 className="font-bold text-sm text-neutral-900 dark:text-white">Roles</h3>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowRolesModal(true)}
                            className="text-xs font-bold text-primary hover:text-primary/80"
                        >
                            Manage
                        </button>
                    </header>
                    <div className="p-4 space-y-3 max-h-72 overflow-y-auto">
                        {roles.map((role) => (
                            <div key={role._id} className="text-sm">
                                <div className="flex items-center gap-2">
                                    <span className="text-neutral-900 dark:text-neutral-100 font-semibold">{role.name}</span>
                                    {role.isManager && (
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Manager</span>
                                    )}
                                </div>
                                {!role.isManager && role.specialtiesIds.length > 0 && (
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                                        {role.specialtiesIds.length} specialties allowed
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            </div>

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
        </div>
    );
}
