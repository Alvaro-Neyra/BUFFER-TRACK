import { mockKPIs } from "@/data/mockData";

export const ProjectKPIs = () => {
    return (
        <div className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-6 py-2 flex items-center justify-between shadow-sm z-40 relative shrink-0">
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-3 pr-6 border-r border-neutral-200 dark:border-neutral-700 shrink-0">
                    <span className="w-1 h-8 rounded-full bg-primary block"></span>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Global PPC</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-lg font-black text-neutral-900 dark:text-white leading-none">{mockKPIs.globalPPC.value}</span>
                            <span className="text-emerald-600 dark:text-emerald-400 text-[10px] font-bold flex items-center bg-emerald-50 dark:bg-emerald-900/30 px-1 py-0.5 rounded leading-none">
                                <span className="material-symbols-outlined text-[10px] mr-0.5">{mockKPIs.globalPPC.isUp ? 'arrow_upward' : 'arrow_downward'}</span> {mockKPIs.globalPPC.trend}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 pr-6 border-r border-neutral-200 dark:border-neutral-700 shrink-0">
                    <span className="w-1 h-8 rounded-full bg-danger block"></span>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Active Restrictions</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-lg font-black text-neutral-900 dark:text-white leading-none">{mockKPIs.activeRestrictions.value}</span>
                            <span className="text-emerald-600 dark:text-emerald-400 text-[10px] font-bold flex items-center bg-emerald-50 dark:bg-emerald-900/30 px-1 py-0.5 rounded leading-none">
                                <span className="material-symbols-outlined text-[10px] mr-0.5">{mockKPIs.activeRestrictions.isUp ? 'arrow_upward' : 'arrow_downward'}</span> {mockKPIs.activeRestrictions.trend}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    <span className="w-1 h-8 rounded-full bg-warning block"></span>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Total Pending Tasks</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-lg font-black text-neutral-900 dark:text-white leading-none">{mockKPIs.totalPendingTasks.value}</span>
                            <span className="text-emerald-600 dark:text-emerald-400 text-[10px] font-bold flex items-center bg-emerald-50 dark:bg-emerald-900/30 px-1 py-0.5 rounded leading-none">
                                <span className="material-symbols-outlined text-[10px] mr-0.5">{mockKPIs.totalPendingTasks.isUp ? 'arrow_upward' : 'arrow_downward'}</span> {mockKPIs.totalPendingTasks.trend}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 hidden lg:flex">
                <span>Projects</span>
                <span className="material-symbols-outlined text-sm">chevron_right</span>
                <span className="font-medium text-neutral-700 dark:text-neutral-300">{mockKPIs.projectName}</span>
            </div>
        </div>
    );
};
