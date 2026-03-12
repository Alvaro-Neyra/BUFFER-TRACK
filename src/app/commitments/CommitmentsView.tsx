"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import { AlertModal } from "@/components/organisms/AlertModal";
import { GlobalHeader } from "@/components/organisms/GlobalHeader";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { updateCommitmentTimeline } from "./actions";
import { formatDateOnlyUTC, toDateInputValue, toUtcMidnightIso } from "@/lib/dateOnly";

type TCommitmentsViewMode = "commitments" | "redlist";

interface ICommitmentViewItem {
    internalId: string;
    customId: string;
    taskName: string;
    location: string;
    specialtyName: string;
    specialtyColor: string;
    status: string;
    startDate: string | null;
    targetDate: string | null;
    startDateLabel: string;
    targetDateLabel: string;
    assignedTo: string;
}

interface IStatusOption {
    id: string;
    name: string;
    colorHex: string;
}

interface ITimelineUpdatePayload {
    startDate?: string | null;
    targetDate?: string | null;
    status?: string;
}

interface ICommitmentEditFormState {
    startDate: string;
    targetDate: string;
    status: string;
}

interface IRestrictionViewItem {
    id: string;
    description: string;
    commitmentInternalId: string;
    floorId: string;
    taskName: string;
    commitmentDescription: string;
    location: string;
    status: string;
    specialtyName: string;
    assignedTo: string;
    startDate: string;
    targetDate: string;
    reportedBy: string;
    solver: string;
    commitmentId: string;
}

interface CommitmentsViewProps {
    commitments: ICommitmentViewItem[];
    restrictions: IRestrictionViewItem[];
    statuses: IStatusOption[];
    projectsList: { id: string, name: string }[];
    currentProjectId: string;
    redListEnabled: boolean;
    isManager: boolean;
}

export function CommitmentsView({ commitments, restrictions, statuses, projectsList, currentProjectId, redListEnabled, isManager }: CommitmentsViewProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isUpdating, startUpdating] = useTransition();

    const [activeView, setActiveView] = useState<TCommitmentsViewMode>("commitments");
    const [commitmentSearchTerm, setCommitmentSearchTerm] = useState("");
    const [restrictionSearchTerm, setRestrictionSearchTerm] = useState("");
    const [selectedSpecialty, setSelectedSpecialty] = useState("all");
    const [selectedStatus, setSelectedStatus] = useState("all");
    const [selectedAssignee, setSelectedAssignee] = useState("all");
    const [filterStartDate, setFilterStartDate] = useState("");
    const [filterEndDate, setFilterEndDate] = useState("");
    const [alert, setAlert] = useState<{ isOpen: boolean; title: string; message: string; type: "error" | "success" } | null>(null);

    useEffect(() => {
        if (!redListEnabled && activeView === "redlist") {
            setActiveView("commitments");
        }
    }, [activeView, redListEnabled]);

    const isRedListView = redListEnabled && activeView === "redlist";

    const specialtyOptions = useMemo(() => {
        return Array.from(new Set(commitments.map((commitment) => commitment.specialtyName).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    }, [commitments]);

    const assigneeOptions = useMemo(() => {
        return Array.from(new Set(commitments.map((commitment) => commitment.assignedTo).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    }, [commitments]);

    const statusOptions = useMemo(() => {
        if (statuses.length > 0) {
            return statuses.map((status) => status.name);
        }

        return Array.from(new Set(commitments.map((commitment) => commitment.status).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    }, [commitments, statuses]);

    const resetCommitmentFilters = () => {
        setCommitmentSearchTerm("");
        setSelectedSpecialty("all");
        setSelectedStatus("all");
        setSelectedAssignee("all");
        setFilterStartDate("");
        setFilterEndDate("");
    };

    const handleProjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const params = new URLSearchParams(searchParams?.toString() || "");
        params.set('projectId', e.target.value);
        router.push(`${pathname}?${params.toString()}`);
    };

    const handleExportCSV = () => {
        if (isRedListView) {
            const headers = ["Description,Location,Reported By,Solver,Target Date,Commitment Custom ID"];
            const rows = getFilteredRestrictions().map(r =>
                `"${r.description}","${r.location}","${r.reportedBy}","${r.solver}","${r.targetDate}","${r.commitmentId}"`
            );
            downloadCSV(headers.concat(rows).join('\n'), 'redlist_export.csv');
        } else {
            const headers = ["Custom ID,Task,Location,Specialty,Status,Start Date,End Date,Assigned To"];
            const filteredCommits = getFilteredCommitments();
            const rows = filteredCommits.map(c =>
                `"${c.customId}","${c.taskName}","${c.location}","${c.specialtyName}","${c.status}","${formatDateOnlyUTC(c.startDate, { year: "2-digit", month: "2-digit", day: "2-digit" }, "TBD")}","${formatDateOnlyUTC(c.targetDate, { year: "2-digit", month: "2-digit", day: "2-digit" }, "TBD")}","${c.assignedTo}"`
            );
            downloadCSV(headers.concat(rows).join('\n'), 'commitments_export.csv');
        }
    };

    const downloadCSV = (content: string, filename: string) => {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getFilteredCommitments = () => {
        return commitments.filter(c => {
            const normalizedQuery = commitmentSearchTerm.trim().toLowerCase();
            const matchSearch = !normalizedQuery || [
                c.taskName,
                c.customId,
                c.location,
                c.specialtyName,
                c.assignedTo,
            ].some((value) => value.toLowerCase().includes(normalizedQuery));

            if (!matchSearch) return false;

            if (selectedSpecialty !== "all" && c.specialtyName !== selectedSpecialty) {
                return false;
            }

            if (selectedStatus !== "all" && c.status !== selectedStatus) {
                return false;
            }

            if (selectedAssignee !== "all" && c.assignedTo !== selectedAssignee) {
                return false;
            }

            const commitmentStartDate = toDateInputValue(c.startDate);
            const commitmentEndDate = toDateInputValue(c.targetDate);

            if (filterStartDate && (!commitmentStartDate || commitmentStartDate < filterStartDate)) {
                return false;
            }

            if (filterEndDate && (!commitmentEndDate || commitmentEndDate > filterEndDate)) {
                return false;
            }

            return true;
        });
    };

    const getFilteredRestrictions = () => {
        const normalizedQuery = restrictionSearchTerm.trim().toLowerCase();
        return restrictions.filter(r =>
            !normalizedQuery ||
            r.description.toLowerCase().includes(normalizedQuery) ||
            r.commitmentId.toLowerCase().includes(normalizedQuery)
        );
    };

    const handleUpdateTimeline = async (commitmentId: string, payload: ITimelineUpdatePayload) => {
        return new Promise<boolean>((resolve) => {
            startUpdating(async () => {
                const response = await updateCommitmentTimeline(commitmentId, payload, currentProjectId);
                if (!response.success) {
                    setAlert({
                        isOpen: true,
                        title: "Update failed",
                        message: response.error || "Could not update commitment timeline.",
                        type: "error",
                    });
                    resolve(false);
                    return;
                }

                router.refresh();
                resolve(true);
            });
        });
    };

    return (
        <div className="flex flex-col h-full w-full overflow-hidden bg-background-light dark:bg-background-dark">
            <GlobalHeader
                showSearch={true}
                showLinks={true}
            />

            <main className="flex-1 flex overflow-hidden">
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-6 md:p-8 pb-0 shrink-0">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
                            <div>
                                <h1 className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight leading-tight">Commitments Log</h1>
                                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                                    {redListEnabled
                                        ? "Manage all commitments and track The Red List."
                                        : "Manage all commitments for this project."
                                    }
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3">
                                <select
                                    value={currentProjectId}
                                    onChange={handleProjectChange}
                                    className="form-select text-sm rounded-md border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 shadow-sm pr-10 min-w-40"
                                >
                                    {projectsList.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>

                                <div className="relative flex-1 sm:w-72">
                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">search</span>
                                    <input
                                        type="text"
                                        placeholder={isRedListView
                                            ? "Search Red List by description or commitment ID..."
                                            : "Search commitments by task, ID, location, specialty or assignee..."
                                        }
                                        value={isRedListView ? restrictionSearchTerm : commitmentSearchTerm}
                                        onChange={(e) => {
                                            if (isRedListView) {
                                                setRestrictionSearchTerm(e.target.value);
                                                return;
                                            }

                                            setCommitmentSearchTerm(e.target.value);
                                        }}
                                        className="pl-9 pr-4 py-2 w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-md text-sm text-neutral-900 dark:text-neutral-100 focus:ring-primary focus:border-primary shadow-sm"
                                    />
                                </div>

                                {isManager && (
                                    <button
                                        onClick={handleExportCSV}
                                        className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 text-sm font-semibold rounded-md border border-neutral-300 dark:border-neutral-700 flex items-center justify-center transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[18px] mr-2">download</span>
                                        CSV
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-neutral-200 dark:border-neutral-800">
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setActiveView("commitments")}
                                    className={`pb-3 text-sm font-bold border-b-2 transition-colors cursor-pointer ${activeView === "commitments" ? "text-primary border-primary" : "text-neutral-500 border-transparent hover:text-neutral-700"}`}
                                >
                                    Commitments
                                </button>
                                {redListEnabled && (
                                    <button
                                        onClick={() => setActiveView("redlist")}
                                        className={`pb-3 text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center ${activeView === "redlist" ? "text-danger border-danger" : "text-neutral-500 border-transparent hover:text-neutral-700"}`}
                                    >
                                        <span className={`material-symbols-outlined text-[16px] mr-1 ${activeView === "redlist" ? "text-danger" : "text-neutral-400"}`}>warning</span>
                                        The Red List
                                    </button>
                                )}
                            </div>

                            {activeView === "commitments" && (
                                <button
                                    type="button"
                                    onClick={resetCommitmentFilters}
                                    className="mb-2 text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:text-primary transition-colors"
                                >
                                    Reset filters
                                </button>
                            )}
                        </div>

                        {activeView === "commitments" && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 py-4">
                                <select
                                    value={selectedSpecialty}
                                    onChange={(event) => setSelectedSpecialty(event.target.value)}
                                    className="form-select text-sm rounded-md border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200"
                                >
                                    <option value="all">All Specialties</option>
                                    {specialtyOptions.map((specialty) => (
                                        <option key={specialty} value={specialty}>{specialty}</option>
                                    ))}
                                </select>

                                <select
                                    value={selectedStatus}
                                    onChange={(event) => setSelectedStatus(event.target.value)}
                                    className="form-select text-sm rounded-md border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200"
                                >
                                    <option value="all">All Statuses</option>
                                    {statusOptions.map((statusName) => (
                                        <option key={statusName} value={statusName}>{statusName}</option>
                                    ))}
                                </select>

                                <select
                                    value={selectedAssignee}
                                    onChange={(event) => setSelectedAssignee(event.target.value)}
                                    className="form-select text-sm rounded-md border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200"
                                >
                                    <option value="all">All Assignees</option>
                                    {assigneeOptions.map((assignee) => (
                                        <option key={assignee} value={assignee}>{assignee}</option>
                                    ))}
                                </select>

                                <input
                                    type="date"
                                    value={filterStartDate}
                                    onChange={(event) => setFilterStartDate(event.target.value)}
                                    className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-neutral-900 dark:text-neutral-100 px-3 py-2"
                                    aria-label="Filter by start date"
                                />

                                <input
                                    type="date"
                                    value={filterEndDate}
                                    onChange={(event) => setFilterEndDate(event.target.value)}
                                    className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-neutral-900 dark:text-neutral-100 px-3 py-2"
                                    aria-label="Filter by end date"
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-auto p-6 md:p-8 pt-6">
                        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm overflow-hidden">
                            {isRedListView ? (
                                <RedListTable restrictions={getFilteredRestrictions()} />
                            ) : (
                                <CommitmentsTable
                                    commitments={getFilteredCommitments()}
                                    statuses={statuses}
                                    isUpdating={isUpdating}
                                    onUpdateTimeline={handleUpdateTimeline}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {alert && (
                <AlertModal
                    isOpen={alert.isOpen}
                    title={alert.title}
                    message={alert.message}
                    type={alert.type}
                    onClose={() => setAlert(null)}
                />
            )}
        </div>
    );
}

// Subcomponents for tables
function CommitmentsTable({
    commitments,
    statuses,
    isUpdating,
    onUpdateTimeline,
}: {
    commitments: CommitmentsViewProps["commitments"];
    statuses: IStatusOption[];
    isUpdating: boolean;
    onUpdateTimeline: (commitmentId: string, payload: ITimelineUpdatePayload) => Promise<boolean>;
}) {
    const [editingCommitment, setEditingCommitment] = useState<ICommitmentViewItem | null>(null);
    const [formState, setFormState] = useState<ICommitmentEditFormState>({
        startDate: "",
        targetDate: "",
        status: "",
    });
    const [formError, setFormError] = useState<string | null>(null);

    const getInputDate = (value: string | null) => {
        return toDateInputValue(value);
    };

    const openEditModal = (commitment: ICommitmentViewItem) => {
        setEditingCommitment(commitment);
        setFormState({
            startDate: getInputDate(commitment.startDate),
            targetDate: getInputDate(commitment.targetDate),
            status: commitment.status,
        });
        setFormError(null);
    };

    const closeEditModal = () => {
        setEditingCommitment(null);
        setFormState({ startDate: "", targetDate: "", status: "" });
        setFormError(null);
    };

    const saveChanges = async () => {
        if (!editingCommitment || !formState.status) return;

        if (formState.startDate && formState.targetDate && formState.targetDate < formState.startDate) {
            setFormError("End date cannot be before start date.");
            return;
        }

        setFormError(null);

        const success = await onUpdateTimeline(editingCommitment.internalId, {
            startDate: formState.startDate ? toUtcMidnightIso(formState.startDate) : null,
            targetDate: formState.targetDate ? toUtcMidnightIso(formState.targetDate) : null,
            status: formState.status,
        });

        if (success) {
            closeEditModal();
        }
    };

    const statusColorByName = new Map(statuses.map((status) => [status.name, status.colorHex]));

    if (commitments.length === 0) {
        return <div className="p-12 text-center text-neutral-500 text-sm">No commitments found matching criteria.</div>;
    }

    return (
        <>
            <div className="overflow-x-auto">
                <table className="w-full min-w-250 text-left text-sm text-neutral-600 dark:text-neutral-300">
                    <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-xs uppercase font-bold text-neutral-500 border-b border-neutral-200 dark:border-neutral-800">
                        <tr>
                            <th className="px-6 py-4">Task</th>
                            <th className="px-6 py-4">Location</th>
                            <th className="px-6 py-4">Specialty</th>
                            <th className="px-6 py-4">Assignee</th>
                            <th className="px-6 py-4">Start / End</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 font-medium">
                        {commitments.map((commitment) => (
                            <tr key={commitment.internalId} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors align-top">
                                <td className="px-6 py-4">
                                    <p className="text-neutral-900 dark:text-neutral-100 font-bold leading-tight">{commitment.taskName}</p>
                                    <p className="mt-1 text-[11px] text-neutral-400 font-mono">#{commitment.customId}</p>
                                </td>
                                <td className="px-6 py-4">{commitment.location}</td>
                                <td className="px-6 py-4">
                                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
                                        <span className="size-2.5 rounded-full" style={{ backgroundColor: commitment.specialtyColor }}></span>
                                        <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">{commitment.specialtyName}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-neutral-600 dark:text-neutral-400">{commitment.assignedTo}</td>
                                <td className="px-6 py-4 min-w-56">
                                    <div className="flex flex-col gap-1">
                                        <div className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-[11px]">
                                            <span className="font-bold text-neutral-500 uppercase">Start</span>
                                            <span className="font-semibold text-neutral-700 dark:text-neutral-200">{commitment.startDateLabel}</span>
                                        </div>
                                        <div className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-[11px]">
                                            <span className="font-bold text-neutral-500 uppercase">End</span>
                                            <span className="font-semibold text-neutral-700 dark:text-neutral-200">{commitment.targetDateLabel}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 min-w-44">
                                    <StatusBadge
                                        status={commitment.status}
                                        colorHex={statusColorByName.get(commitment.status) || "#94a3b8"}
                                    />
                                </td>
                                <td className="px-6 py-4 text-right whitespace-nowrap">
                                    <button
                                        type="button"
                                        onClick={() => openEditModal(commitment)}
                                        disabled={isUpdating}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
                                    >
                                        <span className="material-symbols-outlined text-[15px]">edit</span>
                                        Edit
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <EditCommitmentModal
                commitment={editingCommitment}
                statuses={statuses}
                formState={formState}
                formError={formError}
                isUpdating={isUpdating}
                onClose={closeEditModal}
                onSave={saveChanges}
                onFormChange={(nextState) => setFormState((prev) => ({ ...prev, ...nextState }))}
            />
        </>
    );
}

function EditCommitmentModal({
    commitment,
    statuses,
    formState,
    formError,
    isUpdating,
    onClose,
    onSave,
    onFormChange,
}: {
    commitment: ICommitmentViewItem | null;
    statuses: IStatusOption[];
    formState: ICommitmentEditFormState;
    formError: string | null;
    isUpdating: boolean;
    onClose: () => void;
    onSave: () => void;
    onFormChange: (nextState: Partial<ICommitmentEditFormState>) => void;
}) {
    if (!commitment) return null;

    const selectedStatusColor = statuses.find((status) => status.name === formState.status)?.colorHex || "#94a3b8";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <button
                type="button"
                aria-label="Close edit commitment modal"
                className="absolute inset-0 bg-neutral-950/60 backdrop-blur-[2px]"
                onClick={onClose}
            />

            <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 bg-linear-to-r from-primary/10 to-transparent px-6 py-5">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">Edit commitment</p>
                        <h3 className="mt-1 text-xl font-black text-neutral-900 dark:text-neutral-100 leading-tight">{commitment.taskName}</h3>
                        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Adjust timeline and progress without changing the table layout.</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex size-9 items-center justify-center rounded-full border border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="space-y-6 px-6 py-5">
                    <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/80 dark:bg-neutral-800/60 p-4">
                        <div className="flex flex-wrap items-center gap-3 text-xs">
                            <span className="inline-flex items-center gap-2 rounded-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1 font-semibold text-neutral-700 dark:text-neutral-200">
                                <span className="material-symbols-outlined text-[15px]">location_on</span>
                                {commitment.location}
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1 font-semibold text-neutral-700 dark:text-neutral-200">
                                <span className="size-2 rounded-full" style={{ backgroundColor: commitment.specialtyColor }}></span>
                                {commitment.specialtyName}
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1 font-semibold text-neutral-700 dark:text-neutral-200">
                                <span className="material-symbols-outlined text-[15px]">person</span>
                                {commitment.assignedTo}
                            </span>
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="space-y-1.5">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Start date</span>
                            <input
                                type="date"
                                value={formState.startDate}
                                onChange={(event) => onFormChange({ startDate: event.target.value })}
                                className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 focus:border-primary focus:ring-2 focus:ring-primary/30"
                            />
                        </label>

                        <label className="space-y-1.5">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">End date</span>
                            <input
                                type="date"
                                value={formState.targetDate}
                                onChange={(event) => onFormChange({ targetDate: event.target.value })}
                                className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 focus:border-primary focus:ring-2 focus:ring-primary/30"
                            />
                        </label>
                    </div>

                    <div className="space-y-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Progress status</span>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <select
                                value={formState.status}
                                onChange={(event) => onFormChange({ status: event.target.value })}
                                className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 focus:border-primary focus:ring-2 focus:ring-primary/30"
                            >
                                {(statuses.length > 0 ? statuses : [{ id: "fallback", name: commitment.status, colorHex: selectedStatusColor }]).map((status) => (
                                    <option key={status.id} value={status.name}>{status.name}</option>
                                ))}
                            </select>

                            <span
                                className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider w-fit"
                                style={{
                                    backgroundColor: `${selectedStatusColor}15`,
                                    borderColor: `${selectedStatusColor}33`,
                                    color: selectedStatusColor,
                                }}
                            >
                                <span className="size-1.5 rounded-full" style={{ backgroundColor: selectedStatusColor }}></span>
                                {formState.status || "Select status"}
                            </span>
                        </div>
                    </div>

                    {formError && (
                        <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50/80 dark:bg-rose-900/20 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
                            {formError}
                        </div>
                    )}
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/80 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isUpdating}
                        className="inline-flex items-center justify-center rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-2 text-sm font-bold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onSave}
                        disabled={isUpdating || !formState.status}
                        className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
                    >
                        {isUpdating ? "Saving..." : "Save changes"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function RedListTable({ restrictions }: { restrictions: CommitmentsViewProps['restrictions'] }) {
    const router = useRouter();
    const [selectedRestriction, setSelectedRestriction] = useState<IRestrictionViewItem | null>(null);

    const handleGoToPlan = (restriction: IRestrictionViewItem) => {
        if (!restriction.floorId || !restriction.commitmentInternalId) {
            return;
        }

        setSelectedRestriction(null);
        router.push(`/detail/${restriction.floorId}?commitmentId=${restriction.commitmentInternalId}`);
    };

    if (restrictions.length === 0) {
        return (
            <div className="py-12 flex flex-col items-center justify-center text-neutral-500">
                <span className="material-symbols-outlined text-4xl mb-2 text-emerald-500/50">check_circle</span>
                <p className="text-sm">There are no active constraints. The Red List is clean!</p>
            </div>
        );
    }

    return (
        <>
            <table className="w-full text-left text-sm text-neutral-600 dark:text-neutral-300">
                <thead className="bg-danger/5 dark:bg-danger/10 text-xs uppercase font-bold text-neutral-500 border-b border-danger/20">
                    <tr>
                        <th className="px-6 py-4">Description</th>
                        <th className="px-6 py-4">Location</th>
                        <th className="px-6 py-4">Reported By</th>
                        <th className="px-6 py-4">Solver</th>
                        <th className="px-6 py-4">Commitment</th>
                        <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 font-medium">
                    {restrictions.map(r => (
                        <tr key={r.id} className="hover:bg-rose-50/50 dark:hover:bg-rose-900/10 transition-colors group">
                            <td className="px-6 py-4 text-neutral-900 dark:text-neutral-100 font-bold max-w-sm" title={r.description}>
                                <div className="line-clamp-2">{r.description}</div>
                            </td>
                            <td className="px-6 py-4">{r.location}</td>
                            <td className="px-6 py-4 text-neutral-500">{r.reportedBy}</td>
                            <td className="px-6 py-4 text-neutral-800 dark:text-neutral-200 font-bold">{r.solver || 'Unassigned'}</td>
                            <td className="px-6 py-4 font-mono text-xs">{r.commitmentId || 'N/A'}</td>
                            <td className="px-6 py-4 text-right">
                                <button
                                    type="button"
                                    onClick={() => setSelectedRestriction(r)}
                                    className="text-secondary hover:text-primary transition-colors text-xs font-bold uppercase cursor-pointer"
                                >
                                    View
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <RedListCommitmentModal
                restriction={selectedRestriction}
                onClose={() => setSelectedRestriction(null)}
                onGoToPlan={handleGoToPlan}
            />
        </>
    );
}

function RedListCommitmentModal({
    restriction,
    onClose,
    onGoToPlan,
}: {
    restriction: IRestrictionViewItem | null;
    onClose: () => void;
    onGoToPlan: (restriction: IRestrictionViewItem) => void;
}) {
    if (!restriction) return null;

    const canGoToPlan = Boolean(restriction.floorId && restriction.commitmentInternalId);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <button
                type="button"
                aria-label="Close commitment details modal"
                className="absolute inset-0 bg-neutral-950/60 backdrop-blur-[2px]"
                onClick={onClose}
            />

            <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 bg-linear-to-r from-danger/10 to-transparent px-6 py-5">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-danger">Red List detail</p>
                        <h3 className="mt-1 text-xl font-black text-neutral-900 dark:text-neutral-100 leading-tight">{restriction.taskName || "Restricted commitment"}</h3>
                        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Commitment #{restriction.commitmentId} • {restriction.status}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex size-9 items-center justify-center rounded-full border border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="space-y-6 px-6 py-5 max-h-[70vh] overflow-y-auto">
                    <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/80 dark:bg-neutral-800/60 p-4">
                        <h4 className="text-[11px] font-black uppercase tracking-[0.14em] text-neutral-500 mb-3">Commitment information</h4>
                        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
                            <div>
                                <dt className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Custom ID</dt>
                                <dd className="mt-1 font-mono text-neutral-900 dark:text-neutral-100">{restriction.commitmentId || "N/A"}</dd>
                            </div>
                            <div>
                                <dt className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Status</dt>
                                <dd className="mt-1 text-neutral-900 dark:text-neutral-100">{restriction.status || "Unknown"}</dd>
                            </div>
                            <div>
                                <dt className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Specialty</dt>
                                <dd className="mt-1 text-neutral-900 dark:text-neutral-100">{restriction.specialtyName || "Unknown"}</dd>
                            </div>
                            <div>
                                <dt className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Assignee</dt>
                                <dd className="mt-1 text-neutral-900 dark:text-neutral-100">{restriction.assignedTo || "Unassigned"}</dd>
                            </div>
                            <div>
                                <dt className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Start date</dt>
                                <dd className="mt-1 text-neutral-900 dark:text-neutral-100">{restriction.startDate || "TBD"}</dd>
                            </div>
                            <div>
                                <dt className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Target date</dt>
                                <dd className="mt-1 text-neutral-900 dark:text-neutral-100">{restriction.targetDate || "TBD"}</dd>
                            </div>
                            <div className="sm:col-span-2">
                                <dt className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Location</dt>
                                <dd className="mt-1 text-neutral-900 dark:text-neutral-100">{restriction.location || "N/A"}</dd>
                            </div>
                            <div className="sm:col-span-2">
                                <dt className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Description</dt>
                                <dd className="mt-1 text-neutral-900 dark:text-neutral-100 whitespace-pre-wrap">{restriction.commitmentDescription || restriction.description || "No description"}</dd>
                            </div>
                        </dl>
                    </div>

                    <div className="rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/60 dark:bg-rose-900/10 p-4">
                        <h4 className="text-[11px] font-black uppercase tracking-[0.14em] text-rose-600 dark:text-rose-300 mb-3">Restriction details</h4>
                        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
                            <div className="sm:col-span-2">
                                <dt className="text-[11px] font-bold uppercase tracking-wider text-rose-700/70 dark:text-rose-200/70">Restriction</dt>
                                <dd className="mt-1 text-neutral-900 dark:text-neutral-100 whitespace-pre-wrap">{restriction.description || "No restriction description"}</dd>
                            </div>
                            <div>
                                <dt className="text-[11px] font-bold uppercase tracking-wider text-rose-700/70 dark:text-rose-200/70">Reported by</dt>
                                <dd className="mt-1 text-neutral-900 dark:text-neutral-100">{restriction.reportedBy || "Unknown"}</dd>
                            </div>
                            <div>
                                <dt className="text-[11px] font-bold uppercase tracking-wider text-rose-700/70 dark:text-rose-200/70">Solver</dt>
                                <dd className="mt-1 text-neutral-900 dark:text-neutral-100">{restriction.solver || "Unassigned"}</dd>
                            </div>
                        </dl>
                    </div>
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/80 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
                    <button
                        type="button"
                        onClick={() => onGoToPlan(restriction)}
                        disabled={!canGoToPlan}
                        className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Go to plan
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex items-center justify-center rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-2 text-sm font-bold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

function StatusBadge({ status, colorHex }: { status: string; colorHex: string }) {
    return (
        <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border whitespace-nowrap"
            style={{
                backgroundColor: `${colorHex}15`,
                borderColor: `${colorHex}33`,
                color: colorHex,
            }}
        >
            <span className="size-1.5 rounded-full" style={{ backgroundColor: colorHex }}></span>
            {status}
        </span>
    );
}
