const test = require('node:test');
const assert = require('node:assert/strict');
const { createRectangleElement, renderBoardImage } = require('../dist/index.js');

test('large controlled boards export within canvas limits without argument overflow', t => {
 const original = global.document;
 const context = new Proxy({}, { get: (target, key) => target[key] ?? (() => {}) });
 const canvas = {getContext:()=>context, toDataURL:()=> 'data:image/png;base64,ok'};
 global.document = {createElement:()=>canvas};
 t.after(()=>{ if(original === undefined) delete global.document; else global.document=original; });
 const rectangle = createRectangleElement({id:'base', width:10, height:10});
 const elements = Array.from({length:150000}, (_, index)=>({...rectangle,id:String(index),x:index}));
 assert.equal(renderBoardImage(elements), 'data:image/png;base64,ok');
 assert.ok(canvas.width <= 8192 && canvas.height <= 8192);
 assert.throws(()=>renderBoardImage([{...rectangle,x:Infinity}]), /finite/);
});
