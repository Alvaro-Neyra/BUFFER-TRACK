"use client";

import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

interface IHotspotProps {
    xPercent: number;
    yPercent: number;
    buildingId: string;
    color?: string;
    onClick?: () => void;
}

export function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

export const MasterPlanHotspot = ({ xPercent, yPercent, buildingId, color = "bg-primary", onClick }: Readonly<IHotspotProps>) => {
    return (
        <div
            className="absolute group cursor-pointer"
            style={{ top: `${yPercent}%`, left: `${xPercent}%` }}
            onClick={(e) => { e.stopPropagation(); onClick?.(); }}
        >
            <div className={cn("absolute inset-0 rounded-full animate-pulse opacity-20 scale-150", color)}></div>
            <div className={cn(
                "relative w-4 h-4 rounded-full shadow-lg border-2 border-white dark:border-neutral-800 hover:scale-125 transition-transform z-20",
                color
            )}>
            </div>
            {/* Tooltip */}
            <div className="absolute left-1/2 -translate-x-1/2 -top-8 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
                <div className="bg-neutral-900 text-white text-[10px] font-bold px-2 py-1 rounded whitespace-nowrap shadow-lg">
                    {buildingId}
                </div>
            </div>
        </div>
    );
};
