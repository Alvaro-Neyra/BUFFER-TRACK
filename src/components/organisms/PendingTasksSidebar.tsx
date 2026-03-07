"use client";

import React from "react";
import { useRouter } from "next/navigation";

import { mockTasks } from "@/data/mockData";

export const PendingTasksSidebar = () => {
    const router = useRouter();

    return (
        <div className="w-80 lg:w-96 bg-neutral-50 dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 flex flex-col hidden md:flex shrink-0">
            <div className="p-6 pb-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 z-10 sticky top-0 flex flex-col gap-4">
                <h3 className="text-neutral-900 dark:text-white text-lg font-bold leading-tight flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">task</span>
                    My Pending Tasks
                </h3>
                <div className="flex gap-2">
                    <select className="form-select flex-1 rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-xs text-neutral-700 dark:text-neutral-300 focus:ring-1 focus:ring-primary focus:border-primary px-3 py-2 h-9">
                        <option>All Buildings</option>
                        <option>BLD-01</option>
                    </select>
                    <select className="form-select flex-1 rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-xs text-neutral-700 dark:text-neutral-300 focus:ring-1 focus:ring-primary focus:border-primary px-3 py-2 h-9">
                        <option>All Specialties</option>
                    </select>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                {mockTasks.map((task) => (
                    <div
                        key={task.id}
                        onClick={() => router.push(`/detail/${task.id}`)}
                        className={`flex flex-col gap-3 p-4 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800/80 transition-all border-l-4 border-l-${task.teamColor}-500 border-y border-r border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-sm relative group cursor-pointer`}
                    >
                        <div className="flex justify-between items-start gap-2">
                            <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full bg-${task.teamColor}-100 text-${task.teamColor}-700 flex items-center justify-center font-bold text-xs shrink-0`}>{task.teamInitials}</div>
                                <div>
                                    <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{task.teamName}</p>
                                    <h4 className="text-sm font-bold text-neutral-900 dark:text-white leading-tight">{task.title}</h4>
                                </div>
                            </div>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-${task.status.type}/20 text-${task.status.type} shrink-0`}>{task.status.label}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400 pl-10">
                            <div className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">location_on</span>
                                <span>{task.location}</span>
                            </div>
                            <div className={`flex items-center gap-1 ${task.isOverdue ? 'text-danger font-medium' : ''}`}>
                                <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                                <span>{task.dateLabel}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 z-10">
                <button className="w-full py-2.5 text-sm font-bold text-primary border border-primary/20 hover:bg-primary/5 rounded-md transition-colors flex items-center justify-center gap-2">
                    <span>View All Tasks</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
            </div>
        </div>
    );
};
