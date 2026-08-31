const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { act, create } = require('react-test-renderer');

const { createElement, useHistory } = require('../dist/index.js');

test('history snapshots preserve nested element state', () => {
    let history;
    const Harness = () => {
        history = useHistory();
        return null;
    };

    let renderer;
    act(() => {
        renderer = create(React.createElement(Harness));
    });

    const line = createElement('line', {
        points: [{ x: 0, y: 0 }, { x: 10, y: 20 }],
        startBinding: {
            elementId: 'shape-1',
            fixedPoint: { x: 0.25, y: 0.5 },
        },
    });
    const before = [line];

    history.record(before);
    line.points[1].x = 99;
    line.startBinding.fixedPoint.x = 0.75;

    const restored = history.undo(before);
    assert.equal(restored[0].points[1].x, 10);
    assert.equal(restored[0].startBinding.fixedPoint.x, 0.25);

    act(() => renderer.unmount());
});
