const {chromium,firefox,webkit,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const engine=process.env.BOARD_BROWSER||'chromium';
const sizes=[[320,568],[390,844],[568,320],[844,390],[640,450],[768,1024],[1024,768],[1440,900]];
(async()=>{
 const browser=await {chromium,firefox,webkit}[engine].launch({headless:true,...(engine==='chromium'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
 const errors=[];
 try {
  for(const theme of ['light','dark']) for(const [width,height] of sizes){
   const context=await browser.newContext({viewport:{width,height},hasTouch:width<1100,reducedMotion:'reduce'});
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`http://127.0.0.1:5180/?local=1&workspace=1&theme=${theme}`);await page.waitForFunction(()=>window.board);
   const board=page.getByLabel('Noteboard canvas',{exact:true});
   const command=async q=>{await board.focus();await page.keyboard.press('Control+k');await page.getByLabel('Search commands').fill(q);await page.keyboard.press('Enter');};
   const reachable=async locator=>{
    await expect(locator).toBeVisible();
    await expect.poll(()=>locator.evaluate(el=>{const r=el.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.width>0&&r.height>0&&!!hit&&(el===hit||el.contains(hit));})).toBe(true);
   };
   await page.evaluate(()=>window.board.focusElements(['label']));
   const properties=page.getByRole('region',{name:'Object properties'});
   if(width<600){
    const category=page.getByLabel('Property category');await expect(category).toBeVisible();
    await category.selectOption('text');
    const font=properties.getByLabel('Font size',{exact:true});await font.focus();await reachable(font);await font.fill('24');await page.keyboard.press('Tab');
    await category.selectOption('appearance');
    await properties.getByText('Arrange and lock',{exact:true}).click();
    const lock=properties.getByTitle('Lock',{exact:true});await lock.focus();await reachable(lock);await lock.click();
    const unlock=properties.getByTitle('Unlock',{exact:true});await unlock.focus();await reachable(unlock);await unlock.click();
    assert.equal(await properties.locator('[data-property-scroll]').evaluate(el=>el.scrollWidth>el.clientWidth+1),false,'Phone properties must not require sideways scrolling');
   }
   await properties.getByTitle('Collapse panel').click();
   await reachable(properties.getByTitle('Expand panel'));
   await command('Board workspace:');
   const section=page.getByLabel('Workspace section');
   if(await section.isVisible())await section.selectOption('Objects');else await page.getByRole('tab',{name:'Objects',exact:true}).click();
   await page.getByRole('dialog').locator('details').evaluateAll(nodes=>nodes.forEach(n=>n.open=true));
   const scroll=page.locator('[data-workspace-scroll]');
   const viewportBefore=await page.evaluate(()=>window.board.getViewport());
   await scroll.focus();await scroll.evaluate(el=>el.scrollTop=0);await page.keyboard.press('PageDown');
   if(await scroll.evaluate(el=>el.scrollHeight>el.clientHeight))await expect.poll(()=>scroll.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
   await scroll.evaluate(el=>el.scrollTop=el.scrollHeight);
   const close=page.getByRole('dialog').getByRole('button',{name:'Close',exact:true});
   await reachable(close);
   if(await section.isVisible()){await reachable(section);await section.selectOption('Views');}else {await reachable(page.getByRole('tab',{name:'Views',exact:true}));await page.getByRole('tab',{name:'Views',exact:true}).click();}
   assert.deepEqual(await page.evaluate(()=>window.board.getViewport()),viewportBefore,'Dialog scrolling must not pan the canvas');
   await close.click();await expect(board).toBeFocused();
   await command('Board workspace:');
   if(await section.isVisible())await section.selectOption('Diagram');else await page.getByRole('tab',{name:'Diagram',exact:true}).click();
   await page.getByRole('button',{name:'Preview diagram import',exact:true}).click();
   await scroll.evaluate(el=>el.scrollTop=el.scrollHeight);
   await reachable(page.getByRole('button',{name:'Apply preview',exact:true}));
   await reachable(page.getByRole('button',{name:'Cancel preview',exact:true}));
   await close.click();
   await command('Layers and frames');await scroll.evaluate(el=>el.scrollTop=el.scrollHeight);await reachable(page.getByLabel('Search layers'));await close.click();
   await command('Export preview:');await page.getByLabel('Export format').selectOption('pdf');await page.getByLabel('PDF paper').selectOption('custom');
   const download=page.getByRole('button',{name:'Download PDF',exact:true});await expect(download).toBeEnabled();
   for(const end of [0,1]){await scroll.evaluate((el,end)=>el.scrollTop=end?el.scrollHeight:0,end);await reachable(close);await reachable(download);}
   await close.focus();await page.keyboard.press('Shift+Tab');await expect(download).toBeFocused();await page.keyboard.press('Tab');await expect(close).toBeFocused();
   const paperHeight=page.getByLabel('Paper height');await paperHeight.focus();await reachable(paperHeight);
   await page.screenshot({path:`qa/artifacts/usability-${engine}-${theme}-${width}x${height}.png`});
   await page.keyboard.press('Escape');await expect(board).toBeFocused();
   await context.close();console.log(`${engine} ${theme} ${width}x${height} usability passed`);
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
