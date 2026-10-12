const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const { clickEditorTool } = require('./editor-tools.cjs');

(async () => {
 const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try {
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5191/?mode=calculator');
  await page.getByText('Variables & display', {exact:true}).click();
  await page.getByLabel('Named variables').fill('length = 12');
  await page.getByLabel('Calculation expression').fill('length * 2');
  await page.getByRole('button',{name:'=',exact:true}).click();
  await page.getByLabel('Named variables').fill('length = 99');
  await page.getByLabel('Calculation expression').fill('length * 3');
  await page.getByRole('button',{name:'=',exact:true}).click();
  await page.locator('.calculator-history button').filter({hasText:'length × 2'}).click();
  assert.equal(await page.getByLabel('Named variables').inputValue(),'length = 12');
  await page.getByRole('button',{name:'=',exact:true}).click();
  assert.equal(await page.locator('.calculator-result').textContent(),'24');
  await page.getByLabel('Notation').selectOption('significant');
  await page.getByLabel('Significant figures').fill('4');
  assert.equal(await page.locator('.calculator-result').textContent(),'24.00');
  await page.getByLabel('Calculation expression').fill('ans + 1');
  await page.getByRole('button',{name:'=',exact:true}).click();
  await page.getByLabel('Calculation expression').fill('100');
  await page.getByRole('button',{name:'=',exact:true}).click();
  await page.locator('.calculator-history button').filter({hasText:'ans + 1'}).click();
  await page.getByRole('button',{name:'=',exact:true}).click();
  assert.equal(await page.locator('.calculator-result').textContent(),'25.00');
  await page.getByLabel('f(x)',{exact:true}).fill('x^2');
  await page.getByLabel('Lower bound').fill('0'); await page.getByLabel('Upper bound').fill('3');
  await page.getByRole('button',{name:'Evaluate definite integral'}).click();
  await page.getByLabel('Upper bound').fill('1');
  await page.getByRole('button',{name:'Evaluate definite integral'}).click();
  await page.locator('.calculator-history button').filter({hasText:'∫[0, 3]'}).click();
  assert.equal(await page.getByLabel('Upper bound').inputValue(),'3');
  await page.getByLabel('Significant figures').fill('2');
  assert.match(await page.locator('.calculus-summary').textContent(),/= 9.0$/);
  console.log('Calculator: history restores variables, Ans, calculus inputs, and formatting');

  await page.goto('http://127.0.0.1:5191/?mode=document&readonly=1');
  await page.waitForFunction(()=>window.documentBinding);
  await page.evaluate(()=>window.documentBinding.onChange('# **Same**\n\nFirst\n\n# **Same**\n\nFind this paragraph'));
  await clickEditorTool(page,'Outline');
  await page.getByRole('navigation',{name:'Document outline'}).getByRole('button').nth(1).click();
  assert.equal(await page.locator('h1[data-navigation-match]').getAttribute('data-source-start'),'19');
  await page.getByRole('button',{name:'Close panel'}).click();
  await clickEditorTool(page,'Find & replace');
  await page.getByLabel('Find',{exact:true}).fill('paragraph');
  await page.getByRole('button',{name:'Next',exact:true}).click();
  assert.equal(await page.locator('p[data-navigation-match]').textContent(),'Find this paragraph');
  assert.equal(await page.locator('.markdown-source').count(),0);
  console.log('Document: read-only outline and search navigate exact preview blocks');

  await page.goto('http://127.0.0.1:5191/?mode=document');
  await clickEditorTool(page,'Markdown');
  const source=page.getByRole('textbox',{name:'Markdown source'});
  const before=await source.inputValue();
  await source.dispatchEvent('compositionstart');
  await page.evaluate(()=>{
   window.documentEditor.insertText('UNEXPECTED');
   window.documentEditor.insertMarkdown('**','**','UNEXPECTED');
   window.documentEditor.appendBlock('UNEXPECTED');
   window.documentEditor.setMode('visual');
  });
  assert.equal(await source.inputValue(),before);
  assert.equal(await page.evaluate(()=>window.documentBinding.value),before);
  await source.dispatchEvent('compositionend');
  assert.deepEqual(errors,[]);
  console.log('Document: imperative source mutations preserve active composition; no page errors');
 } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
