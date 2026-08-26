// Element types and type guards
export type {
    Point,
    PressurePoint,
    Bounds,
    FillStyle,
    StrokeStyle,
    Arrowhead,
    BlendMode,
    RoutingMode,
    DropShadow,
    ElementBinding,
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
    ImageElement,
    StickyNoteElement,
    FrameElement,
    StarElement,
    CalloutElement,
    NoteboardElement,
} from './types';
export { isLinearElement, isShapeElement, hasShapeText, isLockedElement } from './types';

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
    createStickyNoteElement,
    createFrameElement,
    createStarElement,
    createCalloutElement,
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

// Connector snapping and persistent shape bindings
export {
    CONNECTOR_SNAP_DISTANCE,
    findBinding,
    resolveBinding,
    getClosestPointOnShapeOutline,
    updateBoundElements,
} from './connectorBinding';
export type { ConnectorSnapResult } from './connectorBinding';

// Element mutation
export {
    mutateElement,
    moveElement,
    resizeElement,
    rotateElement,
    deleteElement,
    restoreElement,
    duplicateElement,
    duplicateElements,
} from './mutateElement';

// Rendering utilities
export {
    getElementAbsoluteCoords,
    getCenterPoint,
    getLinearElementAbsolutePoints,
    getArrowheadPoints,
    getLineAngle,
} from './renderUtils';
