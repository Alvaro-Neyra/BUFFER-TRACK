"use client";

import React from "react";
import { GlobalHeader } from "./GlobalHeader";

export const PendingAccessView = () => {
    return (
        <div className="flex flex-col h-full w-full bg-background-light dark:bg-background-dark">
            <GlobalHeader title="Access Pending" />
            <main className="flex-1 flex items-center justify-center p-6">
                <div className="max-w-md text-center bg-white dark:bg-neutral-900 p-8 pt-10 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800">
                    <div className="mx-auto size-16 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-500 rounded-full flex items-center justify-center mb-6">
                        <span className="material-symbols-outlined text-4xl">hourglass_empty</span>
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white mb-3">Cuenta Pendiente de Aprobación</h2>
                    <p className="text-neutral-500 dark:text-neutral-400 text-sm leading-relaxed mb-6">
                        Tu cuenta ha sido registrada exitosamente, pero aún está pendiente de aprobación por parte del equipo administrador del proyecto. Podrás visualizar todas las métricas, compromisos y planos en cuanto tu acceso sea activado.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="text-sm font-bold text-primary hover:text-primary/80 transition-colors flex items-center justify-center gap-2 mx-auto w-full py-2 bg-primary/5 rounded-lg"
                    >
                        <span className="material-symbols-outlined text-[18px]">refresh</span>
                        Actualizar estado
                    </button>
                </div>
            </main>
        </div>
    );
};
