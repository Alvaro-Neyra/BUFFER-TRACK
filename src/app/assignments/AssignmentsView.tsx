"use client";

import React, { useMemo, useState, useTransition } from "react";
import { AlertModal } from "@/components/organisms/AlertModal";
import { GlobalHeader } from "@/components/organisms/GlobalHeader";
import { useRouter } from "next/navigation";
import { updateAssignmentTimeline } from "./actions";
import { formatDateOnlyUTC, toDateInputValue, toUtcMidnightIso } from "@/lib/dateOnly";

interface IAssignmentViewItem {
    internalId: string;
    taskName: string;
    location: string;
    specialtyName: string;
    specialtyColor: string;
    status: string;
    requiredDate: string | null;
    requiredDateLabel: string;
}

interface IStatusOption {
    id: string;
    name: string;
    colorHex: string;
}

interface ITimelineUpdatePayload {
    requiredDate?: string | null;
    status?: string;
}

interface IAssignmentEditFormState {
    requiredDate: string;
    status: string;
}

interface AssignmentsViewProps {
    assignments: IAssignmentViewItem[];
    statuses: IStatusOption[];
    projectsList: { id: string; name: string }[];
    currentProjectId: string;
    isManager: boolean;
}

export function AssignmentsView({ assignments, statuses, currentProjectId, isManager }: AssignmentsViewProps) {
    const router = useRouter();
    const [isUpdating, startUpdating] = useTransition();

    const [selectedSpecialty, setSelectedSpecialty] = useState("all");
    const [selectedStatus, setSelectedStatus] = useState("all");
    const [filterFromDate, setFilterFromDate] = useState("");
    const [filterToDate, setFilterToDate] = useState("");
    const [alert, setAlert] = useState<{ isOpen: boolean; title: string; message: string; type: "error" | "success" } | null>(null);

    const specialtyOptions = useMemo(() => {
        return Array.from(new Set(assignments.map((assignment) => assignment.specialtyName).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    }, [assignments]);

    const statusOptions = useMemo(() => {
        if (statuses.length > 0) {
            return statuses.map((status) => status.name);
        }

        return Array.from(new Set(assignments.map((assignment) => assignment.status).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    }, [assignments, statuses]);

    const resetAssignmentFilters = () => {
        setSelectedSpecialty("all");
        setSelectedStatus("all");
        setFilterFromDate("");
        setFilterToDate("");
    };

    const getFilteredAssignments = () => {
        return assignments.filter((assignment) => {
            if (selectedSpecialty !== "all" && assignment.specialtyName !== selectedSpecialty) {
                return false;
            }

            if (selectedStatus !== "all" && assignment.status !== selectedStatus) {
                return false;
            }

            const requiredDate = toDateInputValue(assignment.requiredDate);
            if (filterFromDate && (!requiredDate || requiredDate < filterFromDate)) {
                return false;
            }
            if (filterToDate && (!requiredDate || requiredDate > filterToDate)) {
                return false;
            }

            return true;
        });
    };

    const handleExportCSV = () => {
        const headers = ["Task,Location,Specialty,Status,Required Date"];
        const filtered = getFilteredAssignments();
        const rows = filtered.map((assignment) =>
            `"${assignment.taskName}","${assignment.location}","${assignment.specialtyName}","${assignment.status}","${formatDateOnlyUTC(assignment.requiredDate, { year: "2-digit", month: "2-digit", day: "2-digit" }, "TBD")}"`
        );
        downloadCSV(headers.concat(rows).join("\n"), "assignments_export.csv");
    };

    const downloadCSV = (content: string, filename: string) => {
        const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleUpdateTimeline = async (assignmentId: string, payload: ITimelineUpdatePayload) => {
        return new Promise<boolean>((resolve) => {
            startUpdating(async () => {
                const response = await updateAssignmentTimeline(assignmentId, payload, currentProjectId);
                if (!response.success) {
                    setAlert({
                        isOpen: true,
                        title: "Update failed",
                        message: response.error || "Could not update assignment timeline.",
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
            <GlobalHeader showSearch={true} showLinks={true} />

            <main className="flex-1 flex overflow-hidden">
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-6 md:p-8 pb-0 shrink-0">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
                            <div>
                                <h1 className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight leading-tight">Assignments Log</h1>
                                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Manage all assignments for this project.</p>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3">
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
                            <p className="pb-3 text-sm font-bold border-b-2 border-primary text-primary">Assignments</p>
                            <button
                                type="button"
                                onClick={resetAssignmentFilters}
                                className="mb-2 text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:text-primary transition-colors"
                            >
                                Reset filters
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 py-4">
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

                            <input
                                type="date"
                                value={filterFromDate}
                                onChange={(event) => setFilterFromDate(event.target.value)}
                                className="form-input text-sm rounded-md border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200"
                            />

                            <input
                                type="date"
                                value={filterToDate}
                                onChange={(event) => setFilterToDate(event.target.value)}
                                className="form-input text-sm rounded-md border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto p-6 md:p-8 pt-6">
                        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm overflow-hidden">
                            <AssignmentsTable
                                assignments={getFilteredAssignments()}
                                statuses={statuses}
                                isUpdating={isUpdating}
                                onUpdateTimeline={handleUpdateTimeline}
                            />
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

function AssignmentsTable({
    assignments,
    statuses,
    isUpdating,
    onUpdateTimeline,
}: {
    assignments: AssignmentsViewProps["assignments"];
    statuses: IStatusOption[];
    isUpdating: boolean;
    onUpdateTimeline: (assignmentId: string, payload: ITimelineUpdatePayload) => Promise<boolean>;
}) {
    const [editingAssignment, setEditingAssignment] = useState<IAssignmentViewItem | null>(null);
    const [formState, setFormState] = useState<IAssignmentEditFormState>({
        requiredDate: "",
        status: "",
    });
    const [formError, setFormError] = useState<string | null>(null);

    const openEditModal = (assignment: IAssignmentViewItem) => {
        setEditingAssignment(assignment);
        setFormState({
            requiredDate: toDateInputValue(assignment.requiredDate),
            status: assignment.status,
        });
        setFormError(null);
    };

    const closeEditModal = () => {
        setEditingAssignment(null);
        setFormState({ requiredDate: "", status: "" });
        setFormError(null);
    };

    const saveChanges = async () => {
        if (!editingAssignment || !formState.status) return;

        if (!formState.requiredDate) {
            setFormError("Required date is mandatory.");
            return;
        }

        setFormError(null);

        const success = await onUpdateTimeline(editingAssignment.internalId, {
            requiredDate: toUtcMidnightIso(formState.requiredDate),
            status: formState.status,
        });

        if (success) {
            closeEditModal();
        }
    };

    const statusColorByName = new Map(statuses.map((status) => [status.name, status.colorHex]));

    if (assignments.length === 0) {
        return <div className="p-12 text-center text-neutral-500 text-sm">No assignments found matching criteria.</div>;
    }

    return (
        <>
            <div className="overflow-x-auto">
                <table className="w-full min-w-220 text-left text-sm text-neutral-600 dark:text-neutral-300">
                    <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-xs uppercase font-bold text-neutral-500 border-b border-neutral-200 dark:border-neutral-800">
                        <tr>
                            <th className="px-6 py-4">Task</th>
                            <th className="px-6 py-4">Location</th>
                            <th className="px-6 py-4">Specialty</th>
                            <th className="px-6 py-4">Required Date</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 font-medium">
                        {assignments.map((assignment) => (
                            <tr key={assignment.internalId} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors align-top">
                                <td className="px-6 py-4 text-neutral-900 dark:text-neutral-100 font-semibold">{assignment.taskName}</td>
                                <td className="px-6 py-4">{assignment.location}</td>
                                <td className="px-6 py-4">
                                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
                                        <span className="size-2.5 rounded-full" style={{ backgroundColor: assignment.specialtyColor }}></span>
                                        <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">{assignment.specialtyName}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 min-w-40">
                                    <span className="font-semibold text-neutral-700 dark:text-neutral-200">{assignment.requiredDateLabel}</span>
                                </td>
                                <td className="px-6 py-4 min-w-44">
                                    <StatusBadge
                                        status={assignment.status}
                                        colorHex={statusColorByName.get(assignment.status) || "#94a3b8"}
                                    />
                                </td>
                                <td className="px-6 py-4 text-right whitespace-nowrap">
                                    <button
                                        type="button"
                                        onClick={() => openEditModal(assignment)}
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

            <EditAssignmentModal
                assignment={editingAssignment}
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

function EditAssignmentModal({
    assignment,
    statuses,
    formState,
    formError,
    isUpdating,
    onClose,
    onSave,
    onFormChange,
}: {
    assignment: IAssignmentViewItem | null;
    statuses: IStatusOption[];
    formState: IAssignmentEditFormState;
    formError: string | null;
    isUpdating: boolean;
    onClose: () => void;
    onSave: () => void;
    onFormChange: (nextState: Partial<IAssignmentEditFormState>) => void;
}) {
    if (!assignment) return null;

    const selectedStatusColor = statuses.find((status) => status.name === formState.status)?.colorHex || "#94a3b8";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <button
                type="button"
                aria-label="Close edit assignment modal"
                className="absolute inset-0 bg-neutral-950/60 backdrop-blur-[2px]"
                onClick={onClose}
            />

            <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 bg-linear-to-r from-primary/10 to-transparent px-6 py-5">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">Edit assignment</p>
                        <h3 className="mt-1 text-xl font-black text-neutral-900 dark:text-neutral-100 leading-tight">{assignment.taskName}</h3>
                        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Adjust required date and progress status.</p>
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
                                {assignment.location}
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1 font-semibold text-neutral-700 dark:text-neutral-200">
                                <span className="size-2 rounded-full" style={{ backgroundColor: assignment.specialtyColor }}></span>
                                {assignment.specialtyName}
                            </span>
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="space-y-1.5">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Required date</span>
                            <input
                                type="date"
                                value={formState.requiredDate}
                                onChange={(event) => onFormChange({ requiredDate: event.target.value })}
                                className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 focus:border-primary focus:ring-2 focus:ring-primary/30"
                            />
                        </label>

                        <label className="space-y-1.5">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Progress status</span>
                            <select
                                value={formState.status}
                                onChange={(event) => onFormChange({ status: event.target.value })}
                                className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 focus:border-primary focus:ring-2 focus:ring-primary/30"
                            >
                                {(statuses.length > 0 ? statuses : [{ id: "fallback", name: assignment.status, colorHex: selectedStatusColor }]).map((status) => (
                                    <option key={status.id} value={status.name}>{status.name}</option>
                                ))}
                            </select>
                        </label>
                    </div>

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
                        disabled={isUpdating || !formState.status || !formState.requiredDate}
                        className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
                    >
                        {isUpdating ? "Saving..." : "Save changes"}
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
