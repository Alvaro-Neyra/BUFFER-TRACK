"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { GlobalHeader } from "@/components/organisms/GlobalHeader";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            const res = await signIn("credentials", {
                email,
                password,
                redirect: false,
            });

            if (res?.error) {
                setError("Invalid email or password");
                setIsLoading(false);
            } else {
                router.push("/dashboard");
                router.refresh();
            }
        } catch {
            setError("Something went wrong");
            setIsLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-background-light dark:bg-background-dark">
            <GlobalHeader title="Login" />
            <main className="flex-1 flex flex-col items-center justify-start p-6 overflow-y-auto">
                <div className="max-w-md w-full my-auto shrink-0 bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
                    <div className="p-8">
                        <div className="flex items-center justify-center gap-3 mb-8">
                            <span className="material-symbols-outlined text-primary text-4xl">track_changes</span>
                            <h1 className="text-3xl font-black tracking-tight text-neutral-900 dark:text-white">BufferTrack</h1>
                        </div>

                        <div className="text-center mb-8">
                            <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">Welcome back</h2>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400">Sign in to manage your construction projects.</p>
                        </div>

                        <form onSubmit={handleLogin} className="space-y-5">
                            {error && (
                                <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-600 text-sm font-medium text-center">
                                    {error}
                                </div>
                            )}

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
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-xs font-bold uppercase tracking-wide text-neutral-600 dark:text-neutral-400">Password</label>
                                    <Link href="#" className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors">Forgot password?</Link>
                                </div>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>

                            <div className="flex items-center gap-2 py-2">
                                <input type="checkbox" id="remember" className="rounded text-primary focus:ring-primary size-4 border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800" />
                                <label htmlFor="remember" className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Keep me signed in</label>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-3 px-4 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg shadow-md transition-transform active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <span className="material-symbols-outlined max-w-fit w-auto animate-spin">progress_activity</span>
                                ) : null}
                                <span>Sign In</span>
                            </button>
                        </form>

                        <div className="mt-8 text-center">
                            <p className="text-sm text-neutral-500 dark:text-neutral-400">
                                Don&apos;t have an account? <Link href="/register" className="text-primary font-bold hover:underline">Request access</Link>
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
