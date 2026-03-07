"use client";

import React, { useState } from "react";
import { GlobalHeader } from "@/components/organisms/GlobalHeader";
import { UsersTab } from "./tabs/UsersTab";
import type { IUserDTO } from "@/types/models";
import type { IBuildingWithFloors } from "@/services/project.service";
import { BuildingsTab } from "./tabs/BuildingsTab";
import { ActivitiesTab } from "./tabs/ActivitiesTab";

type TTab = "users" | "buildings" | "activities";

interface IManageProjectViewProps {
    pendingUsers: IUserDTO[];
    activeUsers: IUserDTO[];
    buildings: IBuildingWithFloors[];
    commitments: ISerializedCommitment[];
    specialties: ISerializedSpecialty[];
    currentProjectId: string;
    masterPlanImageUrl: string;
    commitmentCounts: Record<string, number>;
}

export interface ISerializedCommitment {
    _id: string;
    buildingName: string;
    buildingCode: string;
    floorLabel: string;
    specialtyName: string;
    specialtyColor: string;
    assignedToName: string;
    requesterName: string;
    status: string;
    targetDate: string | null;
    requestDate: string | null;
    coordinates: { xPercent: number; yPercent: number };
}

export interface ISerializedSpecialty {
    _id: string;
    name: string;
    colorHex: string;
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
    currentProjectId,
    masterPlanImageUrl,
    commitmentCounts,
}: IManageProjectViewProps) {
    const [activeTab, setActiveTab] = useState<TTab>("users");

    return (
        <div className="flex flex-col h-full w-full overflow-hidden bg-[#F4F7F6] dark:bg-neutral-950">
            <GlobalHeader showLinks={true} title="Manage Project" />

            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Tab Navigation */}
                <div className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-4 md:px-8 shrink-0">
                    <div className="flex gap-1">
                        {TABS.map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`relative flex items-center gap-2 px-4 py-3.5 text-sm font-semibold transition-colors
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
                                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-auto p-4 md:p-8">
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
                        />
                    )}
                    {activeTab === "activities" && (
                        <ActivitiesTab
                            commitments={commitments}
                            specialties={specialties}
                        />
                    )}
                </div>
            </main>
        </div>
    );
}
