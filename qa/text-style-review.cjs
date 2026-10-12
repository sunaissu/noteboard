const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try {
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const width of [320,390,1440,2560]){
   await page.setViewportSize({width,height:1000});await page.goto('http://127.0.0.1:5174');
   const rich=page.locator('.sunaissu-rich-text-editor');
   const styles=page.getByRole('group',{name:'Text style',exact:true});
   const assertWidth=async()=>assert.ok(await rich.evaluate(e=>Math.abs(e.getBoundingClientRect().width-e.parentElement.clientWidth)<1),'writing fills its available pane at '+width);
   await assertWidth();await rich.locator('h1').click();
   await expect(styles.getByRole('button',{name:'Heading 1',exact:true})).toHaveAttribute('aria-pressed','true');
   for(let level=2;level<=6;level++){
    const button=styles.getByRole('button',{name:'Heading '+level,exact:true});
    await button.focus();await page.keyboard.press('Enter');
    await expect(rich.locator('h'+level).first()).toHaveText('Project notes');
    await expect(button).toHaveAttribute('aria-pressed','true');
    await expect(rich).toBeFocused();await assertWidth();
    await expect(page.getByRole('complementary',{name:'Text styles',exact:true})).toHaveCount(0);
   }
   await styles.getByRole('button',{name:'Body text',exact:true}).click();
   await expect(rich.locator('p').first()).toHaveText('Project notes');
   await page.getByRole('button',{name:'Preview',exact:true}).click();
   await expect(styles).toHaveCount(0);
   assert.ok(await page.locator('.sunaissu-markdown-body').evaluate(e=>Math.abs(e.getBoundingClientRect().width-e.parentElement.clientWidth)<1));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  assert.deepEqual(errors,[]);console.log('Inline heading/body icons, keyboard activation, selected state, editor focus and full-width panes passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
