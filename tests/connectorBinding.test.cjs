const test = require('node:test');
const assert = require('node:assert/strict');

const {
    ALL_TOOLS,
    TOOL_REGISTRY,
    createCalloutElement,
    createElement,
    createFrameElement,
    createLineElement,
    createRectangleElement,
    createStickyNoteElement,
    deserializeBoard,
    duplicateElement,
    duplicateElements,
    findBinding,
    getClosestPointOnShapeOutline,
    getElementBounds,
    hitTestElement,
    renderElement,
    serializeBoard,
    updateBoundElements,
} = require('../dist/index.js');

const closeTo = (actual, expected, tolerance = 1e-6) => {
    assert.ok(
        Math.abs(actual - expected) <= tolerance,
        `expected ${actual} to be within ${tolerance} of ${expected}`,
    );
};

test('connector snapping uses the visible outline instead of AABB anchors or shape centers', () => {
    const rectangle = createRectangleElement({
        id: 'rectangle', x: 0, y: 0, width: 100, height: 80,
    });
    const sideSnap = findBinding({ x: 105, y: 23 }, [rectangle], 10);
    assert.ok(sideSnap);
    closeTo(sideSnap.point.x, 100);
    closeTo(sideSnap.point.y, 23);
    closeTo(sideSnap.binding.fixedPoint.x, 1);
    closeTo(sideSnap.binding.fixedPoint.y, 23 / 80);

    assert.equal(findBinding({ x: 50, y: 40 }, [rectangle], 10), null);

    const ellipse = createElement('ellipse', {
        id: 'ellipse', x: 0, y: 0, width: 100, height: 60,
    });
    const ellipsePoint = getClosestPointOnShapeOutline(ellipse, { x: 100, y: 0 });
    assert.ok(ellipsePoint);
    const ellipseEquation = ((ellipsePoint.x - 50) ** 2) / (50 ** 2)
        + ((ellipsePoint.y - 30) ** 2) / (30 ** 2);
    closeTo(ellipseEquation, 1, 1e-5);
    assert.notDeepEqual(ellipsePoint, { x: 100, y: 0 });

    const diamond = createElement('diamond', {
        id: 'diamond', x: 0, y: 0, width: 100, height: 100,
    });
    const diamondPoint = getClosestPointOnShapeOutline(diamond, { x: 95, y: 5 });
    assert.ok(diamondPoint);
    closeTo(diamondPoint.x - diamondPoint.y, 50);
});

test('outline geometry follows rotations and non-rectangular sticky/callout paths', () => {
    const rotated = createRectangleElement({
        id: 'rotated', x: 0, y: 0, width: 100, height: 50, angle: Math.PI / 2,
    });
    const rotatedPoint = getClosestPointOnShapeOutline(rotated, { x: 50, y: 80 });
    assert.ok(rotatedPoint);
    closeTo(rotatedPoint.y, 75);

    const sticky = createStickyNoteElement({
        id: 'sticky', x: 0, y: 0, width: 100, height: 100,
    });
    const foldPoint = getClosestPointOnShapeOutline(sticky, { x: 100, y: 0 });
    assert.ok(foldPoint);
    closeTo(foldPoint.x + foldPoint.y, 100);
    assert.ok(foldPoint.x < 100 && foldPoint.y > 0);

    const callout = createCalloutElement({
        id: 'callout', x: 0, y: 0, width: 100, height: 80,
        tailDirection: 'bottom-left',
    });
    const tailSnap = findBinding({ x: 25, y: 100 }, [callout], 10);
    assert.ok(tailSnap);
    closeTo(tailSnap.point.x, 25);
    closeTo(tailSnap.point.y, 96);
    assert.ok(tailSnap.binding.fixedPoint.y > 1);

    const legacyFrame = createFrameElement({
        id: 'legacy-frame', x: 0, y: 0, width: 100, height: 100,
    });
    assert.equal(findBinding({ x: 101, y: 50 }, [legacyFrame], 10), null);
});

test('callout tails participate in hit testing and rotated bounds', () => {
    const callout = createCalloutElement({
        id: 'callout-tail',
        x: 0,
        y: 0,
        width: 100,
        height: 80,
        tailDirection: 'bottom-left',
    });
    assert.equal(hitTestElement({ x: 25, y: 96 }, callout, 0.001), true);
    assert.deepEqual(getElementBounds(callout), [0, 0, 100, 96]);

    const reversed = createCalloutElement({
        id: 'reversed-callout-tail',
        x: 100,
        y: 80,
        width: -100,
        height: -80,
        tailDirection: 'top-right',
    });
    assert.equal(hitTestElement({ x: 75, y: -16 }, reversed, 0.001), true);
    assert.deepEqual(getElementBounds(reversed), [0, -16, 100, 80]);

    const rotated = { ...callout, angle: Math.PI / 2 };
    assert.equal(hitTestElement({ x: -6, y: 15 }, rotated, 0.001), true);
    const rotatedBounds = getElementBounds(rotated);
    [-6, -10, 90, 90].forEach((expected, index) => {
        closeTo(rotatedBounds[index], expected);
    });
});

test('stored bindings follow target move, resize, and rotation and clear when orphaned', () => {
    const target = createRectangleElement({
        id: 'target', x: 0, y: 0, width: 100, height: 80,
    });
    const snap = findBinding({ x: 101, y: 20 }, [target], 10);
    assert.ok(snap);

    const connector = createLineElement({
        id: 'connector',
        x: snap.point.x,
        y: snap.point.y,
        width: 100,
        height: 0,
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        startBinding: snap.binding,
    });

    const unchanged = [target, connector];
    assert.strictEqual(updateBoundElements(unchanged), unchanged);

    const transformedTarget = {
        ...target,
        x: 50,
        y: 10,
        height: 160,
        angle: Math.PI / 2,
    };
    const transformed = updateBoundElements([transformedTarget, connector]);
    const transformedConnector = transformed[1];
    assert.equal(transformedConnector.type, 'line');
    closeTo(transformedConnector.x, 140);
    closeTo(transformedConnector.y, 140);
    assert.deepEqual(transformedConnector.startBinding, snap.binding);

    const orphaned = updateBoundElements([connector]);
    assert.equal(orphaned[0].startBinding, null);
    closeTo(orphaned[0].x, connector.x);
    closeTo(orphaned[0].y, connector.y);
});

test('stored bindings mirror with targets that are flipped during resize', () => {
    const target = createRectangleElement({
        id: 'target', x: 0, y: 0, width: 100, height: 80,
    });
    const snap = findBinding({ x: 0, y: 0 }, [target], 1);
    assert.ok(snap);
    assert.deepEqual(snap.binding.fixedPoint, { x: 0, y: 0 });

    const connector = createLineElement({
        id: 'connector',
        x: 0,
        y: 0,
        width: -50,
        height: 0,
        points: [{ x: 0, y: 0 }, { x: -50, y: 0 }],
        startBinding: snap.binding,
    });
    const flippedTarget = {
        ...target,
        x: 200,
        y: 160,
        width: -100,
        height: -80,
    };
    const [, updatedConnector] = updateBoundElements([flippedTarget, connector]);
    closeTo(updatedConnector.x, 200);
    closeTo(updatedConnector.y, 160);
    assert.deepEqual(updatedConnector.startBinding, snap.binding);
});

test('duplicating a set remaps internal bindings and detaches external bindings', () => {
    const left = createRectangleElement({
        id: 'left', x: 0, y: 0, width: 100, height: 100,
    });
    const right = createRectangleElement({
        id: 'right', x: 200, y: 0, width: 100, height: 100,
    });
    const startSnap = findBinding({ x: 100, y: 50 }, [left], 1);
    const endSnap = findBinding({ x: 200, y: 50 }, [right], 1);
    assert.ok(startSnap);
    assert.ok(endSnap);
    const connector = createLineElement({
        id: 'connector', x: 100, y: 50, width: 100, height: 0,
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        startBinding: startSnap.binding,
        endBinding: endSnap.binding,
    });

    const [leftCopy, rightCopy, connectorCopy] = duplicateElements(
        [left, right, connector],
        10,
    );
    assert.equal(connectorCopy.startBinding.elementId, leftCopy.id);
    assert.equal(connectorCopy.endBinding.elementId, rightCopy.id);
    assert.notStrictEqual(connectorCopy.startBinding, connector.startBinding);
    assert.notStrictEqual(connectorCopy.startBinding.fixedPoint, connector.startBinding.fixedPoint);
    const resolvedCopies = updateBoundElements([
        left,
        right,
        connector,
        leftCopy,
        rightCopy,
        connectorCopy,
    ]);
    closeTo(resolvedCopies[5].x, 110);
    closeTo(resolvedCopies[5].y, 60);

    const [partialTargetCopy, partialConnectorCopy] = duplicateElements(
        [left, connector],
        20,
    );
    assert.equal(partialConnectorCopy.startBinding.elementId, partialTargetCopy.id);
    assert.equal(partialConnectorCopy.endBinding, null);

    const [detachedConnectorCopy] = duplicateElements([connector], 30);
    assert.equal(detachedConnectorCopy.startBinding, null);
    assert.equal(detachedConnectorCopy.endBinding, null);
    closeTo(detachedConnectorCopy.x, 130);
    closeTo(detachedConnectorCopy.y, 80);

    const detachedSingleCopy = duplicateElement(connector, 40);
    assert.equal(detachedSingleCopy.startBinding, null);
    assert.equal(detachedSingleCopy.endBinding, null);
    closeTo(detachedSingleCopy.x, 140);
    closeTo(detachedSingleCopy.y, 90);
});

test('connector binding metadata survives session serialization', () => {
    const target = createRectangleElement({
        id: 'target', x: 0, y: 0, width: 100, height: 100,
    });
    const snap = findBinding({ x: 100, y: 40 }, [target], 1);
    assert.ok(snap);
    const connector = createLineElement({
        id: 'connector', x: 100, y: 40, width: 100, height: 0,
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        startBinding: snap.binding,
    });
    const serialized = serializeBoard(
        [target, connector],
        { panX: 0, panY: 0, zoom: 1 },
        { threadId: 'thread', boardId: 'board' },
    );
    const hydrated = deserializeBoard(JSON.parse(JSON.stringify(serialized)));
    assert.deepEqual(hydrated.elements[1].startBinding, snap.binding);
});

test('retired frames are not authoring tools and remaining advanced tools create safely', () => {
    assert.equal(ALL_TOOLS.includes('frame'), false);
    assert.equal(TOOL_REGISTRY.frame, undefined);
    assert.equal(createElement('sticky-note').type, 'sticky-note');
    assert.equal(createElement('callout').type, 'callout');
});

test('advanced and legacy renderers keep the canvas save/restore stack balanced', () => {
    const makeContext = () => {
        let depth = 0;
        let minimumDepth = 0;
        const values = {};
        const target = {
            save() { depth += 1; },
            restore() { depth -= 1; minimumDepth = Math.min(minimumDepth, depth); },
            measureText(text) { return { width: String(text).length * 8 }; },
            getDepth() { return depth; },
            getMinimumDepth() { return minimumDepth; },
        };
        return new Proxy(target, {
            get(object, property) {
                if (property in object) return object[property];
                if (property in values) return values[property];
                return () => {};
            },
            set(_object, property, value) {
                values[property] = value;
                return true;
            },
        });
    };

    const elements = [
        createStickyNoteElement({ width: 100, height: 100 }),
        createElement('star', { width: 100, height: 100 }),
        createCalloutElement({ width: 100, height: 80 }),
        createFrameElement({ width: 100, height: 100 }),
    ];
    for (const element of elements) {
        const context = makeContext();
        renderElement(context, element);
        assert.equal(context.getDepth(), 0, `${element.type} leaked canvas state`);
        assert.ok(context.getMinimumDepth() >= 0, `${element.type} over-restored canvas state`);
    }
});
