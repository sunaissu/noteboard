// Element types and type guards
export type {
    Point,
    Bounds,
    FillStyle,
    StrokeStyle,
    Arrowhead,
    NoteboardElementBase,
    RectangleElement,
    EllipseElement,
    DiamondElement,
    TriangleElement,
    LineElement,
    ArrowElement,
    TextElement,
    DrawElement,
    PenElement,
    ExcalidrawElement,
} from './types';
export { isLinearElement, isShapeElement } from './types';

// Element creation
export {
    generateId,
    createElement,
    createRectangleElement,
    createEllipseElement,
    createDiamondElement,
    createTriangleElement,
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
