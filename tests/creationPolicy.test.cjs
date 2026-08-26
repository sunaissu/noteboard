const test = require('node:test');
const assert = require('node:assert/strict');

const {
    MIN_CREATION_DISTANCE,
    createElement,
    isElementMutationShortcut,
    shouldCommitDrawnElement,
} = require('../dist/index.js');

const connector = (type, width, height) => createElement(type, {
    x: 0,
    y: 0,
    width,
    height,
    points: [{ x: 0, y: 0 }, { x: width, y: height }],
});

test('connector creation uses a five CSS-pixel distance at every zoom level', () => {
    assert.equal(MIN_CREATION_DISTANCE, 5);

    for (const type of ['line', 'arrow']) {
        assert.equal(shouldCommitDrawnElement(connector(type, 3, 4), 1), true);
        assert.equal(shouldCommitDrawnElement(connector(type, -3, -4), 1), true);
        assert.equal(shouldCommitDrawnElement(connector(type, 2.9, 4), 1), false);
        assert.equal(shouldCommitDrawnElement(connector(type, 1.5, 2), 2), true);
        assert.equal(shouldCommitDrawnElement(connector(type, 3, 4), 0.5), false);
    }
});

test('area tools need meaningful width and height instead of becoming click-created defaults', () => {
    const areaTools = [
        'rectangle',
        'ellipse',
        'diamond',
        'triangle',
        'star',
        'sticky-note',
        'callout',
    ];

    for (const type of areaTools) {
        assert.equal(
            shouldCommitDrawnElement(createElement(type, { width: 0, height: 0 }), 1),
            false,
            `${type} click should be discarded`,
        );
        assert.equal(
            shouldCommitDrawnElement(createElement(type, { width: 100, height: 4.9 }), 1),
            false,
            `${type} should reject a tiny height`,
        );
        assert.equal(
            shouldCommitDrawnElement(createElement(type, { width: -5, height: -6 }), 1),
            true,
            `${type} should accept intentional drawing in a negative direction`,
        );
    }
});

test('raw pointer travel prevents snapping from promoting accidental jitter', () => {
    assert.equal(
        shouldCommitDrawnElement(connector('arrow', 20, 0), 1, 1),
        false,
    );
    assert.equal(
        shouldCommitDrawnElement(createElement('rectangle', { width: 10, height: 10 }), 1, 1),
        false,
    );
});

test('freehand strokes may be tiny but must contain a visible movement', () => {
    for (const type of ['pen', 'draw']) {
        assert.equal(
            shouldCommitDrawnElement(createElement(type, { points: [{ x: 0, y: 0 }] }), 1),
            false,
        );
        assert.equal(
            shouldCommitDrawnElement(createElement(type, {
                points: [{ x: 0, y: 0 }, { x: 0, y: 0 }],
            }), 1),
            false,
        );
        assert.equal(
            shouldCommitDrawnElement(createElement(type, {
                width: 0.1,
                height: 0,
                points: [{ x: 0, y: 0 }, { x: 0.1, y: 0 }],
            }), 1),
            true,
        );
    }
});

test('read-only keyboard policy blocks element mutations but retains view shortcuts', () => {
    const mutatingShortcuts = [
        { key: 'Delete' },
        { key: 'Backspace' },
        { key: 'ArrowLeft' },
        { key: '[' },
        { key: 'z', ctrlKey: true },
        { key: 'Y', metaKey: true },
        { key: 'v', ctrlKey: true },
        { key: 'd', ctrlKey: true },
        { key: 'G', ctrlKey: true, shiftKey: true },
    ];
    for (const shortcut of mutatingShortcuts) {
        assert.equal(isElementMutationShortcut(shortcut), true, shortcut.key);
    }

    const viewOnlyShortcuts = [
        { key: 'Escape' },
        { key: 'c', ctrlKey: true },
        { key: 'a', ctrlKey: true },
        { key: '0', ctrlKey: true },
        { key: 'F', ctrlKey: true, shiftKey: true },
    ];
    for (const shortcut of viewOnlyShortcuts) {
        assert.equal(isElementMutationShortcut(shortcut), false, shortcut.key);
    }
});
