"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { handleUserProjectAccess } from "../actions";
import type { IUserDTO } from "@/types/models";

interface IUsersTabProps {
    pendingUsers: IUserDTO[];
    activeUsers: IUserDTO[];
    currentProjectId: string;
}

export function UsersTab({ pendingUsers, activeUsers, currentProjectId }: IUsersTabProps) {
    const router = useRouter();
    const [filter, setFilter] = useState<"pending" | "active">("pending");
    const [isPending, startTransition] = useTransition();

    const handleAction = (userId: string, action: 'accept' | 'reject' | 'remove') => {
        if (action === 'remove' && !confirm("Are you sure you want to remove this user from the project?")) {
            return;
        }

        startTransition(async () => {
            const res = await handleUserProjectAccess(userId, currentProjectId, action);
            if (res.success) {
                router.refresh();
            } else {
                alert(res.error || "Failed to perform action");
            }
        });
    };

    const usersToDisplay = filter === "pending" ? pendingUsers : activeUsers;

    return (
        <div className="space-y-6">
            {/* Filter Tabs */}
            <div className="flex gap-4 border-b border-neutral-200 dark:border-neutral-800">
                <button
                    onClick={() => setFilter("pending")}
                    className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${filter === "pending" ? "text-primary border-primary" : "text-neutral-500 border-transparent hover:text-neutral-700"}`}
                >
                    Pending Requests
                    {pendingUsers.length > 0 && (
                        <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{pendingUsers.length}</span>
                    )}
                </button>
                <button
                    onClick={() => setFilter("active")}
                    className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${filter === "active" ? "text-primary border-primary" : "text-neutral-500 border-transparent hover:text-neutral-700"}`}
                >
                    Active Users
                    <span className="bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold">{activeUsers.length}</span>
                </button>
            </div>

            {/* Users Table */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm overflow-hidden">
                {usersToDisplay.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-neutral-500">
                        <span className="material-symbols-outlined text-4xl mb-3 text-neutral-300 dark:text-neutral-700">group_off</span>
                        <p className="font-medium text-sm">No {filter} users found.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-neutral-600 dark:text-neutral-300 min-w-[700px]">
                            <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-xs uppercase font-bold text-neutral-500 border-b border-neutral-200 dark:border-neutral-800">
                                <tr>
                                    <th className="px-6 py-4">Name</th>
                                    <th className="px-6 py-4 hidden sm:table-cell">Email</th>
                                    <th className="px-6 py-4">Role</th>
                                    <th className="px-6 py-4">Company & Specialty</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 font-medium">
                                {usersToDisplay.map((user) => (
                                    <tr key={user._id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors">
                                        <td className="px-6 py-4 text-neutral-900 dark:text-neutral-100 font-bold">{user.name}</td>
                                        <td className="px-6 py-4 hidden sm:table-cell text-neutral-500">{user.email}</td>
                                        <td className="px-6 py-4">{user.role}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-neutral-900 dark:text-neutral-200 font-semibold">{user.company}</span>
                                                {user.specialtyName && (
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="size-2 rounded-full" style={{ backgroundColor: user.specialtyColor }} />
                                                        <span className="text-xs text-neutral-500">{user.specialtyName}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {filter === "pending" ? (
                                                    <>
                                                        <button
                                                            onClick={() => handleAction(user._id, 'accept')}
                                                            disabled={isPending}
                                                            className="px-3 py-1.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded text-xs font-bold transition-colors disabled:opacity-50"
                                                        >
                                                            Accept
                                                        </button>
                                                        <button
                                                            onClick={() => handleAction(user._id, 'reject')}
                                                            disabled={isPending}
                                                            className="px-3 py-1.5 text-neutral-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded text-xs font-bold transition-colors disabled:opacity-50"
                                                        >
                                                            Reject
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={() => handleAction(user._id, 'remove')}
                                                        disabled={isPending}
                                                        className="px-3 py-1.5 text-neutral-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1"
                                                    >
                                                        <span className="material-symbols-outlined text-[14px]">person_remove</span>
                                                        Remove
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
