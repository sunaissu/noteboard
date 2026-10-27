const {chromium,firefox,webkit,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const engine=process.env.BOARD_BROWSER||'chromium';
(async()=>{
 const browser=await {chromium,firefox,webkit}[engine].launch({headless:true,...(engine==='chromium'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
 const errors=[];
 try{
  for(const theme of ['light','dark'])for(const [width,height] of [[320,568],[390,844],[844,390],[1440,900]]){
   const page=await browser.newPage({viewport:{width,height},hasTouch:width<1000,reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));
   const open=async(mode,extra='')=>page.goto(`http://127.0.0.1:5180/?mode=${mode}&local=1&theme=${theme}${extra}`);
   const noOverflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await open('calculator');
   const expression=page.getByLabel('Calculation expression',{exact:true});await expression.fill('2+3');await expression.press('Enter');
   await expect(page.locator('.calculator-result')).toHaveText('5');
   await page.getByText('Variables & display',{exact:true}).click();
   const variables=page.getByLabel('Named variables',{exact:true}),preview=page.getByRole('region',{name:'Variable values and errors'});
   await variables.fill('length=ans\nwidth=length/2');await expect(preview).toContainText('width: 2.5');
   const history=page.locator('.calculator-history > button');await expect(history).toHaveCount(1);
   await variables.fill('length=20\nwidth=length/2');await expect(preview).toContainText('width: 10');await expect(history).toHaveCount(1);
   await variables.fill('length=1/0\nwidth=length/2\nindependent=7');await expect(preview).toContainText('Line 1 · length: Error:');await expect(preview).toContainText('Line 2 · width: Error:');await expect(preview).toContainText('independent: 7');
   await variables.fill('');await expression.fill('ans');await expression.press('Enter');await expect(page.locator('.calculator-result')).toHaveText('5');await noOverflow();
   await open('document');await page.getByRole('button',{name:'Markdown',exact:true}).click();
   const source=page.getByLabel('Markdown source');const original='Cat one. Cat two. Cat three. Cat four. Cat five. Cat six.';await source.fill(original);
   await page.getByRole('button',{name:'Find & replace',exact:true}).click();await page.getByLabel('Find',{exact:true}).fill('Cat');await page.getByLabel('Replace with',{exact:true}).fill('<img onerror=alert(1)>');
   await page.getByRole('button',{name:'Review replace all',exact:true}).click();const replacementPreview=page.getByRole('region',{name:'Replacement preview'});
   await expect(replacementPreview).toContainText('Showing 5 of 6');await expect(replacementPreview.locator('del')).toHaveCount(5);await expect(replacementPreview.locator('ins')).toHaveCount(5);await expect(replacementPreview.locator('img')).toHaveCount(0);
   await page.getByRole('complementary',{name:'Find & replace'}).locator('.document-tool-content').evaluate(el=>el.scrollTop=el.scrollHeight);
   assert.ok(await page.getByRole('button',{name:'Close panel',exact:true}).evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));
   await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(source).toHaveValue(original);
   await page.getByRole('button',{name:'Review replace all',exact:true}).click();await page.getByRole('button',{name:'Go to match 2',exact:true}).click();await expect(page.getByRole('complementary',{name:'Find & replace'})).toHaveCount(0);await expect(source).toBeFocused();assert.equal(await source.evaluate(el=>el.value.slice(el.selectionStart,el.selectionEnd)),'Cat');await page.getByRole('button',{name:'Find & replace',exact:true}).click();
   await page.getByLabel('Replace with',{exact:true}).fill('Dog');await page.getByRole('button',{name:'Review replace all',exact:true}).click();await page.getByRole('button',{name:'Apply',exact:true}).click();await expect(source).toHaveValue(original.replaceAll('Cat','Dog'));
   await source.focus();await page.keyboard.press('Control+z');await expect(source).toHaveValue(original);
   await page.getByRole('button',{name:'Review replace all',exact:true}).click();await source.fill(original+' New text.');await expect(page.getByRole('button',{name:'Apply',exact:true})).toHaveCount(0);await noOverflow();
   await open('board');await page.waitForFunction(()=>window.board);
   const board=page.getByLabel('Noteboard canvas',{exact:true});
   await page.evaluate(()=>window.board.focusElements(['label']));const before=await page.evaluate(()=>JSON.stringify(window.board.getElements()));
   await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Focus mode',exact:true}).click();
   await expect(board).toHaveAttribute('data-focus-mode','true');await expect(page.locator('[data-noteboard-toolbar]')).toHaveCount(0);await expect(page.getByRole('region',{name:'Object properties'})).toHaveCount(0);await expect(board).toBeFocused();
   await expect(page.getByRole('button',{name:'Connect shape up',exact:true})).toHaveCount(0);
   const exit=page.getByRole('button',{name:'Exit focus mode',exact:true});await expect(exit).toBeVisible();
   assert.ok(await exit.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));
   if(width<1000)await exit.tap();else await exit.click();await expect(board).toHaveAttribute('data-focus-mode','false');await expect(page.locator('[data-noteboard-toolbar]')).toBeVisible();
   await board.focus();await page.keyboard.press('Control+k');await page.getByLabel('Search commands').fill('Enter focus mode');await page.keyboard.press('Enter');await page.keyboard.press('Control+Shift+Backquote');await page.keyboard.press('p');
   await expect(board).toHaveAttribute('data-focus-mode','false');await expect(page.getByRole('region',{name:'Object properties'})).toBeVisible();assert.equal(await page.evaluate(()=>JSON.stringify(window.board.getElements())),before);
   await board.focus();await page.keyboard.press('Control+k');await page.getByLabel('Search commands').fill('Enter focus mode');await page.keyboard.press('Enter');await exit.click();await expect(board).toBeFocused();
   await noOverflow();await page.close();console.log(`${engine} ${theme} ${width}x${height}: three product workflows passed`);
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
