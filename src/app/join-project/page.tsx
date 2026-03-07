"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { GlobalHeader } from "@/components/organisms/GlobalHeader";

export default function JoinProjectPage() {
    const router = useRouter();
    const [connectionCode, setConnectionCode] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        // Add actual API join call here later
        setTimeout(() => {
            setIsLoading(false);
            router.push("/dashboard");
        }, 1000);
    };

    return (
        <div className="min-h-screen flex flex-col bg-background-light dark:bg-background-dark">
            <GlobalHeader />
            <main className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
                <div className="max-w-md w-full bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
                    <div className="p-8">
                        <div className="flex items-center justify-center gap-3 mb-8">
                            <span className="material-symbols-outlined text-primary text-4xl">domain_add</span>
                            <h1 className="text-3xl font-black tracking-tight text-neutral-900 dark:text-white">Join a Project</h1>
                        </div>

                        <div className="text-center mb-8">
                            <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">Connection Code Required</h2>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400">
                                Enter the unique connection code provided by your project administrator.
                                Format should be similar to <strong className="text-neutral-700 dark:text-neutral-300">Name-[1234567]</strong>
                            </p>
                        </div>

                        <form onSubmit={handleJoin} className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide text-neutral-600 dark:text-neutral-400 mb-2">Project Connection Code</label>
                                <input
                                    type="text"
                                    value={connectionCode}
                                    onChange={(e) => setConnectionCode(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all font-mono text-center tracking-wider text-lg"
                                    placeholder="PROJECT-[XXXXXXX]"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading || connectionCode.trim() === ""}
                                className="w-full py-3 px-4 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg shadow-md transition-transform active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <span className="material-symbols-outlined max-w-fit w-auto animate-spin">progress_activity</span>
                                ) : null}
                                <span>Request Access</span>
                            </button>
                        </form>

                        <div className="mt-8 pt-6 border-t border-neutral-200 dark:border-neutral-800 text-center">
                            <button
                                onClick={() => router.push("/login")}
                                className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
                            >
                                Return to Login
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
