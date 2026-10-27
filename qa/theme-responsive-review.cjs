const { chromium, firefox, webkit, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const engine = process.env.BOARD_BROWSER || 'chromium';
const sizes = [[320,568],[390,844],[844,390],[768,1024],[1024,768],[1440,900],[2560,1440]];
(async () => {
  const browser = await { chromium, firefox, webkit }[engine].launch({headless:true,...(engine==='chromium'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
  const results = [], errors = [];
  try {
    for (const theme of ['light','dark']) for (const [width,height] of sizes) {
      const context = await browser.newContext({viewport:{width,height},hasTouch:width<1100,colorScheme:theme==='dark'?'light':'dark'});
      const page = await context.newPage();
      page.on('pageerror',e=>errors.push(e.message));
      await page.goto(`http://127.0.0.1:5180/?local=1&workspace=1&theme=${theme}`);
      await page.waitForFunction(()=>window.board);
      const board = page.getByLabel('Noteboard canvas',{exact:true});
      const command = async query => {
        await board.focus(); await page.keyboard.press('Control+k');
        await page.getByLabel('Search commands').fill(query); await page.keyboard.press('Enter');
      };
      const workspaceTab=async name=>{const select=page.getByLabel('Workspace section');if(await select.isVisible())await select.selectOption(name);else await page.getByRole('tab',{name,exact:true}).click();};
      const close = async () => {await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();};
      const bounded = async (locator,name,allowScroll=false) => {
        await expect(locator).toBeVisible();
        await page.emulateMedia({reducedMotion:'reduce'});
        await expect.poll(()=>locator.evaluate((el,allowScroll)=>{const r=el.getBoundingClientRect(),b=el.closest('.noteboard-canvas').getBoundingClientRect();return r.left>=b.left-1&&r.right<=b.right+1&&r.top>=b.top-1&&r.bottom<=b.bottom+1&&(allowScroll||el.scrollWidth<=el.clientWidth+1);},allowScroll),{message:name+' within board'}).toBe(true);
      };
      const inspect = async name => {
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        const data = await dialog.evaluate(el=>{
          const box=el.getBoundingClientRect(), style=getComputedStyle(el);
          const overflow=[...el.querySelectorAll('button,input,textarea,select,summary,p,article,fieldset')].filter(n=>{
            if(!n.getClientRects().length)return false;
            const r=n.getBoundingClientRect();return r.left<box.left-1||r.right>box.right+1;
          }).map(n=>n.getAttribute('aria-label')||n.textContent.slice(0,65));
          const luminance=color=>{const rgb=color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
          const lowContrast=[...el.querySelectorAll('button,input:not([type=checkbox]),select,textarea')].filter(n=>!n.matches(':disabled')&&n.getClientRects().length).flatMap(n=>{const s=getComputedStyle(n);if(!s.backgroundColor.startsWith('rgb('))return [];const a=luminance(s.color),b=luminance(s.backgroundColor),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);return ratio<4.5?[{name:n.getAttribute('aria-label')||n.textContent.slice(0,30),ratio}]:[];});
          return {x:box.x,y:box.y,right:box.right,bottom:box.bottom,overflow,lowContrast,scroll:el.scrollWidth>el.clientWidth+1,scheme:style.colorScheme,bg:style.backgroundColor};
        });
        results.push({theme,width,height,name,...data});
        assert.ok(data.x>=0&&data.y>=0&&data.right<=width+1&&data.bottom<=height+1,`${name} bounds ${theme} ${width}x${height}`);
        assert.deepEqual(data.overflow,[],`${name} control overflow ${theme} ${width}x${height}`);
        if(data.scroll) console.log(await dialog.evaluate(el=>[...el.querySelectorAll('*')].filter(n=>n.getBoundingClientRect().right>el.getBoundingClientRect().right).map(n=>({tag:n.tagName,text:n.textContent.slice(0,80),width:n.getBoundingClientRect().width}))));
        assert.equal(data.scroll,false,`${name} horizontal scroll ${theme} ${width}x${height}`);
        assert.equal(data.scheme,theme,`${name} native controls follow ${theme}`);
        assert.deepEqual(data.lowContrast,[],`${name} enabled control text contrast ${theme}`);
      };
      await page.evaluate(()=>window.board.focusElements(['label']));
      await bounded(page.getByRole('region',{name:'Object properties'}),'Properties');
      await command('Tool: Rectangle');
      await bounded(page.getByRole('region',{name:'Object properties'}),'Tool defaults');
      await bounded(page.locator('[data-noteboard-toolbar]'),'Drawing toolbar',true);
      await bounded(page.locator('[data-noteboard-shapes]'),'Shape picker',true);
      await page.getByRole('region',{name:'Object properties'}).getByTitle('Collapse panel').click();
      await expect(page.getByTitle('Expand panel')).toBeVisible();
      if(width===390||width===844)await page.screenshot({path:`qa/artifacts/canvas-theme-${engine}-${theme}-${width}.png`});
      await command('Tool: Select');
      await page.evaluate(()=>window.board.focusElements(['label']));
      await command('Board workspace:');
      for(const tab of ['Views','Library','Diagram','Objects','Styles','Versions']) {
        await workspaceTab(tab);
        await page.getByRole('dialog').locator('details').evaluateAll(nodes=>nodes.forEach(n=>n.open=true));
        await inspect('Workspace '+tab);
        if(tab==='Library') {
          await page.getByLabel('Workspace item name').fill('Reusable selection');
          await page.getByRole('button',{name:'Save selection to library',exact:true}).click();
          await page.getByRole('button',{name:'Preview insertion',exact:true}).click();
          await inspect('Template and symbol preview');
        }
        if(tab==='Diagram') {
          await page.getByRole('button',{name:'Preview diagram import',exact:true}).click();
          await inspect('Diagram preview');
        }
      }
      await workspaceTab('Views');
      await page.getByLabel('Workspace item name').fill('LongViewName'.repeat(20));
      await page.getByRole('button',{name:'Save viewpoint',exact:true}).click();
      await expect(page.getByRole('dialog').getByRole('status')).toContainText('Saved');
      await inspect('Long saved view');
      await page.getByRole('button',{name:'Start presentation',exact:true}).click();
      // The presentation strip intentionally scrolls on narrow boards. The
      // toolbar responsiveness suite checks full End-control reachability.
      await bounded(page.getByRole('group',{name:'Presentation controls'}),'Long presentation name',true);
      await page.getByRole('button',{name:'End presentation',exact:true}).click();
      await page.evaluate(()=>{const a=window.boardApi;const image=a.createElement('image',{id:'crop-image',width:100,height:80,dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg=='});window.board.setElements([...window.board.getElements(),image]);window.board.focusElements(['crop-image']);});
      await command('Board workspace:');
      await workspaceTab('Objects');
      await page.getByRole('dialog').locator('details').evaluateAll(nodes=>nodes.forEach(n=>n.open=true));
      await inspect('Image crop mask and media');
      await close();
      await command('Collaboration:');
      await page.getByLabel('Comment message').fill('LongCommentWithoutSpaces'.repeat(30));
      await expect(page.getByLabel('Comment message')).toHaveValue('LongCommentWithoutSpaces'.repeat(30));
      if(await page.getByRole('button',{name:'Post comment',exact:true}).isDisabled())console.log('Disabled post',await page.getByRole('dialog').evaluate(el=>({text:el.textContent,inputs:[...el.querySelectorAll('input,textarea')].map(n=>[n.outerHTML,n.value])})));
      await page.getByRole('button',{name:'Post comment',exact:true}).click();
      await expect(page.getByRole('article')).toBeVisible();
      await page.getByLabel('Minutes',{exact:true}).fill('1');
      await page.getByRole('button',{name:'Set timer',exact:true}).click();
      await page.getByRole('button',{name:'Start timer',exact:true}).click();
      await inspect('Collaboration comments voting timer');
      await close();
      await bounded(page.getByRole('timer'),'Workshop timer');
      await page.getByRole('button',{name:'Settings',exact:true}).click();
      await page.locator('input[type=file][accept*="application/json"]').setInputFiles({name:'responsive.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({elements:[]}))});
      await inspect('Import preview'); await close();
      await board.focus(); await page.keyboard.press('Escape');
      await command('Layers and frames'); await inspect('Layers'); await close();
      await command('Export preview:');
      for(const format of ['png','jpeg','svg','pdf']) {
        await page.getByLabel('Export format').selectOption(format);
        if(format==='pdf')await page.getByLabel('PDF paper').selectOption('custom');
        await inspect('Export '+format);
      }
      if(width===390||width===844)await page.screenshot({path:`qa/artifacts/theme-${engine}-${theme}-${width}.png`});
      await close();
      await board.focus(); await page.keyboard.press('Control+k'); await inspect('Commands'); await close();
      await board.focus(); await page.keyboard.press('?'); await inspect('Shortcuts'); await close();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await context.close();
      console.log(`${engine} ${theme} ${width}x${height} passed`);
    }
    const system = await browser.newPage({viewport:{width:390,height:844},colorScheme:'light'});
    await system.goto('http://127.0.0.1:5180/?local=1&theme=system');
    const systemBoard=system.getByLabel('Noteboard canvas',{exact:true});
    await expect(systemBoard).toHaveAttribute('data-theme','light');
    await system.emulateMedia({colorScheme:'dark'});
    await expect(systemBoard).toHaveAttribute('data-theme','dark');
    assert.equal(await systemBoard.evaluate(el=>getComputedStyle(el).colorScheme),'dark');
    await system.close();
    assert.deepEqual(errors,[]);
  } finally {
    fs.mkdirSync('qa/artifacts',{recursive:true});
    fs.writeFileSync(`qa/artifacts/theme-responsive-${engine}.json`,JSON.stringify(results,null,2));
    await browser.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
