const test = require('node:test');
const assert = require('node:assert/strict');

const {
    createElement,
    deserializeBoard,
    serializeBoard,
} = require('../dist/index.js');

const snapshot = (elements, viewport = { panX: 0, panY: 0, zoom: 1 }) => ({
    boardId: 'board-1',
    elements,
    threadId: 'thread-1',
    updatedAt: new Date(0).toISOString(),
    version: 1,
    viewport,
});

test('deserialization validates snapshots and restores current element defaults', () => {
    const legacyRectangle = {
        height: 40,
        id: 'legacy-rectangle',
        type: 'rectangle',
        width: 80,
        x: 10,
        y: 20,
    };

    const parsed = deserializeBoard(snapshot(
        [legacyRectangle],
        { panX: 5, panY: -10, zoom: 100 },
    ));

    assert.equal(parsed.elements[0].strokeWidth, 2);
    assert.equal(parsed.elements[0].opacity, 100);
    assert.deepEqual(parsed.viewport, { panX: 5, panY: -10, zoom: 5 });
});

test('deserialization rejects malformed drawing data and duplicate IDs', () => {
    const line = createElement('line', {
        id: 'line-1',
        points: [{ x: 0, y: 0 }, { x: 20, y: 20 }],
    });

    assert.throws(
        () => deserializeBoard(snapshot([{ ...line, points: [{ x: 0, y: Infinity }] }])),
        /invalid drawing points/,
    );
    assert.throws(
        () => deserializeBoard(snapshot([line, { ...line }])),
        /Duplicate element ID/,
    );
});

test('deserialization rejects non-data image sources', () => {
    const image = createElement('image', {
        dataUrl: 'https://example.com/tracking-pixel.png',
        height: 10,
        width: 10,
    });

    assert.throws(
        () => deserializeBoard(snapshot([image])),
        /invalid image data/,
    );
});

test('deserialization rejects renderer-hostile style and geometry values', () => {
    const star = createElement('star', {
        height: 100,
        id: 'unsafe-star',
        width: 100,
    });

    assert.throws(
        () => deserializeBoard(snapshot([{ ...star, sides: 1_000_000_000 }])),
        /invalid star geometry/,
    );
    assert.throws(
        () => deserializeBoard(snapshot([{ ...star, opacity: 101 }])),
        /invalid rendering values/,
    );
    assert.throws(
        () => deserializeBoard(snapshot([{ ...star, strokeStyle: 'surprise' }])),
        /invalid styling/,
    );
});

test('serialized snapshots still round-trip through strict deserialization', () => {
    const line = createElement('line', {
        points: [{ x: 0, y: 0 }, { x: 10, y: 20 }],
        seed: 1_999_999_999,
        startBinding: {
            elementId: 'shape-1',
            fixedPoint: { x: 0.25, y: 0.5 },
        },
    });
    const serialized = serializeBoard(
        [line],
        { panX: 1, panY: 2, zoom: 1.5 },
        { boardId: 'board-1', threadId: 'thread-1' },
    );

    assert.deepEqual(deserializeBoard(serialized), {
        elements: serialized.elements,
        viewport: serialized.viewport,
    });
});
