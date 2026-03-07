"use client";

import React from "react";
import type { ICommitmentData } from "@/app/detail/[floorId]/DetailPlanView";

interface ICalendarBarProps {
    commitments: ICommitmentData[];
    weekStart: string;
    highlightedDay: string | null;
    onDayClick: (dateStr: string) => void;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getWeekDays(weekStartStr: string): Date[] {
    const start = new Date(weekStartStr);
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return d;
    });
}

function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export const CalendarBar = ({ commitments, weekStart, highlightedDay, onDayClick }: ICalendarBarProps) => {
    const currentWeekDays = getWeekDays(weekStart);
    const nextWeekStart = new Date(weekStart);
    nextWeekStart.setDate(nextWeekStart.getDate() + 7);
    const nextWeekDays = getWeekDays(nextWeekStart.toISOString());

    const today = new Date();
    const highlightDate = highlightedDay ? new Date(highlightedDay) : null;

    // Get dots (specialty colors) for a given day
    const getDotsForDay = (day: Date): string[] => {
        const colors = new Set<string>();
        commitments.forEach(c => {
            if (c.targetDate && isSameDay(new Date(c.targetDate), day)) {
                colors.add(c.specialtyColor);
            }
        });
        return Array.from(colors).slice(0, 4); // Max 4 dots
    };

    const renderWeek = (days: Date[], label: string, isNext: boolean) => (
        <div className={`flex flex-col h-full border border-neutral-200 dark:border-neutral-800 rounded-md overflow-hidden bg-neutral-50 dark:bg-neutral-800 ${isNext ? "opacity-70" : ""}`}>
            <div className="bg-neutral-100 dark:bg-neutral-700 px-3 py-1 border-b border-neutral-200 dark:border-neutral-800 text-xs font-semibold text-neutral-700 dark:text-neutral-300 text-center uppercase tracking-wider">
                {label}
            </div>
            <div className="grid grid-cols-7 h-full text-center divide-x divide-neutral-200 dark:divide-neutral-800">
                {days.map((day, i) => {
                    const isToday = isSameDay(day, today);
                    const isHighlighted = highlightDate && isSameDay(day, highlightDate);
                    const isWeekend = i >= 5;
                    const dots = getDotsForDay(day);

                    return (
                        <div
                            key={day.toISOString()}
                            onClick={() => onDayClick(day.toISOString())}
                            className={`p-1 flex flex-col items-center gap-1 cursor-pointer transition-all
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
                            {dots.length > 0 && (
                                <div className="flex gap-0.5 mt-auto">
                                    {dots.map((color, j) => (
                                        <span key={j} className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
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
            <div className="grid grid-cols-2 gap-4 h-24 min-w-[600px]">
                {renderWeek(currentWeekDays, "Current Week", false)}
                {renderWeek(nextWeekDays, "Next Week", true)}
            </div>
        </div>
    );
};
