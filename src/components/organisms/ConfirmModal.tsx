"use client";

import React from "react";

interface IConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
    isDanger?: boolean;
}

export const ConfirmModal = ({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    isDanger = false,
}: IConfirmModalProps) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-neutral-200 dark:border-neutral-800 animate-in zoom-in-95 duration-200">
                <div className="p-6 text-center">
                    <div className={`w-16 h-16 rounded-full ${isDanger ? 'bg-red-100 dark:bg-red-900/30 text-red-600' : 'bg-primary/10 text-primary'} mx-auto mb-4 flex items-center justify-center`}>
                        <span className="material-symbols-outlined text-3xl">
                            {isDanger ? 'warning' : 'help'}
                        </span>
                    </div>
                    <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">{title}</h2>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                        {message}
                    </p>
                </div>

                <div className="px-6 py-4 bg-neutral-50 dark:bg-neutral-800/50 flex flex-col sm:flex-row gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 px-4 py-2.5 text-sm font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-xl transition-all active:scale-95"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`flex-1 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/20 rounded-xl transition-all active:scale-95 ${
                            isDanger 
                            ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20' 
                            : 'bg-primary hover:bg-primary/90'
                        }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};
