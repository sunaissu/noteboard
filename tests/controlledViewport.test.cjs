const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { act, create } = require('react-test-renderer');

const { createElement, Noteboard } = require('../dist/index.js');

const installDomStubs = () => {
    const previous = {
        ResizeObserver: global.ResizeObserver,
        document: global.document,
        requestAnimationFrame: global.requestAnimationFrame,
        window: global.window,
    };

    global.window = {
        addEventListener() {},
        devicePixelRatio: 1,
        innerHeight: 768,
        innerWidth: 1024,
        removeEventListener() {},
    };
    global.document = {
        addEventListener() {},
        getElementById() {
            return {};
        },
        removeEventListener() {},
    };
    global.requestAnimationFrame = (callback) => {
        callback(0);
        return 1;
    };
    global.ResizeObserver = class ResizeObserver {
        observe() {}
        disconnect() {}
    };

    return () => {
        for (const [name, value] of Object.entries(previous)) {
            if (value === undefined) delete global[name];
            else global[name] = value;
        }
    };
};

const makeCanvasContext = () => new Proxy({
    measureText(text) {
        return { width: String(text).length * 8 };
    },
}, {
    get(target, property) {
        if (property in target) return target[property];
        return () => {};
    },
    set(target, property, value) {
        target[property] = value;
        return true;
    },
});

const createNodeMock = ({ type }) => {
    const node = {
        addEventListener() {},
        click() {},
        contains() {
            return false;
        },
        focus() {},
        querySelector() { return null; },
        querySelectorAll() { return []; },
        setSelectionRange() {},
        selectionStart: 0, selectionEnd: 0, selectionDirection: "none",
        getBoundingClientRect() {
            return { bottom: 600, height: 600, left: 0, right: 800, top: 0, width: 800 };
        },
        removeEventListener() {},
        setPointerCapture() {},
        style: {},
        value: '',
    };
    if (type === 'canvas') {
        const context = makeCanvasContext();
        node.getContext = () => context;
        node.toDataURL = () => 'data:image/png;base64,';
    }
    return node;
};

const workspaceButton = (renderer, label) => renderer.root.findAllByType('button')
    .find(button => button.children.includes(label));

// Obtain the internal workspace from the public board, then exercise its lifecycle
// directly so a changed board ID cannot rely on a host's remount behavior.
const mountWorkspace = (t, overrides = {}, replayEffects = false) => {
    const restoreDom = installDomStubs();
    let renderer;
    t.after(() => {
        if (renderer) act(() => renderer.unmount());
        restoreDom();
    });
    act(() => { renderer = create(React.createElement(Noteboard, { theme: 'light' }), { createNodeMock }); });
    act(() => renderer.root.findByProps({ title: 'Settings' }).props.onClick());
    act(() => workspaceButton(renderer, 'Board workspace').props.onClick());
    const Workspace = renderer.root.find(node => node.type?.name === 'BoardWorkspace').type;
    act(() => renderer.unmount());
    let props = {
        boardId: 'board-a', elements: [], selected: new Set(), readOnly: false,
        viewport: { panX: 0, panY: 0, zoom: 1 },
        onViewport() {}, onSelect() {}, onFocus() {}, onClose() {}, mutate() { return true; },
        ...overrides,
    };
    // React 18's test renderer does not replay StrictMode effects. Reproduce its
    // setup -> cleanup -> setup lifecycle using the real registered effects.
    const useEffect = React.useEffect;
    const mock = replayEffects && t.mock.method(React, 'useEffect', (setup, dependencies) =>
        useEffect(() => {
            const cleanup = setup();
            cleanup?.();
            return setup();
        }, dependencies));
    try {
        act(() => { renderer = create(React.createElement(Workspace, props), { createNodeMock }); });
    } finally {
        if (mock) mock.mock.restore();
    }
    return {
        renderer,
        update(next) {
            props = { ...props, ...next };
            act(() => renderer.update(React.createElement(Workspace, props)));
        },
    };
};

test('workspace saves remain usable after StrictMode effect replay', async (t) => {
    const updates = [];
    const { renderer } = mountWorkspace(t, { onStateChange: state => updates.push(state) }, true);
    act(() => renderer.root.findByProps({ 'aria-label': 'Workspace item name' }).props.onChange({ target: { value: 'Overview' } }));
    await act(async () => workspaceButton(renderer, 'Save viewpoint').props.onClick());
    assert.equal(updates.length, 1);
    assert.equal(updates[0].viewpoints[0].name, 'Overview');
    assert.equal(renderer.root.findByType('fieldset').props.disabled, false);
    assert.match(renderer.root.findByProps({ role: 'status' }).children.join(' '), /Saved for this board session/);
});

test('export downloads survive StrictMode effect replay and stop after closing', async (t) => {
    const restoreDom = installDomStubs();
    const downloads = [];
    let renderer;
    global.document.createElement = (tag) => {
        if (tag === 'canvas') return createNodeMock({ type: 'canvas' });
        assert.equal(tag, 'a');
        return { click() { downloads.push({ href: this.href, filename: this.download }); } };
    };
    t.after(() => {
        if (renderer) act(() => renderer.unmount());
        restoreDom();
    });
    await act(async () => {
        renderer = create(React.createElement(Noteboard, { theme: 'light' }), { createNodeMock });
    });
    act(() => renderer.root.findByProps({ title: 'Settings' }).props.onClick());
    await act(async () => workspaceButton(renderer, 'Export preview').props.onClick());
    const ExportDialog = renderer.root.find(node => node.type?.name === 'ExportDialog').type;
    act(() => renderer.unmount());

    // Replay React 18's setup -> cleanup -> setup sequence without remounting refs.
    const useEffect = React.useEffect;
    const replay = t.mock.method(React, 'useEffect', (setup, dependencies) => useEffect(() => {
        const cleanup = setup();
        cleanup?.();
        return setup();
    }, dependencies));
    try {
        await act(async () => {
            renderer = create(React.createElement(ExportDialog, {
                elements: [], selected: new Set(), onClose() {},
            }), { createNodeMock });
        });
    } finally {
        replay.mock.restore();
    }
    const downloadButton = () => renderer.root.findAllByType('button')
        .find(button => button.children.join('') === 'Download PNG');
    assert.equal(downloadButton().props.disabled, false);
    await act(async () => downloadButton().props.onClick());
    assert.deepEqual(downloads, [{ href: 'data:image/png;base64,', filename: 'noteboard.png' }]);
    assert.equal(downloadButton().props.disabled, false, 'download resets its busy state');

    await act(async () => {
        const pending = downloadButton().props.onClick();
        renderer.unmount();
        renderer = null;
        await pending;
    });
    assert.equal(downloads.length, 1, 'closing cancels a pending download');
});

test('workspace board changes isolate pending saves and busy state', async (t) => {
    const completions = new Map();
    const updates = [];
    const { renderer, update } = mountWorkspace(t, {
        storage: { load() { return null; }, save(id) { return new Promise(resolve => completions.set(id, resolve)); } },
        state: require('../dist/index.js').emptyWorkspace('board-a'),
        onStateChange: state => updates.push(state),
    });
    act(() => renderer.root.findByProps({ 'aria-label': 'Workspace item name' }).props.onChange({ target: { value: 'Old view' } }));
    act(() => { workspaceButton(renderer, 'Save viewpoint').props.onClick(); });
    update({ boardId: 'board-b', state: require('../dist/index.js').emptyWorkspace('board-b') });
    assert.equal(renderer.root.findByType('fieldset').props.disabled, false);
    act(() => renderer.root.findByProps({ 'aria-label': 'Workspace item name' }).props.onChange({ target: { value: 'New view' } }));
    act(() => { workspaceButton(renderer, 'Save viewpoint').props.onClick(); });
    await act(async () => { completions.get('board-a')(); });
    assert.deepEqual(updates, []);
    assert.equal(renderer.root.findByType('fieldset').props.disabled, true);
    await act(async () => { completions.get('board-b')(); });
    assert.deepEqual(updates.map(state => state.boardId), ['board-b']);
    assert.equal(updates[0].viewpoints[0].name, 'New view');
    assert.equal(renderer.root.findByType('fieldset').props.disabled, false);
});

test('workspace board changes abort pending document insertion', async (t) => {
    let complete, signal;
    const mutations = [];
    const { renderer, update } = mountWorkspace(t, {
        content: { resolveDocument(reference, pendingSignal) {
            signal = pendingSignal;
            return new Promise(resolve => { complete = resolve; });
        } },
        mutate(change) { mutations.push(change([])); return true; },
    });
    act(() => workspaceButton(renderer, 'Objects').props.onClick());
    act(() => renderer.root.findByProps({ 'aria-label': 'Document reference' }).props.onChange({ target: { value: 'doc-a' } }));
    act(() => { workspaceButton(renderer, 'Insert document card').props.onClick(); });
    update({ boardId: 'board-b' });
    assert.equal(signal.aborted, true);
    await act(async () => complete({ documentId: 'doc-a', revision: '1', title: 'Old document', fallback: 'Excerpt' }));
    assert.deepEqual(mutations, []);
    assert.equal(renderer.root.findByType('fieldset').props.disabled, false);
});

test('workspace revision save stops before reloading a closed board', async (t) => {
    let complete, signal, listCalls = 0;
    const { renderer, update } = mountWorkspace(t, {
        versions: {
            save(name, elements, pendingSignal) { signal = pendingSignal; return new Promise(resolve => { complete = resolve; }); },
            async list() { listCalls++; return []; },
        },
    });
    act(() => workspaceButton(renderer, 'Versions').props.onClick());
    act(() => renderer.root.findByProps({ 'aria-label': 'Revision name' }).props.onChange({ target: { value: 'Old revision' } }));
    act(() => { workspaceButton(renderer, 'Save revision').props.onClick(); });
    update({ boardId: 'board-b' });
    await act(async () => complete());
    assert.equal(signal.aborted, true);
    assert.equal(listCalls, 0);
});

test('invalid workspace data shows a recoverable load error', async (t) => {
    const restoreDom = installDomStubs();
    let renderer;
    let loads = 0;
    const storage = {
        load() {
            loads++;
            return {
                version: 1,
                boardId: loads === 1 ? 'another-board' : 'board-1',
                viewpoints: [], bookmarks: [], library: [], presets: [],
            };
        },
        save() {},
    };
    t.after(() => {
        if (renderer) act(() => renderer.unmount());
        restoreDom();
    });
    await act(async () => {
        renderer = create(React.createElement(Noteboard, {
            boardId: 'board-1', theme: 'light', workspaceStorage: storage,
        }), { createNodeMock });
        await new Promise(resolve => setImmediate(resolve));
    });
    const error = renderer.root.findByProps({ role: 'alert' });
    assert.match(error.children.join(' '), /Workspace load failed/);
    await act(async () => {
        error.findByType('button').props.onClick();
        await new Promise(resolve => setImmediate(resolve));
    });
    assert.equal(loads, 2);
    assert.equal(renderer.root.findAllByProps({ role: 'alert' }).length, 0);
});

test('controlled viewport updates are applied without echoing them to the host', (t) => {
    const restoreDom = installDomStubs();
    const boardRef = React.createRef();
    const changes = [];
    const viewportA = { panX: 0, panY: 0, zoom: 1 };
    const viewportB = { panX: 180, panY: -75, zoom: 1.25 };
    const renderBoard = (viewport) => React.createElement(Noteboard, {
        onViewportChange: (nextViewport) => changes.push(nextViewport),
        ref: boardRef,
        theme: 'light',
        viewport,
    });

    let renderer;
    t.after(() => {
        if (renderer) act(() => renderer.unmount());
        restoreDom();
    });
    act(() => {
        renderer = create(renderBoard(viewportA), { createNodeMock });
    });

    assert.deepEqual(changes, []);
    assert.deepEqual(boardRef.current.getSession().viewport, viewportA);

    act(() => boardRef.current.setViewport(viewportB));

    assert.deepEqual(changes, [viewportB]);
    assert.deepEqual(boardRef.current.getSession().viewport, viewportB);

    act(() => renderer.update(renderBoard({ ...viewportA })));

    assert.deepEqual(boardRef.current.getSession().viewport, viewportA);
    assert.deepEqual(changes, [viewportB]);
});

test('wheel zoom keeps the canvas point under the cursor fixed', (t) => {
    const restoreDom = installDomStubs();
    const boardRef = React.createRef();

    let renderer;
    t.after(() => {
        if (renderer) act(() => renderer.unmount());
        restoreDom();
    });
    act(() => {
        renderer = create(
            React.createElement(Noteboard, { ref: boardRef, theme: 'light' }),
            { createNodeMock },
        );
    });

    const canvas = renderer.root.findByType('canvas');
    act(() => {
        canvas.props.onWheel({
            clientX: 400,
            clientY: 300,
            ctrlKey: true,
            deltaY: -1,
            metaKey: false,
            preventDefault() {},
        });
    });

    const viewport = boardRef.current.getSession().viewport;
    assert.equal(viewport.zoom, 1.1);
    assert.ok(Math.abs(viewport.panX - (-40)) < 1e-9);
    assert.ok(Math.abs(viewport.panY - (-30)) < 1e-9);
});

test('wheel pan normalizes line and page units and keeps shifted trackpad deltas', (t) => {
    const restoreDom = installDomStubs();
    const ref = React.createRef();
    let renderer;
    t.after(() => { if (renderer) act(() => renderer.unmount()); restoreDom(); });
    act(() => { renderer = create(React.createElement(Noteboard, { ref, theme: 'light' }), {
        createNodeMock: element => ({ ...createNodeMock(element), clientWidth: 800, clientHeight: 600 }),
    }); });
    const wheel = event => act(() => renderer.root.findByType('canvas').props.onWheel({
        deltaX: 0, deltaY: 0, deltaMode: 0, ctrlKey: false, metaKey: false, shiftKey: false, preventDefault() {}, ...event,
    }));
    wheel({ deltaY: 3, deltaMode: 1 });
    assert.equal(ref.current.getSession().viewport.panY, -48);
    wheel({ deltaX: 1, deltaY: 1, deltaMode: 2 });
    assert.equal(ref.current.getSession().viewport.panX, -800);
    assert.equal(ref.current.getSession().viewport.panY, -648);
    wheel({ deltaX: 24, shiftKey: true });
    assert.equal(ref.current.getSession().viewport.panX, -824);
    wheel({ deltaY: 10, shiftKey: true });
    assert.equal(ref.current.getSession().viewport.panX, -834);
    wheel({ deltaX: 10, ctrlKey: true });
    assert.equal(ref.current.getSession().viewport.zoom, 1);
});

test('read-only boards still support drag panning', (t) => {
    const restoreDom = installDomStubs();
    const boardRef = React.createRef();
    const changes = [];

    let renderer;
    t.after(() => {
        if (renderer) act(() => renderer.unmount());
        restoreDom();
    });
    act(() => {
        renderer = create(
            React.createElement(Noteboard, {
                onViewportChange: (viewport) => changes.push(viewport),
                readOnly: true,
                ref: boardRef,
                theme: 'light',
            }),
            { createNodeMock },
        );
    });

    const canvas = renderer.root.findByType('canvas');
    act(() => {
        canvas.props.onPointerDown({
            button: 0,
            clientX: 100,
            clientY: 100,
            isPrimary: true,
            pointerId: 1,
        });
        canvas.props.onPointerMove({ clientX: 135, clientY: 120 });
        canvas.props.onPointerUp({pointerType:'mouse',pointerId:1});
    });

    assert.deepEqual(boardRef.current.getSession().viewport, {
        panX: 35,
        panY: 20,
        zoom: 1,
    });
    assert.deepEqual(changes.at(-1), { panX: 35, panY: 20, zoom: 1 });
});

test('canvas focus capture does not intercept nested editor controls', (t) => {
    const restoreDom = installDomStubs();
    let renderer;
    t.after(() => {
        if (renderer) act(() => renderer.unmount());
        restoreDom();
    });

    act(() => {
        renderer = create(
            React.createElement(Noteboard, { theme: 'light' }),
            { createNodeMock },
        );
    });

    const container = renderer.root.find(
        (node) => node.type === 'div' && node.props['data-theme-mode'] === 'light',
    );
    const canvas = renderer.root.findByType('canvas');
    assert.equal(container.props.onPointerDownCapture, undefined);
    assert.equal(typeof canvas.props.onPointerDownCapture, 'function');
});

test('context-menu mutations cannot bypass an element lock', (t) => {
    const restoreDom = installDomStubs();
    const boardRef = React.createRef();
    const rectangle = createElement('rectangle', {
        height: 80,
        id: 'locked-rectangle',
        width: 100,
        x: 0,
        y: 0,
    });
    let renderer;
    t.after(() => {
        if (renderer) act(() => renderer.unmount());
        restoreDom();
    });

    act(() => {
        renderer = create(
            React.createElement(Noteboard, {
                initialElements: [rectangle],
                ref: boardRef,
                theme: 'light',
            }),
            { createNodeMock },
        );
    });

    const canvas = renderer.root.findByType('canvas');
    act(() => {
        canvas.props.onPointerDown({
            button: 0,
            clientX: 20,
            clientY: 20,
            isPrimary: true,
            pointerId: 1,
            shiftKey: false,
        });
        canvas.props.onPointerUp({pointerType:'mouse',pointerId:1});
    });
    const lockButton = renderer.root.find(
        (node) => node.type === 'button' && node.props.title === 'Lock',
    );
    act(() => lockButton.props.onClick());
    assert.equal(boardRef.current.getElements()[0].locked, true);

    act(() => canvas.props.onContextMenu({
        clientX: 20,
        clientY: 20,
        preventDefault() {},
    }));
    for (const label of ['Copy', 'Duplicate', 'Delete']) {
        const button = renderer.root.find(
            (node) => node.type === 'button'
                && node.findAllByType('span').some((span) => span.children.includes(label)),
        );
        assert.equal(button.props.disabled, true, `${label} should be disabled`);
    }
    assert.equal(boardRef.current.getElements()[0].isDeleted, false);
});

test('typing into an existing label publishes text before blur', (t) => {
    const restoreDom = installDomStubs();
    const boardRef = React.createRef();
    const shape = createElement('rectangle', { id: 'label', x: 0, y: 0, width: 120, height: 80, text: 'hello' });
    let renderer;
    t.after(() => { if (renderer) act(() => renderer.unmount()); restoreDom(); });
    act(() => { renderer = create(React.createElement(Noteboard, { ref: boardRef, initialElements: [shape], theme: 'light' }), { createNodeMock }); });
    act(() => renderer.root.findByType('canvas').props.onDoubleClick({ clientX: 40, clientY: 40 }));
    const textarea = renderer.root.findByType('textarea');
    act(() => textarea.props.onInput({ currentTarget: { value: 'hello world', style: {}, scrollHeight: 24, scrollWidth: 100 }, nativeEvent: { isComposing: false } }));
    assert.equal(boardRef.current.getElements()[0].text, 'hello world');
});

test('repainting reuses canvas storage until its size changes',t=>{
 const restore=installDomStubs(),ref=React.createRef();let renderer,writes=0;
 t.after(()=>{if(renderer)act(()=>renderer.unmount());restore();});
 const mock=element=>{const node=createNodeMock(element);if(element.type==='canvas')for(const key of ['width','height']){let value=0;Object.defineProperty(node,key,{get:()=>value,set:next=>{value=next;writes++;}});}return node;};
 act(()=>{renderer=create(React.createElement(Noteboard,{ref,theme:'light'}),{createNodeMock:mock});});
 const initial=writes;
 act(()=>ref.current.setViewport({panX:20,panY:10,zoom:1.1}));
 assert.equal(writes,initial);
 global.window.devicePixelRatio=2;
 act(()=>ref.current.setViewport({panX:30,panY:10,zoom:1.1}));
 assert.equal(writes,initial+2);
});
test('pen draft retains pressure and negative-coordinate bounds',t=>{
 const restore=installDomStubs(),ref=React.createRef();let renderer;
 t.after(()=>{if(renderer)act(()=>renderer.unmount());restore();});
 act(()=>{renderer=create(React.createElement(Noteboard,{ref,theme:'light',activeTool:'pen'}),{createNodeMock});});
 const canvas=renderer.root.findByType('canvas');
 act(()=>{canvas.props.onPointerDown({button:0,clientX:100,clientY:100,isPrimary:true,pointerId:1,pressure:.2});
 canvas.props.onPointerMove({clientX:80,clientY:90,pressure:.7});canvas.props.onPointerMove({clientX:130,clientY:140,pressure:.9});canvas.props.onPointerUp({pointerType:'mouse',pointerId:1});});
 const pen=ref.current.getElements()[0];assert.equal(pen.width,50);assert.equal(pen.height,50);assert.deepEqual(pen.points.map(p=>p.pressure),[.2,.7,.9]);
});


test('host admission rejects a board change before publication and keeps valid edits working', t => {
    const restoreDom = installDomStubs();
    const boardRef = React.createRef();
    const changes = [];
    let renderer;
    t.after(() => { if (renderer) act(() => renderer.unmount()); restoreDom(); });
    act(() => { renderer = create(React.createElement(Noteboard, {
        ref: boardRef, theme: 'light', acceptElementsChange: elements => elements.length <= 1,
        onElementsChange: elements => changes.push(elements),
    }), { createNodeMock }); });
    const first = createElement('rectangle', 0, 0), second = createElement('ellipse', 20, 20);
    act(() => boardRef.current.setElements([first]));
    act(() => boardRef.current.setElements([first, second]));
    assert.deepEqual(boardRef.current.getElements().map(e => e.id), [first.id]);
    assert.equal(changes.length, 1);
    act(() => boardRef.current.setElements([]));
    assert.equal(boardRef.current.getElements().length, 0);
    assert.equal(changes.length, 2);
});

test('the host controls board restoration, edit state and explicit session saves', t => {
    const restoreDom = installDomStubs();
    const ref = React.createRef(), changes = [], saves = [];
    const first = createElement('rectangle', { id: 'host-first', width: 100, height: 80 });
    const restored = createElement('ellipse', { id: 'host-restored', width: 60, height: 60 });
    let renderer, restoreBoard;
    function Host() {
        const [elements, setElements] = React.useState([first]);
        const [viewport, setViewport] = React.useState({ panX: 10, panY: 20, zoom: 1.25 });
        restoreBoard = setElements;
        return React.createElement(Noteboard, {
            ref, theme: 'light', boardId: 'host-board', threadId: 'host-thread',
            elements, viewport, onViewportChange: setViewport,
            onElementsChange(next) { changes.push(next); setElements(next); },
            onSave: session => saves.push(session),
        });
    }
    t.after(() => { if (renderer) act(() => renderer.unmount()); restoreDom(); });
    act(() => { renderer = create(React.createElement(Host), { createNodeMock }); });
    assert.deepEqual(ref.current.getElements().map(element => element.id), ['host-first']);
    act(() => restoreBoard([restored]));
    assert.deepEqual(ref.current.getElements().map(element => element.id), ['host-restored']);
    assert.equal(changes.length, 0, 'host restoration must not echo back as an edit');
    act(() => ref.current.setElements([restored, first]));
    assert.equal(changes.length, 1, 'local edits publish to the host');
    act(() => ref.current.setViewport({ panX: 30, panY: 40, zoom: 1.5 }));
    assert.equal(saves.length, 0, 'editing does not trigger an automatic board save');
    act(() => renderer.root.find(node => node.type?.name === 'SettingsPanel').props.onSave());
    assert.equal(saves.length, 1);
    assert.equal(saves[0].boardId, 'host-board');
    assert.equal(saves[0].threadId, 'host-thread');
    assert.deepEqual(saves[0].elements.map(element => element.id), ['host-restored', 'host-first']);
    assert.deepEqual(saves[0].viewport, { panX: 30, panY: 40, zoom: 1.5 });
    assert.deepEqual(ref.current.getSession().elements, saves[0].elements);
});
