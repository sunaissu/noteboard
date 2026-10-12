const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { clickEditorTool } = require('./editor-tools.cjs');

(async () => {
 const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try {
  const page = await browser.newPage({viewport:{width:1440,height:1100}});
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:5173');
  await page.getByRole('button',{name:'Engineering',exact:true}).click();
  await page.getByRole('button',{name:'Solve f(x) = 0',exact:true}).click();
  await page.getByLabel('f(x)',{exact:true}).fill('x^2 - 2');
  await page.getByLabel('Lower bound').fill('0'); await page.getByLabel('Upper bound').fill('2');
  await page.getByRole('button',{name:'Solve equation',exact:true}).click();
  assert.ok(Math.abs(Number(await page.locator('.calculator-result').textContent())-Math.sqrt(2))<1e-8);
  await expect(page.getByText(/Residual:/)).toBeVisible();
  await page.getByLabel('f(x)',{exact:true}).fill('x^2 + 1');
  await page.getByRole('button',{name:'Solve equation',exact:true}).click();
  await expect(page.locator('.calculator-result')).toContainText('changes sign');
  console.log('Calculator solver, residuals and failed-bracket feedback passed');

  await page.goto('http://127.0.0.1:5174');
  const png=Buffer.from(await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=8;canvas.height=8;const ctx=canvas.getContext('2d');ctx.fillStyle='#7c5cff';ctx.fillRect(0,0,8,8);return canvas.toDataURL().split(',')[1];}),'base64');
  await clickEditorTool(page,'Image');
  await page.locator('.document-image-upload input[type=file]').setInputFiles({name:'purple.png',mimeType:'image/png',buffer:png});
  await expect(page.getByRole('status')).toContainText('Image inserted');
  await expect(page.locator('.sunaissu-rich-text-editor img')).toHaveCount(1);
  await expect(page.locator('.sunaissu-rich-text-editor img')).toHaveAttribute('alt','purple');
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await expect(page.locator('.sunaissu-rich-text-editor img')).toHaveCount(0);
  await page.locator('.document-image-upload input[type=file]').setInputFiles({name:'script.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});
  await expect(page.getByRole('status')).toContainText('Choose a PNG');
  console.log('Editor image upload, alt text, undo and unsupported-format rejection passed');

  await page.goto('http://127.0.0.1:5175');
  await expect(page.getByRole('heading',{name:'Room for your next idea.'})).toBeVisible();
  const inspector=page.getByRole('complementary',{name:'Playground controls'});
  await expect(inspector.locator('.metrics strong').first()).toHaveText('5');
  await inspector.getByLabel('Board template').selectOption('planning');
  await inspector.getByRole('button',{name:'Insert template',exact:true}).click();
  await expect(inspector.locator('.metrics strong').first()).toHaveText('11');
  const downloadPromise=page.waitForEvent('download'); await inspector.getByRole('button',{name:'Export JSON',exact:true}).click();
  const exported=await downloadPromise; const data=JSON.parse(await fs.readFile(await exported.path(),'utf8'));
  assert.equal(data.elements.length,11); assert.ok(data.viewport.zoom>0); assert.equal(data.boardId,'playground');
  await inspector.locator('input[type=file]').setInputFiles({name:'saved.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
  await expect(page.getByRole('region',{name:'Import preview'})).toBeVisible();
  await page.getByRole('button',{name:'Merge objects',exact:true}).click();
  await expect(inspector.locator('.metrics strong').first()).toHaveText('22');
  await inspector.getByRole('button',{name:'Preview as read-only'}).click();
  await expect(inspector.getByRole('button',{name:'Insert template',exact:true})).toBeDisabled();
  await expect(inspector.getByRole('button',{name:'Import JSON',exact:true})).toBeDisabled();
  await inspector.getByRole('button',{name:'Unlock editing'}).click();
  await inspector.getByRole('button',{name:'Reset sample',exact:true}).click();
  for(const theme of ['light','dark']) {
   await inspector.getByRole('button',{name:theme,exact:true}).click();
   await page.screenshot({path:'qa/artifacts/noteboard-playground-'+theme+'.png',fullPage:true});
  }
  await page.setViewportSize({width:390,height:844});
  await page.reload();
  await expect(page.getByRole('heading',{name:'Room for your next idea.'})).toBeVisible();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
  await page.screenshot({path:'qa/artifacts/noteboard-playground-mobile.png',fullPage:true});
  const imageDownload=page.waitForEvent('download'); await inspector.getByRole('button',{name:'Export PNG',exact:true}).click();
  assert.equal((await imageDownload).suggestedFilename(),'noteboard.png');
  assert.deepEqual(errors,[]);
  console.log('Noteboard templates, snapshot roundtrip, merge, permissions, PNG and responsive layouts passed');
 } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
