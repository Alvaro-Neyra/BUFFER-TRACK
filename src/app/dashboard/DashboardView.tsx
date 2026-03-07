"use client";

import React from "react";
import { GlobalHeader } from "@/components/organisms/GlobalHeader";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { PPCBarChart } from "@/components/organisms/PPCCharts";

interface DashboardViewProps {
    metrics: {
        globalPPC: number;
        totalCompleted: number;
        totalCommitted: number;
        totalPinsCount: number;
        ppcBySpecialty: { _id?: string; name: string; color: string; ppc: number; total: number; completed: number; }[];
        ppcBySubcontractor: { _id?: string; name: string; company: string; ppc: number; total: number; completed: number; }[];
        ppcByZone: { _id?: string; level: string; ppc: number; total: number; completed: number; }[];
        subcontractorLoad: { _id: string; name: string; company: string; current: number; next: number; }[];
        activeRestrictions: { id: string; description: string; solver: string; reportedBy: string; commitmentId: string; date: string; }[];
        isManager: boolean;
    };
    projectsList: { id: string, name: string }[];
    currentProjectId: string;
    currentWeekStart: string;
}

export function DashboardView({ metrics, projectsList, currentProjectId, currentWeekStart }: DashboardViewProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Utility to get previous Mondays
    const getWeekOptions = () => {
        const weeks = [];
        const today = new Date();
        const currentDay = today.getDay();
        const diff = today.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
        let monday = new Date(today.setDate(diff));
        monday.setHours(0, 0, 0, 0);

        for (let i = 0; i < 4; i++) {
            const dateStr = monday.toISOString();
            weeks.push({
                label: `Week of ${monday.toLocaleDateString()}`,
                value: dateStr
            });
            monday = new Date(monday.getTime() - 7 * 24 * 60 * 60 * 1000);
        }
        return weeks;
    };

    const weekOptions = getWeekOptions();

    const handleProjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const params = new URLSearchParams(searchParams?.toString() || "");
        params.set('projectId', e.target.value);
        router.push(`${pathname}?${params.toString()}`);
    };

    const handleWeekChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const params = new URLSearchParams(searchParams?.toString() || "");
        params.set('weekStart', e.target.value);
        router.push(`${pathname}?${params.toString()}`);
    };

    const isManager = metrics.isManager;

    return (
        <div className="flex flex-col h-full w-full overflow-hidden bg-background-light dark:bg-background-dark">
            <GlobalHeader
                showSearch={true}
                showLinks={true}
            />

            <main className="flex-1 flex overflow-hidden">
                <div className="flex-1 flex flex-col overflow-y-auto p-6 md:p-8">
                    {/* Header Controls */}
                    <div className="mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
                        <div>
                            <h1 className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight leading-tight">Project Performance</h1>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Metrics and PPC tracking {isManager ? "across all specialties" : "for your assignments"}.</p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                            <select
                                value={currentProjectId}
                                onChange={handleProjectChange}
                                className="form-select text-sm rounded-md border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 shadow-sm pr-10 min-w-40"
                            >
                                {projectsList.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                            <select
                                value={currentWeekStart}
                                onChange={handleWeekChange}
                                className="form-select text-sm rounded-md border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 shadow-sm pr-10 min-w-48"
                            >
                                {weekOptions.map(w => (
                                    <option key={w.value} value={w.value}>{w.label}</option>
                                ))}
                            </select>
                            {isManager && (
                                <button className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 text-sm font-semibold rounded-md border border-neutral-300 dark:border-neutral-700 flex items-center justify-center transition-colors">
                                    <span className="material-symbols-outlined text-[18px] mr-2">download</span>
                                    Export
                                </button>
                            )}
                        </div>
                    </div>

                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 shadow-sm">
                            <div className="text-xs font-bold text-neutral-500 uppercase tracking-wide mb-2">PPC Global</div>
                            <div className="flex items-end gap-3">
                                <span className={`text-4xl font-black ${metrics.globalPPC >= 80 ? 'text-emerald-600' : metrics.globalPPC >= 60 ? 'text-amber-500' : 'text-danger'}`}>
                                    {metrics.globalPPC}%
                                </span>
                                <span className="text-neutral-500 text-sm font-medium mb-1">
                                    {metrics.totalCompleted} / {metrics.totalCommitted} completed
                                </span>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 shadow-sm">
                            <div className="text-xs font-bold text-neutral-500 uppercase tracking-wide mb-2">Task Volume Lifecycle</div>
                            <div className="flex items-end gap-3">
                                <span className="text-4xl font-black text-neutral-900 dark:text-white">{metrics.totalPinsCount}</span>
                                <span className="text-neutral-500 text-sm font-medium mb-1">total pins across project</span>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 shadow-sm">
                            <div className="text-xs font-bold text-neutral-500 uppercase tracking-wide mb-2">The Red List (Active Blockers)</div>
                            <div className="flex items-end gap-3">
                                <span className="text-4xl font-black text-danger">{metrics.activeRestrictions.length}</span>
                                <span className="text-danger bg-danger/10 px-2 py-1 rounded text-xs font-bold mb-1 flex items-center">
                                    <span className="material-symbols-outlined text-xs mr-1">warning</span>Pending
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Complex Data Views */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

                        {/* PPC By Specialty (Manager only effectively, but visible to all if filtered) */}
                        <PPCBarChart
                            title="PPC By Specialty"
                            description="Performance metrics across all project specialties."
                            data={metrics.ppcBySpecialty}
                        />

                        {/* Task Volume Current vs Next Week (Manager shows Subcontractors, Worker shows themselves) */}
                        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 shadow-sm flex flex-col">
                            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-6">Workload Volume (Current vs Next Week)</h3>
                            <div className="flex-1 overflow-x-auto">
                                {metrics.subcontractorLoad.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-neutral-500 text-sm">No data available</div>
                                ) : (
                                    <table className="w-full text-left border-collapse text-sm min-w-[300px]">
                                        <thead>
                                            <tr>
                                                <th className="font-semibold text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800 pb-3">Subcontractor/User</th>
                                                <th className="font-semibold text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800 pb-3 text-center">Current W.</th>
                                                <th className="font-semibold text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800 pb-3 text-center">Next W.</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {metrics.subcontractorLoad.map((sub, idx) => (
                                                <tr key={idx} className="border-b border-neutral-100 dark:border-neutral-800/50 last:border-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                                                    <td className="py-3 font-medium text-neutral-800 dark:text-neutral-200">
                                                        {sub.name} <span className="text-xs text-neutral-500 font-normal ml-1">({sub.company})</span>
                                                    </td>
                                                    <td className="py-3 text-center font-bold text-neutral-800 dark:text-neutral-200">{sub.current}</td>
                                                    <td className="py-3 text-center font-bold text-primary">{sub.next}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>

                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                        {/* PPC by Subcontractor */}
                        <PPCBarChart
                            title="PPC Subcontractor Reliability"
                            description="Percent Plan Complete by specific subcontractors."
                            data={metrics.ppcBySubcontractor.map(s => ({
                                name: s.company && s.company !== 'N/A' ? `${s.company} (${s.name})` : s.name,
                                ppc: s.ppc,
                                total: s.total,
                                completed: s.completed,
                                color: '#10B981' // emerald-500
                            }))}
                        />

                        {/* PPC by Zone */}
                        <PPCBarChart
                            title="PPC Breakdown by Zone"
                            description="Percent Plan Complete across different levels."
                            data={metrics.ppcByZone.map(z => ({
                                name: z.level,
                                ppc: z.ppc,
                                total: z.total,
                                completed: z.completed,
                                color: '#3B82F6' // blue-500
                            }))}
                        />
                    </div>

                    {/* The Red List */}
                    <div className="bg-white dark:bg-neutral-900 border border-danger/20 rounded-xl p-6 shadow-sm flex flex-col">
                        <div className="flex items-center gap-2 mb-6">
                            <span className="material-symbols-outlined text-danger text-xl">warning</span>
                            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">The Red List (Active Constraints)</h3>
                        </div>

                        <div className="overflow-x-auto">
                            {metrics.activeRestrictions.length === 0 ? (
                                <div className="py-8 flex flex-col items-center justify-center text-neutral-500">
                                    <span className="material-symbols-outlined text-4xl mb-2 text-emerald-500/50">check_circle</span>
                                    <p className="text-sm">There are no active constraints right now. Excellent work!</p>
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse text-sm min-w-[600px]">
                                    <thead>
                                        <tr>
                                            <th className="font-semibold text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800 pb-3 pl-2">Description</th>
                                            <th className="font-semibold text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800 pb-3">Location</th>
                                            <th className="font-semibold text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800 pb-3">Reported By</th>
                                            <th className="font-semibold text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800 pb-3">Solver</th>
                                            <th className="font-semibold text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800 pb-3 text-right pr-2">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {metrics.activeRestrictions.map((rest, idx) => (
                                            <tr key={idx} className="border-b border-neutral-100 dark:border-neutral-800/50 last:border-0 hover:bg-rose-50/50 dark:hover:bg-rose-900/10 transition-colors">
                                                <td className="py-4 pl-2 font-medium text-neutral-800 dark:text-neutral-200 max-w-xs truncate" title={rest.description}>
                                                    {rest.description}
                                                </td>
                                                <td className="py-4 text-neutral-600 dark:text-neutral-400">{rest.commitmentId}</td>
                                                <td className="py-4 text-neutral-600 dark:text-neutral-400">{rest.reportedBy}</td>
                                                <td className="py-4 font-bold text-neutral-800 dark:text-neutral-200">{rest.solver}</td>
                                                <td className="py-4 text-right pr-2">
                                                    <button className="text-secondary hover:text-primary transition-colors text-xs font-bold uppercase flex items-center justify-end w-full">
                                                        View Pin <span className="material-symbols-outlined text-[16px] ml-1">arrow_forward</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}
