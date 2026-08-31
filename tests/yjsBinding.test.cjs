const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { act, create } = require('react-test-renderer');
const Y = require('yjs');

const {
    createLineElement,
    createRectangleElement,
    findBinding,
} = require('../dist/index.js');
const {
    YJS_NOTEBOARD_ELEMENTS_KEY,
    YJS_NOTEBOARD_VIEWPORT_KEY,
    useYjsNoteboard,
} = require('../dist/yjs.js');

const mountBinding = (document, options) => {
    let latest;
    const snapshots = [];

    const Harness = () => {
        const binding = useYjsNoteboard(document, options);
        React.useEffect(() => {
            latest = binding;
            snapshots.push({
                elements: binding.elements,
                viewport: binding.viewport,
            });
        });
        return null;
    };

    let renderer;
    act(() => {
        renderer = create(React.createElement(Harness));
    });

    return {
        get binding() {
            return latest;
        },
        renderer,
        snapshots,
    };
};

const createBoundFixture = () => {
    const rectangle = createRectangleElement({
        id: 'rectangle',
        x: 0,
        y: 0,
        width: 100,
        height: 80,
    });
    const snap = findBinding({ x: 100, y: 40 }, [rectangle], 1);
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
    return { connector, elements: [rectangle, connector], rectangle };
};

const registerCleanup = (t, document, renderer) => {
    t.after(() => {
        act(() => renderer.unmount());
        document.destroy();
    });
};

test('local Yjs writes retain the exact bound-connector snapshot', (t) => {
    const document = new Y.Doc();
    const harness = mountBinding(document);
    registerCleanup(t, document, harness.renderer);
    const fixture = createBoundFixture();

    act(() => harness.binding.onElementsChange(fixture.elements));

    assert.strictEqual(harness.binding.elements, fixture.elements);
    assert.strictEqual(harness.binding.elements[0], fixture.rectangle);
    assert.strictEqual(harness.binding.elements[1], fixture.connector);
    assert.strictEqual(
        harness.binding.elements[1].startBinding,
        fixture.connector.startBinding,
    );
});

test('rapid local viewport writes settle on the newest pan without regressing', (t) => {
    const document = new Y.Doc();
    const harness = mountBinding(document);
    registerCleanup(t, document, harness.renderer);
    const fixture = createBoundFixture();

    act(() => harness.binding.onElementsChange(fixture.elements));
    act(() => {
        harness.binding.onViewportChange({ panX: 80, panY: -30, zoom: 1 });
        harness.binding.onViewportChange({ panX: 160, panY: -60, zoom: 1 });
        harness.binding.onViewportChange({ panX: 240, panY: -90, zoom: 1 });
    });

    assert.deepEqual(harness.binding.viewport, {
        panX: 240,
        panY: -90,
        zoom: 1,
    });
    const finalSnapshotIndex = harness.snapshots.findIndex(
        ({ viewport }) => viewport.panX === 240 && viewport.panY === -90,
    );
    assert.notEqual(finalSnapshotIndex, -1);
    assert.ok(
        harness.snapshots.slice(finalSnapshotIndex).every(({ viewport }) =>
            viewport.panX === 240 && viewport.panY === -90 && viewport.zoom === 1,
        ),
    );
});

test('remote Yjs element and viewport transactions are still adopted', (t) => {
    const document = new Y.Doc();
    const harness = mountBinding(document);
    registerCleanup(t, document, harness.renderer);
    const fixture = createBoundFixture();

    act(() => harness.binding.onElementsChange(fixture.elements));
    act(() => {
        document.transact(() => {
            const rectangle = document
                .getMap(YJS_NOTEBOARD_ELEMENTS_KEY)
                .get(fixture.rectangle.id);
            assert.ok(rectangle);
            rectangle.set('x', 35);

            const viewport = document.getMap(YJS_NOTEBOARD_VIEWPORT_KEY);
            viewport.set('panX', -125);
            viewport.set('panY', 75);
            viewport.set('zoom', 1.5);
        }, { source: 'remote-test' });
    });

    assert.notStrictEqual(harness.binding.elements, fixture.elements);
    assert.equal(
        harness.binding.elements.find(({ id }) => id === fixture.rectangle.id).x,
        35,
    );
    assert.equal(
        harness.binding.elements.find(({ id }) => id === fixture.connector.id)
            .startBinding.elementId,
        fixture.rectangle.id,
    );
    assert.deepEqual(harness.binding.viewport, {
        panX: -125,
        panY: 75,
        zoom: 1.5,
    });
});
