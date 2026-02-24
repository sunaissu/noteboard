// Element types and type guards
export type {
    Point,
    Bounds,
    FillStyle,
    StrokeStyle,
    Arrowhead,
    NoteboardElementBase,
    RectangleElement,
    LineElement,
    ArrowElement,
    TextElement,
    DrawElement,
    PenElement,
    ExcalidrawElement,
} from './types';
export { isLinearElement } from './types';

// Element creation
export {
    generateId,
    createElement,
    createRectangleElement,
    createLineElement,
    createArrowElement,
    createTextElement,
    createDrawElement,
    createPenElement,
} from './createElement';

// Bounding-box calculations
export {
    getPointsBounds,
    getElementBounds,
    getRotatedBounds,
    rotatePoint,
    boundsOverlap,
    pointInBounds,
} from './bounds';

// Hit testing
export {
    hitTestElement,
    getElementsInBounds,
    distanceToLineSegment,
} from './hitTest';

// Element mutation
export {
    mutateElement,
    moveElement,
    resizeElement,
    rotateElement,
    deleteElement,
    restoreElement,
    duplicateElement,
} from './mutateElement';

// Rendering utilities
export {
    getElementAbsoluteCoords,
    getCenterPoint,
    getLinearElementAbsolutePoints,
    getArrowheadPoints,
    getLineAngle,
} from './renderUtils';
