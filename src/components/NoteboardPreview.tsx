import React, { useEffect, useRef } from 'react';
import { renderElement } from '../renderer';
import type { NoteboardElement } from '../elements/types';
import { getElementBounds } from '../elements/bounds';

export interface NoteboardPreviewProps {
    elements: NoteboardElement[];
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

    // These dimensions are only the initial/fallback backing-store size. Once
    // mounted, the canvas tracks its rendered CSS size and device-pixel ratio.
    const fallbackWidth = 800;
    const fallbackHeight = 400;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        let active = true;

        const fallbackCssDimension = (value: number | string, fallback: number) => {
            if (typeof value === 'number' && Number.isFinite(value)) return value;
            if (typeof value === 'string' && value.trim().endsWith('px')) {
                const parsed = Number.parseFloat(value);
                if (Number.isFinite(parsed)) return parsed;
            }
            return fallback;
        };

        const paint = () => {
            if (!active) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const cssWidth = canvas.clientWidth || fallbackCssDimension(width, fallbackWidth);
            const cssHeight = canvas.clientHeight || fallbackCssDimension(height, fallbackHeight);
            const dpr = window.devicePixelRatio || 1;
            const backingWidth = Math.max(1, Math.round(cssWidth * dpr));
            const backingHeight = Math.max(1, Math.round(cssHeight * dpr));

            if (canvas.width !== backingWidth) canvas.width = backingWidth;
            if (canvas.height !== backingHeight) canvas.height = backingHeight;

            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const activeElements = elements.filter((element) => !element.isDeleted);
            if (activeElements.length === 0) return;

            let minX = Infinity;
            let minY = Infinity;
            let maxX = -Infinity;
            let maxY = -Infinity;
            for (const element of activeElements) {
                const [x1, y1, x2, y2] = getElementBounds(element);
                minX = Math.min(minX, x1);
                minY = Math.min(minY, y1);
                maxX = Math.max(maxX, x2);
                maxY = Math.max(maxY, y2);
            }

            minX -= padding;
            minY -= padding;
            maxX += padding;
            maxY += padding;

            const contentWidth = Math.max(maxX - minX, 1);
            const contentHeight = Math.max(maxY - minY, 1);
            const scale = Math.min(cssWidth / contentWidth, cssHeight / contentHeight, 1);
            const offsetX = (cssWidth / scale - contentWidth) / 2 - minX;
            const offsetY = (cssHeight / scale - contentHeight) / 2 - minY;

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.scale(scale, scale);
            ctx.translate(offsetX, offsetY);

            for (const element of activeElements) {
                renderElement(ctx, element, false, paint);
            }
        };

        paint();

        const observer = typeof ResizeObserver === 'undefined'
            ? null
            : new ResizeObserver(paint);
        observer?.observe(canvas);
        return () => {
            active = false;
            observer?.disconnect();
        };
    }, [elements, height, padding, width]);

    return (
        <canvas
            ref={canvasRef}
            width={fallbackWidth}
            height={fallbackHeight}
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
