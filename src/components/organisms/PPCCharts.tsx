"use client";

import React from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from "recharts";

interface PPCChartProps {
    data: { name: string; ppc: number; color?: string; total?: number; completed?: number }[];
    title: string;
    description: string;
    isMobile?: boolean;
}

export function PPCBarChart({ data, title, description, isMobile }: PPCChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 shadow-sm flex flex-col h-[400px]">
                <div>
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">{title}</h3>
                    <p className="text-xs text-neutral-500 mt-1">{description}</p>
                </div>
                <div className="flex-1 flex items-center justify-center text-neutral-500 text-sm">
                    No data available
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 shadow-sm flex flex-col h-[400px]">
            <div className="mb-6">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">{title}</h3>
                <p className="text-xs text-neutral-500 mt-1">{description}</p>
            </div>
            <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={data}
                        layout="vertical"
                        margin={{ top: 0, right: 30, left: isMobile ? 0 : 40, bottom: 0 }}
                        barSize={24}
                    >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" className="dark:stroke-neutral-800" />
                        <XAxis
                            type="number"
                            domain={[0, 100]}
                            tickCount={6}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#888888', fontSize: 12 }}
                            tickFormatter={(value) => `${value}%`}
                        />
                        <YAxis
                            dataKey="name"
                            type="category"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#888888', fontSize: 12 }}
                            width={100}
                        />
                        <Tooltip
                            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    const item = payload[0].payload;
                                    return (
                                        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-3 shadow-lg rounded-lg">
                                            <p className="font-bold text-sm text-neutral-900 dark:text-white mb-1">{item.name}</p>
                                            <p className="text-xs text-neutral-600 dark:text-neutral-400">PPC: <span className="font-bold text-neutral-900 dark:text-white">{item.ppc}%</span></p>
                                            {item.total !== undefined && (
                                                <p className="text-xs text-neutral-500 mt-1">Completed: {item.completed} / {item.total}</p>
                                            )}
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Bar
                            dataKey="ppc"
                            radius={[0, 4, 4, 0]}
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            label={{ position: 'right', formatter: (val: any) => `${val}%`, fill: '#6b7280', fontSize: 12, fontWeight: 600 }}
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color || "var(--primary)"} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
