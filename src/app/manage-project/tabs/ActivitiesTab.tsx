"use client";

import React, { useState } from "react";
import type { ISerializedCommitment, ISerializedSpecialty } from "../ManageProjectView";

interface IActivitiesTabProps {
    commitments: ISerializedCommitment[];
    specialties: ISerializedSpecialty[];
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    Request: { bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-600 dark:text-blue-400" },
    Notified: { bg: "bg-indigo-50 dark:bg-indigo-900/20", text: "text-indigo-600 dark:text-indigo-400" },
    Committed: { bg: "bg-cyan-50 dark:bg-cyan-900/20", text: "text-cyan-600 dark:text-cyan-400" },
    "In Progress": { bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-600 dark:text-amber-400" },
    Completed: { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-600 dark:text-emerald-400" },
    Delayed: { bg: "bg-rose-50 dark:bg-rose-900/20", text: "text-rose-600 dark:text-rose-400" },
    Restricted: { bg: "bg-orange-50 dark:bg-orange-900/20", text: "text-orange-600 dark:text-orange-400" },
};

export function ActivitiesTab({ commitments, specialties }: IActivitiesTabProps) {
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [filterSpecialty, setFilterSpecialty] = useState<string>("all");
    const [search, setSearch] = useState("");

    const filteredCommitments = commitments.filter((c) => {
        if (filterStatus !== "all" && c.status !== filterStatus) return false;
        if (filterSpecialty !== "all" && c.specialtyName !== filterSpecialty) return false;
        if (search) {
            const q = search.toLowerCase();
            return (
                c.buildingName.toLowerCase().includes(q) ||
                c.floorLabel.toLowerCase().includes(q) ||
                c.assignedToName.toLowerCase().includes(q) ||
                c.specialtyName.toLowerCase().includes(q)
            );
        }
        return true;
    });

    const allStatuses = ["Request", "Notified", "Committed", "In Progress", "Completed", "Delayed", "Restricted"];

    return (
        <div className="space-y-6">
            {/* Filters */}
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
                    {allStatuses.map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>
                <select value={filterSpecialty} onChange={(e) => setFilterSpecialty(e.target.value)}
                    className="px-3 py-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-lg text-sm text-neutral-900 dark:text-neutral-100 focus:ring-primary focus:border-primary shadow-sm">
                    <option value="all">All Specialties</option>
                    {specialties.map((s) => (<option key={s._id} value={s.name}>{s.name}</option>))}
                </select>
                <span className="text-sm text-neutral-500 ml-auto font-medium">
                    {filteredCommitments.length} activit{filteredCommitments.length === 1 ? "y" : "ies"}
                </span>
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
                        <table className="w-full text-left text-sm text-neutral-600 dark:text-neutral-300 min-w-[900px]">
                            <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-xs uppercase font-bold text-neutral-500 border-b border-neutral-200 dark:border-neutral-800">
                                <tr>
                                    <th className="px-5 py-3.5">Building</th>
                                    <th className="px-5 py-3.5">Floor</th>
                                    <th className="px-5 py-3.5">Specialty</th>
                                    <th className="px-5 py-3.5">Assigned To</th>
                                    <th className="px-5 py-3.5">Status</th>
                                    <th className="px-5 py-3.5">Target Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 font-medium">
                                {filteredCommitments.map((c) => {
                                    const statusStyle = STATUS_COLORS[c.status] || STATUS_COLORS.Request;
                                    return (
                                        <tr key={c._id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors">
                                            <td className="px-5 py-3.5">
                                                <span className="font-semibold text-neutral-900 dark:text-white">{c.buildingName}</span>
                                                <span className="text-xs text-neutral-400 ml-1.5">{c.buildingCode}</span>
                                            </td>
                                            <td className="px-5 py-3.5">{c.floorLabel}</td>
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: c.specialtyColor }} />
                                                    {c.specialtyName}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5">{c.assignedToName}</td>
                                            <td className="px-5 py-3.5">
                                                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${statusStyle.bg} ${statusStyle.text}`}>
                                                    {c.status === "Restricted" && "⚠️ "}{c.status}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-neutral-500">
                                                {c.targetDate ? new Date(c.targetDate).toLocaleDateString() : "—"}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
