const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const { clickEditorTool } = require('./editor-tools.cjs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try {
 const page=await browser.newPage({viewport:{width:1100,height:850}}), errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5191/?mode=document&local=1');
 const visual=page.getByRole('textbox',{name:'Visual document editor'}), bar=page.getByRole('toolbar',{name:'Selection formatting'});
 async function source(text) { await clickEditorTool(page,'Markdown'); await page.getByRole('textbox',{name:'Markdown source'}).fill(text); await clickEditorTool(page,'Visual'); }
 async function select(start,end) { await visual.evaluate((el,[start,end])=>{ el.focus(); const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT); let node,offset=0,first,last; while(node=walker.nextNode()){const size=node.textContent.length;if(!first && start<offset+size)first=[node,start-offset];if(end<=offset+size){last=[node,end-offset];break;}offset+=size;}const range=document.createRange();range.setStart(...first);range.setEnd(...last);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange')); },[start,end]); await expect(bar).toBeVisible(); }
 await source('alpha beta gamma'); await select(0,5);
 await expect(bar.getByRole('button',{name:'Bold',exact:true})).toHaveAttribute('aria-pressed','false');
 await bar.getByRole('button',{name:'Bold',exact:true}).click();
 await expect(visual.locator('b,strong')).toHaveText('alpha');
 await expect(bar.getByRole('button',{name:'Bold',exact:true})).toHaveAttribute('aria-pressed','true');
 await select(0,10);await expect(bar.getByRole('button',{name:'Bold',exact:true})).toHaveAttribute('aria-pressed','mixed');
 await bar.getByRole('button',{name:'Bold',exact:true}).click();await expect(bar.getByRole('button',{name:'Bold',exact:true})).toHaveAttribute('aria-pressed','true');
 await bar.getByRole('button',{name:'Bold',exact:true}).click();await expect(visual.locator('b,strong')).toHaveCount(0);
 await select(11,16);await expect(bar.getByRole('button',{name:'Bold',exact:true})).toHaveAttribute('aria-pressed','false');
 await page.keyboard.press('Alt+F10');await expect(bar.getByRole('button',{name:'Bold',exact:true})).toBeFocused();await page.keyboard.press('ArrowRight');await expect(bar.getByRole('button',{name:'Italic',exact:true})).toBeFocused();await page.keyboard.press('Enter');await expect(visual.locator('i,em')).toHaveText('gamma');
 await select(0,5);await page.keyboard.press('Alt+F10');await expect(bar.getByRole('button',{name:'Bold',exact:true})).toBeFocused();await page.keyboard.press('Escape');await expect(bar).toHaveCount(0);await expect(visual).toBeFocused();
 await select(0,4);await visual.dispatchEvent('compositionstart');await expect(bar).toHaveCount(0);await visual.dispatchEvent('compositionend');
 await source('alpha beta gamma');await select(0,10);await bar.getByRole('button',{name:'Inline code'}).click();await expect(visual.locator('code')).toHaveText('alpha beta');
 await select(0,5);await bar.getByRole('button',{name:'Inline code'}).click();await expect(visual.locator('code')).toHaveText(' beta');
 await source('A **beautiful** document with useful tools.');await select(2,11);
 for(const width of [1100,390]) {await page.setViewportSize({width,height:850});await select(2,11);const b=await bar.boundingBox(),e=await page.locator('.sunaissu-document-editor').boundingBox();assert.ok(b.x>=e.x && b.x+b.width<=e.x+e.width);await page.screenshot({path:__dirname+'/artifacts/selection-'+width+'.png'});}
 await page.keyboard.press('ArrowRight');await expect(bar).toHaveCount(0);
 await page.goto('http://127.0.0.1:5191/?mode=document&local=1&theme=dark');await select(0,5);await page.screenshot({path:__dirname+'/artifacts/selection-dark.png'});
 assert.deepEqual(errors,[]); console.log('Selection formatting, mixed states, keyboard, partial code toggle, light/dark and mobile bounds passed.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
