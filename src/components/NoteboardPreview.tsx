import React, { useEffect, useRef } from 'react';
import { renderElement } from '../renderer';
import type { NoteboardElement } from '../elements/types';

export interface NoteboardPreviewProps {
    elements: NoteboardElement[] | any[];
    width?: number | string;
    height?: number | string;
    className?: string;
    style?: React.CSSProperties;
    /** Padding around the bounded elements (default: 40) */
    padding?: number;
}

export function NoteboardPreview({
    elements,
    width = '100%',
    height = '150px',
    className,
    style,
    padding = 40,
}: NoteboardPreviewProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Use a fixed internal resolution for rendering, scaled down by CSS.
    // This ensures crisp rendering on high-DPI displays if needed,
    // though for a simple preview 800x400 internal resolution is plenty.
    const internalWidth = 800;
    const internalHeight = 400;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !elements || elements.length === 0) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // 1. Find the bounding box of all the shapes to know how big the drawing is
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        elements.forEach((el) => {
            if (el.isDeleted) return;
            if (el.x < minX) minX = el.x;
            if (el.y < minY) minY = el.y;
            // Rough estimation of width/height for bounds
            const w = el.width || 100;
            const h = el.height || 100;
            if (el.x + w > maxX) maxX = el.x + w;
            if (el.y + h > maxY) maxY = el.y + h;
        });

        if (minX === Infinity) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return; // Nothing to draw
        }

        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;

        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;

        // 2. Calculate the zoom scale to make it fit perfectly inside our canvas
        const scaleX = canvas.width / contentWidth;
        const scaleY = canvas.height / contentHeight;
        // Clamp to 1 so small drawings don't blow up huge
        const scale = Math.min(scaleX, scaleY, 1);

        // 3. Calculate offset to center the drawing
        const offsetX = (canvas.width / scale - contentWidth) / 2 - minX;
        const offsetY = (canvas.height / scale - contentHeight) / 2 - minY;

        // 4. Reset, clear, and apply our zoom/pan
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.scale(scale, scale);
        ctx.translate(offsetX, offsetY);

        // 5. Paint the elements
        elements.forEach((el) => {
            if (!el.isDeleted) {
                renderElement(ctx, el as NoteboardElement);
            }
        });
    }, [elements, padding]);

    return (
        <canvas
            ref={canvasRef}
            width={internalWidth}
            height={internalHeight}
            className={className}
            style={{
                width,
                height,
                display: 'block',
                background: 'var(--color-background-soft, #f5f5f5)',
                ...style,
            }}
        />
    );
}
