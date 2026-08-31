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
        canvas.props.onPointerUp();
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
        canvas.props.onPointerUp();
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
