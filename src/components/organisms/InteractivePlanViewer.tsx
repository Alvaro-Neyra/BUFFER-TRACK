// ------------------------------------------------------------------
// InteractivePlanViewer — WebGL-powered master plan viewer with PixiJS
// Features: Smooth zoom/pan, building/activity polygons, keyboard navigation,
//           click-to-place hotspots
// ------------------------------------------------------------------

"use client";

import React, {
    useRef,
    useEffect,
    useCallback,
    useState,
} from "react";
import { Application, Container, Sprite, Assets } from "pixi.js";
import { FloorSelectorModal } from "@/components/organisms/FloorSelectorModal";
import { FreeDrawOverlay } from "@/components/organisms/FreeDrawOverlay";
import type { IPercentPoint } from "@/components/organisms/FreeDrawOverlay";
import { PixelGridOverlay } from "@/components/atoms/PixelGridOverlay";

export type TViewerMode = "view" | "placing" | "drawing";

interface IFloorData {
    _id: string;
    label: string;
    order: number;
}

// Support both ID types to make this generic
interface IHotspotData {
    _id: string;
    name?: string;     // building name
    code?: string;     // building code
    description?: string; // activity description
    commitmentCount?: number; // number of commitments (for building hotspots)
    coordinates: { xPercent: number; yPercent: number };
    polygon?: Array<{ xPercent: number; yPercent: number }>;
    color?: string;
    icon?: string;
    floors?: IFloorData[];
}

interface IInteractivePlanViewerProps {
    imageUrl: string;
    hotspots: IHotspotData[]; // Generic hotspots (buildings or activities)

    // Admin modes and state
    mode?: TViewerMode;
    pendingCoords?: { x: number; y: number } | null;
    pendingPolygon?: IPercentPoint[] | null;
    selectedHotspotId?: string | null;
    focusPulse?: number; // Forces the view to zoom/center again onto the hotspot

    // Events
    onMapClick?: (xPercent: number, yPercent: number) => void;
    onHotspotSelect?: (hotspot: IHotspotData) => void;
    onCreatePolygon?: (points: IPercentPoint[]) => void;

    // Customization
    hotspotIcon?: string; // Which icon to normally use if drawn (e.g., 'domain' or 'assignment')
    hideDefaultHotspots?: boolean; // Use true if you provide custom children and don't want default pins
    children?: React.ReactNode; // Optional custom overlays/pins
}

const POLY_COLORS = ["#8B5CF6", "#3B82F6", "#F59E0B", "#10B981", "#EC4899", "#06B6D4"];
const MAX_SCALE = 100;
const PAN_STEP = 50;

function getHotspotLabel(hotspot: IHotspotData): string {
    const isBuildingHotspot = Array.isArray(hotspot.floors);
    if (isBuildingHotspot) {
        const count = Math.max(0, hotspot.commitmentCount ?? 0);
        return count === 1 ? "1 commitment" : `${count} commitments`;
    }

    return hotspot.code || hotspot.name || hotspot.description || "";
}

export const InteractivePlanViewer = ({
    imageUrl,
    hotspots,
    mode = "view",
    pendingCoords,
    pendingPolygon,
    selectedHotspotId,
    onMapClick,
    onHotspotSelect,
    onCreatePolygon,
    hotspotIcon = "domain",
    hideDefaultHotspots = false,
    focusPulse,
    children,
}: IInteractivePlanViewerProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const pixiAppRef = useRef<Application | null>(null);
    const pixiContainerRef = useRef<Container | null>(null);

    const [viewport, setViewport] = useState({ width: 0, height: 0 });
    const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
    const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [isSpacePressed, setIsSpacePressed] = useState(false);
    const [selectedHotspot, setSelectedHotspot] = useState<IHotspotData | null>(null);
    const panStateRef = useRef({ startX: 0, startY: 0, originX: 0, originY: 0 });
    const initialViewRef = useRef({ scale: 1, x: 0, y: 0 });

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const updateSize = () => {
            const rect = el.getBoundingClientRect();
            setViewport({ width: rect.width, height: rect.height });
        };

        updateSize();

        if (typeof ResizeObserver !== "undefined") {
            const observer = new ResizeObserver(updateSize);
            observer.observe(el);
            return () => observer.disconnect();
        }

        window.addEventListener("resize", updateSize);
        return () => window.removeEventListener("resize", updateSize);
    }, []);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            if (e.code === "Space") {
                e.preventDefault();
                setIsSpacePressed(true);
            }

            setView((prev) => {
                let { scale, x, y } = prev;

                switch (e.key) {
                    case "ArrowUp":
                        y += PAN_STEP;
                        break;
                    case "ArrowDown":
                        y -= PAN_STEP;
                        break;
                    case "ArrowLeft":
                        x += PAN_STEP;
                        break;
                    case "ArrowRight":
                        x -= PAN_STEP;
                        break;
                    case "+":
                    case "=":
                        scale = Math.min(MAX_SCALE, scale * 1.1);
                        break;
                    case "-":
                        scale = Math.max(initialViewRef.current.scale, scale * 0.9);
                        break;
                    case "0":
                        scale = initialViewRef.current.scale;
                        x = initialViewRef.current.x;
                        y = initialViewRef.current.y;
                        break;
                    default:
                        return prev;
                }

                return { scale, x, y };
            });
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === "Space") {
                setIsSpacePressed(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
        };
    }, []);

    const clampScale = (scale: number) => Math.min(MAX_SCALE, Math.max(initialViewRef.current.scale, scale));

    const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
        event.preventDefault();
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        setView((prev) => {
            const factor = event.deltaY > 0 ? 0.9 : 1.1;
            const nextScale = clampScale(prev.scale * factor);
            const k = nextScale / prev.scale;

            const nextX = mouseX - (mouseX - prev.x) * k;
            const nextY = mouseY - (mouseY - prev.y) * k;

            return { scale: nextScale, x: nextX, y: nextY };
        });
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        // We always record pointer down for click detection
        panStateRef.current = {
            startX: event.clientX,
            startY: event.clientY,
            originX: view.x,
            originY: view.y,
        };

        // If placing/drawing, only allow pan if Space is held or using middle mouse button (button 1)
        const isMiddleClick = event.button === 1;
        if ((mode === "placing" || mode === "drawing") && !isSpacePressed && !isMiddleClick) {
            return;
        }

        const target = event.target as HTMLElement;
        if (target.closest("[data-building-hotspot]")) return;

        setIsPanning(true);
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!isPanning) return;

        const { startX, startY, originX, originY } = panStateRef.current;
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;

        setView((prev) => ({
            ...prev,
            x: originX + dx,
            y: originY + dy,
        }));
    };

    const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
        const { startX, startY } = panStateRef.current;
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        const moved = Math.hypot(dx, dy) > 5;

        if (isPanning) {
            setIsPanning(false);
            event.currentTarget.releasePointerCapture(event.pointerId);
        }

        // Only allow map clicks to trigger creation logic when not in pure view mode.
        // In Master Plan (`mode="view"`), clicks should only be for pan/zoom and hotspot selection.
        if (
            mode !== "view" &&
            !moved &&
            onMapClick &&
            containerRef.current &&
            imageSize.width > 0 &&
            imageSize.height > 0
        ) {
            const rect = containerRef.current.getBoundingClientRect();
            // Mouse position relative to container
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;

            // Reverse transform to get coordinates in the unscaled original image space
            const imgX = (mouseX - view.x) / view.scale;
            const imgY = (mouseY - view.y) / view.scale;

            // Convert to percentages
            const xPercent = (imgX / imageSize.width) * 100;
            const yPercent = (imgY / imageSize.height) * 100;

            // Only trigger if click is WITHIN the image bounds
            if (xPercent >= 0 && xPercent <= 100 && yPercent >= 0 && yPercent <= 100) {
                onMapClick(xPercent, yPercent);
            }
        }
    };

    const handlePointerLeave = () => {
        if (!isPanning) return;
        setIsPanning(false);
    };

    const zoomAtPoint = useCallback((factor: number, point?: { x: number; y: number }) => {
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const cx = point?.x ?? rect.width / 2;
        const cy = point?.y ?? rect.height / 2;

        setView((prev) => {
            const nextScale = clampScale(prev.scale * factor);
            const k = nextScale / prev.scale;

            const nextX = cx - (cx - prev.x) * k;
            const nextY = cy - (cy - prev.y) * k;

            return { scale: nextScale, x: nextX, y: nextY };
        });
    }, []);

    const handleZoomIn = useCallback(() => zoomAtPoint(1.1), [zoomAtPoint]);
    const handleZoomOut = useCallback(() => zoomAtPoint(0.9), [zoomAtPoint]);

    const handleReset = useCallback(() => {
        setView(initialViewRef.current);
    }, []);

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const hasInitializedViewRef = useRef(false);

    // Initialize PixiJS vanilla application
    useEffect(() => {
        if (!canvasContainerRef.current) return;

        let isMounted = true;
        hasInitializedViewRef.current = false; // Reset initialization on new image

        const initPixi = async () => {
            try {
                const app = new Application();
                await app.init({
                    width: viewport.width > 0 ? viewport.width : 100,
                    height: viewport.height > 0 ? viewport.height : 100,
                    backgroundAlpha: 0,
                    antialias: true,
                    resolution: dpr,
                    autoDensity: true,
                });

                if (!isMounted) {
                    app.destroy(true, { children: true, texture: false });
                    return;
                }

                if (canvasContainerRef.current) {
                    canvasContainerRef.current.appendChild(app.canvas);
                }
                pixiAppRef.current = app;

                const texture = await Assets.load(imageUrl);
                if (!isMounted) return;

                const sprite = new Sprite(texture);
                setImageSize({ width: texture.width, height: texture.height });
                // We do NOT stretch the sprite, it draws at its native dimensions.

                const container = new Container();
                container.addChild(sprite);
                app.stage.addChild(container);

                pixiContainerRef.current = container;

                if (viewport.width > 0 && viewport.height > 0) {
                    const fitScale = Math.min(
                        viewport.width / texture.width,
                        viewport.height / texture.height
                    );

                    const initialX = (viewport.width - texture.width * fitScale) / 2;
                    const initialY = (viewport.height - texture.height * fitScale) / 2;

                    initialViewRef.current = { scale: fitScale, x: initialX, y: initialY };

                    if (!hasInitializedViewRef.current) {
                        setView(initialViewRef.current);

                        // Apply immediately to avoid flicker
                        container.x = initialX;
                        container.y = initialY;
                        container.scale.set(fitScale);

                        hasInitializedViewRef.current = true;
                    }
                }

            } catch (error) {
                console.error("PixiJS initialization failed:", error);
            }
        };

        if (imageUrl) {
            initPixi();
        }

        return () => {
            isMounted = false;
            if (pixiAppRef.current) {
                // Destroy app strictly. Remove canvas from DOM.
                const canvas = pixiAppRef.current.canvas;
                if (canvas && canvas.parentNode) {
                    canvas.parentNode.removeChild(canvas);
                }
                pixiAppRef.current.destroy(true, { children: true, texture: false });
                pixiAppRef.current = null;
                pixiContainerRef.current = null;
            }
        };
        // Re-init if image changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [imageUrl, dpr]);

    // Handle Resize without destroying Pixi application
    useEffect(() => {
        if (!pixiAppRef.current || viewport.width === 0 || viewport.height === 0 || imageSize.width === 0 || imageSize.height === 0) return;

        pixiAppRef.current.renderer.resize(viewport.width, viewport.height);

        const fitScale = Math.min(
            viewport.width / imageSize.width,
            viewport.height / imageSize.height
        );
        const initialX = (viewport.width - imageSize.width * fitScale) / 2;
        const initialY = (viewport.height - imageSize.height * fitScale) / 2;

        initialViewRef.current = { scale: fitScale, x: initialX, y: initialY };

        if (!hasInitializedViewRef.current) {
            setView(initialViewRef.current);
            hasInitializedViewRef.current = true;
        }
    }, [viewport.width, viewport.height, imageSize.width, imageSize.height]);

    // Apply view transforms efficiently without React re-renders of the canvas
    useEffect(() => {
        if (pixiContainerRef.current) {
            pixiContainerRef.current.x = view.x;
            pixiContainerRef.current.y = view.y;
            pixiContainerRef.current.scale.set(view.scale);
        }
    }, [view]);

    // Animate to selected hotspot
    useEffect(() => {
        if (!selectedHotspotId || !containerRef.current || imageSize.width === 0 || imageSize.height === 0) return;
        const targetHotspot = hotspots.find(h => h._id === selectedHotspotId);
        if (!targetHotspot) return;

        const rect = containerRef.current.getBoundingClientRect();

        // Target scale (zoomed in, but clamped)
        // 30x initial scale represents approx 3000%
        const targetScale = clampScale(initialViewRef.current.scale * 30);

        // Target center in pixel coordinates of the original image
        const imgX = (targetHotspot.coordinates.xPercent / 100) * imageSize.width;
        const imgY = (targetHotspot.coordinates.yPercent / 100) * imageSize.height;

        // Calculate the container position to put imgX, imgY at the center of the viewport
        const targetViewX = (rect.width / 2) - (imgX * targetScale);
        const targetViewY = (rect.height / 2) - (imgY * targetScale);

        // Simple spring/lerp animation
        let animationFrameId: number;
        let p = 0;
        const duration = 30; // frames (~500ms at 60fps)
        const startView = { ...view };

        const animate = () => {
            p += 1;
            const t = p / duration;
            // Ease out cubic
            const ease = 1 - Math.pow(1 - t, 3);

            setView({
                scale: startView.scale + (targetScale - startView.scale) * ease,
                x: startView.x + (targetViewX - startView.x) * ease,
                y: startView.y + (targetViewY - startView.y) * ease,
            });

            if (p < duration) {
                animationFrameId = requestAnimationFrame(animate);
            }
        };

        animate();

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
        // We only want this to run when selectedHotspotId or focusPulse changes specifically
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedHotspotId, focusPulse]);

    // Cursor strategy
    const getCursor = () => {
        if (isPanning) return "grabbing";
        if (isSpacePressed) return "grab";
        if (mode === "drawing") return "crosshair";
        if (mode === "placing") return "crosshair";
        return "grab";
    };

    // Calculate dynamic hotspot sizes based on current zoom
    const zoomPercentage = initialViewRef.current.scale > 0 ? (view.scale / initialViewRef.current.scale) : 1;
    // Map the zoom from 1x to 1000x to a factor from 0 to 1
    const clampedZoom = Math.max(1, Math.min(zoomPercentage, 1000));
    // Easing factor (logarithmic visually feels better for extreme zooms)
    // At 1x -> 0. At 10x -> ~0.33, at 100x -> ~0.66, at 1000x -> 1.0
    const zoomT = Math.log10(clampedZoom) / 3;

    // Dynamic sizes:
    // Dot size: from 24px (zoomed out) to 4px (max zoom)
    const dotSize = 24 - (24 - 4) * zoomT;

    // Icon wrapper size: from 40px (zoomed out) to 12px (max zoom)
    const iconWrapperSize = 40 - (40 - 12) * zoomT;

    // Icon font size: from 28px (zoomed out) to 8px (max zoom)
    const iconFontSize = 28 - (28 - 8) * zoomT;

    // Pulse size (for placing): slightly larger than dot
    const pulseSize = dotSize * 1.5;

    // Label font size: from 14px (zoomed out) to 9px (max zoom)
    const labelFontSize = 14 - (14 - 9) * zoomT;
    const labelTopOffset = -(iconWrapperSize / 2) - labelFontSize - 4; // Dynamic offset

    return (
        <>
            <div
                ref={containerRef}
                className="flex-1 min-h-125 relative rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 shadow-inner overflow-hidden"
                style={{
                    touchAction: "none",
                    cursor: getCursor()
                }}
                onWheel={handleWheel}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerLeave}
            >
                {/* Native Canvas Container */}
                <div ref={canvasContainerRef} className="absolute inset-0 z-0 pointer-events-none" />

                {/* Overlay for grid and drawing (HTML overlays syncing with WebGL) */}
                <div
                    className="absolute pointer-events-none"
                    style={{
                        width: imageSize.width > 0 ? imageSize.width : '100%',
                        height: imageSize.height > 0 ? imageSize.height : '100%',
                        transformOrigin: "0 0",
                        transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`,
                    }}
                >
                    {/* Only show grid and free draw when drawing */}
                    {mode === "drawing" && (
                        <>
                            <PixelGridOverlay zoomScale={view.scale} />
                            {/* FreeDrawOverlay must intercept pointer events itself when drawing, unless space is pressed for panning */}
                            <div className={`absolute inset-0 z-10 ${isSpacePressed ? 'pointer-events-none' : 'pointer-events-auto'}`}>
                                <FreeDrawOverlay
                                    isDrawing={true}
                                    onDrawComplete={(pts) => {
                                        if (onCreatePolygon) onCreatePolygon(pts);
                                    }}
                                />
                            </div>
                        </>
                    )}

                    {/* Pending Hotspot (Placing Mode) */}
                    {mode === "placing" && pendingCoords && (
                        <div
                            className="absolute z-20 pointer-events-none"
                            style={{
                                top: `${pendingCoords.y}%`,
                                left: `${pendingCoords.x}%`,
                                transform: `translate(-50%, -50%) scale(${1 / Math.max(view.scale, 1)})`,
                            }}
                        >
                            <div
                                className="rounded-full bg-neutral-500 animate-pulse shadow-md ring-2 ring-white"
                                style={{
                                    width: `${pulseSize}px`,
                                    height: `${pulseSize}px`,
                                }}
                            />
                            <div
                                className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap z-50"
                                style={{ top: `${-(pulseSize / 2) - labelFontSize - 6}px` }}
                            >
                                <div
                                    className="bg-neutral-900 text-white font-bold px-1.5 py-0.5 rounded shadow-lg"
                                    style={{ fontSize: `${Math.max(labelFontSize, 9)}px` }}
                                >
                                    NEW
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Pending polygon preview while drawing */}
                    {mode === "drawing" && pendingPolygon && pendingPolygon.length >= 2 && imageSize.width > 0 && imageSize.height > 0 && (
                        <svg
                            className="absolute inset-0 z-20 pointer-events-none"
                            viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
                            preserveAspectRatio="none"
                        >
                            <polygon
                                points={pendingPolygon
                                    .map((point) => `${(point.xPercent / 100) * imageSize.width},${(point.yPercent / 100) * imageSize.height}`)
                                    .join(" ")}
                                fill="rgba(16, 185, 129, 0.18)"
                                stroke="#10B981"
                                strokeWidth={Math.max(1, 2 / Math.max(view.scale, 1))}
                            />
                        </svg>
                    )}

                    {!hideDefaultHotspots && hotspots.map((hotspot, idx) => (
                        <div
                            key={hotspot._id}
                            data-building-hotspot
                            className="absolute group pointer-events-auto"
                            style={{
                                top: `${hotspot.coordinates.yPercent}%`,
                                left: `${hotspot.coordinates.xPercent}%`,
                                transform: `translate(-50%, -50%) scale(${1 / Math.max(view.scale, 1)})`,
                                cursor: "pointer",
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onHotspotSelect) {
                                    onHotspotSelect(hotspot);
                                } else {
                                    setSelectedHotspot(hotspot);
                                }
                            }}
                        >
                            {hotspot.polygon && hotspot.polygon.length >= 3 ? (
                                <div
                                    className={`flex items-center justify-center rounded shadow-sm hover:ring-2 hover:ring-white transition-all ${hotspot._id === selectedHotspotId ? "ring-2 ring-white scale-125" : ""}`}
                                    style={{
                                        backgroundColor: hotspot.color || POLY_COLORS[idx % POLY_COLORS.length],
                                        width: `${iconWrapperSize}px`,
                                        height: `${iconWrapperSize}px`
                                    }}
                                >
                                    <span
                                        className="material-symbols-outlined text-white"
                                        style={{
                                            fontSize: `${iconFontSize}px`,
                                            lineHeight: `${iconFontSize}px`,
                                        }}
                                    >{hotspot.icon || hotspotIcon}</span>
                                </div>
                            ) : (
                                <div
                                    className={`flex items-center justify-center rounded-full shadow-sm hover:ring-2 hover:ring-white transition-all ${hotspot._id === selectedHotspotId ? "ring-2 ring-white scale-125" : ""}`}
                                    style={{
                                        backgroundColor: hotspot.color || POLY_COLORS[idx % POLY_COLORS.length],
                                        width: `${Math.max(dotSize, iconWrapperSize * 0.8)}px`,
                                        height: `${Math.max(dotSize, iconWrapperSize * 0.8)}px`
                                    }}
                                >
                                    <span
                                        className="material-symbols-outlined text-white"
                                        style={{
                                            fontSize: `${Math.max(iconFontSize * 0.8, 12)}px`,
                                            lineHeight: `${Math.max(iconFontSize * 0.8, 12)}px`,
                                        }}
                                    >{hotspot.icon || "task_alt"}</span>
                                </div>
                            )}
                            <div
                                className="absolute left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50"
                                style={{ top: `${labelTopOffset}px` }}
                            >
                                <div
                                    className="bg-neutral-900 text-white font-bold px-1.5 py-0.5 rounded shadow-lg"
                                    style={{ fontSize: `${Math.max(labelFontSize, 9)}px` }}
                                >
                                    {getHotspotLabel(hotspot)}
                                </div>
                            </div>
                        </div>
                    ))}

                    {children && (
                        <div className="absolute inset-0 z-30 pointer-events-auto">
                            {children}
                        </div>
                    )}
                </div>

                {/* UI Controls */}
                <div
                    className="absolute bottom-4 right-4 z-10 flex flex-col gap-1 bg-white dark:bg-neutral-800 rounded-md shadow-md border border-neutral-200 dark:border-neutral-700 p-0.5"
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <button
                        onClick={handleZoomIn}
                        className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition-colors border-none shadow-none cursor-pointer"
                        title="Zoom In (+)"
                    >
                        <span className="material-symbols-outlined text-neutral-600 dark:text-neutral-300 text-[16px]">add</span>
                    </button>
                    <button
                        onClick={handleReset}
                        className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition-colors border-none shadow-none cursor-pointer"
                        title="Reset (0)"
                    >
                        <span className="material-symbols-outlined text-neutral-600 dark:text-neutral-300 text-[16px]">fit_screen</span>
                    </button>
                    <button
                        onClick={handleZoomOut}
                        className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition-colors border-none shadow-none cursor-pointer"
                        title="Zoom Out (-)"
                    >
                        <span className="material-symbols-outlined text-neutral-600 dark:text-neutral-300 text-[16px]">remove</span>
                    </button>
                </div>

                <div className="absolute bottom-4 left-4 z-10 bg-neutral-900/80 text-white text-[10px] font-mono px-1.5 py-0.5 rounded select-none">
                    {initialViewRef.current.scale > 0 ? Math.round((view.scale / initialViewRef.current.scale) * 100) : 100}%
                </div>

                {hotspots.length > 0 && (
                    <div
                        className="absolute top-3 left-3 z-10 bg-white/90 dark:bg-neutral-800/90 backdrop-blur-sm rounded-md shadow-md border border-neutral-200 dark:border-neutral-700 p-2.5 max-h-48 overflow-y-auto"
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        <h4 className="text-[9px] font-bold uppercase text-neutral-500 mb-1">Commitments</h4>
                        <div className="flex flex-col gap-0.5">
                            {hotspots.slice(0, 6).map((h, idx) => (
                                <button
                                    key={h._id}
                                    data-building-hotspot
                                    onClick={() => {
                                        if (onHotspotSelect) onHotspotSelect(h);
                                        else setSelectedHotspot(h);
                                    }}
                                    className="flex items-center gap-1 hover:opacity-80 transition-opacity text-left cursor-pointer"
                                >
                                    <div
                                        className="w-1.5 h-1.5 rounded-full"
                                        style={{
                                            backgroundColor: h.color || POLY_COLORS[idx % POLY_COLORS.length],
                                        }}
                                    />
                                    <span className="text-[10px] text-neutral-700 dark:text-neutral-300 truncate max-w-30">{h.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {selectedHotspot && selectedHotspot.floors && (
                <FloorSelectorModal
                    buildingName={selectedHotspot.name || ""}
                    buildingCode={selectedHotspot.code || ""}
                    floors={selectedHotspot.floors}
                    onClose={() => setSelectedHotspot(null)}
                />
            )}
        </>
    );
};
