"use client";

import React, { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createBuilding, updateBuilding, deleteBuilding, createFloor, updateFloor, deleteFloor, updateMasterPlanImage, createCommitment, updateCommitment, deleteCommitment } from "../actions";
import { compressImage, formatFileSize } from "@/lib/compressImage";
import dynamic from "next/dynamic";

const InteractivePlanViewer = dynamic(
    () => import("@/components/organisms/InteractivePlanViewer").then((mod) => mod.InteractivePlanViewer),
    { ssr: false }
);
import { getSpecialtyIcon } from "@/lib/getSpecialtyIcon";
import type { IPercentPoint } from "@/components/organisms/FreeDrawOverlay";
import type { IBuildingWithFloors } from "@/services/project.service";
import type { ISerializedCommitment } from "../ManageProjectView";
import type { IUserDTO, ISpecialtyDTO, IStatusDTO } from "@/types/models";
import { toDateInputValue, toUtcMidnightIso } from "@/lib/dateOnly";

interface IBuildingsTabProps {
    buildings: IBuildingWithFloors[];
    currentProjectId: string;
    masterPlanImageUrl: string;
    commitmentCounts: Record<string, number>; // buildingId → count
    commitments: ISerializedCommitment[];
    specialties: ISpecialtyDTO[];
    statuses: IStatusDTO[];
    activeUsers: IUserDTO[];
}

type TMode = "view" | "placing" | "drawing";
type TFloorItem = IBuildingWithFloors["floors"][number];

interface IUploadedImageResult {
    url: string;
    publicId: string;
}

interface IEditFloorFormState {
    label: string;
    order: number;
    gcsImageUrl: string;
    cloudinaryPublicId?: string;
}

export function BuildingsTab({ buildings, currentProjectId, masterPlanImageUrl, commitmentCounts, commitments, specialties, statuses, activeUsers }: IBuildingsTabProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const editFloorFileInputRef = useRef<HTMLInputElement>(null);
    const masterPlanFileRef = useRef<HTMLInputElement>(null);

    // Modes
    const [mode, setMode] = useState<TMode>("view");
    const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
    const [uploadingMasterPlan, setUploadingMasterPlan] = useState(false);
    const [compressionInfo, setCompressionInfo] = useState<string | null>(null);
    const [showPlaceOptions, setShowPlaceOptions] = useState(false);

    // Navigation state
    const [selectedFloor, setSelectedFloor] = useState<string | null>(null);
    const selectedBuildingObj = buildings.find(b => b._id === selectedBuilding);
    const selectedFloorObj = selectedBuildingObj?.floors.find(f => f._id === selectedFloor);

    const selectableStatuses = useMemo(() => statuses, [statuses]);

    // Default status from dynamic list or fallback
    const defaultStatus = selectableStatuses.length > 0 ? selectableStatuses[0].name : "Request";

    // Build form state
    const [newBuilding, setNewBuilding] = useState({ name: "", code: "", number: 1 });
    const [newBuildingColor, setNewBuildingColor] = useState("#8B5CF6");
    const [pendingCoords, setPendingCoords] = useState<{ x: number; y: number } | null>(null);
    const [pendingPolygon, setPendingPolygon] = useState<IPercentPoint[] | null>(null);

    // Edit state
    const [editingBuilding, setEditingBuilding] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ name: "", code: "", number: 1, color: "#8B5CF6" });

    const [newActivity, setNewActivity] = useState({ name: "", customId: "", location: "", startDate: "", targetDate: "", description: "", specialtyId: "", assignedTo: "", status: defaultStatus });
    const [editingActivity, setEditingActivity] = useState<string | null>(null);
    const [editActivityForm, setEditActivityForm] = useState({ name: "", customId: "", location: "", startDate: "", targetDate: "", description: "", specialtyId: "", assignedTo: "", status: defaultStatus });
    const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
    const [focusPulse, setFocusPulse] = useState(0);

    // Helpers
    const getStatusColor = (statusName: string) => {
        const found = statuses.find(s => s.name === statusName);
        return found?.colorHex || "#94a3b8"; // Default slate-400
    };

    // Floor form state
    const [showAddFloor, setShowAddFloor] = useState<string | null>(null);
    const [newFloor, setNewFloor] = useState({ label: "", order: 1 });
    const [floorImageUrl, setFloorImageUrl] = useState("");
    const [floorImagePublicId, setFloorImagePublicId] = useState<string | undefined>(undefined);
    const [uploading, setUploading] = useState(false);
    const [editingFloorId, setEditingFloorId] = useState<string | null>(null);
    const [editFloorForm, setEditFloorForm] = useState<IEditFloorFormState>({ label: "", order: 1, gcsImageUrl: "" });
    const [uploadingEditFloor, setUploadingEditFloor] = useState(false);

    // ─── Shared: compress + upload helper ────────────────────────

    const compressAndUpload = async (file: File): Promise<IUploadedImageResult | null> => {
        setCompressionInfo(`Compressing ${formatFileSize(file.size)}...`);

        try {
            const result = await compressImage(file);
            const savedPercent = ((1 - result.ratio) * 100).toFixed(0);
            setCompressionInfo(
                `Compressed: ${formatFileSize(result.originalSize)} → ${formatFileSize(result.compressedSize)} (${savedPercent}% saved, ${result.format})`
            );

            // Upload the compressed file
            const formData = new FormData();
            formData.append("file", result.file);
            formData.append("projectId", currentProjectId);
            const res = await fetch("/api/upload", { method: "POST", body: formData });
            const json = await res.json();

            if (json.success) {
                const url = json.data?.url;
                const publicId = json.data?.publicId || json.data?.filename;

                if (typeof url === "string" && typeof publicId === "string") {
                    return { url, publicId };
                }

                alert("Upload response missing required metadata");
                return null;
            } else {
                alert(json.error || "Upload failed");
                return null;
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "Compression failed";
            setCompressionInfo(`❌ ${message}`);
            return null;
        }
    };

    // ─── Master plan upload handler ──────────────────────────────

    const handleUploadMasterPlan = async (file: File) => {
        setUploadingMasterPlan(true);
        try {
            const uploadedImage = await compressAndUpload(file);
            if (uploadedImage) {
                const result = await updateMasterPlanImage(currentProjectId, uploadedImage.url, uploadedImage.publicId);
                if (result.success) router.refresh();
                else alert(result.error || "Failed to save image");
            }
        } finally {
            setUploadingMasterPlan(false);
            // Clear compression info after a delay
            setTimeout(() => setCompressionInfo(null), 8000);
        }
    };

    // ─── Floor plan upload handler ───────────────────────────────

    const handleUploadImage = async (file: File) => {
        setUploading(true);
        try {
            const uploadedImage = await compressAndUpload(file);
            if (uploadedImage) {
                setFloorImageUrl(uploadedImage.url);
                setFloorImagePublicId(uploadedImage.publicId);
            }
        } finally {
            setUploading(false);
            setTimeout(() => setCompressionInfo(null), 8000);
        }
    };

    // ─── CRUD handlers ───────────────────────────────────────────

    const handleCreateBuilding = () => {
        if (!pendingCoords) return;
        startTransition(async () => {
            const res = await createBuilding(currentProjectId, {
                name: newBuilding.name,
                code: newBuilding.code,
                number: newBuilding.number,
                color: newBuildingColor,
                coordinates: { xPercent: pendingCoords.x, yPercent: pendingCoords.y },
                ...(pendingPolygon && pendingPolygon.length >= 3 ? { polygon: pendingPolygon } : {}),
            });
            if (res.success) {
                setMode("view");
                setPendingCoords(null);
                setPendingPolygon(null);
                setNewBuilding({ name: "", code: "", number: buildings.length + 2 });
                setNewBuildingColor("#8B5CF6");
                router.refresh();
            } else {
                alert(res.error || "Failed to create building");
            }
        });
    };

    const handleEditBuilding = (buildingId: string) => {
        startTransition(async () => {
            const res = await updateBuilding(buildingId, {
                name: editForm.name,
                code: editForm.code,
                number: editForm.number,
                color: editForm.color,
            });
            if (res.success) {
                setEditingBuilding(null);
                router.refresh();
            } else {
                alert(res.error || "Failed to update building");
            }
        });
    };

    const handleDeleteBuilding = (buildingId: string) => {
        if (!confirm("Delete this building, all its floors and activities? This cannot be undone.")) return;
        startTransition(async () => {
            const res = await deleteBuilding(buildingId);
            if (res.success) {
                if (selectedBuilding === buildingId) setSelectedBuilding(null);
                router.refresh();
            }
        });
    };

    const handleDeleteFloor = (floorId: string) => {
        if (!confirm("Delete this floor and all its activities?")) return;
        startTransition(async () => {
            const res = await deleteFloor(floorId);
            if (res.success) router.refresh();
        });
    };

    const handleAddFloor = (buildingId: string) => {
        if (!floorImageUrl) { alert("Please upload a floor plan image first"); return; }
        startTransition(async () => {
            const res = await createFloor(buildingId, {
                label: newFloor.label,
                order: newFloor.order,
                gcsImageUrl: floorImageUrl,
                cloudinaryPublicId: floorImagePublicId,
            });
            if (res.success) {
                setShowAddFloor(null);
                setNewFloor({ label: "", order: 1 });
                setFloorImageUrl("");
                setFloorImagePublicId(undefined);
                if (fileInputRef.current) fileInputRef.current.value = "";
                router.refresh();
            } else alert(res.error || "Failed to create floor");
        });
    };

    const resetEditFloorState = () => {
        setEditingFloorId(null);
        setEditFloorForm({ label: "", order: 1, gcsImageUrl: "", cloudinaryPublicId: undefined });
        if (editFloorFileInputRef.current) {
            editFloorFileInputRef.current.value = "";
        }
    };

    const handleStartEditFloor = (floor: TFloorItem) => {
        setShowAddFloor(null);
        setEditingFloorId(floor._id);
        setEditFloorForm({
            label: floor.label,
            order: floor.order,
            gcsImageUrl: floor.gcsImageUrl,
            cloudinaryPublicId: floor.cloudinaryPublicId,
        });
    };

    const handleUploadEditFloorImage = async (file: File) => {
        setUploadingEditFloor(true);
        try {
            const uploadedImage = await compressAndUpload(file);
            if (uploadedImage) {
                setEditFloorForm((prev) => ({
                    ...prev,
                    gcsImageUrl: uploadedImage.url,
                    cloudinaryPublicId: uploadedImage.publicId,
                }));
            }
        } finally {
            setUploadingEditFloor(false);
            setTimeout(() => setCompressionInfo(null), 8000);
        }
    };

    const handleEditFloor = (floorId: string) => {
        if (!editFloorForm.gcsImageUrl) {
            alert("Please upload a floor plan image first");
            return;
        }

        startTransition(async () => {
            const currentFloor = selected?.floors.find((floor) => floor._id === floorId);
            const hasImageUpdate = Boolean(currentFloor && currentFloor.gcsImageUrl !== editFloorForm.gcsImageUrl);

            const payload: { label?: string; order?: number; gcsImageUrl?: string; cloudinaryPublicId?: string } = {
                label: editFloorForm.label,
                order: editFloorForm.order,
            };

            if (hasImageUpdate) {
                payload.gcsImageUrl = editFloorForm.gcsImageUrl;
                payload.cloudinaryPublicId = editFloorForm.cloudinaryPublicId;
            }

            const res = await updateFloor(floorId, payload);

            if (res.success) {
                resetEditFloorState();
                router.refresh();
            } else {
                alert(res.error || "Failed to update floor");
            }
        });
    };

    const handleCreateActivity = () => {
        if (!pendingCoords || !selectedFloorObj || !selectedBuildingObj) return;
        startTransition(async () => {
            const res = await createCommitment({
                projectId: currentProjectId,
                buildingId: selectedBuildingObj._id,
                floorId: selectedFloorObj._id,
                name: newActivity.name,
                customId: newActivity.customId,
                location: newActivity.location,
                description: newActivity.description,
                dates: {
                    startDate: newActivity.startDate ? toUtcMidnightIso(newActivity.startDate) : undefined,
                    targetDate: newActivity.targetDate ? toUtcMidnightIso(newActivity.targetDate) : undefined,
                },
                specialtyId: newActivity.specialtyId,
                assignedTo: newActivity.assignedTo || null,
                status: newActivity.status,
                coordinates: { xPercent: pendingCoords.x, yPercent: pendingCoords.y },
                ...(pendingPolygon && pendingPolygon.length >= 3 ? { polygon: pendingPolygon } : {})
            });
            if (res.success) {
                setMode("view");
                setPendingCoords(null);
                setPendingPolygon(null);
                setNewActivity({ name: "", customId: "", location: "", startDate: "", targetDate: "", description: "", specialtyId: "", assignedTo: "", status: defaultStatus });
                router.refresh();
            } else alert(res.error || "Failed to create activity");
        });
    };

    const handleEditActivity = (activityId: string) => {
        startTransition(async () => {
            const res = await updateCommitment(activityId, {
                name: editActivityForm.name,
                customId: editActivityForm.customId,
                location: editActivityForm.location,
                description: editActivityForm.description,
                dates: {
                    startDate: editActivityForm.startDate ? toUtcMidnightIso(editActivityForm.startDate) : undefined,
                    targetDate: editActivityForm.targetDate ? toUtcMidnightIso(editActivityForm.targetDate) : undefined,
                },
                specialtyId: editActivityForm.specialtyId,
                assignedTo: editActivityForm.assignedTo || null,
                status: editActivityForm.status,
            });
            if (res.success) {
                setEditingActivity(null);
                router.refresh();
            } else alert(res.error || "Failed to update activity");
        });
    };

    const handleDeleteActivity = (activityId: string) => {
        if (!confirm("Delete this activity?")) return;
        startTransition(async () => {
            const res = await deleteCommitment(activityId);
            if (res.success) router.refresh();
        });
    };

    const selected = selectedBuildingObj;
    const COLOR_OPTIONS = ["#8B5CF6", "#3B82F6", "#F59E0B", "#10B981", "#EC4899", "#06B6D4", "#EF4444", "#64748B"];

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-full min-h-150">
            {/* Compression info banner */}
            {compressionInfo && (
                <div className={`absolute top-2 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg text-xs font-semibold border backdrop-blur-sm max-w-md text-center
                    ${compressionInfo.startsWith("❌")
                        ? "bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                        : "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                    }`}
                >
                    {compressionInfo}
                </div>
            )}
            {/* ─── Left: Interactive Plan ─────────────────────── */}
            <div className="flex-1 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                            {selectedFloorObj ? `${selectedBuildingObj?.name} - ${selectedFloorObj.label}` : "Master Plan"}
                        </h2>
                        <p className="text-xs text-neutral-500">
                            {(!masterPlanImageUrl && !selectedFloorObj)
                                ? "Upload a master plan image to get started"
                                : mode === "placing"
                                    ? `👆 Click on the plan to place the ${selectedFloorObj ? "activity" : "building"}`
                                    : mode === "drawing"
                                        ? `✏️ Draw a zone on the plan to define the ${selectedFloorObj ? "activity" : "building"} area`
                                        : selectedFloorObj
                                            ? `${commitments.filter(c => c.floorId === selectedFloorObj._id).length} activities placed`
                                            : `${buildings.length} building${buildings.length !== 1 ? "s" : ""} placed`
                            }
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {masterPlanImageUrl && !selectedFloorObj && (
                            <button
                                onClick={() => masterPlanFileRef.current?.click()}
                                disabled={uploadingMasterPlan}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                                <span className="material-symbols-outlined text-[14px]">image</span>
                                {uploadingMasterPlan ? "Uploading..." : "Change Plan"}
                            </button>
                        )}
                        {((masterPlanImageUrl && !selectedFloorObj) || (selectedFloorObj && selectedFloorObj.gcsImageUrl)) && mode === "view" ? (
                            <div className="flex items-center gap-2">
                                {!showPlaceOptions ? (
                                    <button
                                        onClick={() => setShowPlaceOptions(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">add_location_alt</span>
                                        Place Pin
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => {
                                                setMode("placing");
                                                setNewBuilding({ name: "", code: "", number: buildings.length + 1 });
                                                setPendingCoords(null);
                                                setPendingPolygon(null);
                                                setShowPlaceOptions(false);
                                            }}
                                            className="flex items-center gap-2 px-3 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">push_pin</span>
                                            Exact Point
                                        </button>
                                        <button
                                            onClick={() => {
                                                setMode("drawing");
                                                setNewBuilding({ name: "", code: "", number: buildings.length + 1 });
                                                setPendingCoords(null);
                                                setPendingPolygon(null);
                                                setShowPlaceOptions(false);
                                            }}
                                            className="flex items-center gap-2 px-3 py-2 bg-emerald-500 text-white rounded-lg text-sm font-bold hover:bg-emerald-600 transition-colors shadow-sm"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">draw</span>
                                            Draw Zone
                                        </button>
                                        <button
                                            onClick={() => setShowPlaceOptions(false)}
                                            className="flex items-center justify-center p-2 text-neutral-500 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-neutral-400 rounded-lg transition-colors shadow-sm"
                                            title="Cancel"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">close</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        ) : ((masterPlanImageUrl && !selectedFloorObj) || selectedFloorObj) && (mode === "placing" || mode === "drawing") ? (
                            <button
                                onClick={() => { setMode("view"); setPendingCoords(null); setPendingPolygon(null); }}
                                className="flex items-center gap-2 px-4 py-2 text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-sm font-bold hover:bg-neutral-200 transition-colors"
                            >
                                <span className="material-symbols-outlined text-[18px]">close</span>
                                Cancel
                            </button>
                        ) : null}
                    </div>
                </div>

                {/* Hidden file input for master plan */}
                <input ref={masterPlanFileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadMasterPlan(f); }} />

                {/* No image: Upload prompt */}
                {selectedFloorObj && !selectedFloorObj.gcsImageUrl ? (
                    <div className="flex-1 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 min-h-100">
                        <span className="material-symbols-outlined text-6xl text-neutral-300 dark:text-neutral-600 mb-4">image_not_supported</span>
                        <p className="text-base font-bold text-neutral-700 dark:text-neutral-300">
                            No floor plan uploaded
                        </p>
                        <p className="text-xs text-neutral-400 mt-3">Upload a plan to place activities</p>
                    </div>
                ) : !masterPlanImageUrl && !selectedFloorObj ? (
                    <div
                        className="flex-1 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-primary/50 transition-colors cursor-pointer min-h-100"
                        onClick={() => masterPlanFileRef.current?.click()}
                    >
                        <span className="material-symbols-outlined text-6xl text-neutral-300 dark:text-neutral-600 mb-4">map</span>
                        <p className="text-base font-bold text-neutral-700 dark:text-neutral-300">
                            {uploadingMasterPlan ? "Uploading..." : "Upload Master Plan Image"}
                        </p>
                        <p className="text-sm text-neutral-500 mt-1">JPEG, PNG, or WebP · Max 15MB</p>
                        <p className="text-xs text-neutral-400 mt-3">This will be the main project floor plan</p>
                    </div>
                ) : (
                    <>
                        <div
                            className={`flex-1 relative isolate rounded-xl bg-neutral-100 dark:bg-neutral-800 flex flex-col min-h-125 ${(mode === "placing" || mode === "drawing") ? "ring-2 ring-primary ring-offset-2 dark:ring-offset-neutral-900" : ""}`}
                        >
                            <div className="absolute inset-0 z-0">
                                <InteractivePlanViewer
                                    imageUrl={selectedFloorObj?.gcsImageUrl || masterPlanImageUrl}
                                    hotspots={selectedFloorObj
                                        ? commitments.filter(c => c.floorId === selectedFloorObj._id).map(c => ({
                                            ...c,
                                            name: c.name || c.description,
                                            code: c.specialtyName,
                                            color: c.specialtyColor || "#8B5CF6",
                                            icon: getSpecialtyIcon(c.specialtyName)
                                        }))
                                        : buildings.map(b => ({
                                            ...b,
                                            name: b.name,
                                            code: b.code,
                                            icon: "domain",
                                            commitmentCount: commitmentCounts[b._id] ?? 0,
                                        }))
                                    }
                                    mode={mode}
                                    pendingCoords={pendingCoords}
                                    pendingPolygon={pendingPolygon}
                                    selectedHotspotId={selectedFloorObj ? selectedActivity : selectedBuilding}
                                    onMapClick={(x, y) => {
                                        if (mode === "placing" || mode === "drawing") {
                                            setPendingCoords({ x, y });
                                        }
                                    }}
                                    focusPulse={focusPulse}
                                    onHotspotSelect={(h) => {
                                        if (!selectedFloorObj && mode === "view") {
                                            setSelectedBuilding(h._id === selectedBuilding ? null : h._id);
                                        } else if (selectedFloorObj) {
                                            setSelectedActivity(h._id);
                                            setFocusPulse(p => p + 1);
                                        }
                                    }}
                                    onCreatePolygon={(pts) => {
                                        setPendingPolygon(pts);
                                        if (pts.length > 0) {
                                            const sumX = pts.reduce((s, p) => s + p.xPercent, 0);
                                            const sumY = pts.reduce((s, p) => s + p.yPercent, 0);
                                            setPendingCoords({ x: sumX / pts.length, y: sumY / pts.length });
                                        }
                                    }}
                                />
                            </div>

                            {/* Placing/Drawing mode: form below the plan */}
                            {(mode === "placing" || mode === "drawing") && pendingCoords && (
                                <div className="bg-white dark:bg-neutral-900 border border-emerald-200 dark:border-emerald-800 rounded-xl p-5 shadow-sm relative z-10 mx-4 mb-4 mt-auto">
                                    {selectedFloorObj ? (
                                        <>
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className="material-symbols-outlined text-emerald-500 text-[18px]">task_alt</span>
                                                <span className="text-sm font-bold text-neutral-900 dark:text-white">
                                                    New Activity at ({pendingCoords.x.toFixed(1)}%, {pendingCoords.y.toFixed(1)}%)
                                                </span>
                                            </div>
                                            <div className="grid gap-3 mb-4">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <input type="text" placeholder="Activity Name" value={newActivity.name}
                                                        onChange={(e) => setNewActivity({ ...newActivity, name: e.target.value })}
                                                        className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-primary focus:border-primary" />
                                                    <input type="text" placeholder="Custom ID (Optional)" value={newActivity.customId}
                                                        onChange={(e) => setNewActivity({ ...newActivity, customId: e.target.value })}
                                                        className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-primary focus:border-primary" />
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">Start Date</label>
                                                        <input type="date" value={newActivity.startDate}
                                                            onChange={(e) => setNewActivity({ ...newActivity, startDate: e.target.value })}
                                                            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-primary focus:border-primary" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">Target End</label>
                                                        <input type="date" value={newActivity.targetDate}
                                                            onChange={(e) => setNewActivity({ ...newActivity, targetDate: e.target.value })}
                                                            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-primary focus:border-primary" />
                                                    </div>
                                                </div>
                                                <input type="text" placeholder="Location Details (Optional)" value={newActivity.location}
                                                    onChange={(e) => setNewActivity({ ...newActivity, location: e.target.value })}
                                                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-primary focus:border-primary" />
                                                <textarea placeholder="Description" value={newActivity.description}
                                                    onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
                                                    className="w-full flex-1 px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-primary focus:border-primary resize-none h-16" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 mb-4">
                                                <select value={newActivity.specialtyId} onChange={e => setNewActivity({ ...newActivity, specialtyId: e.target.value })}
                                                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-primary focus:border-primary">
                                                    <option value="" disabled>Select Specialty...</option>
                                                    {specialties.map(s => (
                                                        <option key={s._id} value={s._id}>{s.name}</option>
                                                    ))}
                                                </select>
                                                <select value={newActivity.assignedTo} onChange={e => setNewActivity({ ...newActivity, assignedTo: e.target.value })}
                                                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-primary focus:border-primary">
                                                    <option value="">Unassigned</option>
                                                    {activeUsers.filter(u => {
                                                        const spec = specialties.find(s => s._id === newActivity.specialtyId);
                                                        return !spec || u.specialtyName === spec.name;
                                                    }).map(u => (
                                                        <option key={u._id} value={u._id}>{u.name}</option>
                                                    ))}
                                                </select>
                                                <select value={newActivity.status} onChange={e => setNewActivity({ ...newActivity, status: e.target.value })}
                                                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-primary focus:border-primary col-span-2">
                                                    {selectableStatuses.map(s => (
                                                        <option key={s._id} value={s.name}>{s.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={handleCreateActivity} disabled={isPending || !newActivity.name || !newActivity.specialtyId}
                                                    className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-bold hover:bg-emerald-600 transition-colors disabled:opacity-50 shadow-sm">
                                                    Create Activity
                                                </button>
                                                <button onClick={() => { setPendingCoords(null); setPendingPolygon(null); setMode("view"); }}
                                                    className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-sm font-medium transition-colors">
                                                    Cancel
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className="material-symbols-outlined text-emerald-500 text-[18px]">{mode === "drawing" ? "draw" : "location_on"}</span>
                                                <span className="text-sm font-bold text-neutral-900 dark:text-white">
                                                    {mode === "drawing"
                                                        ? `New Building Zone (${pendingPolygon?.length || 0} points)`
                                                        : `New Building at (${pendingCoords.x.toFixed(1)}%, ${pendingCoords.y.toFixed(1)}%)`
                                                    }
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-3 gap-3 mb-3">
                                                <input type="text" placeholder="Name" value={newBuilding.name}
                                                    onChange={(e) => setNewBuilding({ ...newBuilding, name: e.target.value })}
                                                    className="px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-primary focus:border-primary" />
                                                <input type="text" placeholder="Code (e.g. BLD-01)" value={newBuilding.code}
                                                    onChange={(e) => setNewBuilding({ ...newBuilding, code: e.target.value })}
                                                    className="px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-primary focus:border-primary" />
                                                <input type="number" placeholder="Number" value={newBuilding.number} min={1}
                                                    onChange={(e) => setNewBuilding({ ...newBuilding, number: parseInt(e.target.value) || 1 })}
                                                    className="px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-primary focus:border-primary" />
                                            </div>
                                            <div className="flex items-center gap-2 mb-4">
                                                <span className="text-xs font-bold text-neutral-500 uppercase">Color:</span>
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    {COLOR_OPTIONS.map(c => (
                                                        <button
                                                            key={c}
                                                            onClick={() => setNewBuildingColor(c)}
                                                            className={`w-6 h-6 rounded-full shadow-sm transition-transform hover:scale-110 ${newBuildingColor === c ? "ring-2 ring-offset-2 ring-offset-white dark:ring-offset-neutral-900 ring-primary scale-110" : "opacity-80 border border-neutral-200"}`}
                                                            style={{ backgroundColor: c }}
                                                            title={c}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={handleCreateBuilding} disabled={isPending || !newBuilding.name || !newBuilding.code}
                                                    className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-bold hover:bg-emerald-600 transition-colors disabled:opacity-50 shadow-sm">
                                                    Create Building
                                                </button>
                                                <button onClick={() => { setPendingCoords(null); setPendingPolygon(null); }}
                                                    className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-sm font-medium transition-colors">
                                                    {mode === "drawing" ? "Clear Drawing" : "Clear Pin"}
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* ─── Right: Details Panel ─────────────────────── */}
            <div className="w-full lg:w-96 flex flex-col gap-3 overflow-y-auto shrink-0">
                {!selectedFloorObj && (
                    <h3 className="text-sm font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                        {selected ? selected.name : "Buildings"}
                    </h3>
                )}

                {/* Building list (when none selected) */}
                {!selected && (
                    <div className="space-y-2">
                        {buildings.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-neutral-500 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
                                <span className="material-symbols-outlined text-4xl mb-2 text-neutral-300">apartment</span>
                                <p className="text-sm font-medium">No buildings yet</p>
                                <p className="text-xs mt-1">Click &quot;Place Building&quot; and click on the plan</p>
                            </div>
                        ) : (
                            buildings.map(b => {
                                const count = commitmentCounts[b._id] || 0;
                                return (
                                    <button
                                        key={b._id}
                                        onClick={() => setSelectedBuilding(b._id)}
                                        className="w-full flex items-center gap-3 px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg hover:border-primary/30 hover:bg-primary/5 transition-all group text-left"
                                    >
                                        <div className="flex items-center justify-center size-9 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
                                            {count}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-neutral-900 dark:text-white truncate">{b.name}</p>
                                            <p className="text-xs text-neutral-500">{b.code} · {b.floors.length} floor{b.floors.length !== 1 ? "s" : ""}</p>
                                        </div>
                                        <span className="material-symbols-outlined text-neutral-400 group-hover:text-primary">chevron_right</span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                )}

                {/* Building detail (when selected but floor NOT selected) */}
                {selected && !selectedFloorObj && (
                    <div className="space-y-4">
                        <button onClick={() => { setSelectedBuilding(null); setSelectedFloor(null); }}
                            className="flex items-center gap-1 text-sm text-primary font-semibold hover:underline">
                            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                            Back to all buildings
                        </button>

                        {/* Building info card */}
                        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 shadow-sm">
                            {editingBuilding === selected._id ? (
                                <div className="space-y-3">
                                    <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                        className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100" placeholder="Name" />
                                    <div className="grid grid-cols-2 gap-2">
                                        <input value={editForm.code} onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                                            className="px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100" placeholder="Code" />
                                        <input type="number" value={editForm.number} onChange={(e) => setEditForm({ ...editForm, number: parseInt(e.target.value) || 1 })}
                                            className="px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100" />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {COLOR_OPTIONS.map(c => (
                                            <button
                                                key={c}
                                                onClick={() => setEditForm({ ...editForm, color: c })}
                                                className={`w-5 h-5 rounded-full shadow-sm transition-transform hover:scale-110 ${editForm.color === c ? "ring-2 ring-offset-2 ring-offset-white dark:ring-offset-neutral-900 ring-primary scale-110" : "opacity-80 border border-neutral-200"}`}
                                                style={{ backgroundColor: c }}
                                            />
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleEditBuilding(selected._id)} disabled={isPending}
                                            className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600 disabled:opacity-50">Save</button>
                                        <button onClick={() => setEditingBuilding(null)}
                                            className="px-3 py-1.5 text-neutral-500 hover:bg-neutral-100 rounded-lg text-xs font-medium">Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h4 className="font-bold text-neutral-900 dark:text-white">{selected.name}</h4>
                                        <p className="text-xs text-neutral-500 mt-0.5">{selected.code} · Building #{selected.number}</p>
                                        <p className="text-xs text-neutral-500 mt-0.5">
                                            📍 {selected.coordinates.xPercent.toFixed(1)}%, {selected.coordinates.yPercent.toFixed(1)}%
                                        </p>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => { setEditingBuilding(selected._id); setEditForm({ name: selected.name, code: selected.code, number: selected.number, color: selected.color || "#8B5CF6" }); }}
                                            className="p-1.5 text-neutral-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors">
                                            <span className="material-symbols-outlined text-[16px]">edit</span>
                                        </button>
                                        <button onClick={() => handleDeleteBuilding(selected._id)}
                                            className="p-1.5 text-neutral-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                                            <span className="material-symbols-outlined text-[16px]">delete</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Floors section */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-sm font-bold text-neutral-700 dark:text-neutral-300">Floors</h4>
                                <button onClick={() => {
                                    setShowAddFloor(selected._id);
                                    setNewFloor({ label: "", order: selected.floors.length + 1 });
                                    setFloorImageUrl("");
                                    setFloorImagePublicId(undefined);
                                    if (fileInputRef.current) fileInputRef.current.value = "";
                                    resetEditFloorState();
                                }}
                                    className="flex items-center gap-1 px-2.5 py-1 text-primary bg-primary/10 hover:bg-primary/20 rounded-lg text-xs font-bold transition-colors">
                                    <span className="material-symbols-outlined text-[14px]">add</span>
                                    Add Floor
                                </button>
                            </div>

                            {/* Add floor form */}
                            {showAddFloor === selected._id && (
                                <div className="bg-white dark:bg-neutral-900 border border-primary/20 rounded-lg p-3 mb-3">
                                    <div className="grid grid-cols-2 gap-2 mb-2">
                                        <input type="text" placeholder="Floor Label" value={newFloor.label}
                                            onChange={(e) => setNewFloor({ ...newFloor, label: e.target.value })}
                                            className="px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100" />
                                        <input type="number" placeholder="Order" value={newFloor.order} min={1}
                                            onChange={(e) => setNewFloor({ ...newFloor, order: parseInt(e.target.value) || 1 })}
                                            className="px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100" />
                                    </div>
                                    <div className="mb-2">
                                        {floorImageUrl ? (
                                            <div className="relative rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700 h-24">
                                                <Image src={floorImageUrl} alt="Preview" fill className="object-contain" unoptimized />
                                                <button onClick={() => {
                                                    setFloorImageUrl("");
                                                    setFloorImagePublicId(undefined);
                                                    if (fileInputRef.current) fileInputRef.current.value = "";
                                                }}
                                                    className="absolute top-1 right-1 p-0.5 bg-rose-500 text-white rounded-full hover:bg-rose-600">
                                                    <span className="material-symbols-outlined text-[12px]">close</span>
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-lg p-4 text-center hover:border-primary/50 transition-colors cursor-pointer"
                                                onClick={() => fileInputRef.current?.click()}>
                                                <span className="material-symbols-outlined text-2xl text-neutral-400">cloud_upload</span>
                                                <p className="text-xs text-neutral-500 mt-1">{uploading ? "Uploading..." : "Upload floor plan"}</p>
                                            </div>
                                        )}
                                        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadImage(f); }} />
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleAddFloor(selected._id)} disabled={isPending || !newFloor.label || !floorImageUrl}
                                            className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 disabled:opacity-50">Create</button>
                                        <button onClick={() => {
                                            setShowAddFloor(null);
                                            setFloorImageUrl("");
                                            setFloorImagePublicId(undefined);
                                            if (fileInputRef.current) fileInputRef.current.value = "";
                                        }}
                                            className="px-3 py-1.5 text-neutral-600 hover:bg-neutral-100 rounded-lg text-xs font-medium">Cancel</button>
                                    </div>
                                </div>
                            )}

                            {/* Floor list */}
                            {selected.floors.length === 0 ? (
                                <p className="text-xs text-neutral-500 italic py-3 text-center">No floors yet</p>
                            ) : (
                                <div className="space-y-1.5">
                                    {selected.floors.map((floor) => {
                                        const isEditingFloor = editingFloorId === floor._id;

                                        if (isEditingFloor) {
                                            return (
                                                <div key={floor._id} className="bg-white dark:bg-neutral-900 border border-primary/20 rounded-lg p-3">
                                                    <div className="space-y-4">
                                                        <div className="grid grid-cols-2 gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-800">
                                                            <div className="space-y-1">
                                                                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider ml-1">Floor Label</label>
                                                                <input type="text" placeholder="e.g. Floor 1" value={editFloorForm.label}
                                                                    onChange={(e) => setEditFloorForm({ ...editFloorForm, label: e.target.value })}
                                                                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider ml-1">Order</label>
                                                                <input type="number" placeholder="Order" value={editFloorForm.order} min={1}
                                                                    onChange={(e) => setEditFloorForm({ ...editFloorForm, order: parseInt(e.target.value) || 1 })}
                                                                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" />
                                                            </div>
                                                        </div>

                                                        <div className="space-y-2">
                                                            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider ml-1">Floor Plan Image</label>
                                                            {editFloorForm.gcsImageUrl ? (
                                                                <div className="group relative rounded-xl overflow-hidden border-2 border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 aspect-video transition-all hover:border-primary/30">
                                                                    <Image src={editFloorForm.gcsImageUrl} alt={`Preview for ${floor.label}`} fill className="object-contain p-2" unoptimized />
                                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                                        <button onClick={() => editFloorFileInputRef.current?.click()}
                                                                            type="button"
                                                                            className="px-3 py-1.5 bg-white text-black rounded-lg text-xs font-bold shadow-xl hover:scale-105 transition-transform flex items-center gap-1.5">
                                                                            <span className="material-symbols-outlined text-[16px]">image</span>
                                                                            Change Image
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl p-6 text-center hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group"
                                                                    onClick={() => editFloorFileInputRef.current?.click()}>
                                                                    <div className="size-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-2 group-hover:bg-primary/10 transition-colors">
                                                                        <span className="material-symbols-outlined text-2xl text-neutral-400 group-hover:text-primary">cloud_upload</span>
                                                                    </div>
                                                                    <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300">{uploadingEditFloor ? "Uploading..." : "Click to upload plan"}</p>
                                                                    <p className="text-[10px] text-neutral-500 mt-1">PNG, JPG or WEBP up to 10MB</p>
                                                                </div>
                                                            )}

                                                            <input ref={editFloorFileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                                                                onChange={(e) => {
                                                                    const f = e.target.files?.[0];
                                                                    if (f) handleUploadEditFloorImage(f);
                                                                }} />
                                                            
                                                            {editFloorForm.gcsImageUrl && (
                                                                <div className="flex items-center gap-2 px-1">
                                                                    <span className="material-symbols-outlined text-[14px] text-emerald-500">check_circle</span>
                                                                    <span className="text-[10px] font-medium text-neutral-500">Image uploaded successfully</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="flex gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                                                            <button
                                                                onClick={() => handleEditFloor(floor._id)}
                                                                disabled={isPending || uploadingEditFloor || !editFloorForm.label || !editFloorForm.gcsImageUrl}
                                                                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold shadow-sm shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:grayscale transition-all active:scale-[0.98]"
                                                            >
                                                                {isPending ? "Saving..." : "Save Changes"}
                                                            </button>
                                                            <button onClick={resetEditFloorState}
                                                                className="px-4 py-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-sm font-bold transition-colors">
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div key={floor._id}
                                                onClick={() => setSelectedFloor(floor._id)}
                                                className="flex items-center justify-between bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2.5 group cursor-pointer hover:border-primary/50 transition-all">
                                                <div className="flex items-center gap-2.5">
                                                    {floor.gcsImageUrl ? (
                                                        <div className="relative size-7 rounded border border-neutral-200 dark:border-neutral-700 overflow-hidden shrink-0">
                                                            <Image src={floor.gcsImageUrl} alt={floor.label} fill className="object-cover" unoptimized />
                                                        </div>
                                                    ) : (
                                                        <div className="relative size-7 rounded border border-neutral-200 dark:border-neutral-700 overflow-hidden shrink-0 flex items-center justify-center bg-neutral-100 dark:bg-neutral-800">
                                                            <span className="material-symbols-outlined text-[14px] text-neutral-400">image_not_supported</span>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="text-sm font-semibold text-neutral-900 dark:text-white group-hover:text-primary transition-colors">{floor.label}</p>
                                                        <p className="text-[10px] text-neutral-500">Level {floor.order}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button onClick={(e) => { e.stopPropagation(); handleStartEditFloor(floor); }}
                                                        className="p-1 text-neutral-400 hover:text-primary hover:bg-primary/10 rounded transition-colors opacity-0 group-hover:opacity-100" title="Edit Floor">
                                                        <span className="material-symbols-outlined text-[14px]">edit</span>
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteFloor(floor._id); }}
                                                        className="p-1 text-neutral-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors opacity-0 group-hover:opacity-100" title="Delete Floor">
                                                        <span className="material-symbols-outlined text-[14px]">delete</span>
                                                    </button>
                                                    <span className="material-symbols-outlined text-neutral-400 group-hover:text-primary text-[18px]">chevron_right</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Floor detail (when selected) */}
                {selected && selectedFloorObj && (
                    <div className="space-y-4">
                        <button onClick={() => { setSelectedFloor(null); setMode("view"); setPendingCoords(null); setPendingPolygon(null); }}
                            className="flex items-center gap-1 text-sm text-primary font-semibold hover:underline">
                            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                            Back to building details
                        </button>

                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">{selectedFloorObj.label}</h3>
                                <p className="text-xs text-neutral-500">Activities on this floor</p>
                            </div>
                        </div>

                        {/* Activities List */}
                        <div className="space-y-2">
                            {commitments.filter(c => c.floorId === selectedFloorObj._id).length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 text-neutral-500 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
                                    <span className="material-symbols-outlined text-3xl mb-2 text-neutral-300">task_alt</span>
                                    <p className="text-sm font-medium">No activities</p>
                                    <p className="text-xs mt-1 text-center">Select &quot;Place Pin&quot; and click on<br />the plan to add an activity</p>
                                </div>
                            ) : (
                                commitments.filter(c => c.floorId === selectedFloorObj._id).map(activity => (
                                    <div key={activity._id}
                                        onClick={() => {
                                            if (editingActivity !== activity._id) {
                                                setSelectedActivity(activity._id);
                                                setFocusPulse(p => p + 1);
                                            }
                                        }}
                                        className={`bg-white dark:bg-neutral-900 border ${selectedActivity === activity._id ? 'border-primary ring-1 ring-primary' : 'border-neutral-200 dark:border-neutral-800'} rounded-lg p-3 shadow-sm group cursor-pointer transition-all hover:border-primary/50`}>

                                        {editingActivity === activity._id ? (
                                            <div className="space-y-3" onClick={e => e.stopPropagation()}>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <input value={editActivityForm.name} onChange={(e) => setEditActivityForm({ ...editActivityForm, name: e.target.value })}
                                                        className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100" placeholder="Activity Name" />
                                                    <input value={editActivityForm.customId} onChange={(e) => setEditActivityForm({ ...editActivityForm, customId: e.target.value })}
                                                        className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100" placeholder="Custom ID" />
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="block text-[9px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">Start Date</label>
                                                        <input type="date" value={editActivityForm.startDate} onChange={(e) => setEditActivityForm({ ...editActivityForm, startDate: e.target.value })}
                                                            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[9px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">Target End</label>
                                                        <input type="date" value={editActivityForm.targetDate} onChange={(e) => setEditActivityForm({ ...editActivityForm, targetDate: e.target.value })}
                                                            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100" />
                                                    </div>
                                                </div>
                                                <input value={editActivityForm.location} onChange={(e) => setEditActivityForm({ ...editActivityForm, location: e.target.value })}
                                                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100" placeholder="Location Details" />
                                                <textarea value={editActivityForm.description} onChange={(e) => setEditActivityForm({ ...editActivityForm, description: e.target.value })}
                                                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 resize-none h-16" placeholder="Description (optional)" />
                                                <div className="grid grid-cols-2 gap-2">
                                                    <select value={editActivityForm.specialtyId} onChange={e => setEditActivityForm({ ...editActivityForm, specialtyId: e.target.value, assignedTo: "" })}
                                                        className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100">
                                                        <option value="" disabled>Specialty</option>
                                                        {specialties.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                                                    </select>
                                                    <select value={editActivityForm.assignedTo} onChange={e => setEditActivityForm({ ...editActivityForm, assignedTo: e.target.value })}
                                                        className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100">
                                                        <option value="">No Assignee</option>
                                                        {activeUsers.filter(u => editActivityForm.specialtyId && u.specialtyName === specialties.find(s => s._id === editActivityForm.specialtyId)?.name).map(u => (
                                                            <option key={u._id} value={u._id}>{u.name}</option>
                                                        ))}
                                                    </select>
                                                    <select value={editActivityForm.status} onChange={e => setEditActivityForm({ ...editActivityForm, status: e.target.value })}
                                                        className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 col-span-2">
                                                        {selectableStatuses.map(s => (
                                                            <option key={s._id} value={s.name}>{s.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="flex gap-2 pt-1">
                                                    <button onClick={() => handleEditActivity(activity._id)} disabled={isPending}
                                                        className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600 disabled:opacity-50">Save</button>
                                                    <button onClick={() => setEditingActivity(null)}
                                                        className="px-3 py-1.5 text-neutral-500 hover:bg-neutral-100 rounded-lg text-xs font-medium">Cancel</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-start gap-2 max-w-[80%]">
                                                    <div className="size-3 rounded-full mt-1 shrink-0 shadow-sm border border-black/10" style={{ backgroundColor: activity.specialtyColor || "#8B5CF6" }} />
                                                    <div>
                                                        <p className="text-sm font-bold text-neutral-900 dark:text-white leading-tight">{activity.name}</p>
                                                        {activity.description && <p className="text-xs text-neutral-500 line-clamp-1 mt-0.5">{activity.description}</p>}
                                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                                            <span className="inline-flex items-center justify-center px-1.5 py-1 rounded bg-neutral-100 dark:bg-neutral-800 text-[10px] font-bold text-neutral-600 dark:text-neutral-400 leading-none border border-neutral-200/50 dark:border-neutral-700/50">
                                                                {activity.specialtyName}
                                                            </span>
                                                            {activity.assignedToId && activeUsers.find(u => u._id === activity.assignedToId) && (
                                                                <span className="inline-flex items-center justify-center px-1.5 py-1 rounded bg-neutral-100 dark:bg-neutral-800 text-[10px] font-bold text-neutral-600 dark:text-neutral-400 gap-1 leading-none border border-neutral-200/50 dark:border-neutral-700/50">
                                                                    <span className="material-symbols-outlined text-[11px] leading-none">person</span>
                                                                    {activeUsers.find(u => u._id === activity.assignedToId)?.name.split(' ')[0]}
                                                                </span>
                                                            )}
                                                            <span className="inline-flex items-center justify-center px-1.5 py-1 rounded text-[10px] font-black uppercase tracking-wider leading-none border" style={{ 
                                                                backgroundColor: `${getStatusColor(activity.status)}15`,
                                                                color: getStatusColor(activity.status),
                                                                borderColor: `${getStatusColor(activity.status)}30`
                                                            }}>
                                                                {activity.status}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex gap-1">
                                                    <button onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingActivity(activity._id);
                                                        setEditActivityForm({
                                                            name: activity.name,
                                                            customId: activity.customId || "",
                                                            location: activity.location || "",
                                                            startDate: toDateInputValue(activity.dates?.startDate),
                                                            targetDate: toDateInputValue(activity.dates?.targetDate),
                                                            description: activity.description || "",
                                                            specialtyId: activity.specialtyId,
                                                            assignedTo: activity.assignedToId || "",
                                                            status: activity.status
                                                        });
                                                    }} className="p-1 text-neutral-400 hover:text-primary hover:bg-primary/10 rounded transition-colors opacity-0 group-hover:opacity-100" title="Edit Activity">
                                                        <span className="material-symbols-outlined text-[16px]">edit</span>
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteActivity(activity._id); }}
                                                        className="p-1 text-neutral-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors opacity-0 group-hover:opacity-100" title="Delete Activity">
                                                        <span className="material-symbols-outlined text-[16px]">delete</span>
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
