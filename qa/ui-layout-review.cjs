const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try {
  const page = await browser.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  for(const width of [320,390,768,1440]) {
   await page.setViewportSize({width,height:1000});
   for(const [name,port] of [['document',5174],['calculator',5173],['noteboard',5175]]) {
    await page.goto('http://127.0.0.1:'+port);
    if(name==='calculator') {
     await page.getByRole('button',{name:'Engineering',exact:true}).click();
     await page.getByText('Variables & display',{exact:true}).click();
     const rows=await page.locator('.calculus-operation-switch button').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().top));
     assert.equal(new Set(rows).size,1,'numerical operations share one row');
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name+' overflows at '+width);
    if(name==='document') {
     const toolbar=page.locator('.sunaissu-document-toolbar');
     await expect(toolbar.locator('select')).toHaveCount(0);
     assert.equal(await toolbar.locator('.document-toolbar-utility').evaluate(e=>{
      const boxes=[...e.children].map(n=>n.getBoundingClientRect());
      return boxes.some((a,i)=>boxes.slice(i+1).some(b=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top));
     }),false,'utility controls overlap');
     await toolbar.getByRole('button',{name:'Image',exact:true}).click();
     const panel=page.getByRole('complementary',{name:'Insert image'});
     await expect(page.getByLabel('Image URL')).toBeFocused();
     assert.equal(await panel.evaluate(e=>{
      const p=e.getBoundingClientRect();
      return [...e.querySelectorAll('input:not([hidden]),.document-tool-content button')].every(n=>{const r=n.getBoundingClientRect();return r.left>=p.left+19&&r.right<=p.right-19;});
     }),true,'image controls retain panel padding');
     await page.keyboard.press('Escape');
     await expect(toolbar.getByRole('button',{name:'Image',exact:true})).toBeFocused();
     await toolbar.getByRole('button',{name:'Markdown',exact:true}).click();
     const source=page.getByLabel('Markdown source');
     for(let level=1;level<=6;level++) {
      await source.fill('Heading target');
      await toolbar.getByRole('button',{name:'Heading '+level,exact:true}).click();
      await expect(source).toHaveValue('#'.repeat(level)+' Heading target');
     }
     await toolbar.getByRole('button',{name:'Body text',exact:true}).click();
     await expect(source).toHaveValue('Heading target');
     await toolbar.getByRole('button',{name:'Preview',exact:true}).click();
     await expect(toolbar.getByRole('button',{name:'Bold',exact:true})).toHaveCount(0);
     await expect(toolbar.getByRole('button',{name:'Outline',exact:true})).toBeVisible();
     await toolbar.getByRole('button',{name:'Visual',exact:true}).click();
     await expect(toolbar.getByRole('button',{name:'Bold',exact:true})).toBeVisible();
     await page.locator('.inspector').getByRole('button',{name:'Reset sample',exact:true}).click();
     await toolbar.locator('.document-toolbar-scroll').evaluate(e=>e.scrollLeft=0);
     for(const theme of ['light','dark']) {
      await page.locator('.inspector').getByRole('button',{name:theme,exact:true}).click();
      await page.evaluate(()=>{scrollTo(0,0);const pane=document.querySelector('.sunaissu-document-write-pane');if(pane)pane.scrollTop=0;});
      await page.screenshot({path:'qa/artifacts/ui-document-'+theme+'-'+width+'.png',animations:'disabled'});
     }
    } else await page.screenshot({path:'qa/artifacts/ui-'+name+'-'+width+'.png',animations:'disabled',fullPage:width<900});
   }
  }
  assert.deepEqual(errors,[]);
  console.log('320/390/768/1440px layouts, control bounds, panel padding, six inline heading actions, preview tools and dark/light screenshots passed');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
