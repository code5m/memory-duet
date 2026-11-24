(function () {
  "use strict";
  const TOKEN_KEY="duet-social-guest-token";
  const BASE="/api/community";
  const SUBJECTS=["英语","语文","数学","科学","历史","地理","编程","专业知识","生活技能","记忆训练","其他学习"];
  let token=localStorage.getItem(TOKEN_KEY)||"";
  let me=null,root=null,booted=false,requestId=0;
  let screen="feed",kind="all",sort="new",query="",feed=[],selected=null,replies=[],user=null,
      matches=[],challenges=[],leaders=[],inbox=[],messages=[],peer=null,rooms=[],room=null,roomHintUsed=false,subscreen="",draftKind="hard",composeDraft=null,resumeAfterGuest=null;
  const labels={hard:"太难记漂流瓶",secret:"记忆秘诀瓶"};
  const icons={hard:"◌",secret:"✦"};
  const stateName={hard:"分享你的难题，让搭子来支招",secret:"把真正有效的记忆方法传递出去"};
  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  const attr=esc;
  const currentId=()=>me&&me.id;
  function notify(text,isError=false){
    let n=document.querySelector("#toast");
    if(n){n.textContent=text;n.hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>n.hidden=true,3700);}
    if(isError)console.warn("Memory Duet community:",text);
  }
  async function call(route,options={}){
    const headers={"Accept":"application/json",...(options.body?{"Content-Type":"application/json"}:{}),...(token?{"Authorization":"Bearer "+token}:{})};
    let response;
    try{
      response=await fetch(BASE+route,{method:options.body?"POST":"GET",headers,body:options.body?JSON.stringify(options.body):undefined,credentials:"same-origin"});
    }catch(e){throw Error("无法连接共享社区服务；请通过 python3 server.py 启动网页服务。");}
    let data;
    try{data=await response.json();}catch(e){throw Error("服务器没有返回有效数据");}
    if(!response.ok||!data.ok)throw Error(data.error||"操作失败");
    return data;
  }
  function captureDraft(){const f=document.getElementById('socialCompose');if(!f||screen!=='compose')return;const d=new FormData(f);composeDraft={kind:d.get('kind'),title:d.get('title'),content:d.get('content'),subject:d.get('subject'),method:d.get('method'),tags:d.get('tags')};draftKind=composeDraft.kind;}
  function prepare(section,draft){
    requestId++;
    if(draft){
      composeDraft=draft;draftKind=draft.kind==="secret"?"secret":"hard";screen="compose";return;
    }
    if(section==="hard"||section==="secret"){kind=section;screen="feed";query="";return;}
    if(section==="feed"){kind="all";query="";}
    screen=["feed","matches","rooms","challenges","leaderboard","inbox","saved","profile","compose"].includes(section)?section:"feed";
  }
  function section(){return screen==="entry"&&resumeAfterGuest?resumeAfterGuest:screen==="feed"?(kind==="all"?"feed":kind):screen==="detail"?(selected&&selected.kind||"feed"):screen==="room"?"rooms":screen;}
  function view(){
    return '<section class="duet-social" id="duetSocial"><div class="social-hero">'+
      '<div><span class="eyebrow">LEARN TOGETHER / NO PASSWORD</span>'+
      '<h1>记忆很难，<br><em>我们一起想办法。</em></h1>'+
      '<p>扔出一个太难记的问题，或接住一条有用的记忆秘诀。分享、尝试、再验证。</p>'+
      '<div class="scene-bottle-actions"><button type="button" class="btn-primary" data-social="compose" data-kind="hard">◌ 发太难记漂流瓶</button> <button type="button" class="btn-secondary" data-social="compose" data-kind="secret">✦ 分享记忆秘诀</button></div></div>'+
      '<div class="social-hero-art" aria-hidden="true"><span>✦</span><span>✉</span><span>◌</span></div></div>'+
      '<div id="socialMount" aria-live="polite"><div class="social-loading">正在连接记忆海岸…</div></div></section>';
  }
  function mount(){
    root=document.getElementById("socialMount");
    if(!root||!root.isConnected)return;
    if(!booted){
      booted=true;
      root.addEventListener("click",onClick);
      root.addEventListener("submit",onSubmit);
      root.addEventListener("change",onChange);
      root.addEventListener("keydown",e=>{if(e.key==="Escape"&&screen==="detail"){screen="feed";load();}});
      document.querySelector("#duetSocial").addEventListener("click",e=>{
        const control=e.target.closest('[data-social="compose"]');
        if(control&&!root.contains(control)){e.preventDefault();composeDraft=null;draftKind=control.dataset.kind||"hard";screen="compose";if(!requireGuest())return;render();}
      });
    }
    // Re-rendering the outer SPA creates a new DOM node, rebind its listeners.
    else{
      root.addEventListener("click",onClick);root.addEventListener("submit",onSubmit);root.addEventListener("change",onChange);
      document.querySelector("#duetSocial").addEventListener("click",e=>{
        const b=e.target.closest('[data-social="compose"]');
        if(b&&!root.contains(b)){e.preventDefault();composeDraft=null;draftKind=b.dataset.kind||"hard";screen="compose";if(!requireGuest())return;render();}
      });
    }
    bootstrap();
  }
  async function bootstrap(){
    try{
      if(token){
        const data=await call("/me");
        if(data.guest)me=data.guest;
        else{token="";me=null;localStorage.removeItem(TOKEN_KEY);}
      }
      if(["compose","matches","inbox","saved","profile"].includes(screen)&&!me){requireGuest();return;}
      await load();
    }catch(e){renderError(e.message);}
  }
  function requireGuest(){
    if(me)return true;
    resumeAfterGuest=screen;screen="entry";render();notify("无需密码，输入任意昵称即可进入");
    return false;
  }
  function navbar(){
    const menu=[["feed","漂流瓶广场"],["matches","找搭子"],["challenges","结伴挑战"],["rooms","共学练习室"],["leaderboard","贡献榜"],["inbox","私信"],["saved","我的收藏"]];
    return '<div class="social-toolbar"><div class="social-user">'+(me?
      '<span class="social-avatar">✦</span><span>游客 <strong>'+esc(me.nickname)+'</strong><small>免密码 · 临时身份</small></span>'+
      '<button class="social-quiet" data-social="profile">个人设置</button>':
      '<span class="social-avatar">?</span><span><strong>来海岸逛逛</strong><small>浏览免登录，互动只需昵称</small></span>'+
      '<button class="social-small-primary" data-social="entry">输入昵称进入</button>')+
      '</div><div class="social-tabs" role="navigation" aria-label="记忆交友">'+menu.map(([k,v])=>
        '<button type="button" class="'+(screen===k?"active":"")+'" data-social="screen" data-screen="'+k+'">'+v+'</button>').join("")+'</div></div>';
  }
  function splashKinds(){
    return '<div class="social-kind-grid"><button class="social-kind kind-hard" data-social="kind" data-kind="hard"><span class="social-symbol">◌</span>'+
      '<strong>太难记漂流瓶</strong><small>这个知识我总记不住，谁能帮我？</small><b>帮我想办法 ↗</b></button>'+
      '<button class="social-kind kind-secret" data-social="kind" data-kind="secret"><span class="social-symbol">✦</span>'+
      '<strong>记忆秘诀瓶</strong><small>我发现了一个好记法，分享给你。</small><b>拆开秘诀 ↗</b></button></div>';
  }
  function button(text,action,rest="",klass="social-action"){
    return '<button type="button" class="'+klass+'" data-social="'+action+'" '+rest+'>'+text+'</button>';
  }
  function tag(t){return '<span class="social-tag">'+esc(t)+'</span>';}
  function userButton(u){return u?'<button class="social-user-link" type="button" data-social="user" data-id="'+attr(u.id)+'">'+esc(u.nickname)+'</button>':"";}
  function itemCard(b){
    const author=b.author||{};
    return '<article class="social-post"><div class="social-post-head">'+
      '<span class="social-type '+(b.kind==="hard"?"type-hard":"type-secret")+'">'+esc(icons[b.kind])+' '+esc(labels[b.kind])+'</span>'+
      '<span class="social-time">'+esc((b.created_at||"").slice(0,16).replace("T"," "))+' UTC</span></div>'+
      '<h3><button class="social-post-title" data-social="bottle" data-id="'+attr(b.id)+'">'+esc(b.title)+'</button></h3>'+
      '<p>'+esc(b.content).slice(0,190)+(b.content.length>190?"…":"")+'</p>'+
      '<div class="social-tag-row">'+tag(b.subject)+(b.method?tag(b.method):"")+(b.tags||[]).slice(0,3).map(tag).join("")+'</div>'+
      '<div class="social-post-foot"><span>来自 '+userButton(author)+'</span>'+
      '<span>'+esc(b.likes||0)+' 赞 · '+esc(b.replies||0)+' 回信</span>'+
      '<button data-social="bottle" data-id="'+attr(b.id)+'" class="social-quiet">打开 ↗</button></div></article>';
  }
  function feedView(){
    return splashKinds()+
      '<div class="social-filterbar"><div class="social-segments">'+[["all","全部"],["hard","太难记"],["secret","记忆秘诀"]].map(([v,t])=>
      '<button data-social="kind" data-kind="'+v+'" class="'+(kind===v?"active":"")+'">'+t+'</button>').join("")+'</div>'+
      '<select id="socialSort" class="form-control" aria-label="排序方式"><option value="new">最新发布</option>'+
      '<option value="popular" '+(sort==="popular"?"selected":"")+'>最多点赞</option></select></div>'+
      '<form id="socialSearch" class="social-search"><input name="search" class="form-control" value="'+attr(query)+'" placeholder="搜索知识、标题、学科…" maxlength="100"/>'+
      '<button class="btn-secondary" type="submit">搜索</button></form>'+
      '<div class="social-feed">'+(feed.length?feed.map(itemCard).join(""):'<div class="social-empty">这片海岸还没有漂流瓶。来投递第一个吧！</div>')+'</div>'+
      '<div class="social-foot-actions">'+button("随机捞一个瓶子","random",'','btn-primary')+
      (me?button("我也发一个","compose",'data-kind="hard"'):button("输入昵称参与","entry"))+'</div>';
  }
  function entryView(){
    return '<div class="social-panel social-guest-entry"><div class="social-big-icon">✦</div><span class="eyebrow">ONE NAME. NO PASSWORD.</span>'+
      '<h2>随便起个昵称，就可以一起记。</h2><p>无需手机号、邮箱或密码。昵称允许重复，不代表真实身份，也不能通过昵称找回记录。</p>'+
      '<form id="guestForm"><label for="guestName">游客昵称 · 任意输入</label>'+
      '<input id="guestName" name="nickname" class="form-control" placeholder="例如：背书不迷路" maxlength="30" required autocomplete="nickname" />'+
      '<label for="guestInterests">喜欢的领域（可不填，用逗号隔开）</label>'+
      '<input id="guestInterests" name="interests" class="form-control" placeholder="英语, 数学, 记忆训练" maxlength="160" />'+
      '<button class="btn-primary" type="submit">直接进入记忆海岸 ↗</button></form>'+
      '<p class="social-disclaimer">此操作会创建一个临时游客身份，并将会话标识保存在当前浏览器。游客数据在服务端共享，但无法依靠昵称验证所有权。</p></div>';
  }
  function composeView(){
    const draft=composeDraft||{};
    return '<div class="social-panel"><span class="eyebrow">CREATE / MEMORY BOTTLE</span><h2>装进一只记忆瓶</h2>'+
      '<p>太难记是求助，记忆秘诀是分享。作品会公开展示，请勿填写密码、住址、电话号码或未经同意的他人照片。</p>'+
      '<form id="socialCompose" class="social-form"><label>瓶子类型</label>'+
      '<div class="social-radio"><label><input type="radio" name="kind" value="hard" '+(draftKind==="hard"?"checked":"")+'> ◌ 太难记漂流瓶</label>'+
      '<label><input type="radio" name="kind" value="secret" '+(draftKind==="secret"?"checked":"")+'> ✦ 记忆秘诀瓶</label></div>'+
      '<label>给它取一个标题<input class="form-control" name="title" required maxlength="90" value="'+attr(draft.title||"")+'" placeholder="例如：英语 borrow 和 lend 总是搞混"></label>'+
      '<label>内容 / 难点 / 方法步骤<textarea class="form-control" name="content" required maxlength="1500" rows="6" placeholder="说清楚要记的知识，或写出秘诀、适用对象和如何自行验证…">'+esc(draft.content||"")+'</textarea></label>'+
      '<div class="social-form-grid"><label>学习领域<select class="form-control" name="subject">'+SUBJECTS.map(x=>'<option '+(x===draft.subject?'selected':'')+'>'+esc(x)+'</option>').join("")+'</select></label>'+
      '<label>记忆方法（可选）<input class="form-control" name="method" maxlength="60" value="'+attr(draft.method||"")+'" placeholder="画面 / 故事 / 组块…"></label></div>'+
      '<label>标签（可选，用逗号分隔，最多 8 个）<input class="form-control" name="tags" maxlength="160" value="'+attr(draft.tags||"")+'" placeholder="词义, 易混词, 英语"></label>'+
      '<label>配图（可选，500KB 以内 PNG/JPEG/WebP）<input class="form-control" name="image" type="file" accept="image/png,image/jpeg,image/webp"></label>'+
      '<p class="social-disclaimer">这只是草稿；检查文字与图片后，由你点击发布。学习笔记、作答记录和参考答案不会自动复制到瓶子。</p>'+
      '<div class="social-form-bottom">'+button("取消","screen",'data-screen="feed"','btn-secondary')+
      '<button class="btn-primary" type="submit">抛向记忆海岸 ↗</button></div></form></div>';
  }
  function detailView(){
    const b=selected;if(!b)return '<div class="social-empty">没有找到这只瓶子。</div>';
    const isOwner=me&&b.author.id===me.id;
    return '<div class="social-detail-head">'+button("← 返回海岸","screen",'data-screen="feed"','social-quiet')+
      '<span class="social-type '+(b.kind==="hard"?"type-hard":"type-secret")+'">'+labels[b.kind]+'</span></div>'+
      '<article class="social-panel"><span class="eyebrow">'+(b.kind==="hard"?"I NEED A MEMORY IDEA":"HERE IS MY SECRET")+'</span>'+
      '<h2>'+esc(b.title)+'</h2><div class="social-detail-by">来自 '+userButton(b.author)+' · '+esc(b.subject)+(b.method?" · "+esc(b.method):"")+'</div>'+
      '<div class="social-content">'+esc(b.content).replace(/\n/g,"<br>")+'</div>'+
      (b.image&&/^data:image\/(png|jpeg|webp);base64,/.test(b.image)?'<img class="social-detail-image" alt="发布者提供的记忆配图" src="'+attr(b.image)+'">':"")+
      '<div class="social-tag-row">'+(b.tags||[]).map(tag).join("")+'</div>'+
      '<div class="social-detail-actions">'+
      (b.kind==="secret"?button("转成我的学习卡草稿","secret-to-card",'','social-small-primary'):"")+
      button((b.liked?"♥ 已点赞":"♡ 点赞")+" "+(b.likes||0),"reaction",'data-type="bottle" data-id="'+attr(b.id)+'" data-kind="like"')+
      button(b.saved?"★ 已收藏":"☆ 收藏","reaction",'data-type="bottle" data-id="'+attr(b.id)+'" data-kind="save"')+
      (!isOwner?button("关注作者","follow",'data-id="'+attr(b.author.id)+'"'):tag("我的瓶子"))+
      button("举报","report",'data-type="bottle" data-id="'+attr(b.id)+'"','social-quiet')+'</div></article>'+
      '<div class="social-heading"><h2>搭子的回信 <small>'+replies.length+'</small></h2>'+
      '<span class="social-hint">最佳回信由瓶主挑选</span></div>'+
      (replies.length?replies.map(r=>'<div class="social-reply"><div class="social-reply-top">'+userButton(r.author)+
      (r.is_best?'<span class="social-best">✦ 瓶主精选</span>':"")+'</div><p>'+esc(r.content).replace(/\n/g,"<br>")+'</p>'+
      (r.method?'<small>记忆方法：'+esc(r.method)+'</small>':"")+
      '<div class="social-reply-actions">'+(isOwner&&!r.is_best?button("设为精选","best",'data-id="'+attr(r.id)+'"'):"")+
      button("♡ 点赞","reaction",'data-type="reply" data-id="'+attr(r.id)+'" data-kind="like"')+
      button("举报","report",'data-type="reply" data-id="'+attr(r.id)+'"','social-quiet')+'</div></div>').join(""):'<div class="social-empty">还没人回信，试着贡献一个记法吧。</div>')+
      '<div class="social-panel social-reply-form"><h3>'+(b.kind==="hard"?"送出你的记法":"分享试过后的感受")+'</h3>'+
      (me?'<form id="socialReply"><textarea class="form-control" name="content" required rows="4" maxlength="800" placeholder="写出可复现、可验证的建议，而不是只说“加油”"></textarea>'+
      '<input class="form-control" name="method" maxlength="60" placeholder="你采用的记忆方法（可选）">'+
      '<button class="btn-primary" type="submit">发送回信 ↗</button></form>':
      '<p>先以任意昵称进入，再写下你的记法。</p>'+button("随便起个昵称","entry"))+'</div>';
  }
  function profileView(){
    const interests=me&&me.interests||[];
    return '<div class="social-panel"><span class="eyebrow">MY GUEST SPACE</span><h2>我的游客名片</h2>'+
      '<p>昵称可以修改。没有密码、手机或邮件，换设备或清除本机数据后不能保证找回这个游客身份。</p>'+
      '<form id="socialProfile"><label>昵称<input name="nickname" required maxlength="30" class="form-control" value="'+attr(me?me.nickname:"")+'"></label>'+
      '<label>兴趣标签（逗号隔开）<input name="interests" maxlength="180" class="form-control" value="'+attr(interests.join(", "))+'"></label>'+
      '<button class="btn-primary" type="submit">保存资料</button></form>'+
      '<hr>'+button("切换为新游客","signout",'','social-quiet')+'</div>';
  }
  function matchesView(){
    return '<div class="social-heading"><h2>寻找记忆搭子</h2><span class="social-hint">优先按共同兴趣推荐</span></div>'+
      '<div class="social-user-grid">'+(matches.length?matches.map(u=>'<div class="social-person"><div class="social-person-avatar">✦</div>'+
      '<h3>'+esc(u.nickname)+'</h3><p>'+u.posts+' 个公开瓶子 · '+u.followers+' 位关注者</p>'+
      '<div class="social-tag-row">'+(u.common_interests||[]).map(tag).join("")+'</div>'+
      '<div class="social-person-actions">'+button("查看主页","user",'data-id="'+attr(u.id)+'"')+
      button(u.followed?"已关注 · 取消":"＋ 关注","follow",'data-id="'+attr(u.id)+'"')+
      (u.mutual?button("私信搭子","dm",'data-id="'+attr(u.id)+'"'):"")+'</div></div>').join(""):
      '<div class="social-empty">还没有合适的游客搭子。可以分享兴趣或邀请朋友进入相同服务。</div>')+'</div>';
  }
  function userView(){
    if(!user)return '<div class="social-empty">游客不存在</div>';
    return '<div class="social-panel"><span class="eyebrow">MEMORY PARTNER</span><div class="social-person-avatar">✦</div>'+
      '<h2>'+esc(user.nickname)+'</h2><p>'+user.posts+' 只公开漂流瓶 · '+user.followers+' 位关注者 · '+user.following+' 位关注中</p>'+
      '<div class="social-tag-row">'+(user.interests||[]).map(tag).join("")+'</div>'+
      '<div class="social-person-actions">'+(currentId()===user.id?tag("这是你"):button(user.followed?"取消关注":"＋ 关注","follow",'data-id="'+attr(user.id)+'"'))+
      (user.mutual?button("发私信","dm",'data-id="'+attr(user.id)+'"'):"")+
      (currentId()!==user.id?button("屏蔽此游客","block",'data-id="'+attr(user.id)+'"'):"")+
      (currentId()!==user.id?button("举报游客","report",'data-type="user" data-id="'+attr(user.id)+'"'):"")+'</div></div>'+
      '<p class="social-disclaimer">昵称可能重复，游客身份未经过实名认证；不要向陌生人发送敏感信息。</p>';
  }
  function roomsView(){
    return '<div class="social-heading"><h2>一起完成记忆练习</h2><span class="social-hint">最多 8 位游客协作试记</span></div>'+
      '<div class="social-panel"><p>每个共学室有一道参考答案题。先看学习提示，再遮住提示独立答题；服务端负责文本核对。查看提示由参与者自报。</p>'+
      button('＋ 创建共学练习室','room-create','','btn-primary')+'</div>'+
      (rooms.length?'<div class="social-feed">'+rooms.map(r=>
      '<article class="social-post"><span class="social-type type-secret">'+esc(r.subject)+'</span>'+
      '<h3>'+esc(r.title)+'</h3><p>'+esc(r.question)+'</p>'+
      '<div class="social-post-foot"><span>'+esc(r.creator_name)+' · '+r.members+' 位参与</span>'+
      button('进入共学','room','data-id="'+attr(r.id)+'"','social-small-primary')+'</div></article>').join('')+'</div>':
      '<div class="social-empty">暂时还没有共学室，创建第一道互助练习。</div>');
  }
  function roomComposeView(){
    return '<section class="social-panel"><span class="eyebrow">LEARN WITH FRIENDS</span><h2>创建一个共学练习室</h2>'+
      '<p>不能在题干里直接泄露答案。参考答案只会在参与者提交回答后显示。</p>'+
      '<form id="socialRoomCreate" class="social-form">'+
      '<label>练习室标题<input class="form-control" name="title" required maxlength="90" placeholder="例如：借入借出词义挑战"></label>'+
      '<label>学习领域<select class="form-control" name="subject">'+SUBJECTS.map(v=>'<option>'+esc(v)+'</option>').join("")+'</select></label>'+
      '<label>独立回忆问题<textarea class="form-control" name="question" rows="3" required maxlength="500" placeholder="遮住提示后，参与者需要回答什么？"></textarea></label>'+
      '<label>可选看的一段学习线索<textarea class="form-control" name="hint" rows="4" required maxlength="1000" placeholder="清晰解释知识，但先不提供在题干中"></textarea></label>'+
      '<label>参考答案<input class="form-control" name="answer" required maxlength="250" placeholder="例如 lend"></label>'+
      '<button class="btn-primary" type="submit">创建练习室 ↗</button></form></section>';
  }
  function roomView(){
    if(!room)return '<div class="social-empty">找不到练习室。</div>';
    const joined=me&&(room.members||[]).some(m=>m.id===me.id),attempt=room.my_attempt;
    return '<div class="social-detail-head">'+button('← 返回共学列表','screen','data-screen="rooms"','social-quiet')+
      '<span class="detail-pill">'+esc(room.subject)+'</span></div>'+
      '<div class="social-panel"><span class="eyebrow">GROUP ACTIVE RECALL</span><h2>'+esc(room.title)+'</h2>'+
      '<p>题目由游客 '+esc((room.members.find(m=>m.id===room.creator)||{}).nickname||'搭子')+' 提供。最多 8 人参与。</p>'+
      '<div class="quiz-question">'+esc(room.question)+'</div>'+
      (attempt?'<div class="answer-box"><strong>'+({ 'independent-correct':'独立答对', 'prompted-correct':'提示后答对',
        'incorrect':'未答对'}[attempt.outcome]||'已作答')+'</strong>'+
        '<div class="answer-text">参考答案：'+esc(room.reference_answer)+'</div>'+
        '<p>你提交的答案：'+esc(attempt.answer)+'</p></div>':
      joined?'<form id="socialRoomAnswer"><label>独立写出答案</label><input class="form-control" name="answer" required maxlength="500" autocomplete="off" placeholder="不用看参考答案，自己回答">'+
        (roomHintUsed?'<div class="hint-box"><b>已看提示，本次正确也只计为提示后答对</b><p>'+esc(room.hint)+'</p></div>':'')+
        '<div class="social-detail-actions">'+(!roomHintUsed?button('需要一个提示','room-hint'):'')+
        '<button class="btn-primary" type="submit">提交答案并核对</button></div></form>':
      '<p>加入共学室后可以看到提示、参加独立答题。</p>'+button('加入这间共学室','room-join','','btn-primary'))+
      '<div class="social-heading"><h3>一起学习的搭子</h3><small>'+room.members.length+' / 8</small></div>'+
      (room.members||[]).map(m=>'<div class="social-leader">'+userButton(m)+
        '<small>'+esc(m.outcome==='independent-correct'?'无提示正确':m.outcome==='prompted-correct'?'提示后正确':
        m.outcome==='incorrect'?'本轮未答对':'尚未作答')+'</small></div>').join('')+
      '<div style="margin-top:17px">'+button('举报共学内容','report','data-type="room" data-id="'+attr(room.id)+'"','social-quiet')+'</div>'+
      '<p class="social-disclaimer">这里只能核对提交的文本；是否使用了外部辅助由参与者自报，不是防作弊考试。</p></div>';
  }
  function challengesView(){
    return '<div class="social-heading"><h2>结伴记忆挑战</h2><span class="social-hint">打卡由学习者自报</span></div>'+
      '<div class="social-challenge-grid">'+challenges.map(c=>'<div class="social-challenge">'+
      '<span class="social-type type-secret">'+esc(c.category)+'</span><h3>'+esc(c.title)+'</h3>'+
      '<p>'+esc(c.description)+'</p><div class="social-challenge-bottom"><small>'+c.participants+' 位参与</small>'+
      button(c.completed?"✓ 已自报完成":c.joined?"自报已完成":"加入挑战","challenge",
      'data-id="'+attr(c.id)+'" data-state="'+(c.joined?"complete":"join")+'"',
      c.completed?"social-action":"social-small-primary")+'</div></div>').join("")+'</div>'+
      '<div class="social-panel"><p class="social-disclaimer">这不是考试成绩或经核实的记忆水平排名；独立回忆效果仍应通过真实答题验证。</p></div>';
  }
  function leaderboardView(){
    return '<div class="social-heading"><h2>记忆海岸贡献榜</h2><span class="social-hint">按公开作品与帮助数量排序</span></div>'+
      '<div class="social-panel social-leaders">'+(leaders.length?leaders.map((u,i)=>'<div class="social-leader">'+
      '<strong class="social-rank">'+(i+1)+'</strong><span class="social-person-avatar">✦</span>'+
      userButton(u)+'<small>'+u.posts+' 个瓶子 · '+u.replies+' 次回信</small></div>').join(""):'<div class="social-empty">还没有贡献记录</div>')+'</div>'+
      '<p class="social-disclaimer">贡献榜不衡量记忆力、知识正确性或真实学习成绩。</p>';
  }
  function inboxView(){
    return '<div class="social-heading"><h2>搭子私信</h2><span class="social-hint">互相关注后才可以发送消息</span></div>'+
      '<div class="social-panel"><div class="social-inbox">'+(inbox.length?inbox.map(u=>
      '<button class="social-inbox-user" data-social="dm" data-id="'+attr(u.id)+'"><span class="social-person-avatar">✦</span><span>'+esc(u.nickname)+'</span><span>查看 ↗</span></button>').join(""):
      '<div class="social-empty">还没有私信。先在“找搭子”里互相关注吧。</div>')+'</div></div>';
  }
  function dmView(){
    if(!peer)return '<div class="social-empty">没有找到这位搭子。</div>';
    return '<div class="social-detail-head">'+button("← 返回私信","screen",'data-screen="inbox"','social-quiet')+
      '<strong>和 '+esc(peer.nickname)+' 的对话</strong></div>'+
      '<div class="social-panel"><p class="social-disclaimer">仅支持互相关注的游客私信。不要发送私人联系方式或敏感信息；当前没有端到端加密。</p>'+
      '<div class="social-messages">'+(messages.length?messages.map(m=>
      '<div class="social-message '+(m.sender===currentId()?"mine":"theirs")+'"><small>'+esc(m.created_at.slice(0,16))+' UTC</small><p>'+esc(m.content)+'</p></div>').join(""):
      '<div class="social-empty">你们还没有聊天记录。</div>')+'</div>'+
      '<form id="socialMessage"><textarea class="form-control" name="content" maxlength="500" rows="3" placeholder="发一句友善的话…" required></textarea>'+
      '<button class="btn-primary" type="submit">发送私信</button></form></div>';
  }
  function reportView(){
    return '<div class="social-panel"><span class="eyebrow">COMMUNITY SAFETY</span><h2>举报不合适的内容</h2>'+
      '<p>举报将记录在服务器，达到阈值的内容会临时隐藏，管理员仍须审核。请勿使用举报功能骚扰他人。</p>'+
      '<form id="socialReport"><label>举报原因<textarea class="form-control" name="reason" maxlength="220" required rows="4" placeholder="描述问题，例如广告、欺骗、骚扰或侵犯隐私"></textarea></label>'+
      '<button class="btn-primary" type="submit">提交举报</button>'+button("取消","screen",'data-screen="feed"','btn-secondary')+'</form></div>';
  }
  function render(){
    if(!root||!root.isConnected)return;
    const screens={feed:feedView,entry:entryView,compose:composeView,detail:detailView,profile:profileView,
      matches:matchesView,user:userView,challenges:challengesView,rooms:roomsView,room:roomView,roomCompose:roomComposeView,leaderboard:leaderboardView,
      inbox:inboxView,dm:dmView,report:reportView,saved:()=>'<div class="social-heading"><h2>收藏的记忆瓶</h2></div><div class="social-feed">'+(feed.length?feed.map(itemCard).join(""):'<div class="social-empty">暂时没有收藏的瓶子。</div>')+'</div>'};
    root.innerHTML=navbar()+'<div class="social-inner">'+(screens[screen]||feedView)()+'</div>';
    if(window.MemoryDuetSceneBridge)window.MemoryDuetSceneBridge.sectionChanged(section());
  }
  function renderError(msg){
    if(!root||!root.isConnected)return;
    root.innerHTML=navbar()+'<div class="social-panel social-error"><h3>暂时无法连接社区</h3><p>'+esc(msg)+'</p>'+
      button("重试连接","retry")+'<p class="social-disclaimer">课程分类和本机记忆练习仍可继续使用。共享交友需要服务器在线。</p></div>';
  }
  async function load(){
    const rid=++requestId;
    try{
      let d;
      if(screen==="feed"||screen==="saved"){
        let route=screen==="saved"?"/saved":"/feed";
        const params=new URLSearchParams({kind:kind,sort:sort,search:query});
        d=await call(route+"?"+params.toString());
        if(rid===requestId)feed=d.items;
      }else if(screen==="detail"){
        d=await call("/bottles/"+encodeURIComponent(selected.id));
        if(rid===requestId){selected=d.item;replies=d.replies;}
      }else if(screen==="matches"){
        d=await call("/matches");if(rid===requestId)matches=d.users;
      }else if(screen==="user"){
        d=await call("/users/"+encodeURIComponent(user.id));if(rid===requestId)user=d.user;
      }else if(screen==="rooms"){
        d=await call("/rooms");if(rid===requestId)rooms=d.items;
      }else if(screen==="room"){
        d=await call("/rooms/"+encodeURIComponent(room.id));if(rid===requestId)room=d.room;
      }else if(screen==="leaderboard"){
        d=await call("/leaderboard");if(rid===requestId)leaders=d.users;
      }else if(screen==="challenges"){
        d=await call("/challenges");if(rid===requestId)challenges=d.items;
      }else if(screen==="inbox"){
        d=await call("/inbox");if(rid===requestId)inbox=d.users;
      }else if(screen==="dm"){
        d=await call("/messages?peer="+encodeURIComponent(peer.id));if(rid===requestId){messages=d.items;peer=d.peer;}
      }
      if(rid===requestId)render();
    }catch(e){if(rid===requestId)renderError(e.message);}
  }
  async function doAction(work,reload=true){
    try{
      await work();
      if(reload)await load();
      else render();
    }catch(e){notify(e.message,true);}
  }
  async function onClick(event){
    const b=event.target.closest("[data-social]");
    if(!b)return;
    const action=b.dataset.social,id=b.dataset.id;
    event.preventDefault();
    if(action==="entry"){resumeAfterGuest=screen==="entry"?"feed":screen;screen="entry";render();return;}
    if(action==="retry"){bootstrap();return;}
    if(action==="signout"){
      token="";me=null;localStorage.removeItem(TOKEN_KEY);screen="feed";await load();notify("已切换为访客；原游客无法靠昵称找回");return;
    }
    if(action==="screen"){
      screen=b.dataset.screen||"feed";if(["matches","inbox","saved","profile"].includes(screen)&&!requireGuest())return;
      if(screen==="profile")render();else await load();return;
    }
    if(action==="kind"){kind=b.dataset.kind;screen="feed";await load();return;}
    if(action==="compose"){composeDraft=null;draftKind=b.dataset.kind||draftKind;screen="compose";if(!requireGuest())return;render();return;}
    if(action==="secret-to-card"){if(selected&&selected.kind==="secret"&&window.MemoryDuetSceneBridge)window.MemoryDuetSceneBridge.createFromSecret({title:selected.title,content:"来源：公开记忆秘诀（请先核实）\n"+selected.content,subject:selected.subject,method:selected.method});return;}
    if(action==="bottle"){selected={id:id};screen="detail";await load();return;}
    if(action==="random"){
      try{
        const d=await call("/random?kind="+encodeURIComponent(kind));
        if(!d.item){notify("海里暂时没有符合条件的瓶子");return;}
        selected=d.item;screen="detail";await load();
      }catch(e){notify(e.message,true);}
      return;
    }
    if(action==="profile"){if(!requireGuest())return;screen="profile";render();return;}
    if(action==="user"){user={id:id};screen="user";await load();return;}
    if(action==="follow"||action==="block"){
      if(!requireGuest())return;
      if(action==="block"&&!confirm("确定屏蔽该游客吗？你将不再看到对方的漂流瓶。"))return;
      await doAction(()=>call("/"+action,{body:{user_id:id}}));
      return;
    }
    if(action==="dm"){
      if(!requireGuest())return;
      peer={id:id};screen="dm";await load();return;
    }
    if(action==="reaction"){
      if(!requireGuest())return;
      await doAction(()=>call("/reaction",{body:{target_type:b.dataset.type,target_id:id,kind:b.dataset.kind}}));
      return;
    }
    if(action==="best"){
      if(!requireGuest())return;
      await doAction(()=>call("/best",{body:{reply_id:id}}));return;
    }
    if(action==="room-create"){if(!requireGuest())return;screen="roomCompose";render();return;}
    if(action==="room"){room={id:id};roomHintUsed=false;screen="room";await load();return;}
    if(action==="room-hint"){roomHintUsed=true;render();return;}
    if(action==="room-join"){if(!requireGuest())return;await doAction(()=>call("/rooms/join",{body:{id:room.id}}));return;}
    if(action==="challenge"){
      if(!requireGuest())return;
      if(b.dataset.state==="complete"&&!confirm("本次完成由你自行确认，不会自动判定记忆效果，确定打卡吗？"))return;
      await doAction(()=>call("/challenge",{body:{id:id,action:b.dataset.state}}));return;
    }
    if(action==="report"){
      if(!requireGuest())return;subscreen=screen;window.__duetReportTarget={type:b.dataset.type,id:id};screen="report";render();return;
    }
  }
  async function imageToData(file){
    if(!file || (!file.name && file.size===0))return "";
    if(file.size>500000||!["image/png","image/jpeg","image/webp"].includes(file.type))throw Error("图片必须是 500KB 以内的 PNG、JPEG 或 WebP");
    return await new Promise((resolve,reject)=>{
      const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error("读取照片失败"));r.readAsDataURL(file);
    });
  }
  function splitTags(s){return String(s||"").split(/[,，、]/).map(x=>x.trim()).filter(Boolean).slice(0,8);}
  async function onSubmit(event){
    const form=event.target;if(!form.id||!form.id.startsWith("social")&&form.id!=="guestForm")return;
    event.preventDefault();
    const f=new FormData(form);
    if(form.id==="guestForm"){
      await doAction(async()=>{
        const data=await call("/guest",{body:{nickname:String(f.get("nickname")||""),interests:splitTags(f.get("interests"))}});
        token=data.token;localStorage.setItem(TOKEN_KEY,token);me=data.guest;screen=resumeAfterGuest||"feed";resumeAfterGuest=null;notify("欢迎来到记忆海岸，"+me.nickname);
      });return;
    }
    if(form.id==="socialSearch"){query=String(f.get("search")||"").trim();await load();return;}
    if(!requireGuest())return;
    if(form.id==="socialCompose"){
      await doAction(async()=>{
        const payload={kind:f.get("kind"),title:f.get("title"),content:f.get("content"),subject:f.get("subject"),
          method:f.get("method"),tags:splitTags(f.get("tags")),image:await imageToData(f.get("image"))};
        const data=await call("/bottles",{body:payload});composeDraft=null;selected={id:data.id};screen="detail";
        notify("你的记忆瓶已经入海");
      });return;
    }
    if(form.id==="socialRoomCreate"){
      await doAction(async()=>{const d=await call("/rooms",{body:{title:f.get("title"),subject:f.get("subject"),question:f.get("question"),
        hint:f.get("hint"),answer:f.get("answer")}});room={id:d.id};roomHintUsed=false;screen="room";notify("共学室已创建，邀请搭子参与");});return;
    }
    if(form.id==="socialRoomAnswer"){
      await doAction(async()=>{const d=await call("/rooms/submit",{body:{id:room.id,answer:f.get("answer"),hint_used:roomHintUsed}});
        notify(d.outcome==="independent-correct"?"恭喜独立答对":d.outcome==="prompted-correct"?"提示后答对已单独记录":"已核对答案，可以和搭子交流");});return;
    }
    if(form.id==="socialReply"){
      await doAction(async()=>{
        await call("/replies",{body:{bottle_id:selected.id,content:f.get("content"),method:f.get("method")}});
        notify("回信已经送达");
      });return;
    }
    if(form.id==="socialProfile"){
      await doAction(async()=>{
        const d=await call("/profile",{body:{nickname:f.get("nickname"),interests:splitTags(f.get("interests"))}});
        me=d.guest;notify("游客名片已更新");
      },false);return;
    }
    if(form.id==="socialMessage"){
      await doAction(async()=>{
        await call("/messages",{body:{to:peer.id,content:f.get("content")}});notify("消息已发送");
      });return;
    }
    if(form.id==="socialReport"){
      await doAction(async()=>{
        if(!window.__duetReportTarget)throw Error("没有选择举报对象");
        const target=window.__duetReportTarget;
        await call("/report",{body:{target_type:target.type,target_id:target.id,reason:f.get("reason")}});
        screen=subscreen==="detail"?"feed":subscreen;notify("举报已提交");
      });return;
    }
  }
  function onChange(event){
    const target=event.target;
    if(target.id==="socialSort"){sort=target.value;load();}
    if(target.name==="kind" && target.closest("#socialCompose"))draftKind=target.value;
  }
  window.MemoryDuetSocial={view,mount,prepare,section,captureDraft};
})();