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
        const binding = useYjsNoteboard(document, { shareViewport: true, ...options });
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

// Regression: a callback captured before a remote render expresses only its local changes.
test('stale local snapshots preserve peer insertions and unrelated fields', (t) => {
    const document = new Y.Doc();
    const harness = mountBinding(document);
    registerCleanup(t, document, harness.renderer);
    const original = createRectangleElement({ id: 'local', x: 0, strokeColor: '#111111' });
    act(() => harness.binding.onElementsChange([original]));
    const staleChange = harness.binding.onElementsChange;
    const peer = createRectangleElement({ id: 'peer', x: 90 });
    act(() => document.transact(() => {
        const store = document.getMap(YJS_NOTEBOARD_ELEMENTS_KEY);
        store.get('local').set('strokeColor', '#ff0000');
        store.set('peer', new Y.Map(Object.entries(peer)));
    }, 'peer'));
    act(() => staleChange([{ ...original, x: 20 }]));
    assert.equal(harness.binding.elements.find(el => el.id === 'local').strokeColor, '#ff0000');
    assert.equal(harness.binding.elements.find(el => el.id === 'local').x, 20);
    assert.ok(harness.binding.elements.some(el => el.id === 'peer'));
});

test('stale local snapshots do not resurrect an element deleted by a peer', (t) => {
    const document = new Y.Doc();
    const harness = mountBinding(document);
    registerCleanup(t, document, harness.renderer);
    const original = createRectangleElement({ id: 'removed' });
    act(() => harness.binding.onElementsChange([original]));
    const staleChange = harness.binding.onElementsChange;
    act(() => document.getMap(YJS_NOTEBOARD_ELEMENTS_KEY).delete('removed'));
    act(() => staleChange([{ ...original, x: 20 }]));
    assert.equal(harness.binding.elements.length, 0);
});

test('two board replicas keep simultaneous label edits', (t) => {
    const a = new Y.Doc(), b = new Y.Doc();
    const initial = createRectangleElement({ id: 'label', text: 'hello' });
    const first = mountBinding(a, { initialElements: [initial] });
    registerCleanup(t, a, first.renderer);
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    const second = mountBinding(b);
    registerCleanup(t, b, second.renderer);
    act(() => first.binding.onElementsChange(first.binding.elements.map(el => ({ ...el, text: 'hello A' }))));
    act(() => second.binding.onElementsChange(second.binding.elements.map(el => ({ ...el, text: 'hello B' }))));
    const au = Y.encodeStateAsUpdate(a), bu = Y.encodeStateAsUpdate(b);
    act(() => { Y.applyUpdate(a, bu); Y.applyUpdate(b, au); });
    const text = first.binding.elements[0].text;
    assert.equal(text, second.binding.elements[0].text);
    assert.match(text, /A/); assert.match(text, /B/);
});

test('collaborative undo keeps another users object', (t) => {
    const document = new Y.Doc();
    const original = createRectangleElement({ id: 'mine', x: 0 });
    const harness = mountBinding(document, { initialElements: [original] });
    registerCleanup(t, document, harness.renderer);
    act(() => { harness.binding.history.record(); harness.binding.onElementsChange([{ ...original, x: 20 }]); });
    act(() => document.transact(() => document.getMap(YJS_NOTEBOARD_ELEMENTS_KEY).set('peer', new Y.Map(Object.entries(createRectangleElement({ id: 'peer' })))), 'peer'));
    act(() => harness.binding.history.undo());
    assert.equal(harness.binding.elements.find(el => el.id === 'mine').x, 0);
    assert.ok(harness.binding.elements.some(el => el.id === 'peer'));
});

test('navigation stays local unless following is explicitly enabled', (t) => {
    const document = new Y.Doc();
    const first = mountBinding(document, { shareViewport: false });
    const second = mountBinding(document, { shareViewport: false });
    registerCleanup(t, document, first.renderer);
    t.after(() => act(() => second.renderer.unmount()));
    act(() => first.binding.onViewportChange({ panX: 120, panY: 80, zoom: 2 }));
    assert.deepEqual(second.binding.viewport, { panX: 0, panY: 0, zoom: 1 });
    assert.equal(document.getMap(YJS_NOTEBOARD_VIEWPORT_KEY).size, 0);
});

test('adding an object from a stale snapshot preserves peer z-order', (t) => {
 const document = new Y.Doc();
 const initial = ['a', 'b', 'c'].map(id => createRectangleElement({id}));
 const harness = mountBinding(document, {initialElements: initial});
 registerCleanup(t, document, harness.renderer);
 const staleChange = harness.binding.onElementsChange;
 act(() => harness.binding.onElementsChange([initial[2], initial[0], initial[1]]));
 act(() => staleChange([...initial, createRectangleElement({id:'d'})]));
 assert.deepEqual(harness.binding.elements.map(el => el.id), ['c','a','b','d']);
});

test('inserting an object retains existing shared order entries', (t) => {
 const document = new Y.Doc();
 const initial = ['a', 'b'].map(id => createRectangleElement({id}));
 const harness = mountBinding(document, {initialElements: initial});
 registerCleanup(t, document, harness.renderer);
 let delta;
 document.getArray('noteboard-order').observe(event => { delta = event.changes.delta; });
 act(() => harness.binding.onElementsChange([...initial, createRectangleElement({id:'c'})]));
 assert.deepEqual(delta, [{retain:2}, {insert:['c']}]);
});

test('disconnected additions converge without duplicating unchanged order entries', (t) => {
 const a = new Y.Doc(), b = new Y.Doc();
 const first = mountBinding(a, {initialElements:['a','b'].map(id => createRectangleElement({id}))});
 registerCleanup(t, a, first.renderer);
 Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
 const second = mountBinding(b); registerCleanup(t, b, second.renderer);
 act(() => first.binding.onElementsChange([...first.binding.elements, createRectangleElement({id:'c'})]));
 act(() => second.binding.onElementsChange([...second.binding.elements, createRectangleElement({id:'d'})]));
 const au = Y.encodeStateAsUpdate(a), bu = Y.encodeStateAsUpdate(b);
 act(() => { Y.applyUpdate(a, bu); Y.applyUpdate(b, au); });
 assert.deepEqual(a.getArray('noteboard-order').toArray(), b.getArray('noteboard-order').toArray());
 assert.equal(a.getArray('noteboard-order').length, 4);
 assert.equal(new Set(first.binding.elements.map(el => el.id)).size, 4);
});

test('local reorder undo retains a peers subsequent insertion', (t) => {
 const document = new Y.Doc();
 const initial = ['a','b','c'].map(id => createRectangleElement({id}));
 const first = mountBinding(document, {initialElements:initial});
 const second = mountBinding(document);
 registerCleanup(t, document, first.renderer);
 t.after(() => act(() => second.renderer.unmount()));
 act(() => { first.binding.history.record(); first.binding.onElementsChange([initial[2],initial[0],initial[1]]); });
 act(() => second.binding.onElementsChange([...second.binding.elements, createRectangleElement({id:'peer'})]));
 act(() => first.binding.history.undo());
 assert.deepEqual(first.binding.elements.filter(el=>el.id!=='peer').map(el=>el.id), ['a','b','c']);
 assert.ok(first.binding.elements.some(el=>el.id==='peer'));
});

test('malformed peer records are quarantined and become visible after repair', t => {
 const document = new Y.Doc();
 const store = document.getMap(YJS_NOTEBOARD_ELEMENTS_KEY);
 store.set('invalid-container','bad');
 store.set('invalid-shape',new Y.Map(Object.entries(createRectangleElement({id:'invalid-shape',x:NaN}))));
 store.set('wrong-id',new Y.Map(Object.entries(createRectangleElement({id:'different'}))));
 const harness = mountBinding(document);
 registerCleanup(t,document,harness.renderer);
 assert.deepEqual(harness.binding.elements,[]);
 act(()=>store.get('invalid-shape').set('x',10));
 assert.equal(harness.binding.elements.length,1);
 assert.equal(harness.binding.elements[0].x,10);
 assert.equal(store.get('invalid-container'),'bad');
 act(()=>store.set('invalid-container',new Y.Map(Object.entries(createRectangleElement({id:'invalid-container'})))));
 assert.equal(harness.binding.elements.length,2);
});
