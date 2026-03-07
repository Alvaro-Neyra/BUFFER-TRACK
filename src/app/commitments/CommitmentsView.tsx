"use client";

import React, { useState } from "react";
import { GlobalHeader } from "@/components/organisms/GlobalHeader";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface CommitmentsViewProps {
    commitments: {
        id: string;
        taskName: string;
        location: string;
        specialtyName: string;
        specialtyColor: string;
        status: string;
        targetDate: string;
        assignedTo: string;
    }[];
    restrictions: {
        id: string;
        description: string;
        location: string;
        reportedBy: string;
        solver: string;
        targetDate: string;
        commitmentId: string;
    }[];
    projectsList: { id: string, name: string }[];
    currentProjectId: string;
    isManager: boolean;
}

export function CommitmentsView({ commitments, restrictions, projectsList, currentProjectId, isManager }: CommitmentsViewProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // "all" | "inprogress" | "delayed" | "redlist"
    const [filter, setFilter] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");

    const handleProjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const params = new URLSearchParams(searchParams?.toString() || "");
        params.set('projectId', e.target.value);
        router.push(`${pathname}?${params.toString()}`);
    };

    const handleExportCSV = () => {
        if (filter === "redlist") {
            const headers = ["Description,Location,Reported By,Solver,Target Date,Commitment ID"];
            const rows = restrictions.map(r =>
                `"${r.description}","${r.location}","${r.reportedBy}","${r.solver}","${r.targetDate}","${r.commitmentId}"`
            );
            downloadCSV(headers.concat(rows).join('\n'), 'redlist_export.csv');
        } else {
            const headers = ["ID,Task,Location,Specialty,Status,Target Date,Assigned To"];
            const filteredCommits = getFilteredCommitments();
            const rows = filteredCommits.map(c =>
                `"${c.id}","${c.taskName}","${c.location}","${c.specialtyName}","${c.status}","${c.targetDate}","${c.assignedTo}"`
            );
            downloadCSV(headers.concat(rows).join('\n'), 'commitments_export.csv');
        }
    };

    const downloadCSV = (content: string, filename: string) => {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getFilteredCommitments = () => {
        return commitments.filter(c => {
            const matchSearch = c.taskName.toLowerCase().includes(searchTerm.toLowerCase()) || c.id.toLowerCase().includes(searchTerm.toLowerCase());
            if (!matchSearch) return false;

            if (filter === "inprogress") return c.status === "In Progress";
            if (filter === "delayed") return c.status === "Delayed";
            return true;
        });
    };

    const getFilteredRestrictions = () => {
        return restrictions.filter(r =>
            r.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.commitmentId.toLowerCase().includes(searchTerm.toLowerCase())
        );
    };

    return (
        <div className="flex flex-col h-full w-full overflow-hidden bg-background-light dark:bg-background-dark">
            <GlobalHeader
                showSearch={true}
                showLinks={true}
            />

            <main className="flex-1 flex overflow-hidden">
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-6 md:p-8 pb-0 shrink-0">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
                            <div>
                                <h1 className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight leading-tight">Commitments Log</h1>
                                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Manage all commitments and track The Red List.</p>
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

                                <div className="relative flex-1 sm:w-64">
                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">search</span>
                                    <input
                                        type="text"
                                        placeholder="Search by name or ID..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-9 pr-4 py-2 w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-md text-sm text-neutral-900 dark:text-neutral-100 focus:ring-primary focus:border-primary shadow-sm"
                                    />
                                </div>

                                {isManager && (
                                    <button
                                        onClick={handleExportCSV}
                                        className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 text-sm font-semibold rounded-md border border-neutral-300 dark:border-neutral-700 flex items-center justify-center transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[18px] mr-2">download</span>
                                        CSV
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-4 border-b border-neutral-200 dark:border-neutral-800">
                            <button onClick={() => setFilter("all")} className={`pb-3 text-sm font-bold border-b-2 transition-colors ${filter === "all" ? "text-primary border-primary" : "text-neutral-500 border-transparent hover:text-neutral-700"}`}>All Commitments</button>
                            <button onClick={() => setFilter("inprogress")} className={`pb-3 text-sm font-bold border-b-2 transition-colors ${filter === "inprogress" ? "text-primary border-primary" : "text-neutral-500 border-transparent hover:text-neutral-700"}`}>In Progress</button>
                            <button onClick={() => setFilter("delayed")} className={`pb-3 text-sm font-bold border-b-2 transition-colors ${filter === "delayed" ? "text-primary border-primary" : "text-neutral-500 border-transparent hover:text-neutral-700"}`}>Delayed</button>
                            <button onClick={() => setFilter("redlist")} className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center ${filter === "redlist" ? "text-danger border-danger" : "text-neutral-500 border-transparent hover:text-neutral-700"}`}>
                                <span className={`material-symbols-outlined text-[16px] mr-1 ${filter === "redlist" ? "text-danger" : "text-neutral-400"}`}>warning</span>
                                The Red List
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto p-6 md:p-8 pt-6">
                        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm overflow-hidden">
                            {filter === "redlist" ? (
                                <RedListTable restrictions={getFilteredRestrictions()} />
                            ) : (
                                <CommitmentsTable commitments={getFilteredCommitments()} />
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

// Subcomponents for tables
function CommitmentsTable({ commitments }: { commitments: CommitmentsViewProps['commitments'] }) {
    if (commitments.length === 0) {
        return <div className="p-12 text-center text-neutral-500 text-sm">No commitments found matching criteria.</div>;
    }

    return (
        <table className="w-full text-left text-sm text-neutral-600 dark:text-neutral-300">
            <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-xs uppercase font-bold text-neutral-500 border-b border-neutral-200 dark:border-neutral-800">
                <tr>
                    <th className="px-6 py-4">Task</th>
                    <th className="px-6 py-4">Location</th>
                    <th className="px-6 py-4">Specialty</th>
                    <th className="px-6 py-4">Assignee</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Target Date</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 font-medium">
                {commitments.map(c => (
                    <tr key={c.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer group">
                        <td className="px-6 py-4 text-neutral-900 dark:text-neutral-100 font-bold group-hover:text-primary transition-colors">{c.taskName}</td>
                        <td className="px-6 py-4">{c.location}</td>
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                                <span className="size-2 rounded-full" style={{ backgroundColor: c.specialtyColor }}></span>
                                {c.specialtyName}
                            </div>
                        </td>
                        <td className="px-6 py-4 text-neutral-600 dark:text-neutral-400">{c.assignedTo}</td>
                        <td className="px-6 py-4">
                            <StatusBadge status={c.status} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">{c.targetDate}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function RedListTable({ restrictions }: { restrictions: CommitmentsViewProps['restrictions'] }) {
    if (restrictions.length === 0) {
        return (
            <div className="py-12 flex flex-col items-center justify-center text-neutral-500">
                <span className="material-symbols-outlined text-4xl mb-2 text-emerald-500/50">check_circle</span>
                <p className="text-sm">There are no active constraints. The Red List is clean!</p>
            </div>
        );
    }

    return (
        <table className="w-full text-left text-sm text-neutral-600 dark:text-neutral-300">
            <thead className="bg-danger/5 dark:bg-danger/10 text-xs uppercase font-bold text-neutral-500 border-b border-danger/20">
                <tr>
                    <th className="px-6 py-4">Description</th>
                    <th className="px-6 py-4">Location</th>
                    <th className="px-6 py-4">Reported By</th>
                    <th className="px-6 py-4">Solver</th>
                    <th className="px-6 py-4">Commitment</th>
                    <th className="px-6 py-4 text-right">Action</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 font-medium">
                {restrictions.map(r => (
                    <tr key={r.id} className="hover:bg-rose-50/50 dark:hover:bg-rose-900/10 transition-colors cursor-pointer group">
                        <td className="px-6 py-4 text-neutral-900 dark:text-neutral-100 font-bold max-w-sm" title={r.description}>
                            <div className="line-clamp-2">{r.description}</div>
                        </td>
                        <td className="px-6 py-4">{r.location}</td>
                        <td className="px-6 py-4 text-neutral-500">{r.reportedBy}</td>
                        <td className="px-6 py-4 text-neutral-800 dark:text-neutral-200 font-bold">{r.solver || 'Unassigned'}</td>
                        <td className="px-6 py-4 font-mono text-xs">{r.commitmentId.substring(0, 8)}...</td>
                        <td className="px-6 py-4 text-right">
                            <button className="text-secondary hover:text-primary transition-colors text-xs font-bold uppercase">View</button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function StatusBadge({ status }: { status: string }) {
    switch (status) {
        case 'In Progress':
            return <span className="px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider bg-warning/20 text-warning whitespace-nowrap">In Progress</span>;
        case 'Delayed':
            return <span className="px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider bg-danger/20 text-danger whitespace-nowrap">Delayed</span>;
        case 'Completed':
            return <span className="px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 whitespace-nowrap">Completed</span>;
        case 'Restricted':
            return <span className="px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 whitespace-nowrap flex items-center gap-1 w-max"><span className="material-symbols-outlined text-[14px]">warning</span> Restricted</span>;
        default:
            return <span className="px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider bg-neutral-100 text-neutral-500 whitespace-nowrap">{status}</span>;
    }
}
