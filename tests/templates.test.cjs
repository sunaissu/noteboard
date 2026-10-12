const test = require('node:test');
const assert = require('node:assert/strict');
const {createBoardTemplate, deserializeBoard, resizeElement, createPenElement} = require('../dist/index.js');
test('templates produce valid, independent objects with internal connections', () => {
 for(const template of ['flowchart','planning','brainstorm']) {
  const first = createBoardTemplate(template), second = createBoardTemplate(template, {x:100,y:200});
  assert.ok(first.length >= 5);
  assert.equal(deserializeBoard({elements:first}).elements.length, first.length);
  const ids = new Set(first.map(item=>item.id));
  assert.ok(second.every(item=>!ids.has(item.id)));
  assert.equal(second[0].x-first[0].x,100);
  assert.equal(second[0].y-first[0].y,200);
  for(const item of first) for(const binding of [item.startBinding,item.endBinding]) if(binding) assert.ok(ids.has(binding.elementId));
 }
 assert.throws(()=>createBoardTemplate('unknown'),/Unknown/);
 assert.throws(()=>createBoardTemplate('flowchart',{x:Infinity,y:0}),/finite/);
});
test('public pen resizing preserves pressure without mutating the source', () => {
 const pen = createPenElement({points:[{x:1,y:2,pressure:.2},{x:4,y:5,pressure:.9}]});
 const resized=resizeElement(pen,2,3);
 assert.deepEqual(resized.points,[{x:2,y:6,pressure:.2},{x:8,y:15,pressure:.9}]);
 assert.equal(pen.points[0].x,1);
});
