/* Browser-level responsive and guest-social smoke tests.
   Requires: npm install --no-save playwright@1.61.0 && npx playwright install chromium
   Run while python3 server.py is running. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const URL='http://127.0.0.1:8765/';
(async()=>{
  const browser=await chromium.launch({headless:true});
  const errors=[];
  try{
    const desktop=await browser.newContext({viewport:{width:1440,height:900}});
    const page=await desktop.newPage();
    page.on('pageerror',e=>errors.push('desktop: '+e.message));
    await page.goto(URL,{waitUntil:'networkidle'});
    assert.match(await page.title(),/Memory Duet/);
    assert.ok(await page.locator('.topic-card').count()>=4);
    assert.equal(await page.locator('body').getAttribute('data-scene'),'mixed');
    await page.locator('#sceneSwitch [data-scene="learn"]').click();
    assert.equal(await page.locator('body').getAttribute('data-scene'),'learn');
    assert.equal(await page.locator('.sidebar [data-nav="community"]').count(),0);
    await page.locator('.sidebar [data-nav="catalog"]').click();
    await page.locator('#dimensionSelect').selectOption('subject');
    await page.locator('[data-action="filter-value"][data-value="英语"]').click();
    await page.locator('#dimensionSelect').selectOption('method');
    await page.locator('[data-action="filter-value"][data-value="组块"]').click();
    assert.ok(await page.locator('#catalogResults .lesson-card').count()>0,'AND facets returned no cards');
    assert.ok((await page.locator('.filter-card .chip.active').count())>=2,'Multiple active filters');
    await page.locator('#catalogResults .lesson-card .round-arrow').first().click();
    await page.locator('[data-action="start-quiz"]').click();
    await page.locator('#answerInput').fill('临时练习草稿');
    assert.equal(await page.locator('#app .prose-card').count(),0,'Quiz should hide explanatory answer material');
    await page.locator('#sceneSwitch [data-scene="social"]').click();
    await page.locator('#socialMount .social-tabs').waitFor({state:'visible'});
    assert.equal(await page.locator('body').getAttribute('data-scene'),'social');
    assert.equal(await page.locator('.sidebar [data-nav="catalog"]').count(),0);
    await page.locator('#sceneSwitch [data-scene="learn"]').click();
    await page.locator('#answerInput').waitFor();
    assert.equal(await page.locator('#answerInput').inputValue(),'临时练习草稿');
    await page.locator('.sidebar [data-nav="topics"]').click();
    await page.locator('.topic-card').first().click();
    assert.ok((await page.locator('text=01 · 先认识').count())>0,'Topic chapter missing');

    for(const width of [320,375,430,768,1024,1440,1920]){
      const ctx=await browser.newContext({viewport:{width,height:800}});
      const p=await ctx.newPage();
      p.on('pageerror',e=>errors.push(width+': '+e.message));
      await p.goto(URL,{waitUntil:'networkidle'});
      const info=await p.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:window.innerWidth}));
      assert.ok(info.scroll<=info.inner+4,'Horizontal overflow at '+width+': '+JSON.stringify(info));
      if(width<=800){
        assert.ok(await p.locator('.bottom-nav').isVisible(),'mobile nav missing at '+width);
        assert.ok(await p.locator('.bottom-nav [data-nav="community"]').count(),'social entry missing at '+width);
      }
      for(const scene of ['learn','social']){
        await p.locator('#sceneSwitch [data-scene="'+scene+'"]').click();
        if(scene==='social')await p.locator('#socialMount .social-tabs').waitFor({state:'visible'});
        const size=await p.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:window.innerWidth}));
        assert.ok(size.scroll<=size.inner+4,scene+' overflow at '+width+': '+JSON.stringify(size));
        if(width<=800){
          assert.equal(await p.locator('.bottom-nav [data-nav="catalog"]').count(),scene==='learn'?1:0);
          assert.equal(await p.locator('.bottom-nav [data-section="matches"]').count(),scene==='social'?1:0);
        }
      }
      await p.reload({waitUntil:'networkidle'});
      assert.equal(await p.locator('body').getAttribute('data-scene'),'social','Scene preference survives reload');
      await p.screenshot({path:'/tmp/memory-duet-'+width+'.png',fullPage:true});
      await ctx.close();
    }

    const ctxA=await browser.newContext({viewport:{width:390,height:844}});
    const a=await ctxA.newPage();a.on('pageerror',e=>errors.push('social A: '+e.message));
    await a.goto(URL,{waitUntil:'networkidle'});
    await a.locator('.bottom-nav [data-nav="community"][data-section="feed"]').click();
    await a.locator('#socialMount .social-tabs').waitFor({state:'visible'});
    await a.locator('#socialMount [data-social="entry"]').first().click();
    await a.locator('#guestName').fill('测试游客A-'+Date.now());
    await a.locator('#guestForm [type="submit"]').click();
    await a.locator('#socialMount .social-user strong').filter({hasText:"测试游客A-"}).waitFor();
    await a.locator('#duetSocial .social-hero [data-social="compose"][data-kind="hard"]').click();
    await a.locator('#socialCompose [name="title"]').fill('英语词义记不住·自动化');
    await a.locator('#socialCompose [name="content"]').fill('总是记不住 lend 和 borrow 的区别，谁能用一个方向画面帮我？');
    await a.locator('#socialCompose [type="submit"]').click();
    await a.locator('.social-detail-head').waitFor();
    assert.ok((await a.locator('.social-panel h2').first().textContent()).includes('英语词义记不住'));

    const ctxB=await browser.newContext({viewport:{width:1280,height:800}});
    const b=await ctxB.newPage();b.on('pageerror',e=>errors.push('social B: '+e.message));
    await b.goto(URL,{waitUntil:'networkidle'});
    await b.locator('.sidebar [data-nav="community"][data-section="feed"]').click();
    await b.locator('#socialMount .social-tabs').waitFor({state:'visible'});
    await b.locator('#socialMount [data-social="entry"]').first().click();
    await b.locator('#guestName').fill('测试游客B-'+Date.now());
    await b.locator('#guestForm [type="submit"]').click();
    await b.locator('#socialMount .social-user strong').filter({hasText:"测试游客B-"}).waitFor();
    await b.locator('.social-post-title').filter({hasText:'英语词义记不住·自动化'}).first().click();
    await b.locator('#socialReply [name="content"]').fill('借入 borrow 让伞朝自己来；借出 lend 让伞朝朋友去。');
    await b.locator('#socialReply [type="submit"]').click();
    await b.locator('.social-reply').first().waitFor();
    assert.ok((await b.locator('.social-reply').count())>=1);
    await a.locator('.social-detail-head [data-social="screen"][data-screen="feed"]').click();
    await a.locator('.social-post-title').filter({hasText:'英语词义记不住·自动化'}).first().click();
    await a.locator('.social-reply [data-social="best"]').first().click();
    await a.locator('.social-best').first().waitFor({state:'visible',timeout:10000});
    assert.ok((await a.locator('.social-best').count())>=1,'Owner best-pick is not visible');

    await b.locator('#sceneSwitch [data-scene="social"]').click();
    await b.locator('#socialMount .social-user strong').filter({hasText:"测试游客B-"}).waitFor();
    await b.locator('#duetSocial .social-hero [data-social="compose"][data-kind="secret"]').click();
    await b.locator('#socialCompose [name="title"]').fill('记忆秘诀·自动化');
    await b.locator('#socialCompose [name="content"]').fill('先理解，再独立回忆。');
    await b.locator('#socialCompose [type="submit"]').click();
    await b.locator('[data-social="secret-to-card"]').waitFor();
    await b.locator('[data-social="secret-to-card"]').click();
    await b.locator('#customTitle').waitFor();
    assert.equal(await b.locator('body').getAttribute('data-scene'),'learn');
    assert.equal(await b.locator('#customTitle').inputValue(),'记忆秘诀·自动化');
    assert.match(await b.locator('#customCue').inputValue(),/先理解/);
    assert.equal(await b.locator('#customAnswer').inputValue(),'');
    await b.locator('#sceneSwitch [data-scene="social"]').click();
    await b.locator('#socialMount .social-user strong').filter({hasText:"测试游客B-"}).waitFor();
    await ctxA.close();await ctxB.close();await desktop.close();
    assert.deepEqual(errors,[],'Browser JS errors');
    console.log('PASS: scene navigation, responsive modes, retained quiz draft, persisted preference, taxonomy, chapters, guest identity, two bottle types and secret-to-card');
  }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});