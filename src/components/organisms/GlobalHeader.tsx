"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { isManagerRole } from "@/constants/roles";

interface IGlobalHeaderProps {
    title?: string;
    showSearch?: boolean;
    showLinks?: boolean;
}

export const GlobalHeader = ({ title, showSearch = false, showLinks = false }: Readonly<IGlobalHeaderProps>) => {
    const router = useRouter();
    const pathname = usePathname();
    const { data: session } = useSession();
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    const hasActiveProject = session?.user?.projects?.some(p => p.status === 'Active');

    const getRoleColor = (role?: string) => {
        switch (role) {
            case 'Admin': return 'bg-rose-500';
            case 'Project Director': return 'bg-purple-600';
            case 'Project Manager': return 'bg-indigo-600';
            case 'Superintendent': return 'bg-blue-600';
            case 'Production Manager': return 'bg-emerald-600';
            case 'Production Lead': return 'bg-teal-500';
            case 'Production Engineer': return 'bg-cyan-500';
            case 'Coordinator': return 'bg-amber-500';
            case 'Subcontractor': return 'bg-slate-500';
            default: return 'bg-neutral-500';
        }
    };

    return (
        <header className="sticky top-0 w-full flex flex-wrap items-center justify-between gap-y-3 border-b border-neutral-200 dark:border-neutral-800 px-4 md:px-6 py-3 bg-white dark:bg-neutral-900 shrink-0 z-50">
            <div className="flex items-center gap-4 md:gap-8 flex-wrap">
                <Link
                    href="/dashboard"
                    className="flex items-center gap-3 text-neutral-900 dark:text-neutral-100 cursor-pointer"
                >
                    <span className="material-symbols-outlined text-primary text-2xl md:text-3xl" aria-hidden="true">track_changes</span>
                    <h2 className="text-lg md:text-xl font-bold tracking-tight">Buffer Track</h2>
                </Link>

                {showSearch && (
                    <label className="flex flex-col min-w-40 h-10! max-w-64 md:flex">
                        <div className="flex w-full flex-1 items-stretch rounded-md h-full">
                            <div className="text-neutral-500 flex border-none bg-neutral-100 dark:bg-neutral-800 items-center justify-center pl-4 rounded-l-md border-r-0">
                                <span className="material-symbols-outlined">search</span>
                            </div>
                            <input
                                className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-md text-neutral-900 dark:text-neutral-100 focus:outline-0 focus:ring-0 border-none bg-neutral-100 dark:bg-neutral-800 focus:border-none h-full placeholder:text-neutral-500 px-4 rounded-l-none border-l-0 pl-2 text-sm font-normal leading-normal"
                                placeholder="Search projects, buildings..."
                            />
                        </div>
                    </label>
                )}

                <span className="text-neutral-900 dark:text-neutral-100 font-semibold" aria-current="page">
                    {title}
                </span>

            </div>

            <div className="flex items-center gap-3 md:gap-4 flex-wrap">
                {showLinks && (
                    <nav className="flex items-center gap-6 md:flex mr-4">
                        {[
                            { label: "Dashboard", href: "/dashboard" },
                            { label: "Master Plan", href: "/" },
                            { label: "Commitments", href: "/commitments" },
                            ...(isManagerRole(session?.user?.role)
                                ? [{ label: "Manage Project", href: "/manage-project" }]
                                : [])
                        ].map((navItem) => {
                            const isActive = pathname === navItem.href;
                            return (
                                <Link
                                    key={navItem.href}
                                    href={navItem.href}
                                    className={`${isActive
                                        ? "text-primary border-b-2 border-primary pb-1 font-bold"
                                        : "text-neutral-600 dark:text-neutral-300 hover:text-primary transition-colors font-medium"
                                        } text-sm leading-normal`}
                                >
                                    {navItem.label}
                                </Link>
                            );
                        })}
                    </nav>
                )}

                <div className="relative">
                    <button
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                        className={`relative rounded-full size-9 md:size-10 border-2 border-neutral-200 dark:border-neutral-700 cursor-pointer focus:ring-2 focus:ring-primary focus:outline-none transition-all overflow-hidden flex items-center justify-center ${getRoleColor(session?.user?.role)}`}
                    >
                        <div className="absolute inset-0 w-full h-full flex items-center justify-center">
                            <Image
                                src="/assets/profile.svg"
                                alt={session?.user?.name || "User Profile"}
                                width={20}
                                height={20}
                                className="object-contain"
                            />
                        </div>
                    </button>

                    {isProfileOpen && (
                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-neutral-800 rounded-md shadow-lg border border-neutral-200 dark:border-neutral-700 py-1 z-50">
                            {session ? (
                                <>
                                    {hasActiveProject && (
                                        <>
                                            <button
                                                onClick={() => {
                                                    setIsProfileOpen(false);
                                                    router.push('/profile');
                                                }}
                                                className="w-full text-left px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors flex items-center gap-2"
                                            >
                                                <span className="material-symbols-outlined text-[18px]">person</span>
                                                Edit Profile
                                            </button>
                                            <div className="h-px w-full bg-neutral-200 dark:bg-neutral-700 my-1"></div>
                                        </>
                                    )}
                                    <button
                                        onClick={() => signOut({ callbackUrl: '/login' })}
                                        className="w-full text-left px-4 py-2 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors flex items-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">logout</span>
                                        Sign Out
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className="px-4 py-3 text-sm text-neutral-500 text-center font-medium">
                                        Not logged in
                                    </div>
                                    <div className="h-px w-full bg-neutral-200 dark:bg-neutral-700 my-1"></div>
                                    <Link
                                        href="/login"
                                        onClick={() => setIsProfileOpen(false)}
                                        className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 ${pathname === '/login'
                                            ? 'text-primary font-bold bg-primary/5 dark:bg-primary/10'
                                            : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 font-medium'
                                            }`}
                                    >
                                        <span className="material-symbols-outlined text-[18px]">login</span>
                                        Log In
                                    </Link>
                                    <Link
                                        href="/register"
                                        onClick={() => setIsProfileOpen(false)}
                                        className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 ${pathname === '/register'
                                            ? 'text-primary font-bold bg-primary/5 dark:bg-primary/10'
                                            : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 font-medium'
                                            }`}
                                    >
                                        <span className="material-symbols-outlined text-[18px]">person_add</span>
                                        Register
                                    </Link>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};
