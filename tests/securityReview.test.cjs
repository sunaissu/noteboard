const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const cache = new Map();
function load(name) {
 let file = path.resolve(__dirname, '../src', name);
 if (!fs.existsSync(file)) file = file.slice(0,-3)+'/index.ts';
 if (cache.has(file)) return cache.get(file).exports;
 const mod = new Module(file, module); mod.paths = module.paths; cache.set(file, mod);
 const ordinary = mod.require.bind(mod);
 mod.require = id => id.startsWith('.') ? load(path.relative(path.resolve(__dirname,'../src'),path.resolve(path.dirname(file),id+'.ts'))) : ordinary(id);
 mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,file);
 return mod.exports;
}
const {drawJitteredLine} = load('renderer/utils.ts');
const {renderLine} = load('renderer/renderLinear.ts');
const {deserializeBoard,createElement} = require('../dist/index.js');
test('rough rendering bounds coordinate and polyline amplification', () => {
 let calls = 0;
 const context = {lineTo(){assert.ok(++calls <= 10000, 'rendering budget exceeded');},beginPath(){},moveTo(){},stroke(){}};
 drawJitteredLine(context,0,0,1e9,1e9,1,()=>.5);
 assert.ok(calls <= 256);
 calls = 0;
 const points = Array.from({length:1000},(_,i)=>({x:i%2?1e9:0,y:0}));
 renderLine(context,createElement('line',{points,roughness:1}));
 assert.ok(calls <= 4096);
});
test('snapshot images require raster MIME and well-formed base64', () => {
 for (const dataUrl of ['data:image/svg+xml;base64,AAAA','data:image/png;base64,!!!','data:image/png;base64,A===','data:image/png;base64,A']) {
  assert.throws(()=>deserializeBoard({elements:[createElement('image',{dataUrl})]}),/image data/);
 }
 for(const format of ['png','jpeg','gif','webp']) assert.equal(deserializeBoard({elements:[createElement('image',{dataUrl:'data:image/'+format+';base64,AA=='})]}).elements.length,1);
});

test('large valid image payloads do not overflow the validator stack', () => {
 const dataUrl='data:image/png;base64,'+'A'.repeat(7*1024*1024);
 assert.equal(deserializeBoard({elements:[createElement('image',{dataUrl})]}).elements[0].dataUrl,dataUrl);
});
test('long shape labels measure a linear amount of text', () => {
 const {renderShapeText}=load('renderer/renderShapes.ts');
 const text='word '.repeat(20000); let measured=0;
 const ctx={save(){},restore(){},fillText(){},measureText(s){measured+=s.length;assert.ok(measured<text.length*4);return {width:s.length};}};
 renderShapeText(ctx,createElement('rectangle',{width:1e9,height:100}),text,12,'sans-serif','left');
});
test('oversized decoded images are rejected and stalled exports time out', async t => {
 const previous=global.Image; const images=[];
 global.Image=class {naturalWidth=5000;naturalHeight=5000;set src(value){images.push(this);}};
 t.after(()=>{global.Image=previous;});
 const {getCachedImage}=load('renderer/utils.ts');
 const entry=getCachedImage('oversized-test','test'); images[0].onload();
 assert.equal(getCachedImage('oversized-test','test').status,'error');
 const {exportBoardImage}=load('exportImage.ts');
 await assert.rejects(exportBoardImage([createElement('image',{dataUrl:'stalled-test'})],'png',{imageTimeoutMs:10}),/timed out/);
 // A late completion remains safe after the timed-out listener was removed.
 images[1].onload();
});
