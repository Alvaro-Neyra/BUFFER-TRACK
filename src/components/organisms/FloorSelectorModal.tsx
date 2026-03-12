"use client";

import React from "react";
import Link from "next/link";

interface IFloorOption {
    _id: string;
    label: string;
    order: number;
}

interface IFloorSelectorModalProps {
    buildingName: string;
    buildingCode: string;
    floors: IFloorOption[];
    onClose: () => void;
}

export const FloorSelectorModal = ({
    buildingName,
    buildingCode,
    floors,
    onClose,
}: Readonly<IFloorSelectorModalProps>) => {
    const sortedFloors = [...floors].sort((a, b) => a.order - b.order);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl max-w-sm w-full overflow-hidden border border-neutral-200 dark:border-neutral-800" onClick={(e) => e.stopPropagation()}>
                <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center bg-neutral-50 dark:bg-neutral-800/50">
                    <div>
                        <h2 className="text-lg font-bold text-neutral-900 dark:text-white">{buildingName}</h2>
                        <p className="text-xs text-neutral-500">{buildingCode} · Select a floor</p>
                    </div>
                    <button onClick={onClose} className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="p-4 max-h-[60vh] overflow-y-auto">
                    {sortedFloors.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-neutral-500">
                            <span className="material-symbols-outlined text-3xl mb-2 text-neutral-300">layers</span>
                            <p className="text-sm font-medium">No floors available</p>
                            <p className="text-xs mt-1 text-neutral-400">Floors need to be added in Manage Project</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {sortedFloors.map((floor) => (
                                <Link
                                    key={floor._id}
                                    href={`/detail/${floor._id}`}
                                    className="w-full flex items-center gap-3 px-4 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-primary/5 hover:border-primary/30 dark:hover:bg-primary/10 transition-all group"
                                >
                                    <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                                        <span className="material-symbols-outlined text-[18px]">layers</span>
                                    </div>
                                    <div className="text-left">
                                        <p className="text-sm font-semibold text-neutral-900 dark:text-white">{floor.label}</p>
                                        <p className="text-xs text-neutral-500">Level {floor.order}</p>
                                    </div>
                                    <span className="material-symbols-outlined text-neutral-400 ml-auto">chevron_right</span>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
