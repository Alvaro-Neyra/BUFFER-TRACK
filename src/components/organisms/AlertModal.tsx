"use client";

import React from "react";

interface IAlertModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    onClose: () => void;
    type?: 'success' | 'error' | 'info' | 'warning';
}

export const AlertModal = ({
    isOpen,
    title,
    message,
    onClose,
    type = 'info',
}: IAlertModalProps) => {
    if (!isOpen) return null;

    const config = {
        success: {
            icon: 'check_circle',
            color: 'text-green-600 bg-green-100 dark:bg-green-900/30',
            button: 'bg-green-600 hover:bg-green-700 shadow-green-500/20'
        },
        error: {
            icon: 'error',
            color: 'text-red-600 bg-red-100 dark:bg-red-900/30',
            button: 'bg-red-600 hover:bg-red-700 shadow-red-500/20'
        },
        warning: {
            icon: 'warning',
            color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30',
            button: 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20'
        },
        info: {
            icon: 'info',
            color: 'text-primary bg-primary/10',
            button: 'bg-primary hover:bg-primary/90 shadow-primary/20'
        }
    };

    const current = config[type];

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-neutral-200 dark:border-neutral-800 animate-in zoom-in-95 duration-200">
                <div className="p-8 text-center">
                    <div className={`w-16 h-16 rounded-full ${current.color} mx-auto mb-6 flex items-center justify-center`}>
                        <span className="material-symbols-outlined text-3xl font-bold">
                            {current.icon}
                        </span>
                    </div>
                    <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">{title}</h2>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                        {message}
                    </p>
                </div>

                <div className="px-6 py-4 bg-neutral-50 dark:bg-neutral-800/50 flex flex-col">
                    <button
                        onClick={onClose}
                        className={`w-full px-4 py-3 text-sm font-bold text-white shadow-lg rounded-xl transition-all active:scale-95 ${current.button}`}
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
};
