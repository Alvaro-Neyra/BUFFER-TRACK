// ------------------------------------------------------------------
// PlanViewer — High-performance WebGL floor plan viewer
// Uses PixiJS (WebGL) for the image and keeps DOM overlay for pins.
// ------------------------------------------------------------------

"use client";

import React, {
    useRef,
    useEffect,
    useCallback,
    useState,
    useMemo,
} from "react";
import { Application, extend } from "@pixi/react";
import { Container, Sprite, Texture } from "pixi.js";

extend({ Container, Sprite });

interface IPlanViewerProps {
    imageUrl: string;
    children?: React.ReactNode;
    onMapClick?: (xPercent: number, yPercent: number) => void;
}

const MIN_SCALE = 0.2;
const MAX_SCALE = 8;

export const PlanViewer = ({ imageUrl, children, onMapClick }: Readonly<IPlanViewerProps>) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const texture = useMemo(() => Texture.from(imageUrl), [imageUrl]);

    const [viewport, setViewport] = useState({ width: 0, height: 0 });
    const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const panStateRef = useRef({ startX: 0, startY: 0, originX: 0, originY: 0 });

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

    const clampScale = (scale: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

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
        const target = event.target as HTMLElement;
        if (target.closest("[data-plan-pin]")) return;

        setIsPanning(true);
        panStateRef.current = {
            startX: event.clientX,
            startY: event.clientY,
            originX: view.x,
            originY: view.y,
        };
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
        if (!isPanning) return;

        const { startX, startY } = panStateRef.current;
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        const moved = Math.hypot(dx, dy) > 5;

        setIsPanning(false);
        event.currentTarget.releasePointerCapture(event.pointerId);

        if (!moved && onMapClick && overlayRef.current) {
            const rect = overlayRef.current.getBoundingClientRect();
            const xPercent = ((event.clientX - rect.left) / rect.width) * 100;
            const yPercent = ((event.clientY - rect.top) / rect.height) * 100;
            onMapClick(xPercent, yPercent);
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
        setView({ scale: 1, x: 0, y: 0 });
    }, []);

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

    const overlayTransform = {
        transformOrigin: "0 0",
        transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`,
        pointerEvents: "auto" as const,
    };

    return (
        <div
            ref={containerRef}
            className="flex-1 relative rounded-xl shadow-inner bg-neutral-200 dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600"
            style={{ overflow: "hidden", touchAction: "none", cursor: isPanning ? "grabbing" : "grab" }}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
        >
            {viewport.width > 0 && viewport.height > 0 && (
                <Application
                    className="absolute inset-0"
                    width={viewport.width}
                    height={viewport.height}
                    backgroundAlpha={0}
                    antialias={true}
                    resolution={dpr}
                >
                    <pixiContainer x={view.x} y={view.y} scale={view.scale}>
                        <pixiSprite
                            texture={texture}
                            width={viewport.width}
                            height={viewport.height}
                        />
                    </pixiContainer>
                </Application>
            )}

            <div
                ref={overlayRef}
                className="absolute inset-0 w-full h-full"
                style={overlayTransform}
            >
                {children}
            </div>

            <div className="absolute bottom-4 right-4 flex flex-col gap-1 bg-white/90 dark:bg-neutral-900/90 backdrop-blur rounded-md shadow-md p-0.5 border border-neutral-200 dark:border-neutral-700 z-10">
                <button onClick={handleZoomIn} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors" title="Zoom In">
                    <span className="material-symbols-outlined text-neutral-600 dark:text-neutral-300 text-[16px]">add</span>
                </button>
                <button onClick={handleReset} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors" title="Fit">
                    <span className="material-symbols-outlined text-neutral-600 dark:text-neutral-300 text-[16px]">fit_screen</span>
                </button>
                <button onClick={handleZoomOut} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors" title="Zoom Out">
                    <span className="material-symbols-outlined text-neutral-600 dark:text-neutral-300 text-[16px]">remove</span>
                </button>
            </div>

            <div className="absolute bottom-4 left-4 z-10 bg-neutral-900/80 text-white text-[10px] font-mono px-1.5 py-0.5 rounded select-none">
                {Math.round(view.scale * 100)}%
            </div>
        </div>
    );
};
