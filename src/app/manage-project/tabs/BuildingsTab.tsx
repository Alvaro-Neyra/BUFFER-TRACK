"use client";

import React, { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { createBuilding, updateBuilding, deleteBuilding, createFloor, deleteFloor, updateMasterPlanImage } from "../actions";
import { compressImage, formatFileSize } from "@/lib/compressImage";
import type { IBuildingWithFloors } from "@/services/project.service";

interface IBuildingsTabProps {
    buildings: IBuildingWithFloors[];
    currentProjectId: string;
    masterPlanImageUrl: string;
    commitmentCounts: Record<string, number>; // buildingId → count
}

type TMode = "view" | "placing";

export function BuildingsTab({ buildings, currentProjectId, masterPlanImageUrl, commitmentCounts }: IBuildingsTabProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const planContainerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const masterPlanFileRef = useRef<HTMLInputElement>(null);

    // Modes
    const [mode, setMode] = useState<TMode>("view");
    const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
    const [uploadingMasterPlan, setUploadingMasterPlan] = useState(false);
    const [compressionInfo, setCompressionInfo] = useState<string | null>(null);

    // Build form state
    const [newBuilding, setNewBuilding] = useState({ name: "", code: "", number: 1 });
    const [pendingCoords, setPendingCoords] = useState<{ x: number; y: number } | null>(null);

    // Edit state
    const [editingBuilding, setEditingBuilding] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ name: "", code: "", number: 1 });

    // Floor form state
    const [showAddFloor, setShowAddFloor] = useState<string | null>(null);
    const [newFloor, setNewFloor] = useState({ label: "", order: 1 });
    const [floorImageUrl, setFloorImageUrl] = useState("");
    const [uploading, setUploading] = useState(false);

    // ─── Shared: compress + upload helper ────────────────────────

    const compressAndUpload = async (file: File): Promise<string | null> => {
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
            const res = await fetch("/api/upload", { method: "POST", body: formData });
            const json = await res.json();

            if (json.success) {
                return json.data.url as string;
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
            const url = await compressAndUpload(file);
            if (url) {
                const result = await updateMasterPlanImage(currentProjectId, url);
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
            const url = await compressAndUpload(file);
            if (url) setFloorImageUrl(url);
        } finally {
            setUploading(false);
            setTimeout(() => setCompressionInfo(null), 8000);
        }
    };

    // ─── Plan click handler ──────────────────────────────────────

    const handlePlanClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (mode !== "placing") return;
        if (!planContainerRef.current) return;
        if ((e.target as HTMLElement).closest("[data-building-marker]")) return;

        const rect = planContainerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setPendingCoords({ x, y });
    };

    // ─── CRUD handlers ───────────────────────────────────────────

    const handleCreateBuilding = () => {
        if (!pendingCoords) return;
        startTransition(async () => {
            const res = await createBuilding(currentProjectId, {
                name: newBuilding.name,
                code: newBuilding.code,
                number: newBuilding.number,
                coordinates: { xPercent: pendingCoords.x, yPercent: pendingCoords.y },
            });
            if (res.success) {
                setMode("view");
                setPendingCoords(null);
                setNewBuilding({ name: "", code: "", number: buildings.length + 2 });
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
            const res = await createFloor(buildingId, { label: newFloor.label, order: newFloor.order, gcsImageUrl: floorImageUrl });
            if (res.success) {
                setShowAddFloor(null);
                setNewFloor({ label: "", order: 1 });
                setFloorImageUrl("");
                router.refresh();
            } else alert(res.error || "Failed to create floor");
        });
    };

    const [zoomScale, setZoomScale] = useState(1);
    const selected = buildings.find(b => b._id === selectedBuilding);

    const showCount = zoomScale >= 2.5;

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-full min-h-[600px]">
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
                        <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Master Plan</h2>
                        <p className="text-xs text-neutral-500">
                            {!masterPlanImageUrl
                                ? "Upload a master plan image to get started"
                                : mode === "placing"
                                    ? "👆 Click on the plan to place the building"
                                    : `${buildings.length} building${buildings.length !== 1 ? "s" : ""} placed`
                            }
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {masterPlanImageUrl && (
                            <button
                                onClick={() => masterPlanFileRef.current?.click()}
                                disabled={uploadingMasterPlan}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                                <span className="material-symbols-outlined text-[14px]">image</span>
                                {uploadingMasterPlan ? "Uploading..." : "Change Plan"}
                            </button>
                        )}
                        {masterPlanImageUrl && mode === "view" ? (
                            <button
                                onClick={() => {
                                    setMode("placing");
                                    setNewBuilding({ name: "", code: "", number: buildings.length + 1 });
                                    setPendingCoords(null);
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm"
                            >
                                <span className="material-symbols-outlined text-[18px]">add_location_alt</span>
                                Place Building
                            </button>
                        ) : masterPlanImageUrl && mode === "placing" ? (
                            <button
                                onClick={() => { setMode("view"); setPendingCoords(null); }}
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
                {!masterPlanImageUrl ? (
                    <div
                        className="flex-1 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-primary/50 transition-colors cursor-pointer min-h-[400px]"
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
                        {/* Plan Viewer */}
                        <div className={`flex-1 relative isolate rounded-xl border-2 overflow-hidden bg-neutral-100 dark:bg-neutral-800 shadow-inner ${mode === "placing" ? "border-primary border-dashed cursor-crosshair" : "border-neutral-200 dark:border-neutral-700 cursor-move"}`}>
                            <TransformWrapper
                                initialScale={1} minScale={0.5} maxScale={4} centerOnInit={true}
                                doubleClick={{ disabled: true }}
                                panning={{ disabled: mode === "placing" }}
                                onTransformed={(_ref, state) => setZoomScale(state.scale)}
                            >
                                {({ zoomIn, zoomOut }) => (
                                    <>
                                        <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
                                            <div
                                                ref={planContainerRef}
                                                className="relative inline-block w-full h-full min-h-[500px] min-w-[700px]"
                                                onClick={handlePlanClick}
                                            >
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    id="admin-plan-image"
                                                    src={masterPlanImageUrl}
                                                    alt="Master Plan"
                                                    className="w-full h-full object-cover"
                                                    draggable={false}
                                                />

                                                {/* Building markers — small dots, count visible at high zoom */}
                                                {buildings.map((b) => {
                                                    const count = commitmentCounts[b._id] || 0;
                                                    const isSelected = selectedBuilding === b._id;

                                                    return (
                                                        <div
                                                            key={b._id}
                                                            data-building-marker
                                                            className="absolute z-10 hover:z-50 group"
                                                            style={{
                                                                top: `${b.coordinates.yPercent}%`,
                                                                left: `${b.coordinates.xPercent}%`,
                                                                transform: "translate(-50%, -50%)",
                                                            }}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (mode === "view") setSelectedBuilding(isSelected ? null : b._id);
                                                            }}
                                                        >
                                                            {/* Pulse ring */}
                                                            {isSelected && (
                                                                <div className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
                                                            )}

                                                            {/* Main circle — small by default, shows count at high zoom */}
                                                            <div className={`relative flex items-center justify-center rounded-full shadow-lg border-2 cursor-pointer transition-all font-bold
                                                        ${showCount ? "size-8 text-xs" : "size-4"}
                                                        ${isSelected
                                                                    ? "bg-primary text-white border-white scale-125 ring-4 ring-primary/30"
                                                                    : "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white border-primary/60 hover:scale-125 hover:ring-2 hover:ring-primary/20"
                                                                }`}
                                                            >
                                                                {showCount && count}
                                                            </div>

                                                            {/* Tooltip — visible on hover, now above siblings via hover:z-50 */}
                                                            <div className="absolute left-1/2 -translate-x-1/2 -top-8 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                                                                <div className="bg-neutral-900 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg">
                                                                    {b.name} ({b.code})
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}

                                                {/* Pending placement marker */}
                                                {mode === "placing" && pendingCoords && (
                                                    <div
                                                        className="absolute z-20"
                                                        style={{
                                                            top: `${pendingCoords.y}%`,
                                                            left: `${pendingCoords.x}%`,
                                                            transform: "translate(-50%, -50%)",
                                                        }}
                                                    >
                                                        <div className="relative flex items-center justify-center size-6 rounded-full bg-emerald-500 text-white border-2 border-white shadow-xl animate-bounce">
                                                            <span className="material-symbols-outlined text-[14px]">add</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </TransformComponent>

                                        {/* Zoom controls */}
                                        <div className="absolute bottom-4 right-4 flex flex-col gap-1.5 bg-white/90 dark:bg-neutral-900/90 backdrop-blur rounded-lg shadow-md p-1 border border-neutral-200 dark:border-neutral-700 z-10">
                                            <button onClick={() => zoomIn()} className="p-1.5 text-neutral-600 dark:text-neutral-300 hover:text-primary hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors">
                                                <span className="material-symbols-outlined text-[18px]">add</span>
                                            </button>
                                            <button onClick={() => zoomOut()} className="p-1.5 text-neutral-600 dark:text-neutral-300 hover:text-primary hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors">
                                                <span className="material-symbols-outlined text-[18px]">remove</span>
                                            </button>
                                        </div>
                                    </>
                                )}
                            </TransformWrapper>
                        </div>

                        {/* Placing mode: form below the plan */}
                        {mode === "placing" && pendingCoords && (
                            <div className="bg-white dark:bg-neutral-900 border border-emerald-200 dark:border-emerald-800 rounded-xl p-5 shadow-sm">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="material-symbols-outlined text-emerald-500 text-[18px]">location_on</span>
                                    <span className="text-sm font-bold text-neutral-900 dark:text-white">
                                        New Building at ({pendingCoords.x.toFixed(1)}%, {pendingCoords.y.toFixed(1)}%)
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
                                <div className="flex gap-2">
                                    <button onClick={handleCreateBuilding} disabled={isPending || !newBuilding.name || !newBuilding.code}
                                        className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-bold hover:bg-emerald-600 transition-colors disabled:opacity-50 shadow-sm">
                                        Create Building
                                    </button>
                                    <button onClick={() => { setPendingCoords(null); }}
                                        className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-sm font-medium transition-colors">
                                        Clear Pin
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ─── Right: Building Details Panel ──────────────── */}
            <div className="w-full lg:w-96 flex flex-col gap-3 overflow-y-auto shrink-0">
                <h3 className="text-sm font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                    {selected ? selected.name : "Buildings"}
                </h3>

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

                {/* Building detail (when selected) */}
                {selected && (
                    <div className="space-y-4">
                        <button onClick={() => setSelectedBuilding(null)}
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
                                        <button onClick={() => { setEditingBuilding(selected._id); setEditForm({ name: selected.name, code: selected.code, number: selected.number }); }}
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
                                <button onClick={() => { setShowAddFloor(selected._id); setNewFloor({ label: "", order: selected.floors.length + 1 }); setFloorImageUrl(""); }}
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
                                                <Image src={floorImageUrl} alt="Preview" fill className="object-contain" />
                                                <button onClick={() => { setFloorImageUrl(""); if (fileInputRef.current) fileInputRef.current.value = ""; }}
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
                                        <button onClick={() => { setShowAddFloor(null); setFloorImageUrl(""); }}
                                            className="px-3 py-1.5 text-neutral-600 hover:bg-neutral-100 rounded-lg text-xs font-medium">Cancel</button>
                                    </div>
                                </div>
                            )}

                            {/* Floor list */}
                            {selected.floors.length === 0 ? (
                                <p className="text-xs text-neutral-500 italic py-3 text-center">No floors yet</p>
                            ) : (
                                <div className="space-y-1.5">
                                    {selected.floors.map(floor => (
                                        <div key={floor._id} className="flex items-center justify-between bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2.5 group">
                                            <div className="flex items-center gap-2.5">
                                                {floor.gcsImageUrl && (
                                                    <div className="relative size-7 rounded border border-neutral-200 dark:border-neutral-700 overflow-hidden shrink-0">
                                                        <Image src={floor.gcsImageUrl} alt={floor.label} fill className="object-cover" />
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="text-sm font-semibold text-neutral-900 dark:text-white">{floor.label}</p>
                                                    <p className="text-[10px] text-neutral-500">Level {floor.order}</p>
                                                </div>
                                            </div>
                                            <button onClick={() => handleDeleteFloor(floor._id)}
                                                className="p-1 text-neutral-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors opacity-0 group-hover:opacity-100">
                                                <span className="material-symbols-outlined text-[14px]">delete</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
