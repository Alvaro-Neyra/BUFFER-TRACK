"use client";

import React from "react";
import type { ICommitmentData } from "@/app/detail/[floorId]/DetailPlanView";
import { fromLocalDateKey, toLocalDateKey, toUtcDateKey } from "@/lib/dateOnly";

interface ICalendarBarProps {
    commitments: ICommitmentData[];
    highlightedDayKey: string | null;
    onDayClick: (dayKey: string) => void;
    onCommitmentClick?: (commitment: ICommitmentData) => void;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getWeekDayKeys(weekStart: Date): string[] {
    return Array.from({ length: 7 }, (_, i) => {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        return toLocalDateKey(date);
    });
}

function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export const CalendarBar = ({ commitments, highlightedDayKey, onDayClick, onCommitmentClick }: ICalendarBarProps) => {
    // Dynamically calculate the current week's Monday
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(diff);
    currentWeekStart.setHours(0, 0, 0, 0);

    const currentWeekDays = getWeekDayKeys(currentWeekStart);
    const nextWeekStart = new Date(currentWeekStart);
    nextWeekStart.setDate(nextWeekStart.getDate() + 7);
    const nextWeekDays = getWeekDayKeys(nextWeekStart);

    const getActivitiesForDay = (dayKey: string): ICommitmentData[] => {
        return commitments.filter(c => {
            return toUtcDateKey(c.targetDate) === dayKey;
        }).slice(0, 4); // Max 4 dots
    };

    const renderWeek = (days: string[], label: string, isNext: boolean) => (
        <div className={`flex flex-col h-full border border-neutral-200 dark:border-neutral-800 rounded-md overflow-hidden bg-neutral-50 dark:bg-neutral-800 ${isNext ? "opacity-70" : ""}`}>
            <div className="bg-neutral-100 dark:bg-neutral-700 px-3 py-1 border-b border-neutral-200 dark:border-neutral-800 text-xs font-semibold text-neutral-700 dark:text-neutral-300 text-center uppercase tracking-wider">
                {label}
            </div>
            <div className="grid grid-cols-7 h-full text-center divide-x divide-neutral-200 dark:divide-neutral-800">
                {days.map((dayKey, i) => {
                    const day = fromLocalDateKey(dayKey);
                    const isToday = isSameDay(day, today);
                    const isHighlighted = highlightedDayKey === dayKey;
                    const isWeekend = i >= 5;
                    const activities = getActivitiesForDay(dayKey);

                    return (
                        <div
                            key={dayKey}
                            onClick={() => onDayClick(dayKey)}
                            className={`p-1 flex flex-col items-center gap-1 cursor-pointer transition-all relative
                                ${isHighlighted ? "bg-primary/10 ring-2 ring-primary ring-inset" : ""}
                                ${isToday && !isHighlighted ? "bg-primary/5 border-b-2 border-primary" : ""}
                                ${isWeekend && !isHighlighted ? "bg-neutral-100/50 dark:bg-neutral-800/50" : ""}
                                hover:bg-neutral-100 dark:hover:bg-neutral-700/50
                            `}
                        >
                            <span className={`text-[10px] font-medium ${isWeekend ? "text-neutral-400" : "text-neutral-500"}`}>
                                {DAY_LABELS[i]}
                            </span>
                            <span className={`text-xs ${isToday ? "font-bold text-primary" : isWeekend ? "font-semibold text-neutral-400" : "font-semibold text-neutral-700 dark:text-neutral-300"}`}>
                                {day.getDate()}
                            </span>
                            {activities.length > 0 && (
                                <div className="flex gap-0.5 mt-auto pb-0.5">
                                    {activities.map((activity, j) => (
                                        <div
                                            key={`${activity._id}-${j}`}
                                            className="size-2 rounded-full hover:scale-150 transition-transform cursor-pointer border border-black/10 shadow-sm"
                                            style={{ backgroundColor: activity.specialtyColor || "#8B5CF6" }}
                                            title={activity.name || activity.description || "Activity"}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (onCommitmentClick) {
                                                    onCommitmentClick(activity);
                                                } else {
                                                    onDayClick(dayKey);
                                                }
                                            }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 p-4 shrink-0 shadow-sm z-10 w-full overflow-x-auto">
            <div className="grid grid-cols-2 gap-4 h-24 min-w-150">
                {renderWeek(currentWeekDays, "Current Week", false)}
                {renderWeek(nextWeekDays, "Next Week", true)}
            </div>
        </div>
    );
};
