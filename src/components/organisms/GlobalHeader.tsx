"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { isManagerRole } from "@/constants/roles";
import type { IGlobalSearchResultsDTO, TGlobalSearchResultDTO } from "@/types/models";

interface IGlobalHeaderProps {
    title?: string;
    showSearch?: boolean;
    showLinks?: boolean;
    onOpenBuildingFromSearch?: (buildingId: string) => void;
}

interface IGlobalSearchApiResponse {
    success: boolean;
    data?: IGlobalSearchResultsDTO;
    error?: string;
}

const EMPTY_SEARCH_RESULTS: IGlobalSearchResultsDTO = {
    buildings: [],
    activities: [],
};

export const GlobalHeader = ({
    title,
    showSearch = false,
    showLinks = false,
    onOpenBuildingFromSearch,
}: Readonly<IGlobalHeaderProps>) => {
    const pathname = usePathname();
    const router = useRouter();
    const { data: session } = useSession();

    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<IGlobalSearchResultsDTO>(EMPTY_SEARCH_RESULTS);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [activeResultIndex, setActiveResultIndex] = useState(-1);

    const searchContainerRef = useRef<HTMLDivElement | null>(null);

    const hasActiveProject = session?.user?.projects?.some(p => p.status === 'Active');
    const normalizedSearchQuery = searchQuery.trim();

    const flattenedResults = useMemo<TGlobalSearchResultDTO[]>(() => {
        return [...searchResults.buildings, ...searchResults.activities];
    }, [searchResults]);

    const getResultIndex = (target: TGlobalSearchResultDTO) => {
        return flattenedResults.findIndex((candidate) => candidate.kind === target.kind && candidate.id === target.id);
    };

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

    const closeSearchDropdown = () => {
        setIsSearchOpen(false);
        setActiveResultIndex(-1);
    };

    const handleSearchResultSelect = (result: TGlobalSearchResultDTO) => {
        setSearchQuery("");
        setSearchResults(EMPTY_SEARCH_RESULTS);
        setSearchError(null);
        closeSearchDropdown();

        if (result.kind === 'building') {
            if (pathname === '/' && onOpenBuildingFromSearch) {
                onOpenBuildingFromSearch(result.id);
                return;
            }

            router.push(`/?openBuildingId=${result.id}`);
            return;
        }

        router.push(`/detail/${result.floorId}?assignmentId=${result.id}`);
    };

    const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Escape') {
            closeSearchDropdown();
            return;
        }

        if (event.key === 'ArrowDown') {
            if (flattenedResults.length === 0) return;
            event.preventDefault();
            setIsSearchOpen(true);
            setActiveResultIndex((current) => {
                if (current < 0) return 0;
                return (current + 1) % flattenedResults.length;
            });
            return;
        }

        if (event.key === 'ArrowUp') {
            if (flattenedResults.length === 0) return;
            event.preventDefault();
            setIsSearchOpen(true);
            setActiveResultIndex((current) => {
                if (current < 0) return flattenedResults.length - 1;
                return (current - 1 + flattenedResults.length) % flattenedResults.length;
            });
            return;
        }

        if (event.key === 'Enter') {
            if (flattenedResults.length === 0) return;
            event.preventDefault();
            const selectedIndex = activeResultIndex >= 0 ? activeResultIndex : 0;
            const selected = flattenedResults[selectedIndex];
            if (selected) {
                handleSearchResultSelect(selected);
            }
        }
    };

    useEffect(() => {
        const handleOutsideClick = (event: MouseEvent) => {
            const node = searchContainerRef.current;
            if (!node) return;

            if (event.target instanceof Node && !node.contains(event.target)) {
                closeSearchDropdown();
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
        };
    }, []);

    useEffect(() => {
        if (!showSearch) {
            setSearchResults(EMPTY_SEARCH_RESULTS);
            setIsSearching(false);
            setSearchError(null);
            return;
        }

        if (!hasActiveProject) {
            setSearchResults(EMPTY_SEARCH_RESULTS);
            setIsSearching(false);
            setSearchError(null);
            return;
        }

        if (normalizedSearchQuery.length < 2) {
            setSearchResults(EMPTY_SEARCH_RESULTS);
            setIsSearching(false);
            setSearchError(null);
            setActiveResultIndex(-1);
            return;
        }

        const controller = new AbortController();
        const timeoutId = window.setTimeout(async () => {
            setIsSearching(true);
            setSearchError(null);

            try {
                const response = await fetch(`/api/search?q=${encodeURIComponent(normalizedSearchQuery)}&limit=8`, {
                    method: 'GET',
                    cache: 'no-store',
                    signal: controller.signal,
                });

                const payload = await response.json() as IGlobalSearchApiResponse;
                if (!response.ok || !payload.success || !payload.data) {
                    throw new Error(payload.error || 'Search request failed');
                }

                setSearchResults(payload.data);
                setIsSearchOpen(true);
                setActiveResultIndex(-1);
            } catch (error) {
                if (controller.signal.aborted) return;
                console.error('Global search failed:', error);
                setSearchResults(EMPTY_SEARCH_RESULTS);
                setSearchError(error instanceof Error ? error.message : 'Search request failed');
                setIsSearchOpen(true);
                setActiveResultIndex(-1);
            } finally {
                if (!controller.signal.aborted) {
                    setIsSearching(false);
                }
            }
        }, 260);

        return () => {
            controller.abort();
            window.clearTimeout(timeoutId);
        };
    }, [hasActiveProject, normalizedSearchQuery, showSearch]);

    const showQueryHint = normalizedSearchQuery.length > 0 && normalizedSearchQuery.length < 2;
    const showEmptyState = normalizedSearchQuery.length >= 2
        && !isSearching
        && !searchError
        && flattenedResults.length === 0;

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
                    <div className="relative min-w-40 w-full max-w-80 md:w-auto" ref={searchContainerRef}>
                        <label className="flex flex-col h-10">
                            <div className="flex w-full flex-1 items-stretch rounded-md h-full">
                                <div className="text-neutral-500 flex border-none bg-neutral-100 dark:bg-neutral-800 items-center justify-center pl-4 rounded-l-md border-r-0">
                                    <span className="material-symbols-outlined">search</span>
                                </div>
                                <input
                                    value={searchQuery}
                                    onChange={(event) => {
                                        const nextQuery = event.target.value;
                                        setSearchQuery(nextQuery);
                                        setIsSearchOpen(Boolean(nextQuery.trim()));
                                        setActiveResultIndex(-1);
                                    }}
                                    onFocus={() => {
                                        if (normalizedSearchQuery.length > 0) {
                                            setIsSearchOpen(true);
                                        }
                                    }}
                                    onKeyDown={handleSearchKeyDown}
                                    disabled={!hasActiveProject}
                                    aria-expanded={isSearchOpen}
                                    aria-controls="global-header-search-results"
                                    aria-autocomplete="list"
                                    role="combobox"
                                    className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-md text-neutral-900 dark:text-neutral-100 focus:outline-0 focus:ring-0 border-none bg-neutral-100 dark:bg-neutral-800 focus:border-none h-full placeholder:text-neutral-500 px-4 rounded-l-none border-l-0 pl-2 text-sm font-normal leading-normal disabled:cursor-not-allowed disabled:opacity-70"
                                    placeholder={hasActiveProject
                                        ? "Search buildings and activities in active project..."
                                        : "Search available only with an active project"
                                    }
                                />
                            </div>
                        </label>

                        {isSearchOpen && (
                            <div
                                id="global-header-search-results"
                                className="absolute left-0 right-0 mt-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-xl overflow-hidden z-50"
                            >
                                {isSearching && (
                                    <div className="px-4 py-3 text-sm text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
                                        <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                                        Searching active project...
                                    </div>
                                )}

                                {!isSearching && searchError && (
                                    <div className="px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
                                        {searchError}
                                    </div>
                                )}

                                {!isSearching && !searchError && showQueryHint && (
                                    <div className="px-4 py-3 text-sm text-neutral-500 dark:text-neutral-400">
                                        Type at least 2 characters to search.
                                    </div>
                                )}

                                {!isSearching && !searchError && showEmptyState && (
                                    <div className="px-4 py-3 text-sm text-neutral-500 dark:text-neutral-400">
                                        No buildings or activities found in your active project.
                                    </div>
                                )}

                                {!isSearching && !searchError && searchResults.buildings.length > 0 && (
                                    <div className="py-1 border-b border-neutral-200 dark:border-neutral-800">
                                        <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                                            Buildings
                                        </p>
                                        {searchResults.buildings.map((building) => {
                                            const resultIndex = getResultIndex(building);
                                            const isActive = resultIndex === activeResultIndex;

                                            return (
                                                <button
                                                    key={building.id}
                                                    type="button"
                                                    onMouseEnter={() => setActiveResultIndex(resultIndex)}
                                                    onClick={() => handleSearchResultSelect(building)}
                                                    className={`w-full px-4 py-2 text-left transition-colors ${isActive
                                                        ? 'bg-primary/10 text-primary'
                                                        : 'text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                                                        }`}
                                                >
                                                    <p className="text-sm font-semibold leading-tight">{building.name}</p>
                                                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{building.code}</p>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {!isSearching && !searchError && searchResults.activities.length > 0 && (
                                    <div className="py-1">
                                        <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                                            Activities
                                        </p>
                                        {searchResults.activities.map((activity) => {
                                            const resultIndex = getResultIndex(activity);
                                            const isActive = resultIndex === activeResultIndex;

                                            return (
                                                <button
                                                    key={activity.id}
                                                    type="button"
                                                    onMouseEnter={() => setActiveResultIndex(resultIndex)}
                                                    onClick={() => handleSearchResultSelect(activity)}
                                                    className={`w-full px-4 py-2 text-left transition-colors ${isActive
                                                        ? 'bg-primary/10 text-primary'
                                                        : 'text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                                                        }`}
                                                >
                                                    <p className="text-sm font-semibold leading-tight">{activity.name}</p>
                                                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                                                        {activity.buildingCode} · {activity.floorLabel}
                                                    </p>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
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
                            { label: "Assignments", href: "/assignments" },
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
                                    <Link
                                        href="/profile"
                                        onClick={() => setIsProfileOpen(false)}
                                        className="w-full text-left px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors flex items-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">person</span>
                                        Edit Profile
                                    </Link>
                                    <div className="h-px w-full bg-neutral-200 dark:bg-neutral-700 my-1"></div>
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
