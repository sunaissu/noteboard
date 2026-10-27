const {chromium,firefox,webkit,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const engine=process.env.BOARD_BROWSER||'chromium';
(async()=>{
 const browser=await ({chromium,firefox,webkit}[engine]).launch({headless:true,...(engine==='chromium'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5180/?local=1');await page.waitForFunction(()=>window.board);
  const board=page.getByLabel('Noteboard canvas',{exact:true}),properties=page.getByRole('region',{name:'Object properties'});
  const elements=()=>page.evaluate(()=>window.board.getElements().filter(el=>!el.isDeleted));
  const command=async(q)=>{await board.focus();await page.keyboard.press('Control+k');await page.getByRole('textbox',{name:'Search commands'}).fill(q);await page.keyboard.press('Enter');};
  await page.evaluate(()=>{const a=window.boardApi;window.board.setElements([a.createElement('arrow',{id:'bend',x:400,y:350,width:350,height:0,points:[{x:0,y:0},{x:350,y:0}],routing:'orthogonal'}),a.createElement('rectangle',{id:'obstacle',x:530,y:300,width:70,height:100})]);window.board.focusElements(['bend']);});
  const bend=page.getByRole('button',{name:'Connector bend 1',exact:true});await expect(bend).toBeVisible();let before=(await elements()).find(e=>e.id==='bend').points;
  await bend.focus();await page.keyboard.press('ArrowDown');let changed=(await elements()).find(e=>e.id==='bend');assert.equal(changed.manualRoute,true);assert.notDeepEqual(changed.points,before);
  await properties.getByRole('button',{name:'Reset automatic route'}).click();assert.equal((await elements()).find(e=>e.id==='bend').manualRoute,false);
  const box=await bend.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2,box.y+box.height/2+40,{steps:4});await page.mouse.up();assert.equal((await elements()).find(e=>e.id==='bend').manualRoute,true);
  await board.focus();await page.keyboard.press('Control+z');assert.equal((await elements()).find(e=>e.id==='bend').manualRoute,false);
  await page.evaluate(()=>window.board.focusElements(['bend']));await properties.getByLabel('End x',{exact:true}).fill('800');await page.keyboard.press('Tab');assert.equal((await elements()).find(e=>e.id==='bend').x+(await elements()).find(e=>e.id==='bend').width,800);
  console.log('Connector bend keyboard editing, pointer dragging, automatic reset, endpoints and undo passed');

  await page.evaluate(()=>{window.board.setElements([]);window.board.setViewport({panX:0,panY:0,zoom:1});});await board.focus();await page.keyboard.press('3');await properties.getByRole('button',{name:'XL',exact:true}).click();
  const canvas=board.locator('canvas').first(),canvasBox=await canvas.boundingBox();await page.mouse.move(canvasBox.x+420,canvasBox.y+350);await page.mouse.down();await page.mouse.move(canvasBox.x+540,canvasBox.y+440,{steps:4});await page.mouse.up();assert.equal((await elements())[0].strokeWidth,6);
  const shape=(await elements())[0];await command('Tool: Frame');await expect(page.getByText('Frame defaults',{exact:true})).toBeVisible();await page.mouse.move(canvasBox.x+390,canvasBox.y+320);await page.mouse.down();await page.mouse.move(canvasBox.x+580,canvasBox.y+480,{steps:4});await page.mouse.up();let frame=(await elements()).find(e=>e.type==='frame');assert.deepEqual(frame.childIds,[shape.id]);
  await page.evaluate(id=>window.board.focusElements([id]),frame.id);await command('Tool: Select');await board.focus();await page.keyboard.press('Control+d');let copies=await elements();assert.equal(copies.length,4);const duplicate=copies.find(e=>e.type==='frame'&&e.id!==frame.id);assert.equal(duplicate.childIds.length,1);assert.notEqual(duplicate.childIds[0],shape.id);
  console.log('Pointer tool defaults, frame capture and coherent frame duplication passed');

  await board.focus();await page.keyboard.press('Control+Shift+Backquote');await page.keyboard.press('Tab');await page.keyboard.press('a');await page.keyboard.press('Tab');assert.ok((await properties.textContent()).includes('Properties (2)'));
  await page.keyboard.press('F6');await expect(page.locator('[data-keyboard-canvas]')).toHaveCount(0);await board.focus();await page.keyboard.press('Tab');if(await page.evaluate(()=>document.activeElement.getAttribute('aria-label'))==='Noteboard canvas')await page.keyboard.press('Tab');await expect.poll(()=>page.evaluate(()=>document.activeElement.getAttribute('aria-label'))).not.toBe('Noteboard canvas');assert.notEqual(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Noteboard canvas');
  await command('Tool: Text');await expect(page.locator('[data-tool-defaults="Text"]')).toBeVisible();await properties.getByLabel('Font size',{exact:true}).fill('32');await properties.getByLabel('Font family',{exact:true}).selectOption('Arial, sans-serif');await board.focus();await page.keyboard.press('Control+Shift+Backquote');await page.keyboard.press('Space');await page.getByRole('textbox',{name:'Edit object text'}).fill('p l m a 123');assert.equal(await page.getByRole('textbox',{name:'Edit object text'}).evaluate(el=>parseFloat(getComputedStyle(el).fontSize)),await page.evaluate(()=>32*window.board.getViewport().zoom));assert.equal(await page.locator('[data-tool-defaults="Text"]').count(),1);
  await page.keyboard.press('Control+Enter');await expect(board).toBeFocused();await page.keyboard.press('Control+k');await page.getByRole('textbox',{name:'Search commands'}).focus();await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.tagName),'BUTTON');await page.keyboard.press('Escape');await expect(board).toBeFocused();
  console.log('Additive object selection, keyboard escape path, typing isolation and modal focus passed');
  await command('Tool: Image');await expect(page.locator('[data-tool-defaults="Image"]')).toBeVisible();await board.focus();const choose=page.waitForEvent('filechooser');await page.keyboard.press('Space');const chooser=await choose;const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=4;c.height=4;c.getContext('2d').fillRect(0,0,4,4);return c.toDataURL().split(',')[1];});await chooser.setFiles({name:'keyboard.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await expect.poll(async()=>(await elements()).some(el=>el.type==='image')).toBe(true);console.log('Keyboard image insertion passed');

  await page.goto('http://127.0.0.1:5180/?local=1');await page.waitForFunction(()=>window.board);
  await page.evaluate(()=>{window.originalStorageSet=Storage.prototype.setItem;window.storageWriteAttempts=0;Storage.prototype.setItem=()=>{window.storageWriteAttempts++;throw new DOMException('Quota exceeded','QuotaExceededError');};});
  try{
   await page.evaluate(()=>window.board.setElements([window.boardApi.createElement('rectangle',{id:'current-board',width:100,height:80})]));
   await expect.poll(async()=>(await elements()).map(el=>el.id)).toEqual(['current-board']);
   await page.waitForTimeout(800);
   await page.getByRole('button',{name:'Settings',exact:true}).click();
   await expect(page.getByRole('button',{name:'Retry draft save'})).toHaveCount(0);
   await expect(page.getByText('Draft save failed. Retry or export a copy.')).toHaveCount(0);
   assert.equal(await page.evaluate(()=>window.storageWriteAttempts),0);
   await page.getByRole('button',{name:'Close settings',exact:true}).click();await board.focus();await page.keyboard.press('Control+z');
   assert.deepEqual((await elements()).map(el=>el.id),['label','arrow','star','pen']);
   await page.keyboard.press('Control+Shift+z');assert.deepEqual((await elements()).map(el=>el.id),['current-board']);
  }finally{await page.evaluate(()=>{Storage.prototype.setItem=window.originalStorageSet;});}
  console.log('Board editing and undo/redo work without browser storage or draft-save controls');
  assert.deepEqual(errors,[]);console.log(engine+' refinement review passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
