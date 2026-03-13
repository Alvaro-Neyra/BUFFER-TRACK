"use client";

import React from "react";
import { cn } from "./MasterPlanHotspot";

interface ICommitmentPinProps {
    xPercent: number;
    yPercent: number;
    onClick: () => void;
    status: string;
    specialtyColor?: string; // hex color from specialty
    isHighlighted?: boolean; // calendar→plan sync
    icon?: string;
    bgColor?: string; // fallback TW class
}

const STATUS_RING: Record<string, string> = {
    "In Progress": "ring-amber-400/40",
    Completed: "ring-emerald-400/40",
    Delayed: "ring-rose-400/40",
};

export const CommitmentPin = ({
    xPercent,
    yPercent,
    onClick,
    status,
    specialtyColor,
    isHighlighted = false,
    icon = "location_on",
    bgColor = "bg-primary",
}: Readonly<ICommitmentPinProps>) => {

    const getStatusIndicator = () => {
        switch (status) {
            case 'In Progress': return <span className="absolute -top-1 -right-1 size-3.5 bg-amber-400 rounded-full border-2 border-white dark:border-neutral-900" />;
            case 'Completed': return <span className="absolute -top-1 -right-1 size-3.5 bg-emerald-500 rounded-full border-2 border-white dark:border-neutral-900" />;
            case 'Delayed': return <span className="absolute -top-1 -right-1 size-3.5 bg-rose-500 rounded-full border-2 border-white dark:border-neutral-900" />;
            default: return null;
        }
    };

    const ringClass = STATUS_RING[status] || "ring-transparent";

    return (
        <button
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            data-plan-pin="true"
            className={cn(
                "absolute size-10 rounded-full shadow-xl flex items-center justify-center text-white border-2 border-white dark:border-neutral-900 z-10 transition-all",
                isHighlighted ? "scale-150 ring-4 ring-primary/50" : "scale-110 ring-4 hover:scale-125",
                !isHighlighted && ringClass,
                !specialtyColor && bgColor,
            )}
            style={{
                top: `${yPercent}%`,
                left: `${xPercent}%`,
                transform: `translate(-50%, -50%) scale(${isHighlighted ? 1.5 : 1.1})`,
                ...(specialtyColor ? { backgroundColor: specialtyColor } : {}),
            }}
        >
            <span className="material-symbols-outlined text-base">{icon}</span>
            {getStatusIndicator()}
        </button>
    );
};
