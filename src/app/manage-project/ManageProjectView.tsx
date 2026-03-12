"use client";

import React, { useEffect, useState, useTransition } from "react";
import { GlobalHeader } from "@/components/organisms/GlobalHeader";
import { useRouter } from "next/navigation";
import { UsersTab } from "./tabs/UsersTab";
import type { IUserDTO, ISpecialtyDTO, IStatusDTO, IRoleDTO } from "@/types/models";
import type { IBuildingWithFloors } from "@/services/project.service";
import { BuildingsTab } from "./tabs/BuildingsTab";
import { ActivitiesTab } from "./tabs/ActivitiesTab";
import { setProjectRedListEnabled } from "./actions";
import { ConfirmModal } from "@/components/organisms/ConfirmModal";

type TTab = "users" | "buildings" | "activities";

interface IManageProjectViewProps {
    pendingUsers: IUserDTO[];
    activeUsers: IUserDTO[];
    buildings: IBuildingWithFloors[];
    commitments: ISerializedCommitment[];
    specialties: ISpecialtyDTO[];
    statuses: IStatusDTO[];
    roles: IRoleDTO[];
    currentProjectId: string;
    masterPlanImageUrl: string;
    commitmentCounts: Record<string, number>;
    redListEnabled: boolean;
    isGlobalAdmin: boolean;
}

export interface ISerializedCommitment {
    _id: string;
    buildingName: string;
    buildingCode: string;
    floorId: string;
    floorLabel: string;
    name: string;
    description: string;
    specialtyId: string;
    specialtyName: string;
    specialtyColor: string;
    assignedToId: string;
    assignedToName: string;
    requesterName: string;
    status: string;
    startDate: string | null;
    targetDate: string | null;
    requestDate: string | null;
    coordinates: { xPercent: number; yPercent: number };
    polygon?: { xPercent: number; yPercent: number }[];
    customId?: string;
    location?: string;
    dates?: {
        requestDate?: string | null;
        startDate?: string | null;
        targetDate?: string | null;
        actualCompletionDate?: string | null;
    };
}

const TABS: { key: TTab; label: string; icon: string }[] = [
    { key: "users", label: "Users", icon: "group" },
    { key: "buildings", label: "Buildings", icon: "apartment" },
    { key: "activities", label: "Activities", icon: "assignment" },
];

export function ManageProjectView({
    pendingUsers,
    activeUsers,
    buildings,
    commitments,
    specialties,
    statuses,
    roles,
    currentProjectId,
    masterPlanImageUrl,
    commitmentCounts,
    redListEnabled,
    isGlobalAdmin,
}: IManageProjectViewProps) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TTab>("users");
    const [isUpdatingRedList, startUpdatingRedList] = useTransition();
    const [redListFeatureEnabled, setRedListFeatureEnabled] = useState(redListEnabled);
    const [redListError, setRedListError] = useState<string | null>(null);
    const [isRedListConfirmOpen, setIsRedListConfirmOpen] = useState(false);
    const [pendingRedListValue, setPendingRedListValue] = useState<boolean | null>(null);

    useEffect(() => {
        setRedListFeatureEnabled(redListEnabled);
        setRedListError(null);
        setIsRedListConfirmOpen(false);
        setPendingRedListValue(null);
    }, [currentProjectId, redListEnabled]);

    const handleToggleRedList = () => {
        if (isUpdatingRedList) {
            return;
        }

        setPendingRedListValue(!redListFeatureEnabled);
        setIsRedListConfirmOpen(true);
    };

    const handleCancelToggleRedList = () => {
        setIsRedListConfirmOpen(false);
        setPendingRedListValue(null);
    };

    const handleConfirmToggleRedList = () => {
        if (pendingRedListValue === null) {
            setIsRedListConfirmOpen(false);
            return;
        }

        const nextValue = pendingRedListValue;
        setIsRedListConfirmOpen(false);
        setPendingRedListValue(null);

        startUpdatingRedList(async () => {
            setRedListError(null);
            const response = await setProjectRedListEnabled(currentProjectId, nextValue);
            if (!response.success) {
                setRedListError(response.error || "Failed to update Red List setting");
                return;
            }

            setRedListFeatureEnabled(nextValue);
            router.refresh();
        });
    };

    const willEnableRedList = pendingRedListValue === true;
    const redListConfirmTitle = willEnableRedList ? "Enable Red List" : "Disable Red List";
    const redListConfirmMessage = willEnableRedList
        ? "Enable The Red List for this project?"
        : "Disable The Red List for this project? This requires zero active restrictions and zero Restricted commitments.";
    const redListConfirmLabel = willEnableRedList ? "Enable" : "Disable";

    return (
        <div className="flex flex-col h-full w-full overflow-hidden bg-[#F4F7F6] dark:bg-neutral-950">
            <GlobalHeader showLinks={true} title="Manage Project" />

            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Tab Navigation */}
                <div className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-4 md:px-8 shrink-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex gap-1">
                            {TABS.map((tab) => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`relative flex items-center gap-2 px-4 py-3.5 text-sm font-semibold transition-colors cursor-pointer
                                        ${activeTab === tab.key
                                            ? "text-primary"
                                            : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                                        }`}
                                >
                                    <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                                    {tab.label}
                                    {tab.key === "users" && pendingUsers.length > 0 && (
                                        <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                                            {pendingUsers.length}
                                        </span>
                                    )}
                                    {activeTab === tab.key && (
                                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-md" />
                                    )}
                                </button>
                            ))}
                        </div>

                        {isGlobalAdmin && (
                            <button
                                type="button"
                                onClick={handleToggleRedList}
                                disabled={isUpdatingRedList}
                                className={`my-2 inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors disabled:opacity-60 ${redListFeatureEnabled
                                        ? "border-danger/40 bg-danger/10 text-danger hover:bg-danger/15"
                                        : "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                    }`}
                            >
                                <span className="material-symbols-outlined text-[15px]">{redListFeatureEnabled ? "warning" : "shield"}</span>
                                {isUpdatingRedList
                                    ? "Updating..."
                                    : redListFeatureEnabled
                                        ? "Red List: On"
                                        : "Red List: Off"
                                }
                            </button>
                        )}
                    </div>

                    {isGlobalAdmin && redListError && (
                        <p className="py-5 text-xs font-semibold text-rose-600 dark:text-rose-400">{redListError}</p>
                    )}
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-auto p-4 md:p-8 bg-neutral-50 dark:bg-neutral-900">
                    {activeTab === "users" && (
                        <UsersTab
                            pendingUsers={pendingUsers}
                            activeUsers={activeUsers}
                            currentProjectId={currentProjectId}
                        />
                    )}
                    {activeTab === "buildings" && (
                        <BuildingsTab
                            buildings={buildings}
                            currentProjectId={currentProjectId}
                            masterPlanImageUrl={masterPlanImageUrl}
                            commitmentCounts={commitmentCounts}
                            commitments={commitments}
                            specialties={specialties}
                            statuses={statuses}
                            redListEnabled={redListFeatureEnabled}
                            activeUsers={activeUsers}
                        />
                    )}
                    {activeTab === "activities" && (
                        <ActivitiesTab
                            commitments={commitments}
                            specialties={specialties}
                            statuses={statuses}
                            redListEnabled={redListFeatureEnabled}
                            roles={roles}
                            users={activeUsers}
                            currentProjectId={currentProjectId}
                        />
                    )}
                </div>
            </main>

            <ConfirmModal
                isOpen={isRedListConfirmOpen}
                title={redListConfirmTitle}
                message={redListConfirmMessage}
                onConfirm={handleConfirmToggleRedList}
                onCancel={handleCancelToggleRedList}
                confirmLabel={redListConfirmLabel}
                cancelLabel="Cancel"
                isDanger={!willEnableRedList}
            />
        </div>
    );
}
