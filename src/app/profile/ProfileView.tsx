"use client";

import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GlobalHeader } from "@/components/organisms/GlobalHeader";
import { updateProfile } from "./actions";

interface IProjectMembershipSummary {
    projectId: string;
    projectName: string;
    status: "Pending" | "Active";
}

interface IProfileViewProps {
    initialName: string;
    initialEmail: string;
    initialCompany?: string;
    roleName: string;
    memberships: IProjectMembershipSummary[];
}

export function ProfileView({
    initialName,
    initialEmail,
    initialCompany,
    roleName,
    memberships,
}: Readonly<IProfileViewProps>) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const [name, setName] = useState(initialName);
    const [company, setCompany] = useState(initialCompany || "");
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const hasChanges = useMemo(() => {
        return name.trim() !== initialName || company.trim() !== (initialCompany || "");
    }, [company, initialCompany, initialName, name]);

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setSuccess(null);

        startTransition(async () => {
            const result = await updateProfile({
                name,
                company,
            });

            if (!result.success) {
                setError(result.error || "Failed to save profile");
                return;
            }

            setSuccess("Profile updated successfully.");
            router.refresh();
        });
    };

    return (
        <div className="h-full flex flex-col bg-background-light dark:bg-background-dark">
            <GlobalHeader title="Profile" showLinks />

            <main className="flex-1 overflow-y-auto p-6">
                <div className="max-w-3xl mx-auto grid gap-6">
                    <section className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm p-6">
                        <div className="mb-6">
                            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">My Profile</h1>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                                Update your personal information.
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="grid gap-4">
                            {error && (
                                <div className="px-4 py-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 text-sm">
                                    {error}
                                </div>
                            )}

                            {success && (
                                <div className="px-4 py-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm">
                                    {success}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide text-neutral-600 dark:text-neutral-400 mb-2">
                                    Full Name
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(event) => setName(event.target.value)}
                                    className="w-full px-4 py-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                    placeholder="John Doe"
                                    minLength={2}
                                    maxLength={100}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide text-neutral-600 dark:text-neutral-400 mb-2">
                                    Company
                                </label>
                                <input
                                    type="text"
                                    value={company}
                                    onChange={(event) => setCompany(event.target.value)}
                                    className="w-full px-4 py-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                    placeholder="Company XYZ"
                                    maxLength={200}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide text-neutral-600 dark:text-neutral-400 mb-2">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={initialEmail}
                                    className="w-full px-4 py-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800/70 text-neutral-600 dark:text-neutral-300"
                                    readOnly
                                />
                                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                                    Email is managed by your account credentials and cannot be edited here.
                                </p>
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={isPending || !hasChanges}
                                    className="w-full sm:w-auto px-6 py-3 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isPending && <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>}
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </section>

                    <section className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm p-6">
                        <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-3">Account Summary</h2>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-4">
                                <p className="text-xs uppercase tracking-wide font-bold text-neutral-500 dark:text-neutral-400">Current Role</p>
                                <p className="text-sm font-semibold text-neutral-900 dark:text-white mt-1">{roleName}</p>
                            </div>
                            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-4">
                                <p className="text-xs uppercase tracking-wide font-bold text-neutral-500 dark:text-neutral-400">Project Memberships</p>
                                <p className="text-sm font-semibold text-neutral-900 dark:text-white mt-1">{memberships.length}</p>
                            </div>
                        </div>

                        <div className="mt-4 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
                            {memberships.length === 0 ? (
                                <p className="text-sm text-neutral-500 dark:text-neutral-400 px-4 py-3">
                                    No project memberships found.
                                </p>
                            ) : (
                                <ul>
                                    {memberships.map((membership) => (
                                        <li
                                            key={`${membership.projectId}-${membership.status}`}
                                            className="px-4 py-3 border-b last:border-b-0 border-neutral-200 dark:border-neutral-700 flex items-center justify-between gap-3"
                                        >
                                            <div>
                                                <p className="text-sm font-semibold text-neutral-900 dark:text-white">{membership.projectName}</p>
                                            </div>
                                            <span
                                                className={`text-xs font-bold px-2.5 py-1 rounded-full ${membership.status === "Active"
                                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                                                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                                                    }`}
                                            >
                                                {membership.status}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}
