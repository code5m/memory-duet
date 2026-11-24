(function(root,factory){
  const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MemoryDuetScene=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const KEY='memoryDuetSceneV1';
  const modes=[{id:'learn',label:'专注学习',icon:'▤',description:'知识、专题、回忆与复习'},
    {id:'social',label:'记忆交友',icon:'♧',description:'漂流瓶、搭子与共学'},
    {id:'mixed',label:'自由探索',icon:'✦',description:'学习与交友自由联动'}];
  const item=(view,label,icon,section)=>({view,label,icon,section:section||''});
  const H=item('home','首页','⌂'),C=item('catalog','分类学习','▦'),T=item('topics','专题图书馆','◈'),
    R=item('review','回忆练习','◎'),W=item('create','创作记忆卡','✎'),P=item('profile','我的学习','◉'),
    F=item('community','漂流瓶广场','♧','feed'),D=item('community','太难记漂流瓶','◌','hard'),
    S=item('community','记忆秘诀瓶','✦','secret'),M=item('community','找搭子','☷','matches'),
    G=item('community','共学练习室','▤','rooms'),I=item('community','私信','✉','inbox'),
    U=item('community','我的游客名片','◉','profile'),B=item('community','我的收藏','☆','saved'),
    A=item('community','结伴挑战','◎','challenges'),L=item('community','贡献榜','♜','leaderboard');
  const groups={
    learn:[{title:'专注学习',items:[H,C,T,R]},{title:'知识创作',items:[W,P]}],
    social:[{title:'记忆海岸',items:[F,D,S]},{title:'一起学习与交友',items:[M,G,A,L,I,B,U]}],
    mixed:[{title:'学习空间',items:[H,C,T,R,W]},{title:'记忆交友',items:[F,D,S,M,G,I,P]}]
  };
  const mobile={
    learn:[H,C,T,R,P],
    social:[F,M,G,I,U],
    mixed:[H,C,T,item('community','交友','♧','feed'),P]
  };
  const normalize=s=>modes.some(m=>m.id===s)?s:'mixed';
  const isLearning=view=>['catalog','topics','topic','lesson','review','create','profile'].includes(view);
  function modeForView(mode,view){mode=normalize(mode);return mode==='learn'&&view==='community'?'social':mode==='social'&&isLearning(view)?'learn':mode;}
  function landing(mode){return normalize(mode)==='social'?'community':'home';}
  function groupsFor(mode){return groups[normalize(mode)];}
  function mobileFor(mode){return mobile[normalize(mode)];}
  return {KEY,modes,normalize,landing,modeForView,isLearning,groupsFor,mobileFor};
});