const S=require('../utils/scene.js');
Component({data:{items:S.tabs('mixed'),active:'home',mode:'mixed'},lifetimes:{attached(){this.refresh();}},pageLifetimes:{show(){this.refresh();}},methods:{
  refresh(){
    const mode=S.get(),page=S.currentPage(),route=page&&page.route||'pages/home/index';
    const name=route.split('/')[1],screen=page&&page.data&&page.data.screen||'feed';
    const active=name==='social'?(mode==='social'?(screen==='profile'?'social-profile':['matches','inbox','rooms'].includes(screen)?screen:'feed'):'feed'):name;
    this.setData({mode,items:S.tabs(mode),active});
  },
  tap(e){const id=e.currentTarget.dataset.id,item=this.data.items.find(x=>x.id===id);if(item)S.go(item.page,item.section);}
}});