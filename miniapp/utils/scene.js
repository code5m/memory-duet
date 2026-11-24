const KEY='memoryDuetSceneV1',REQUEST='duetSceneRequest';
const modes=[{id:'learn',label:'专注学习',icon:'▤'},{id:'social',label:'记忆交友',icon:'♧'},{id:'mixed',label:'自由探索',icon:'✦'}];
const normalize=s=>modes.some(x=>x.id===s)?s:'mixed';
function get(){return normalize(wx.getStorageSync(KEY));}
function set(mode){mode=normalize(mode);wx.setStorageSync(KEY,mode);return mode;}
const item=(id,label,icon,page,section)=>({id,label,icon,page,section:section||''});
const H=item('home','首页','⌂','home'),C=item('catalog','分类','▦','catalog'),R=item('review','复习','◎','review'),P=item('profile','我的','◉','profile'),
  F=item('feed','广场','♧','social','feed'),M=item('matches','找搭子','☷','social','matches'),
  G=item('rooms','共学','▤','social','rooms'),I=item('inbox','私信','✉','social','inbox'),U=item('social-profile','我的','◉','social','profile');
const nav={learn:[H,C,R,P],social:[F,M,G,I,U],mixed:[H,C,R,item('feed','交友','♧','social','feed'),P]};
function tabs(mode){return nav[normalize(mode)];}
function currentPage(){const pages=getCurrentPages();return pages[pages.length-1];}
function sync(page){
  const tab=page&&page.getTabBar&&page.getTabBar();
  if(tab&&tab.refresh)tab.refresh();
}
function take(page){
  const x=wx.getStorageSync(REQUEST);
  if(x&&x.page===page){wx.removeStorageSync(REQUEST);return x;}
  return null;
}
function go(page,section='',draft=null){
  const current=currentPage(),path='pages/'+page+'/index',req={page,section,draft};
  wx.setStorageSync(REQUEST,req);
  if(current&&current.route===path&&typeof current.sceneRoute==='function'){
    wx.removeStorageSync(REQUEST);current.sceneRoute(req);sync(current);return;
  }
  if(current&&current.route===path){wx.removeStorageSync(REQUEST);sync(current);return;}
  wx.switchTab({url:'/'+path,fail:()=>wx.removeStorageSync(REQUEST)});
}
function choose(mode){mode=set(mode);go(mode==='social'?'social':'home',mode==='social'?'feed':'');}
function learnPage(){if(get()==='social')set('learn');}
function socialPage(){if(get()==='learn')set('social');}
function ask(lesson){
  socialPage();
  go('social','compose',{kind:'hard',title:lesson.title,subject:lesson.subject,method:lesson.method,
    content:'我想记住这个知识点。请分享一个更容易理解和独立回忆的方法。\n（请补充具体困难，确认后再发布。）'});
}
function secret(bottle){
  learnPage();
  wx.setStorageSync('duetCreateDraft',{title:bottle.title,subject:bottle.subject,method:bottle.method,
    cue:'来源：公开记忆秘诀（请先核实）\n'+bottle.content});
  wx.navigateTo({url:'/pages/create/index'});
}
module.exports={KEY,modes,normalize,get,set,tabs,sync,take,go,choose,learnPage,socialPage,ask,secret,currentPage};
