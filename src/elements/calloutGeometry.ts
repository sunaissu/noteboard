import type { CalloutElement, Point } from './types';

export interface CalloutGeometry {
    body: {
        x: number;
        y: number;
        width: number;
        height: number;
        radius: number;
    };
    tail: readonly [Point, Point, Point];
}

/**
 * Return the unrotated geometry used to render and interact with a callout.
 * Width and height are normalized so drawing in any pointer direction produces
 * the same visual tail placement.
 */
export function getCalloutGeometry(element: CalloutElement): CalloutGeometry {
    const x = Math.min(element.x, element.x + element.width);
    const y = Math.min(element.y, element.y + element.height);
    const width = Math.abs(element.width);
    const height = Math.abs(element.height);
    const radius = Math.min(10, width * 0.08, height * 0.08);
    const tailWidth = Math.min(20, width * 0.15);
    const tailHeight = Math.min(20, height * 0.2);
    const direction = element.tailDirection ?? 'bottom-left';
    const tailX = direction.endsWith('left')
        ? x + width * 0.25
        : x + width * 0.75;
    const tailBaseY = direction.startsWith('bottom') ? y + height : y;
    const tailTipY = tailBaseY + (direction.startsWith('bottom') ? tailHeight : -tailHeight);

    return {
        body: { x, y, width, height, radius },
        tail: [
            { x: tailX - tailWidth / 2, y: tailBaseY },
            { x: tailX, y: tailTipY },
            { x: tailX + tailWidth / 2, y: tailBaseY },
        ],
    };
}

