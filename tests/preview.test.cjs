const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { act, create } = require('react-test-renderer');

const { createElement, NoteboardPreview } = require('../dist/index.js');

test('preview matches its rendered size and clears empty snapshots', (t) => {
    const previousWindow = global.window;
    const previousResizeObserver = global.ResizeObserver;
    global.window = { devicePixelRatio: 2 };
    global.ResizeObserver = class ResizeObserver {
        observe() {}
        disconnect() {}
    };

    const calls = [];
    const context = new Proxy({}, {
        get(target, property) {
            if (!(property in target)) {
                target[property] = (...args) => calls.push([property, ...args]);
            }
            return target[property];
        },
        set(target, property, value) {
            target[property] = value;
            return true;
        },
    });
    const canvas = {
        clientHeight: 200,
        clientWidth: 300,
        getContext: () => context,
        height: 400,
        width: 800,
    };
    let renderer;

    t.after(() => {
        if (renderer) act(() => renderer.unmount());
        if (previousWindow === undefined) delete global.window;
        else global.window = previousWindow;
        if (previousResizeObserver === undefined) delete global.ResizeObserver;
        else global.ResizeObserver = previousResizeObserver;
    });

    const rectangle = createElement('rectangle', {
        x: 100,
        y: 100,
        width: -80,
        height: -20,
    });

    act(() => {
        renderer = create(
            React.createElement(NoteboardPreview, {
                elements: [rectangle],
                height: '200px',
                padding: 0,
                width: '300px',
            }),
            { createNodeMock: ({ type }) => type === 'canvas' ? canvas : {} },
        );
    });

    assert.equal(canvas.width, 600);
    assert.equal(canvas.height, 400);
    assert.ok(calls.some(([name]) => name === 'strokeRect'));

    const clearCount = calls.filter(([name]) => name === 'clearRect').length;
    const paintCount = calls.filter(([name]) => name === 'strokeRect').length;
    act(() => {
        renderer.update(React.createElement(NoteboardPreview, {
            elements: [],
            height: '200px',
            padding: 0,
            width: '300px',
        }));
    });

    assert.equal(calls.filter(([name]) => name === 'clearRect').length, clearCount + 1);
    assert.equal(calls.filter(([name]) => name === 'strokeRect').length, paintCount);
});

test('preview repaints loaded images and refreshes a changed image source', (t) => {
    const previousImage = global.Image;
    const previousWindow = global.window;
    const previousResizeObserver = global.ResizeObserver;
    const images = [];

    global.window = { devicePixelRatio: 1 };
    global.ResizeObserver = class ResizeObserver {
        observe() {}
        disconnect() {}
    };
    global.Image = class FakeImage {
        complete = false;
        naturalWidth = 0;
        onerror = null;
        onload = null;

        set src(value) {
            this.currentSrc = value;
            images.push(this);
        }
    };

    const calls = [];
    const context = new Proxy({}, {
        get(target, property) {
            if (!(property in target)) {
                target[property] = (...args) => calls.push([property, ...args]);
            }
            return target[property];
        },
        set(target, property, value) {
            target[property] = value;
            return true;
        },
    });
    const canvas = {
        clientHeight: 100,
        clientWidth: 100,
        getContext: () => context,
        height: 100,
        width: 100,
    };
    let renderer;

    t.after(() => {
        if (renderer) act(() => renderer.unmount());
        if (previousImage === undefined) delete global.Image;
        else global.Image = previousImage;
        if (previousWindow === undefined) delete global.window;
        else global.window = previousWindow;
        if (previousResizeObserver === undefined) delete global.ResizeObserver;
        else global.ResizeObserver = previousResizeObserver;
    });

    const imageElement = createElement('image', {
        dataUrl: 'data:image/png;base64,first',
        height: 40,
        width: 40,
    });
    const props = { elements: [imageElement], height: 100, padding: 0, width: 100 };

    act(() => {
        renderer = create(React.createElement(NoteboardPreview, props), {
            createNodeMock: ({ type }) => type === 'canvas' ? canvas : {},
        });
    });
    assert.equal(images.length, 1);
    assert.equal(calls.filter(([name]) => name === 'drawImage').length, 0);

    act(() => {
        images[0].complete = true;
        images[0].naturalWidth = 40;
        images[0].onload();
    });
    assert.equal(calls.filter(([name]) => name === 'drawImage').length, 1);

    act(() => {
        renderer.update(React.createElement(NoteboardPreview, {
            ...props,
            elements: [{ ...imageElement, dataUrl: 'data:image/png;base64,second' }],
        }));
    });
    assert.equal(images.length, 2);
    assert.equal(images[1].currentSrc, 'data:image/png;base64,second');

    act(() => images[1].onerror());
    assert.ok(calls.some(
        ([name, value]) => name === 'fillText' && value === 'Image unavailable',
    ));

    // Returning to a previously rendered source with the same serialized
    // element ID reuses that source. Concurrent boards can therefore use the
    // same element ID for different images without continuously evicting one
    // another from the cache.
    act(() => {
        renderer.update(React.createElement(NoteboardPreview, {
            ...props,
            elements: [{ ...imageElement }],
        }));
    });
    assert.equal(images.length, 2);
});
