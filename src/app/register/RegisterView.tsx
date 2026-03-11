"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GlobalHeader } from "@/components/organisms/GlobalHeader";
import type { IRoleDTO, ISpecialtyDTO } from "@/types/models";

interface RegisterViewProps {
    initialSpecialties?: ISpecialtyDTO[];
    initialRoles?: IRoleDTO[];
}

interface IRegisterOptionsResponse {
    projectId: string;
    projectName: string;
    roles: IRoleDTO[];
    specialties: ISpecialtyDTO[];
}

export function RegisterView({ initialSpecialties = [], initialRoles = [] }: RegisterViewProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingOptions, setIsLoadingOptions] = useState(false);
    const [error, setError] = useState("");
    const [optionsError, setOptionsError] = useState("");
    const [projectName, setProjectName] = useState("");
    const [availableRoles, setAvailableRoles] = useState<IRoleDTO[]>(initialRoles);
    const [availableSpecialties, setAvailableSpecialties] = useState<ISpecialtyDTO[]>(initialSpecialties);

    // Form State
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [roleId, setRoleId] = useState("");
    const [company, setCompany] = useState("");
    const [projectId, setProjectId] = useState("");
    const [specialtyId, setSpecialtyId] = useState("");

    const selectedRole = useMemo(
        () => availableRoles.find((role) => role._id === roleId),
        [availableRoles, roleId]
    );

    const allowedSpecialties = useMemo(() => {
        if (!selectedRole) return [];
        const allowed = new Set(selectedRole.specialtiesIds || []);
        return availableSpecialties.filter((specialty) => allowed.has(specialty._id));
    }, [availableSpecialties, selectedRole]);

    const specialtyRequired = Boolean(selectedRole && (selectedRole.specialtiesIds || []).length > 0);

    useEffect(() => {
        const trimmedCode = projectId.trim();
        if (!trimmedCode) {
            setAvailableRoles([]);
            setAvailableSpecialties([]);
            setRoleId("");
            setSpecialtyId("");
            setProjectName("");
            setOptionsError("");
            return;
        }

        const controller = new AbortController();
        const timeout = setTimeout(async () => {
            setIsLoadingOptions(true);
            setOptionsError("");

            try {
                const response = await fetch('/api/auth/register/options', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projectId: trimmedCode }),
                    signal: controller.signal,
                });

                const json = await response.json();
                if (!response.ok) {
                    setProjectName("");
                    setAvailableRoles([]);
                    setAvailableSpecialties([]);
                    setRoleId("");
                    setSpecialtyId("");
                    setOptionsError(json.error || 'Invalid project connection code');
                    return;
                }

                const payload: IRegisterOptionsResponse = json.data;
                setProjectName(payload.projectName);
                setAvailableRoles(payload.roles);
                setAvailableSpecialties(payload.specialties);
                setOptionsError("");

                setRoleId((currentRoleId) => payload.roles.some((role) => role._id === currentRoleId) ? currentRoleId : "");
                setSpecialtyId((currentSpecialtyId) => payload.specialties.some((specialty) => specialty._id === currentSpecialtyId) ? currentSpecialtyId : "");
            } catch (fetchError) {
                if ((fetchError as Error).name === 'AbortError') return;
                setProjectName("");
                setAvailableRoles([]);
                setAvailableSpecialties([]);
                setRoleId("");
                setSpecialtyId("");
                setOptionsError('Unable to load project roles and specialties');
            } finally {
                setIsLoadingOptions(false);
            }
        }, 350);

        return () => {
            controller.abort();
            clearTimeout(timeout);
        };
    }, [projectId]);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        if (optionsError) {
            setError(optionsError);
            setIsLoading(false);
            return;
        }

        if (!roleId) {
            setError("Please select a valid role for this project.");
            setIsLoading(false);
            return;
        }

        if (specialtyRequired && !specialtyId) {
            setError("Please select a specialty for the selected role.");
            setIsLoading(false);
            return;
        }

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    email,
                    password,
                    roleId,
                    company,
                    projectId,
                    ...(specialtyId ? { specialtyId } : {}),
                })
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || "Failed to register");
                setIsLoading(false);
            } else {
                // Success - Redirect user to login so they can authenticate
                router.push("/login?registered=true");
            }
        } catch {
            setError("An unexpected error occurred. Please try again.");
            setIsLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-background-light dark:bg-background-dark">
            <GlobalHeader title="Register" />
            <main className="flex-1 flex flex-col items-center justify-start p-6 overflow-y-auto">
                <div className="max-w-md w-full my-auto shrink-0 bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
                    <div className="p-8">
                        <div className="flex items-center justify-center gap-3 mb-8">
                            <span className="material-symbols-outlined text-primary text-4xl">track_changes</span>
                            <h1 className="text-3xl font-black tracking-tight text-neutral-900 dark:text-white">BufferTrack</h1>
                        </div>

                        <div className="text-center mb-8">
                            <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">Create an account</h2>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400">Join a project to manage construction commitments.</p>
                        </div>

                        <form onSubmit={handleRegister} className="space-y-4">
                            {error && (
                                <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-600 text-sm font-medium text-center">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide text-neutral-600 dark:text-neutral-400 mb-2">Full Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                    placeholder="John Doe"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide text-neutral-600 dark:text-neutral-400 mb-2">Email Address</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                    placeholder="name@company.com"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide text-neutral-600 dark:text-neutral-400 mb-2">Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                />
                            </div>

                            <hr className="border-neutral-200 dark:border-neutral-800 py-2" />

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide text-neutral-600 dark:text-neutral-400 mb-2">Project ID / Connection Code</label>
                                <input
                                    type="text"
                                    value={projectId}
                                    onChange={(e) => setProjectId(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                    placeholder="e.g. [PROJECT-NAME]-[123...9]"
                                    required
                                />
                                {isLoadingOptions && (
                                    <p className="text-xs mt-2 text-neutral-500 dark:text-neutral-400">Loading project configuration...</p>
                                )}
                                {!!optionsError && (
                                    <p className="text-xs mt-2 text-rose-600">{optionsError}</p>
                                )}
                                {!optionsError && !!projectName && !isLoadingOptions && (
                                    <p className="text-xs mt-2 text-emerald-600">Project detected: {projectName}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide text-neutral-600 dark:text-neutral-400 mb-2">Company Name</label>
                                <input
                                    type="text"
                                    value={company}
                                    onChange={(e) => setCompany(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                    placeholder="Company XYZ"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide text-neutral-600 dark:text-neutral-400 mb-2">Role</label>
                                <select
                                    className="w-full px-4 py-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all appearance-none"
                                    required
                                    value={roleId}
                                    onChange={(e) => {
                                        setRoleId(e.target.value);
                                        setSpecialtyId("");
                                    }}
                                    disabled={isLoadingOptions || availableRoles.length === 0}
                                >
                                    <option value="" disabled>
                                        {availableRoles.length === 0 ? "Enter a valid project code first..." : "Select your role..."}
                                    </option>
                                    {availableRoles.map(role => (
                                        <option key={role._id} value={role._id}>{role.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Specialty required only when the selected role explicitly defines allowed specialties */}
                            {specialtyRequired && (
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wide text-neutral-600 dark:text-neutral-400 mb-2">Specialty</label>
                                    <select
                                        className="w-full px-4 py-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all appearance-none"
                                        required
                                        value={specialtyId}
                                        onChange={(e) => setSpecialtyId(e.target.value)}
                                    >
                                        <option value="" disabled>Select your specialty...</option>
                                        {allowedSpecialties.map((specialty) => (
                                            <option key={specialty._id} value={specialty._id}>{specialty.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-3 px-4 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg shadow-md transition-transform active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 flex items-center justify-center gap-2 mt-6"
                            >
                                {isLoading ? (
                                    <span className="material-symbols-outlined max-w-fit w-auto animate-spin">progress_activity</span>
                                ) : null}
                                <span>Complete Registration</span>
                            </button>
                        </form>

                        <div className="mt-8 text-center border-t border-neutral-200 dark:border-neutral-800 pt-6">
                            <p className="text-sm text-neutral-500 dark:text-neutral-400">
                                Already have an account? <Link href="/login" className="text-primary font-bold hover:underline">Log in</Link>
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
