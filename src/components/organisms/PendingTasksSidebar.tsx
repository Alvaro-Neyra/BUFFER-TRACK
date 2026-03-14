"use client";

import React, { useState, useMemo } from "react";
import type { IPendingAssignment } from "@/components/organisms/MasterPlanPage";
import Link from "next/link";

interface IPendingTasksSidebarProps {
    assignments: IPendingAssignment[];
    onTaskClick: (buildingId: string) => void;
}

export const PendingTasksSidebar = ({ assignments, onTaskClick }: IPendingTasksSidebarProps) => {
    const [filterBuilding, setFilterBuilding] = useState<string>("all");
    const [filterSpecialty, setFilterSpecialty] = useState<string>("all");

    // Extract unique buildings and specialties for the filters
    const uniqueBuildings = useMemo(() => {
        const set = new Set(assignments.map(c => c.buildingCode).filter(Boolean));
        return Array.from(set);
    }, [assignments]);

    const uniqueSpecialties = useMemo(() => {
        const set = new Set(assignments.map(c => c.specialtyName).filter(Boolean));
        return Array.from(set);
    }, [assignments]);

    const filteredAssignments = assignments.filter(c => {
        if (filterBuilding !== "all" && c.buildingCode !== filterBuilding) return false;
        if (filterSpecialty !== "all" && c.specialtyName !== filterSpecialty) return false;
        return true;
    });

    return (
        <div className="w-80 lg:w-96 bg-neutral-50 dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 flex flex-col md:flex shrink-0">
            <div className="p-6 pb-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 z-10 sticky top-0 flex flex-col gap-4">
                <h3 className="text-neutral-900 dark:text-white text-lg font-bold leading-tight flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">task</span>
                    My Pending Tasks
                </h3>
                <div className="flex gap-2">
                    <select
                        value={filterBuilding}
                        onChange={(e) => setFilterBuilding(e.target.value)}
                        className="form-select flex-1 rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-xs text-neutral-700 dark:text-neutral-300 focus:ring-1 focus:ring-primary focus:border-primary px-3 py-2 h-9"
                    >
                        <option value="all">All Buildings</option>
                        {uniqueBuildings.map(code => <option key={code} value={code}>{code}</option>)}
                    </select>
                    <select
                        value={filterSpecialty}
                        onChange={(e) => setFilterSpecialty(e.target.value)}
                        className="form-select flex-1 rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-xs text-neutral-700 dark:text-neutral-300 focus:ring-1 focus:ring-primary focus:border-primary px-3 py-2 h-9"
                    >
                        <option value="all">All Specialties</option>
                        {uniqueSpecialties.map(spec => <option key={spec} value={spec}>{spec}</option>)}
                    </select>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                {filteredAssignments.length === 0 ? (
                    <div className="text-center py-8 text-neutral-500 flex flex-col items-center gap-2">
                        <span className="material-symbols-outlined text-4xl text-neutral-300 dark:text-neutral-700">task_alt</span>
                        <p className="text-sm">No tasks found</p>
                    </div>
                ) : (
                    filteredAssignments.map((task) => (
                        <div
                            key={task._id}
                            onClick={() => {
                                if (task.buildingId) onTaskClick(task.buildingId);
                            }}
                            style={{ borderLeftColor: task.specialtyColor }}
                            className={`flex flex-col gap-3 p-4 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800/80 transition-all border-l-4 border-y border-r border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-sm relative group cursor-pointer`}
                        >
                            <div className="flex justify-between items-start gap-2">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 text-white"
                                        style={{ backgroundColor: task.specialtyColor || "#8B5CF6" }}
                                    >
                                        {task.specialtyName.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{task.specialtyName}</p>
                                        <h4 className="text-sm font-bold text-neutral-900 dark:text-white leading-tight">{task.name}</h4>
                                    </div>
                                </div>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide shrink-0 ${task.status === "Completed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                                    task.status === "In Progress" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                                        task.status === "Delayed" ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" :
                                            "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                    }`}>
                                    {task.status === "In Progress" ? "In progress" :
                                        task.status === "Completed" ? "Completed" :
                                            task.status === "Delayed" ? "Delayed" :
                                                task.status}
                                </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400 pl-10">
                                <div className="flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[14px]">location_on</span>
                                    <span>{task.buildingCode} - {task.floorLabel}</span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 z-10">
                <Link
                    href="/assignments"
                    className="w-full py-2.5 text-sm font-bold text-primary border border-primary/20 hover:bg-primary/5 rounded-md transition-colors flex items-center justify-center gap-2"
                >
                    <span>View All Tasks</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </Link>
            </div>
        </div>
    );
};
