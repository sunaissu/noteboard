const {chromium,firefox,webkit,expect}=require('@playwright/test');
const engine=process.env.BOARD_BROWSER||'chromium';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const BASE=process.env.BOARD_REVIEW_URL||'http://127.0.0.1:5180';
const executablePath=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';

(async()=>{
 const browser=await ({chromium,firefox,webkit}[engine]).launch({...(engine==='chromium'?{executablePath}:{}),headless:true});
 const errors=[];
 try{
  const page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(BASE+'/?local=1');await page.waitForFunction(()=>window.board);
  const board=page.getByLabel('Noteboard canvas',{exact:true});
  const live=()=>page.evaluate(()=>window.board.getElements().filter(el=>!el.isDeleted));
  const command=async(query)=>{await board.focus();await page.keyboard.press('Control+k');await page.getByRole('textbox',{name:'Search commands'}).fill(query);await page.keyboard.press('Enter');};
  await page.evaluate(()=>window.board.setElements([]));await board.focus();await page.keyboard.press('3');
  await expect(page.getByRole('region',{name:'Object properties'})).toBeVisible();await expect(page.getByText('Rectangle defaults',{exact:true})).toBeVisible();
  await page.getByRole('region',{name:'Object properties'}).getByRole('button',{name:'XL',exact:true}).click();
  await board.focus();await page.keyboard.press('Control+Shift+Backquote');await expect(page.locator('[data-keyboard-canvas]')).toBeVisible();
  await page.keyboard.press('Space');await page.keyboard.press('Space');assert.equal((await live()).length,0);
  for(let i=0;i<10;i++)await page.keyboard.press('ArrowRight');for(let i=0;i<8;i++)await page.keyboard.press('ArrowDown');await page.keyboard.press('Space');
  let els=await live();assert.equal(els.length,1);assert.equal(els[0].strokeWidth,6);const id=els[0].id;
  await page.keyboard.press('Tab');await page.keyboard.press('Enter');await expect(page.getByRole('textbox',{name:'Edit object text'})).toBeFocused();
  await page.getByRole('textbox',{name:'Edit object text'}).fill('Keyboard first');await page.keyboard.press('Control+Enter');assert.equal((await live())[0].text,'Keyboard first');await expect(board).toBeFocused();
  await page.keyboard.press('p');await expect(page.getByRole('region',{name:'Object properties'})).toBeVisible();await expect.poll(()=>page.evaluate(()=>!!document.activeElement.closest('[aria-label="Object properties"]'))).toBe(true);
  await page.keyboard.press('Escape');await expect(board).toBeFocused();
  const x=(await live())[0].x;await page.keyboard.press('m');await page.keyboard.press('Shift+ArrowRight');await page.keyboard.press('Shift+ArrowRight');await page.keyboard.press('Enter');assert.equal((await live())[0].x,x+2);
  await page.keyboard.press('Control+z');assert.equal((await live())[0].x,x);await page.keyboard.press('Control+Shift+z');assert.equal((await live())[0].x,x+2);
  await page.keyboard.press('Tab');await command('Create connected shape right');assert.equal((await live()).length,3);
  const arrow=(await live()).find(el=>el.type==='arrow');assert.ok(arrow.endBinding&&arrow.startBinding);
  await page.keyboard.press('Control+a');await command('Frame selection');els=await live();const frame=els.find(el=>el.type==='frame');assert.ok(frame);assert.equal(frame.childIds.length,3);
  const child=els.find(el=>el.id===id);await board.focus();await page.keyboard.press('m');await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');assert.equal((await live()).find(el=>el.id===id).x,child.x+10);
  await command('Layers and frames');await expect(page.getByRole('dialog',{name:'Layers and frames'})).toBeVisible();
  const row=page.getByRole('listitem').filter({has:page.getByRole('textbox',{name:'Name '+id,exact:true})});await row.getByRole('textbox').fill('Named keyboard shape');await row.getByRole('button',{name:'Hide',exact:true}).click();
  assert.equal((await live()).find(el=>el.id===id).hidden,true);assert.equal((await live()).find(el=>el.id===id).displayName,'Named keyboard shape');
  await row.getByRole('button',{name:'Show',exact:true}).click();await page.keyboard.press('Escape');await expect(board).toBeFocused();
  await command('Export preview');await expect(page.getByRole('img',{name:'Export preview'})).toBeVisible();
  for(const format of ['svg','pdf','png']){await page.getByLabel('Export format').selectOption(format);const waiting=page.waitForEvent('download');await page.getByRole('button',{name:'Download '+format.toUpperCase()}).click();const file=await waiting;const data=await fs.readFile(await file.path());if(format==='pdf'){assert.match(data.subarray(0,8).toString(),/^%PDF-1\.[3-7]$/);assert.ok(data.includes(Buffer.from('%%EOF')));}if(format==='svg'){assert.ok(data.toString().includes('<text'));assert.ok(data.toString().includes('Keyboard') && data.toString().includes('first'),data.toString().slice(-3000));assert.ok(!data.toString().includes('<parsererror'));}}
  await page.keyboard.press('Escape');console.log('Keyboard creation, same-point rejection, defaults, text, focus, move, undo/redo, quick connect, frames, layers and exports passed');

  // Test SVG parsing, escaping and every renderer through its real browser APIs.
  const svg=await page.evaluate(async()=>{const api=window.boardApi;const types=['rectangle','ellipse','diamond','triangle','star','callout','sticky-note','frame','line','arrow','pen','text'];const elements=types.map((type,i)=>api.createElement(type,{x:(i%4)*200,y:Math.floor(i/4)*180,width:140,height:100,text:'<script> & "quoted"',points:[{x:0,y:0},{x:100,y:60}],strokeColor:'#123456',backgroundColor:'#ffeedd'}));const tiny=document.createElement('canvas');tiny.width=2;tiny.height=3;tiny.getContext('2d').fillRect(0,0,2,3);elements.push(api.createElement('image',{x:0,y:600,width:180,height:40,dataUrl:tiny.toDataURL()}));const text=await api.exportBoardSvg(elements);const parsed=new DOMParser().parseFromString(text,'image/svg+xml');const image=new Image();image.src='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(text)));await image.decode();return {errors:parsed.querySelectorAll('parsererror').length,scripts:parsed.querySelectorAll('script').length,paths:parsed.querySelectorAll('path').length,images:parsed.querySelectorAll('image[preserveAspectRatio="none"]').length,text:parsed.documentElement.textContent};});assert.equal(svg.errors,0);assert.equal(svg.scripts,0);assert.ok(svg.paths>10);assert.equal(svg.images,1);assert.ok(svg.text.includes('<script>'));
  console.log('SVG rendering, embedded text escaping and browser decoding passed');

  await page.goto(BASE+'/?local=1');await page.waitForFunction(()=>window.board);
  const legacyDraftKey='noteboard:draft:browser-review';
  const legacyDraft=await page.evaluate(key=>{const draft=JSON.stringify({...window.board.getSession(),elements:[window.boardApi.createElement('rectangle',{id:'legacy-draft',text:'Previous board',width:100,height:80})]});localStorage.setItem(key,draft);return draft;},legacyDraftKey);
  await page.reload();await page.waitForFunction(()=>window.board);
  assert.deepEqual((await live()).map(el=>el.id),['label','arrow','star','pen']);
  await expect(page.getByRole('region',{name:'Board recovery'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Restore draft'})).toHaveCount(0);
  await page.evaluate(()=>window.board.setElements([window.boardApi.createElement('rectangle',{id:'current-board',width:120,height:90})]));
  await expect.poll(async()=>(await live()).map(el=>el.id)).toEqual(['current-board']);
  await page.waitForTimeout(800);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),legacyDraftKey),legacyDraft);
  await page.reload();await page.waitForFunction(()=>window.board);
  assert.deepEqual((await live()).map(el=>el.id),['label','arrow','star','pen']);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),legacyDraftKey),legacyDraft);
  await expect(page.getByRole('region',{name:'Board recovery'})).toHaveCount(0);
  console.log('Host-provided board loads without restoring or overwriting legacy browser drafts');

  await page.goto(BASE+'/?local=1&readonly=1');await page.waitForFunction(()=>window.board);const before=await live();await board.focus();await page.keyboard.press('Control+Shift+Backquote');await page.keyboard.press('Tab');await page.keyboard.press('Delete');await page.keyboard.press('Enter');await page.keyboard.press('m');await page.keyboard.press('ArrowRight');assert.deepEqual(await live(),before);assert.equal(await page.getByRole('textbox',{name:'Edit object text'}).count(),0);
  console.log('Read-only keyboard mutation guards passed');

  for(const viewport of [{width:390,height:844},{width:768,height:1024},{width:1024,height:768},{width:844,height:390}]){
   await page.setViewportSize(viewport);await page.goto(BASE+'/?local=1');await page.waitForFunction(()=>window.board);await board.focus();await page.keyboard.press('3');await expect(page.getByRole('region',{name:'Object properties'})).toBeVisible();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.screenshot({animations:'disabled',path:`qa/artifacts/keyboard-canvas-${engine}-${viewport.width}x${viewport.height}.png`});await command('Layers and frames');const box=await page.getByRole('dialog',{name:'Layers and frames'}).boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1);
   await page.screenshot({animations:'disabled',path:`qa/artifacts/keyboard-layers-${engine}-${viewport.width}x${viewport.height}.png`});await page.keyboard.press('Escape');
  }
  console.log('Phone portrait/landscape and tablet portrait/landscape layout bounds passed');

  if(engine==='chromium'){
  const touchPage=await browser.newPage({viewport:{width:768,height:1024},hasTouch:true,isMobile:true});touchPage.on('pageerror',e=>errors.push(e.message));await touchPage.goto(BASE+'/?local=1');await touchPage.waitForFunction(()=>window.board);
  await touchPage.touchscreen.tap(350,280);await expect(touchPage.getByRole('region',{name:'Object properties'})).toBeVisible();
  const cdp=await touchPage.context().newCDPSession(touchPage);const original=await touchPage.evaluate(()=>window.board.getViewport());
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:450,y:600,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:500,y:650,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect.poll(()=>touchPage.evaluate(()=>window.board.getViewport().panX)).not.toBe(original.panX);
  const preZoom=await touchPage.evaluate(()=>window.board.getViewport().zoom);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:400,y:600,id:1},{x:500,y:600,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:350,y:600,id:1},{x:550,y:600,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect.poll(()=>touchPage.evaluate(()=>window.board.getViewport().zoom)).toBeGreaterThan(preZoom);assert.equal(await touchPage.evaluate(()=>window.board.getElements().length),4);
  await touchPage.setViewportSize({width:390,height:844});await touchPage.getByRole('button',{name:'Rectangle',exact:true}).first().click();
  await touchPage.screenshot({animations:'disabled',path:'qa/artifacts/keyboard-touch-phone.png'});
  const overlap=await touchPage.evaluate(()=>{const nodes=[document.querySelector('[data-noteboard-toolbar]'),document.querySelector('[data-noteboard-shapes]'),document.querySelector('[aria-label="Zoom in"]').parentElement];const boxes=nodes.map(n=>n.getBoundingClientRect());return boxes.some((a,i)=>boxes.slice(i+1).some(b=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top));});assert.equal(overlap,false);
  console.log('Touch tap selection, one-finger pan, two-finger pinch and coarse-pointer phone control spacing passed');
  }
  assert.deepEqual(errors,[]);console.log(engine+' review passed');
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
