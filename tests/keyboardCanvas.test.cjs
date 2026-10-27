const test=require('node:test');
const assert=require('node:assert/strict');
const {createElement,duplicateElements,duplicateElement,moveKeyboardCursor,nextKeyboardElement,frameSelection,moveFrameChildren,createConnectedSibling,exportSelection,routeOrthogonal,updateBoundElements,hitTestElement,serializeBoard,deserializeBoard}=require('../dist/index.js');
const shape=(id,x,y=0,extra={})=>createElement('rectangle',{id,x,y,width:20,height:20,...extra});

test('fast keyboard travel stops at the nearest crossed visible object in either direction',()=>{
    const elements=[shape('hidden',5,0,{hidden:true}),shape('deleted',10,0,{isDeleted:true}),shape('far',60),shape('near',30)];
    assert.deepEqual(moveKeyboardCursor({x:0,y:10},{x:80,y:0},elements,true),{x:30,y:10});
    assert.deepEqual(moveKeyboardCursor({x:100,y:10},{x:-100,y:0},elements,true),{x:80,y:10});
    assert.deepEqual(moveKeyboardCursor({x:30,y:10},{x:80,y:0},elements,true),{x:60,y:10});
    assert.deepEqual(moveKeyboardCursor({x:0,y:10},{x:80,y:0},elements),{x:80,y:10});
});
test('object cycling wraps, retains locked objects, and skips hidden/deleted objects',()=>{
    const elements=[shape('a',0),shape('b',0,0,{hidden:true}),shape('c',0,0,{locked:true}),shape('d',0,0,{isDeleted:true})];
    assert.equal(nextKeyboardElement(elements,undefined).id,'a');assert.equal(nextKeyboardElement(elements,'a').id,'c');
    assert.equal(nextKeyboardElement(elements,'c').id,'a');assert.equal(nextKeyboardElement(elements,'a',true).id,'c');
    assert.equal(nextKeyboardElement([],undefined),undefined);
});
test('frame translation carries children once and respects explicit edits and locks',()=>{
    const a=shape('a',10),b=shape('b',50),locked=shape('locked',80,0,{locked:true});
    const frame=frameSelection([a,b,locked],new Set(['a','b','locked']));assert.deepEqual(frame.childIds,['a','b']);
    const before=[frame,a,b,locked],moved=moveFrameChildren(before,[{...frame,x:frame.x+40},a,{...b,x:100},locked]);
    assert.equal(moved[1].x,50);assert.equal(moved[2].x,100);assert.equal(moved[3].x,80);
    const undone=moveFrameChildren(moved,before);assert.equal(undone[1].x,10);assert.equal(undone[2].x,50);
});
test('frame export expands nested membership safely even with imported cycles',()=>{
    const a=shape('a',0),f=createElement('frame',{id:'f',childIds:['a','g']}),g=createElement('frame',{id:'g',childIds:['f']});
    assert.deepEqual(exportSelection([a,f,g],['f']),['f','a','g']);assert.equal(exportSelection([a]),undefined);
});
test('quick connect produces valid bound shapes whose connectors follow movement',()=>{
    const a=shape('a',0),result=createConnectedSibling(a,'right');assert.ok(result);
    const first=updateBoundElements([a,result.connector,result.node]);
    const moved=updateBoundElements(first.map(el=>el.id===result.node.id?{...el,y:100}:el));
    assert.equal(moved[1].endBinding.elementId,result.node.id);assert.notEqual(moved[1].height,first[1].height);
    assert.equal(createConnectedSibling({...a,locked:true},'right'),null);
});
test('orthogonal routes avoid obstacles and keep endpoints exact',()=>{
    const boxes=[[30,-20,70,20],[80,-80,110,-10]],start={x:0,y:0},end={x:140,y:0};
    const points=routeOrthogonal(start,end,boxes);assert.deepEqual(points[0],start);assert.deepEqual(points.at(-1),end);
    for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];assert.ok(a.x===b.x||a.y===b.y);for(let k=1;k<100;k++){const p={x:a.x+(b.x-a.x)*k/100,y:a.y+(b.y-a.y)*k/100};assert.equal(boxes.some(r=>p.x>r[0]&&p.x<r[2]&&p.y>r[1]&&p.y<r[3]),false);}}
});
test('moving obstacles reroutes elbows while manual bends survive subsequent edits',()=>{
    const connector=createElement('arrow',{id:'arrow',x:0,y:0,width:200,height:0,routing:'orthogonal',points:[{x:0,y:0},{x:200,y:0}]}),obstacle=shape('block',90,-10);
    const auto=updateBoundElements([connector,obstacle]);assert.ok(auto[0].points.some(p=>p.y!==0));
    assert.equal(updateBoundElements(auto),auto);
    const cleared=updateBoundElements([auto[0],{...obstacle,y:200}]);assert.ok(cleared[0].points.every(p=>p.y===0));
    const manual={...auto[0],manualRoute:true};const result=updateBoundElements([manual,{...obstacle,y:300}]);assert.equal(result[0],manual);
});
test('hidden layers are unselectable and visibility and names survive sessions',()=>{
    const hidden=shape('secret',0,0,{hidden:true,displayName:'Private draft'});
    assert.equal(hitTestElement({x:10,y:10},hidden,5),false);
    const session=serializeBoard([hidden],{panX:0,panY:0,zoom:1},{threadId:'test',boardId:'test'});const restored=deserializeBoard(session);assert.equal(restored.elements[0].hidden,true);assert.equal(restored.elements[0].displayName,'Private draft');
    assert.throws(()=>deserializeBoard({...session,elements:[{...hidden,hidden:'yes'}]}));
});

test('duplicated frames never retain references to original children',()=>{
 const child=shape('child',10),frame=frameSelection([child],new Set(['child']));
 const copies=duplicateElements([frame,child]);assert.deepEqual(copies[0].childIds,[copies[1].id]);assert.notEqual(copies[0].childIds[0],child.id);
 assert.deepEqual(duplicateElement(frame).childIds,[]);assert.deepEqual(duplicateElements([frame])[0].childIds,[]);
});
