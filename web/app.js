(function () {
  'use strict';
  var C=window.MemoryDuetCatalog;
  if (!C) { document.getElementById('app').textContent='学习内容加载失败，请刷新页面。';return; }
  var APP=document.getElementById('app'), RAIL=document.getElementById('rail'), SEARCH=document.getElementById('globalSearch');
  var Scenes=window.MemoryDuetScene;
  function readScene(){try{return Scenes.normalize(localStorage.getItem(Scenes.KEY));}catch(e){return 'mixed';}}
  var sceneMode=readScene(),lastLearningView='home',lastSocialSection='feed',cardDraft=null;
  function saveScene(mode){sceneMode=Scenes.normalize(mode);try{localStorage.setItem(Scenes.KEY,sceneMode);}catch(e){}}
  var STORAGE='memoryDuetV2', state=load(), ui={
    view:'home',dimension:'subject',value:'全部',facets:{},search:'',onlySaved:false,sort:'curated',
    topicId:null,lessonId:null,phase:'study',hintUsed:false,result:null,quizDraft:'',bottleId:null,composeBottle:false
  };
  var seedMap=['en-lend','en-lend','en-lend','mem-zero','cn-moon1'];
  migrateLegacy();
  var startHash=decodeURIComponent(location.hash.slice(1));
  if (['home','catalog','topics','review','create','community','profile'].includes(startHash)) ui.view=startHash;
  else ui.view=Scenes.landing(sceneMode);
  if(sceneMode==='social'&&ui.view==='home')ui.view='community';
  saveScene(Scenes.modeForView(sceneMode,ui.view));
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function attr(s){return esc(s);}
  function initial(){return {saved:{},attempts:{},custom:[],customDimensions:[],bottles:[],notes:{},likes:{}};}
  function load(){try{var s=JSON.parse(localStorage.getItem(STORAGE));if(s && typeof s==='object')return Object.assign(initial(),s);}catch(e){}return initial();}
  function persist(){try{localStorage.setItem(STORAGE,JSON.stringify(state));return true;}catch(e){toast('本机存储空间不足；新内容可能无法在刷新后保留。');return false;}}
  function migrateLegacy(){
    if(state.legacyMigrated)return;
    try{
      var old=JSON.parse(localStorage.getItem('duetV1')||'null');
      if(old){
        Object.keys(old.saved||{}).forEach(function(k){if(old.saved[k]){var id=Number(k)<5?seedMap[Number(k)]:'legacy-'+(Number(k)-5);state.saved[id]=true;}});
        (old.cards||[]).forEach(function(c,k){
          if(!Array.isArray(c)||c.length<7)return;
          state.custom.push(makeCustom({id:'legacy-'+k,subject:String(c[0]||'其他学习').split(' · ')[0],title:c[1],method:c[2],cue:c[4],question:c[5],answer:c[6],photo:c[7]||''}));
        });
        (old.bottles||[]).forEach(function(b){if(b && typeof b.task==='string' && /^data:image\/(png|jpeg|webp);base64,/i.test(b.photo||''))state.bottles.push(b);});
        Object.keys(old.runs||{}).forEach(function(k){var id=seedMap[Number(k)];if(id && !state.attempts[id])state.attempts[id]=[];/* Old attempts had no timestamp or hint status: not upgraded to proven independent practice. */});
      }
    }catch(e){}
    state.legacyMigrated=true;persist();
  }
  function toast(msg){var n=document.getElementById('toast');n.textContent=msg;n.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(function(){n.hidden=true;},3600);}
  function allDimensions(){return C.DIMENSIONS.concat(state.customDimensions||[]);}
  var originalFacetValue=C.facetValue,originalFacetOptions=C.facetOptions;
  C.facetOptions=function(lessons,key,context){if(!key.startsWith('custom:'))return originalFacetOptions(lessons,key,context);
    return [...new Set(lessons.map(x=>(x.customFacets||{})[key]||'未分类'))].sort((a,b)=>a.localeCompare(b,'zh-CN'));};
  C.facetValue=function(x,key,context){return key.startsWith('custom:')?((x.customFacets||{})[key]||'未分类'):originalFacetValue(x,key,context);};
  function allLessons(){return C.LESSONS.concat(state.custom||[]);}
  function one(id){return allLessons().find(function(x){return x.id===id;});}
  function makeCustom(x){
    var fields=['id','title','subject','method','cue','question','answer','photo'];
    fields.forEach(function(k){if(x[k]==null)x[k]='';});
    return Object.assign({
      topicId:'user-works',topic:'我的原创学习卡',icon:'✎',tone:'peach',tags:['我的作品'],
      goal:'独立回忆',skill:'知识回忆',difficulty:'自定义',minutes:3,
      duration:'3 分钟内',format:'互动学习卡',material:'原创文本',language:'中文',
      exam:'自主学习',scenario:'自主学习',theme:'个人知识',knowledge:'自定义知识',
      cognitive:'准确回忆',recall:'文字填空',order:'按题目要求',
      visual:'自主描述',sensory:'视觉 / 文字',group:'独立学习',frequency:'自主安排',
      source:'用户原创',creator:'我的作品',path:'我的学习',auxMethod:'不需要',grade:'通用'
    },x);
  }
  function status(id){return C.progressState(id,state.attempts);}
  function statistics(){
    var histories=Object.values(state.attempts).filter(Array.isArray);
    var attempts=histories.reduce(function(n,a){return n+a.length;},0);
    var independent=histories.reduce(function(n,a){return n+a.filter(function(x){return x.outcome==='independent-correct';}).length;},0);
    var due=allLessons().filter(function(x){return ['待复习','需巩固'].includes(status(x.id));}).length;
    return {attempts:attempts,independent:independent,due:due};
  }
  function setView(view,options){
    options=options||{};
    if(ui.view==='community'&&view!=='community'&&window.MemoryDuetSocial)window.MemoryDuetSocial.captureDraft();
    if(view==='home'&&sceneMode==='social')view='community';
    saveScene(Scenes.modeForView(sceneMode,view));
    if(ui.view!=='community'&&ui.view!=='home')lastLearningView=ui.view;
    ui.view=view;
    if(view==='community'&&window.MemoryDuetSocial&&options.section){
      lastSocialSection=options.section;
      window.MemoryDuetSocial.prepare(options.section,options.draft||null);
    }
    if(options.topicId)ui.topicId=options.topicId;
    if(options.lessonId){ui.lessonId=options.lessonId;ui.phase='study';ui.result=null;ui.hintUsed=false;ui.quizDraft='';}
    if(options.dimension){ui.dimension=options.dimension;ui.value=options.value||'全部';if(options.value&&options.value!=='全部')ui.facets[options.dimension]=[options.value];}
    if(options.value && !options.dimension)ui.value=options.value;
    if(view!=='catalog' && SEARCH.value){/* Keep user search available until explicitly cleared. */}
    history.replaceState(null,'','#'+view);
    render();
    window.scrollTo({top:0,behavior:'instant'});
  }
  function chooseScene(mode){
    mode=Scenes.normalize(mode);
    if(mode===sceneMode)return;
    if(ui.view!=='community')lastLearningView=ui.view;
    saveScene(mode);
    if(mode==='social')setView('community',{section:lastSocialSection||'feed'});
    else if(mode==='learn')setView(lastLearningView||'home');
    else setView('home');
  }
  function sceneNav(){
    var activeSection=window.MemoryDuetSocial&&window.MemoryDuetSocial.section?window.MemoryDuetSocial.section():lastSocialSection;
    function navItem(x,mobile){
      var active=x.view===ui.view&&(x.view!=='community'||x.section===activeSection)||
        (x.view==='catalog'&&ui.view==='lesson')||(x.view==='topics'&&ui.view==='topic');
      if(mobile&&x.view==='community'&&x.section==='feed'&&sceneMode==='mixed'&&ui.view==='community')active=true;
      return '<button type="button" class="'+(mobile?'':'side-link ')+(active?'active':'')+'" data-nav="'+attr(x.view)+'"'+
        (x.section?' data-section="'+attr(x.section)+'"':'')+' aria-current="'+(active?'page':'false')+'"><span class="'+(mobile?'':'nav-icon')+'">'+esc(x.icon)+'</span>'+
        (mobile?'<small>'+esc(x.label.replace('分类学习','分类').replace('专题图书馆','专题').replace('回忆练习','复习').replace('我的学习','我的').replace('漂流瓶广场','广场').replace('共学练习室','共学').replace('我的游客名片','我的'))+'</small>':esc(x.label))+'</button>';
    }
    document.body.dataset.scene=sceneMode;
    document.body.dataset.view=ui.view;
    document.body.dataset.phase=ui.view==='lesson'?ui.phase:'';
    document.getElementById('sceneNav').innerHTML=Scenes.groupsFor(sceneMode).map(g=>'<div class="sidebar-section"><span class="sidebar-caption">'+esc(g.title)+'</span><nav class="side-links">'+g.items.map(x=>navItem(x,false)).join('')+'</nav></div>').join('');
    document.getElementById('mobileSceneNav').innerHTML=Scenes.mobileFor(sceneMode).map(x=>navItem(x,true)).join('');
    document.getElementById('sceneSwitch').innerHTML=Scenes.modes.map(m=>'<button type="button" data-scene="'+m.id+'" aria-pressed="'+(m.id===sceneMode)+'" title="'+esc(m.description)+'" class="scene-option '+(m.id===sceneMode?'active':'')+'"><span aria-hidden="true">'+m.icon+'</span><b>'+esc(m.label)+'</b></button>').join('');
    document.getElementById('sceneCaption').textContent=Scenes.modes.find(m=>m.id===sceneMode).description;
    document.getElementById('sceneTitle').textContent=sceneMode==='social'?'你的记忆海岸':sceneMode==='learn'?'你的专注学习空间':'你的灵感学习空间';
    document.getElementById('topSceneAction').innerHTML=sceneMode==='social'?'<button type="button" data-action="compose-scene" data-kind="hard" class="top-create"><span>＋</span> 发布瓶子</button>':'<button type="button" data-nav="create" class="top-create"><span>✦</span> 创建作品</button>';
    document.getElementById('sideSceneCopy').textContent=sceneMode==='social'?'一份难题，一份秘诀。把好记的方法传给搭子。':'记住知识的方式，可以和别人不一样。';
    SEARCH.parentElement.hidden=sceneMode==='social';
  }
  function sceneSocial(section,draft){
    if(ui.view!=='community')lastLearningView=ui.view;
    if(sceneMode==='learn')saveScene('social');
    setView('community',{section:section,draft:draft});
  }
  function button(label,action,more,cls){return '<button type="button" class="'+(cls||'btn-secondary')+'" data-action="'+esc(action)+'" '+(more||'')+'>'+label+'</button>';}
  function lessonCard(x){
    return '<article class="lesson-card"><div class="lesson-card-top"><span class="lesson-glyph tone-'+esc(x.tone||'violet')+'">'+esc(x.icon)+'</span><span class="small-pill">'+esc(x.subject)+'</span></div>'+
      '<h3>'+esc(x.title)+'</h3><p>'+esc(x.cue)+'</p><div class="lesson-bottom"><span class="pill-info">'+esc(x.method)+'</span><span class="pill-info">· '+esc(x.minutes||3)+' 分钟</span>'+
      '<button class="round-arrow" aria-label="学习 '+attr(x.title)+'" data-action="open-lesson" data-id="'+attr(x.id)+'">↗</button></div></article>';
  }
  function topicCard(t){
    return '<button class="topic-card" type="button" data-action="open-topic" data-id="'+attr(t.id)+'">'+
      '<div class="topic-art tone-'+esc(t.tone)+'"><span>'+esc(t.icon)+'</span></div>'+
      '<div class="topic-body"><strong>'+esc(t.title)+'</strong><p>'+esc(t.subtitle)+'</p>'+
      '<div class="topic-card-footer"><span>'+esc(t.subject)+'</span><span>'+C.topicLessonCount(t.id)+' 张记忆卡 ↗</span></div></div></button>';
  }
  function section(title,sub,action){
    return '<div class="section-top"><div><span class="eyebrow">'+esc(sub)+'</span><h2>'+esc(title)+'</h2></div>'+
      (action?'<button class="text-link" data-nav="'+esc(action)+'">查看全部 ↗</button>':'')+'</div>';
  }
  function home(){
    var stat=statistics(), topics=C.TOPICS.slice(0,6), lessons=C.LESSONS.slice(0,4);
    return (sceneMode==='mixed'?'<section class="scene-home-grid"><button class="scene-choice learn-choice" data-scene="learn"><span>▤</span><b>今天想专注学习</b><small>分类、专题、回忆、复习</small><strong>进入学习工作台 ↗</strong></button><button class="scene-choice social-choice" data-scene="social"><span>♧</span><b>今天想认识记忆搭子</b><small>难题求助、秘诀交换、结伴共学</small><strong>进入记忆海岸 ↗</strong></button></section>':'')+
      '<section class="hero"><div class="hero-copy"><span class="eyebrow">'+(sceneMode==='learn'?'FOCUS / YOUR LEARNING STUDIO':'WELCOME TO MEMORY DUET / 2026')+'</span>'+
      '<h1>每个知识点，<br>都有<em>好记的办法。</em></h1><p>把知识变成画面、故事和自己的理解。先学会，再遮住线索，看看你是否真正记住。</p>'+
      '<div class="hero-actions">'+button('开始探索 ↗','goto-catalog','','btn-primary')+
      button('看看专题','goto-topics','','btn-secondary')+'</div></div>'+
      '<div class="hero-graphic" aria-hidden="true"><div class="floating-card one"><b>m</b><small>MEMORIES</small></div><div class="floating-card two">✺</div><div class="floating-card three">✦</div></div></section>'+
      '<div class="stats-strip"><div class="stat"><strong>'+C.TOPICS.length+'</strong><small>精选学习专题</small></div>'+
      '<div class="stat"><strong>'+C.DIMENSIONS.length+'</strong><small>可切换分类维度</small></div>'+
      '<div class="stat"><strong>'+C.LESSONS.length+'</strong><small>原创示例学习卡</small></div></div>'+
      section('按兴趣开启一段学习','CURATED COLLECTIONS','topics')+
      '<div class="topic-grid">'+topics.map(topicCard).join('')+'</div>'+
      section('你可以从这里开始','START SMALL, REMEMBER MORE','catalog')+
      '<div class="lesson-grid">'+lessons.map(lessonCard).join('')+'</div>'+
      '<div class="prose-card" style="margin-top:26px"><div class="page-header-row"><b>学习建议</b>'+button('去复习练习 ↗','goto-review','','btn-secondary')+'</div><p>先理解知识，再选择一个主记忆方法。独立答题前不要看答案；提示后答对和独立答对会分开记录。</p>'+
      '<p class="quiet">当前已记录 '+stat.attempts+' 次本机答题。数据仅保存在本浏览器，暂未接入账号同步。</p></div>';
  }
  function head(label,title,description){
    return '<section class="page-head"><span class="eyebrow">'+esc(label)+'</span><h1>'+esc(title)+'</h1><p>'+esc(description)+'</p></section>';
  }
  function catalog(){
    var dims=allDimensions(),dim=dims.find(x=>x.key===ui.dimension)||dims[0];
    var context={saved:state.saved,attempts:state.attempts},values=C.facetOptions(allLessons(),dim.key,context);
    var counts=C.facetCountMap(allLessons(),dim.key,{facets:ui.facets,search:ui.search,onlySaved:ui.onlySaved},context);
    var active=ui.facets[dim.key]||[];
    var chosen=Object.entries(ui.facets).flatMap(pair=>(pair[1]||[]).map(v=>({key:pair[0],name:(dims.find(x=>x.key===pair[0])||{}).label||pair[0],value:v})));
    return head('CHOOSE YOUR OWN WAY','自由组合 '+dims.length+' 种分类维度',
      '自由切换分类视角，也能组合多条件：不同维度同时满足，同一维度可多选；原创卡还可以自建分类。')+
      '<section class="filter-card"><div class="filter-top"><label class="filter-field"><span class="field-label">分类维度 · '+dims.length+' 种</span><select class="form-control" id="dimensionSelect" aria-label="切换分类维度">'+
      dims.map(x=>'<option value="'+attr(x.key)+'" '+(x.key===dim.key?'selected':'')+'>'+esc(x.label)+'</option>').join('')+'</select></label>'+
      '<label class="filter-field"><span class="field-label">当前分类值 · 可多选</span><select class="form-control" id="valueSelect" aria-label="添加分类取值"><option value="全部">全部</option>'+
      values.map(x=>'<option value="'+attr(x)+'" '+(ui.value===x?'selected':'')+'>'+esc(x)+'</option>').join('')+'</select></label>'+
      '<label class="filter-field"><span class="field-label">排序</span><select class="form-control" id="sortSelect"><option value="curated">精选顺序</option>'+
      '<option value="title" '+(ui.sort==='title'?'selected':'')+'>标题排序</option>'+
      '<option value="short" '+(ui.sort==='short'?'selected':'')+'>学习时长</option></select></label></div>'+
      '<div class="filter-chips" role="group" aria-label="'+esc(dim.label)+'分类值">'+['全部'].concat(values).map(v=>
      '<button class="chip '+((v==='全部'?!active.length:active.includes(v))?'active':'')+'" type="button" data-action="filter-value" data-value="'+attr(v)+'">'+
      esc(v)+(v==='全部'?'':' <span style="opacity:.7">('+Number(counts[v]||0)+')</span>')+'</button>').join('')+'</div>'+
      '<div class="filter-bottom"><p>组合逻辑：不同维度 AND，同一维度多个值 OR。</p>'+
      '<button class="filter-switch '+(ui.onlySaved?'active':'')+'" type="button" data-action="only-saved">'+
      (ui.onlySaved?'♥ 已筛选收藏':'♡ 只看收藏')+'</button></div></section>'+
      '<section class="filter-card"><div class="filter-bottom" style="margin-top:0"><strong style="font-size:13px">组合筛选条件 · '+chosen.length+' 个</strong>'+
      button('全部清除','clear-facets','','btn-secondary')+'</div><div class="filter-chips">'+
      (chosen.length?chosen.map(c=>'<button type="button" class="chip active" data-action="remove-facet" data-dim="'+attr(c.key)+'" data-value="'+attr(c.value)+'">'+
      esc(c.name)+'：'+esc(c.value)+' ×</button>').join(''):'<span class="quiet">可以换一个维度继续添加条件。</span>')+'</div></section>'+
      '<details class="filter-card"><summary style="font-weight:800;cursor:pointer">＋ 自定义分类维度 / 给原创卡设置取值</summary>'+
      '<p class="form-note">自建维度只存在本地。可为自己的原创学习卡指定任意分类名称和取值。</p>'+
      '<form id="customDimensionForm" class="filter-top" style="margin-top:12px"><label class="filter-field"><span class="field-label">分类名称</span>'+
      '<input id="newDimensionName" class="form-control" required maxlength="28" placeholder="例如：我的考试计划"></label>'+
      '<button class="btn-primary" type="submit">新增维度</button></form>'+
      (state.customDimensions.length&&state.custom.length?
      '<form id="customFacetForm" class="filter-top" style="margin-top:15px"><label class="filter-field"><span class="field-label">我的原创学习卡</span>'+
      '<select id="customFacetCard" class="form-control">'+state.custom.map(x=>'<option value="'+attr(x.id)+'">'+esc(x.title)+'</option>').join('')+'</select></label>'+
      '<label class="filter-field"><span class="field-label">分类维度</span><select id="customFacetDimension" class="form-control">'+
      state.customDimensions.map(d=>'<option value="'+attr(d.key)+'">'+esc(d.label)+'</option>').join('')+'</select></label>'+
      '<label class="filter-field"><span class="field-label">分类值</span><input class="form-control" id="customFacetValue" required maxlength="40" placeholder="例如：第一周重点"></label>'+
      '<button class="btn-primary" type="submit">应用到卡片</button></form>':
      '<p class="form-note">先新增维度，并通过「创作记忆卡」创建自己的作品，就能设置取值。</p>')+
      '</details><div id="catalogResults">'+catalogResults()+'</div>';
  }
  function catalogResults(){
    var filtered=C.filterLessonsMulti(allLessons(),{facets:ui.facets,search:ui.search,onlySaved:ui.onlySaved,sort:ui.sort},
      {saved:state.saved,attempts:state.attempts});
    return '<div class="section-top" style="margin-top:0"><div><span class="eyebrow">EXPLORE KNOWLEDGE</span><h2>找到适合自己的记法</h2></div><span class="quiet">共 '+filtered.length+' 张学习卡</span></div>'+
      (filtered.length?'<div class="lesson-grid">'+filtered.map(lessonCard).join('')+'</div>':
        '<div class="empty-state"><span class="empty-icon">⌕</span><h3>暂时没有符合条件的学习卡</h3><p>换个分类值、关键词，或者发布自己的第一张作品。</p>'+button('清除筛选','clear-filter','','btn-primary')+'</div>');
  }
  function topics(){
    var groups={};
    C.TOPICS.forEach(function(t){(groups[t.subject]||=[]).push(t);});
    return head('THE TOPIC LIBRARY','专题图书馆','精选 '+C.TOPICS.length+' 个可直接试学的专题，从英语、语文、数学到科学、编程、工作与生活。每个专题都提供理解线索和独立回忆题。')+
      Object.keys(groups).map(function(subject){return section(subject,subject.toUpperCase())+
        '<div class="topic-grid">'+groups[subject].map(topicCard).join('')+'</div>';}).join('');
  }
  function topic(){
    var t=C.topicsById[ui.topicId];if(!t)return topics();
    var lessons=allLessons().filter(function(x){return x.topicId===t.id;});
    return '<button class="text-link" data-nav="topics">← 返回全部专题</button>'+
      '<section class="detail-hero tone-'+esc(t.tone)+'"><div><span class="detail-eyebrow">'+esc(t.subject)+' / LEARNING COLLECTION</span>'+
      '<h1>'+esc(t.title)+'</h1><p>'+esc(t.subtitle)+'。每张卡先看解释，再遮住线索回忆。</p>'+
      '<div class="detail-actions">'+button('开始专题学习 ↗','open-lesson','data-id="'+attr(lessons[0].id)+'"','btn-primary')+
      button('切换分类视角','topic-to-filter','data-value="'+attr(t.title)+'"')+'</div></div><div class="detail-illustration">'+esc(t.icon)+'</div></section>'+
      C.getTopicChapters(t.id).map(ch=>section(ch.title,'TOPIC CHAPTER')+'<p class="muted" style="font-size:12px;margin:-7px 0 16px">'+esc(ch.intro)+'</p>'+
      '<div class="lesson-grid">'+ch.lessonIds.map(id=>lessons.find(x=>x.id===id)).filter(Boolean).map(lessonCard).join('')+'</div>').join('');
  }
  function lesson(){
    var x=one(ui.lessonId);if(!x)return catalog();
    var saved=!!state.saved[x.id], history=state.attempts[x.id]||[];
    var inner;
    if(ui.phase==='quiz'){
      inner='<span class="step-mark">STEP 02 / WITHOUT THE CUE</span><h2>遮住线索，独立回忆</h2>'+
        '<div class="quiz-question">'+esc(x.question)+'</div>'+
        '<form id="quizForm"><label class="quiz-field"><span class="field-label">写出你的答案（不需要完全依赖提示）</span>'+
        '<input class="form-control" id="answerInput" name="answer" required autocomplete="off" maxlength="400" value="'+attr(ui.quizDraft||'')+'" placeholder="在这里输入…" aria-label="你的回忆答案"></label>'+
        (ui.hintUsed?'<div class="hint-box"><strong>已查看提示 · 本次不会计为独立正确</strong><p>'+esc(x.cue)+'</p></div>':'')+
        '<footer>'+button(ui.hintUsed?'已看提示':'查看提示','reveal-hint',ui.hintUsed?'disabled':'')+
        '<button class="btn-primary" type="submit">核对我的回答 ↗</button></footer></form>';
    }else if(ui.phase==='result'){
      var r=ui.result||{outcome:'revealed',answer:''};
      var messages={'independent-correct':['独立答对了！','本次记录为独立正确。下一轮复习需要在之后单独完成。'],
        'prompted-correct':['提示后答对','这次提示对你有帮助，但不计作独立正确。'],
        'incorrect':['这次还没完全记住','可以重看线索，下次尝试无提示回答。'],
        'revealed':['参考答案','查看答案不算完成独立练习。']};
      var message=messages[r.outcome]||messages.revealed;
      inner='<span class="step-mark">STEP 03 / FEEDBACK</span><h2>'+message[0]+'</h2>'+
        '<p class="muted">'+message[1]+'</p><div class="answer-box"><small>参考答案</small><div class="answer-text">'+esc(x.answer)+'</div>'+
        '<p>'+esc(x.explanation)+'</p></div>'+
        (r.outcome!=='revealed'?'<p class="form-note">你的回答：'+esc(r.answer)+'</p>':'')+
        '<footer>'+button('再试一次','retry-quiz')+button('继续学习 ↗','next-lesson','','btn-primary')+'</footer>';
    }else{
      inner='<span class="step-mark">STEP 01 / UNDERSTAND FIRST</span><h2>先理解，再记忆</h2>'+
        '<div class="cue-stage tone-'+esc(x.tone||'violet')+'"><div class="cue-icon">'+esc(x.icon)+'</div><p>'+esc(x.cue)+'</p></div>'+
        '<p class="form-note">建议主方法：<b>'+esc(x.method)+'</b>。本卡不预设额外记忆法；内容正确性始终比画面花哨更重要。</p>'+
        (x.photo && safePhoto(x.photo)?'<img alt="学习卡配图" src="'+attr(x.photo)+'" style="width:100%;max-height:280px;object-fit:contain;margin-top:16px;border-radius:15px">':'')+
        '<footer>'+button('生成专用配图提示词','make-prompt')+
        button('遮住线索，开始试记 ↗','start-quiz','','btn-primary')+'</footer>'+
        '<div id="promptArea"></div>';
    }
    return '<button class="text-link" data-action="back-to-topic">← 返回专题 / 分类学习</button>'+
      '<div class="page-header-row page-head"><div><span class="eyebrow">'+esc(x.subject)+' / '+esc(x.topic)+'</span><h1>'+esc(x.title)+'</h1>'+
      '<div class="lesson-meta"><span class="detail-pill">'+esc(x.method)+'</span><span class="detail-pill">约 '+esc(x.minutes)+' 分钟</span>'+
      '<span class="detail-pill">'+esc(status(x.id))+'</span></div></div>'+
      '<button type="button" class="btn-secondary" data-action="toggle-saved" data-id="'+attr(x.id)+'">'+(saved?'♥ 已收藏':'♡ 收藏')+'</button></div>'+
      '<section class="lesson-stage">'+inner+'</section>'+(ui.phase==='quiz'?'': '<div class="scene-context"><div><b>这个知识点还是太难记？</b><p>先准备求助草稿，由你决定是否公开。</p></div>'+button('发太难记漂流瓶','ask-bottle','data-id="'+attr(x.id)+'"','btn-secondary')+'</div>')+(ui.phase==='quiz'?'':
      '<section class="prose-card" style="margin-top:17px"><b>学习作品说明</b><p>目标：'+esc(x.goal)+' · 独立回忆方式：'+esc(x.recall)+'。</p>'+
      '<p>'+esc(x.explanation)+'</p><p class="quiet">这张卡已经有 '+history.length+' 次本机答题记录。只有真实完成无提示答题才会记作“独立正确”。</p></section>'+
      '<section class="form-panel" style="margin-top:15px"><h3>写下你的记法</h3><p class="form-note">笔记仅保存在你自己的浏览器，不会公开发布。</p>'+
      '<form id="noteForm"><div class="form-row"><label for="noteText">我的联想或改进建议</label><textarea class="form-control" id="noteText" maxlength="300" required placeholder="我还有一种更好记的方式…"></textarea></div>'+
      '<button class="btn-secondary" type="submit">保存笔记</button></form>'+
      (state.notes[x.id]||[]).map(function(n){return '<p style="margin-top:10px;padding:11px;background:#faf9fd;border-radius:11px">'+esc(n)+'</p>';}).join('')+'</section>');
  }
  function review(){
    var practiced=allLessons().filter(function(x){return (state.attempts[x.id]||[]).length;});
    var due=practiced.filter(function(x){return ['待复习','需巩固'].includes(status(x.id));});
    var next=due.length?due:practiced.slice(0,6);
    return head('ACTIVE RECALL','让记忆经得起时间','先回忆，再核对。系统按本机真实练习记录建议复习；同一轮提示后的答对不会算作独立成功。')+
      '<div class="stats-strip"><div class="stat"><strong>'+practiced.length+'</strong><small>已尝试知识点</small></div>'+
      '<div class="stat"><strong>'+due.length+'</strong><small>当前可复习</small></div>'+
      '<div class="stat"><strong>'+statistics().independent+'</strong><small>独立正确轮次</small></div></div>'+
      section(due.length?'今天可以再试的知识':'你的回忆练习','RETRIEVAL PRACTICE')+
      (next.length?'<div class="lesson-grid">'+next.map(lessonCard).join('')+'</div>':
        '<div class="empty-state"><span class="empty-icon">◎</span><h3>还没有复习记录</h3><p>先完成一次独立回忆，之后这里会根据答题情况安排复习。</p>'+button('挑选第一张学习卡','goto-catalog','','btn-primary')+'</div>')+
      '<div class="prose-card" style="margin-top:20px"><b>复习节奏</b><p>独立正确后建议在约 1、3、7、14 天等间隔再次练习；这是建议而非已完成的自动提醒，暂不跨设备同步。</p></div>';
  }
  function create(){
    var subjects=Array.from(new Set(C.TOPICS.map(function(t){return t.subject;}))).concat(['其他学习']);
    var methods=Array.from(new Set(C.LESSONS.map(function(x){return x.method;}))).concat(['口诀','地点','手指','其他']);
    return head('CREATE SOMETHING MEMORABLE','创作一张独特的记忆卡','从真实知识出发，把理解线索、回忆问题和答案分开。画面、故事、组块都可以，但不要让提示直接泄露答案。')+
      '<section class="form-panel"><form id="createForm"><div class="form-grid"><div class="form-row"><label for="customSubject">学科分类</label><select class="form-control" id="customSubject">'+
      subjects.map(function(x){return '<option>'+esc(x)+'</option>';}).join('')+'</select></div>'+
      '<div class="form-row"><label for="customMethod">主记忆方法</label><select class="form-control" id="customMethod">'+methods.map(function(x){return '<option>'+esc(x)+'</option>';}).join('')+'</select></div>'+
      '<div class="form-row wide"><label for="customTitle">记忆任务标题</label><input class="form-control" id="customTitle" required maxlength="65" placeholder="例如：二分查找的前提"></div>'+
      '<div class="form-row wide"><label for="customCue">帮助理解的记忆线索</label><textarea class="form-control" id="customCue" required maxlength="1200" placeholder="用具体的画面、操作或事实帮助理解…"></textarea></div>'+
      '<div class="form-row wide"><label for="customQuestion">遮住线索后，问什么？</label><input class="form-control" id="customQuestion" required maxlength="250" placeholder="一道能无提示独立回答的问题"></div>'+
      '<div class="form-row wide"><label for="customAnswer">参考正确答案</label><input class="form-control" id="customAnswer" required maxlength="300" placeholder="填写可逐字核对的答案"></div>'+
      '<div class="form-row wide"><label for="customPhoto">可选：自己的记忆图片（小于 1MB）</label><input class="form-control" type="file" id="customPhoto" accept="image/png,image/jpeg,image/webp"></div></div>'+
      '<button class="btn-primary" type="submit">保存作品并试记 ↗</button><p class="form-note">作品保存在本浏览器，不会上传到服务器。请勿使用包含个人隐私的照片发布可分享文件。</p></form></section>';
  }
  function safePhoto(s){return typeof s==='string' && s.length<3200000 && /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(s);}
  function fileToData(file,max){
    return new Promise(function(resolve,reject){
      if(!file||(!file.name&&file.size===0)){resolve('');return;}
      if(file.size>max||!['image/png','image/jpeg','image/webp'].includes(file.type)){reject(new Error('仅支持小于 '+Math.round(max/1024)+'KB 的 PNG/JPEG/WebP 图片'));return;}
      var r=new FileReader();r.onload=function(){resolve(r.result);};r.onerror=function(){reject(new Error('无法读取图片'));};r.readAsDataURL(file);
    });
  }
  function community(){return window.MemoryDuetSocial?window.MemoryDuetSocial.view():'<section class="form-panel">交友模块尚未加载，请刷新页面。</section>';}
  function profile(){
    var saved=allLessons().filter(function(x){return state.saved[x.id];}), stat=statistics();
    return head('MY LITTLE UNIVERSE','我的记忆空间','收藏想学的内容，查看独立练习记录。当前数据只在本设备浏览器本地保存。')+
      '<div class="profile-stats"><div><strong>'+saved.length+'</strong><small>收藏作品</small></div>'+
      '<div><strong>'+stat.attempts+'</strong><small>答题记录</small></div><div><strong>'+stat.independent+'</strong><small>独立正确</small></div></div>'+
      section('收藏的学习卡','MY SAVED CARDS')+
      (saved.length?'<div class="lesson-grid">'+saved.map(lessonCard).join('')+'</div>':
        '<div class="empty-state"><span class="empty-icon">♡</span><h3>还没有收藏的卡片</h3><p>遇到喜欢的记法，点开学习卡并选择收藏。</p>'+button('发现学习卡','goto-catalog','','btn-primary')+'</div>')+
      section('下一步：记忆宫殿','COMING LATER')+
      '<div class="prose-card"><b>记忆宫殿还在规划中</b><p>未来先请你确认熟悉路线、地点桩顺序与数量，再安放真正需要记忆的知识；不会随意给你虚构“已掌握”的记忆效果。</p></div>'+
      '<div class="section-top"><h2>我的数据</h2>'+button('进入复习空间 ↗','goto-review','','btn-primary')+'</div><div class="prose-card"><p>学习记录、学习卡收藏和创作保存在本浏览器。社区漂流瓶由共享服务保存，游客身份的会话凭据保存在本设备。</p>'+
      '<div style="margin-top:13px">'+button('导出本机学习数据','export-data')+'</div></div>';
  }
  function rail(){
    if(sceneMode==='social'||ui.view==='community')return '<div class="rail-card"><div class="rail-heading"><span>记忆海岸</span><small>COMMUNITY</small></div><p class="rail-note">有难题就求助，有好方法就分享。</p><div class="scene-rail-actions"><button data-action="compose-scene" data-kind="hard" class="btn-secondary">◌ 发太难记漂流瓶</button><button data-action="compose-scene" data-kind="secret" class="btn-secondary">✦ 分享记忆秘诀</button><button data-nav="community" data-section="rooms" class="btn-secondary">▤ 进入共学室</button></div></div><div class="rail-tip"><h3>一起学习，彼此尊重</h3><p>无需真实姓名或密码。公开内容请勿包含隐私；秘诀需要自己核对，交友不等于学习成绩。</p><button class="text-link" data-scene="learn">返回专注学习 ↗</button></div>';
    var stat=statistics(), target=5, pct=Math.min(100,Math.round(stat.attempts/target*100)), today=new Date();
    var labels=['日','一','二','三','四','五','六'];
    var marks=Array.from({length:7},function(_,i){
      var d=new Date(today.getTime()-(6-i)*86400000);
      var at=Array.prototype.concat.apply([],Object.values(state.attempts).filter(Array.isArray));
      var has=at.some(function(a){return a.at && a.at.slice(0,10)===d.toISOString().slice(0,10);});
      return '<span class="rail-day"><small>'+labels[d.getDay()]+'</small><b class="'+(i===6?'today':'')+'">'+(has?'✓':'·')+'</b></span>';
    }).join('');
    return '<div class="rail-card"><div class="rail-heading"><span>学习轨迹</span><small>LOCAL ONLY</small></div>'+
      '<div class="rail-streak">'+stat.attempts+' <span>次实际答题</span></div>'+
      '<div class="progress-track"><span style="width:'+pct+'%"></span></div>'+
      '<p class="rail-note">体验目标：5 次独立或提示后练习，不代表知识已掌握。</p><div class="rail-days">'+marks+'</div></div>'+
      '<div class="rail-tip"><div class="rail-orbit">◎ ✦</div><h3>知道 ≠ 记住</h3>'+
      '<p>复习之前先遮住答案。真正的独立回忆，需要在不同时间再次验证。</p>'+
      '<button class="text-link" data-nav="review">打开复习空间 ↗</button></div>'+
      '<div class="rail-card"><div class="rail-heading"><span>今天的灵感</span><small>TIP 01</small></div>'+
      '<p class="rail-note" style="line-height:1.9">先让内容有意义，再为难记的部分添加一个简单、可逆的提示。</p>'+
      '<div class="divider"></div><span class="eyebrow">MEMORY DUET</span><p class="quiet" style="margin-top:7px">学习，可以有你的方法。</p></div>';
  }
  function render(){
    var pages={home:home,catalog:catalog,topics:topics,topic:topic,lesson:lesson,review:review,create:create,community:community,profile:profile};
    sceneNav();
    APP.innerHTML=(pages[ui.view]||home)();RAIL.innerHTML=rail();
    if(ui.view==='create'&&cardDraft){
      document.getElementById('customTitle').value=String(cardDraft.title||'').slice(0,65);
      document.getElementById('customCue').value=String(cardDraft.content||'').slice(0,1200);
      const select=document.getElementById('customSubject');
      if([...select.options].some(o=>o.value===cardDraft.subject))select.value=cardDraft.subject;
      if(cardDraft.method){const method=document.getElementById('customMethod');if([...method.options].some(o=>o.value===cardDraft.method))method.value=cardDraft.method;}
      cardDraft=null;
      toast('已转入私人学习卡草稿；请核实秘诀并填写问题与正确答案');
    }
    if(ui.view==='community'&&window.MemoryDuetSocial)window.MemoryDuetSocial.mount();
    // Scene navigation is rebuilt from sceneNav; social module refreshes active section.
    SEARCH.value=ui.search;
    document.title=ui.view==='home'?'Memory Duet · 记忆搭子':'记忆搭子 · '+({catalog:'分类学习',topics:'专题图书馆',lesson:'独立记忆练习',review:'回忆练习',profile:'我的空间',create:'创作记忆卡',community:'记忆交友'}[ui.view]||'专题学习');
  }
  function promptText(x){
    return '请为学习任务《'+x.title+'》创作一张清晰的教学助记插画。\n主方法：'+x.method+'。\n知识线索：'+x.cue+
      '\n目标答案（仅供构图核对，画面不要直接写出答案）：'+x.answer+
      '\n要求：动作、空间、顺序或组块关系清晰；无误导性历史或科学“实拍”画面；文字尽量少；兼容竖屏。';
  }
  function download(obj,filename){
    var url=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:'application/json;charset=utf-8'}));
    var a=document.createElement('a');a.href=url;a.download=filename+'.json';document.body.append(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(url);},800);
  }
  function saveAttempt(x,answer,outcome){
    if(!Array.isArray(state.attempts[x.id]))state.attempts[x.id]=[];
    state.attempts[x.id].push({at:new Date().toISOString(),outcome:outcome,answer:answer.slice(0,400)});
    persist();
  }
  document.addEventListener('click',function(event){
    var mode=event.target.closest('button[data-scene]');
    if(mode){event.preventDefault();chooseScene(mode.dataset.scene);return;}
    var nav=event.target.closest('[data-nav]');
    if(nav){event.preventDefault();setView(nav.dataset.nav,{section:nav.dataset.section||undefined});return;}
    var el=event.target.closest('[data-action]');
    if(!el)return;
    var action=el.dataset.action,id=el.dataset.id;
    if(action==='compose-scene'){sceneSocial('compose',{kind:el.dataset.kind||'hard'});}
    else if(action==='ask-bottle'){var x=one(id);if(x)sceneSocial('compose',{kind:'hard',title:x.title,subject:x.subject,method:x.method,content:'我想记住这个知识点。请分享一个更容易理解和独立回忆的方法。\n（请在发布前补充你遇到的具体困难。）'});}
    else if(action==='goto-catalog')setView('catalog');
    else if(action==='goto-review')setView('review');
    else if(action==='goto-topics')setView('topics');
    else if(action==='open-topic')setView('topic',{topicId:id});
    else if(action==='open-lesson')setView('lesson',{lessonId:id});
    else if(action==='back-to-topic'){var x=one(ui.lessonId);if(x && C.topicsById[x.topicId])setView('topic',{topicId:x.topicId});else setView('catalog');}
    else if(action==='topic-to-filter')setView('catalog',{dimension:'topic',value:el.dataset.value});
    else if(action==='filter-value'){var v=el.dataset.value,items=(ui.facets[ui.dimension]||[]).slice();
      if(v==='全部')delete ui.facets[ui.dimension];else{items=items.includes(v)?items.filter(x=>x!==v):items.concat([v]);
      if(items.length)ui.facets[ui.dimension]=items;else delete ui.facets[ui.dimension];}
      ui.value=v;render();}
    else if(action==='remove-facet'){var k=el.dataset.dim;ui.facets[k]=(ui.facets[k]||[]).filter(x=>x!==el.dataset.value);
      if(!ui.facets[k].length)delete ui.facets[k];render();}
    else if(action==='clear-facets'){ui.facets={};ui.value='全部';render();}
    else if(action==='only-saved'){ui.onlySaved=!ui.onlySaved;render();}
    else if(action==='clear-filter'){ui.value='全部';ui.facets={};ui.search='';ui.onlySaved=false;render();}
    else if(action==='toggle-saved'){state.saved[id]=!state.saved[id];persist();render();toast(state.saved[id]?'已加入收藏':'已取消收藏');}
    else if(action==='start-quiz'){ui.phase='quiz';ui.hintUsed=false;ui.quizDraft='';render();var ans=document.getElementById('answerInput');if(ans)ans.focus();}
    else if(action==='reveal-hint'){ui.hintUsed=true;render();}
    else if(action==='retry-quiz'){ui.phase='quiz';ui.hintUsed=false;ui.result=null;ui.quizDraft='';render();}
    else if(action==='next-lesson'){
      var current=one(ui.lessonId), related=allLessons().filter(function(x){return x.topicId===current.topicId;});
      var k=related.findIndex(function(x){return x.id===current.id;});
      setView('lesson',{lessonId:related[(k+1)%related.length].id});
    }
    else if(action==='make-prompt'){
      var v=document.getElementById('promptArea'),text=promptText(one(ui.lessonId));
      v.innerHTML='<div class="form-row" style="margin-top:22px"><label for="promptOutput">可编辑的画面生成提示词</label><textarea id="promptOutput" class="form-control" rows="7" readonly>'+esc(text)+'</textarea><p class="form-note">目前仅生成文本提示词；图片生成服务需另行配置。</p>'+
        button('复制提示词','copy-prompt')+'</div>';
    }
    else if(action==='copy-prompt'){var ta=document.getElementById('promptOutput');if(!ta)return;
      if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(ta.value).then(function(){toast('提示词已复制');}).catch(function(){ta.select();toast('请手动复制已选中文本');});
      else{ta.select();toast('请复制已选中文本');}
    }
    else if(action==='new-bottle'){ui.composeBottle=true;ui.bottleId=null;render();}
    else if(action==='open-bottle'){ui.bottleId=id;ui.composeBottle=false;render();}
    else if(action==='export-bottle'){var b=state.bottles.find(function(x){return x.id===id;});if(b)download({type:'duet-bottle',id:b.id,task:b.task,photo:b.photo},'memory-duet-bottle');}
    else if(action==='pick-reply'){var b2=state.bottles.find(function(x){return x.id===id;});if(b2&&b2.mine){b2.best=Number(el.dataset.index);persist();render();}}
    else if(action==='export-data')download({type:'memory-duet-backup-v2',exportedAt:new Date().toISOString(),data:state},'memory-duet-my-data');
  });
  document.addEventListener('change',function(e){
    if(e.target.id==='dimensionSelect'){ui.dimension=e.target.value;ui.value=(ui.facets[ui.dimension]||[])[0]||'全部';render();}
    if(e.target.id==='valueSelect'){ui.value=e.target.value;if(ui.value==='全部')delete ui.facets[ui.dimension];else ui.facets[ui.dimension]=[ui.value];render();}
    if(e.target.id==='sortSelect'){ui.sort=e.target.value;render();}
    if(e.target.id==='importBottle'){importBottleFile(e.target.files[0]);}
  });
  document.addEventListener('input',function(e){if(e.target.id==='answerInput')ui.quizDraft=e.target.value;});
  SEARCH.addEventListener('input',function(e){
    ui.search=e.target.value;
    if(ui.view!=='catalog'){setView('catalog');SEARCH.focus();SEARCH.setSelectionRange(SEARCH.value.length,SEARCH.value.length);}
    else {var r=document.getElementById('catalogResults');if(r)r.innerHTML=catalogResults();}
  });
  document.addEventListener('keydown',function(e){
    if(sceneMode!=='social'&&e.key==='/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && !e.ctrlKey && !e.metaKey){e.preventDefault();SEARCH.focus();}
    if(e.key==='Escape' && document.activeElement===SEARCH){SEARCH.value='';ui.search='';if(ui.view==='catalog'){var r=document.getElementById('catalogResults');if(r)r.innerHTML=catalogResults();}SEARCH.blur();}
  });
  document.addEventListener('submit',async function(e){
    if(e.target.id==='customDimensionForm'){e.preventDefault();var label=document.getElementById('newDimensionName').value.trim();
      if(!label)return;if(allDimensions().some(d=>d.label===label)){toast('该分类名已存在');return;}
      var key='custom:'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
      state.customDimensions.push({key,label});persist();ui.dimension=key;ui.value='全部';render();toast('新分类已建立');return;}
    if(e.target.id==='customFacetForm'){e.preventDefault();var cardId=document.getElementById('customFacetCard').value,
      key=document.getElementById('customFacetDimension').value,value=document.getElementById('customFacetValue').value.trim();
      var card=state.custom.find(x=>x.id===cardId);if(!card||!value)return;
      card.customFacets=card.customFacets||{};card.customFacets[key]=value;persist();
      ui.dimension=key;ui.facets[key]=[value];ui.value=value;render();toast('已设置原创卡分类');return;}
    if(e.target.id==='quizForm'){
      e.preventDefault();var x=one(ui.lessonId),a=document.getElementById('answerInput').value.trim();
      if(!a)return;var correct=C.evaluateAnswer(x,a),outcome=correct?(ui.hintUsed?'prompted-correct':'independent-correct'):'incorrect';
      saveAttempt(x,a,outcome);ui.phase='result';ui.result={outcome:outcome,answer:a};render();
    }
    if(e.target.id==='noteForm'){
      e.preventDefault();var note=document.getElementById('noteText').value.trim();
      if(note){(state.notes[ui.lessonId]||=[]).push(note);persist();render();toast('已保存到本机笔记');}
    }
    if(e.target.id==='createForm'){
      e.preventDefault();var data={
        id:'user-'+Date.now()+'-'+Math.floor(Math.random()*10000),
        title:document.getElementById('customTitle').value.trim(),
        subject:document.getElementById('customSubject').value,
        method:document.getElementById('customMethod').value,
        cue:document.getElementById('customCue').value.trim(),
        question:document.getElementById('customQuestion').value.trim(),
        answer:document.getElementById('customAnswer').value.trim()
      };
      if(!data.title||!data.cue||!data.question||!data.answer)return;
      try{data.photo=await fileToData(document.getElementById('customPhoto').files[0],1024*1024);}
      catch(ex){toast(ex.message);return;}
      state.custom.push(makeCustom(data));persist();setView('lesson',{lessonId:data.id});toast('原创学习卡已保存到本机');
    }
    if(e.target.id==='bottleForm'){
      e.preventDefault();var task=document.getElementById('bottleTask').value.trim();
      if(!task)return;
      try{var photo=await fileToData(document.getElementById('bottlePhoto').files[0],1024*1024);}
      catch(ex){toast(ex.message);return;}
      var bottle={id:'b-'+Date.now()+'-'+Math.random().toString(16).slice(2),task:task,photo:photo,mine:true,replies:[],best:-1};
      state.bottles.push(bottle);persist();ui.bottleId=bottle.id;ui.composeBottle=false;render();
    }
    if(e.target.id==='replyForm'){
      e.preventDefault();var b=state.bottles.find(function(x){return x.id===ui.bottleId;});
      var nick=document.getElementById('replyNick').value.trim(),line=document.getElementById('replyLine').value.trim();
      if(b && nick && line)download({type:'duet-reply',id:b.id,nick:nick,line:line},'memory-duet-reply');
    }
  });
  async function importBottleFile(file){
    if(!file)return;
    if(file.size>3300000){toast('文件过大');return;}
    try{
      var data=JSON.parse(await file.text());
      if(!data||typeof data.id!=='string'||data.id.length>100)throw Error('文件格式错误');
      var existing=state.bottles.find(function(b){return b.id===data.id;});
      if(data.type==='duet-bottle'){
        if(!existing){
          if(typeof data.task!=='string'||!data.task.trim()||data.task.length>180||!safePhoto(data.photo))throw Error('瓶子内容不合法');
          state.bottles.push({id:data.id,task:data.task,photo:data.photo,mine:false,replies:[],best:-1});
        }
      }else if(data.type==='duet-reply'){
        if(!existing||!existing.mine||typeof data.nick!=='string'||data.nick.length>24||typeof data.line!=='string'||data.line.length>180||!data.line.trim())throw Error('未找到对应的已发布瓶子');
        if(!(existing.replies||[]).some(function(r){return r.nick===data.nick && r.line===data.line;})){
          (existing.replies||=[]).push({nick:data.nick,line:data.line});
        }
      }else throw Error('不是 Memory Duet 漂流瓶文件');
      persist();ui.bottleId=data.id;ui.composeBottle=false;render();toast('已导入并保存到本机');
    }catch(ex){toast('导入失败：'+ex.message);}
  }
  window.MemoryDuetSceneBridge={
    sectionChanged(section){lastSocialSection=section||'feed';if(ui.view==='community')sceneNav();},
    createFromSecret(draft){cardDraft=draft;setView('create');},
    returnToLearning(){chooseScene('learn');}
  };
  render();
  if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1')){
    window.addEventListener('load',function(){navigator.serviceWorker.register('./service-worker.js').catch(function(){});});
  }
})();