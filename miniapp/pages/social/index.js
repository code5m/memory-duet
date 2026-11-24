const api=require('../../utils/community.js'),S=require('../../utils/scene.js');
const SUBJECTS=['英语','语文','数学','科学','历史','地理','编程','专业知识','生活技能','记忆训练','其他学习'];
Page({
  data:{mode:'mixed',guest:null,connected:api.configured(),error:'',screen:'feed',kind:'all',feed:[],search:'',
    nickname:'',interests:'',postKind:'hard',title:'',content:'',subject:'英语',method:'',tags:'',subjects:SUBJECTS,
    photo:'',matches:[],challenges:[],leaders:[],inbox:[],loading:false},
  onShow(){
    S.socialPage();this.setData({mode:S.get()});
    const req=S.take('social');
    this.loadMe().then(()=>{if(req)this.sceneRoute(req);else{S.sync(this);this.loadScreen();}});
  },
  sceneRoute(req){
    const screen=req.section||'feed',draft=req.draft||null;
    this.setData({mode:S.get()});
    if(screen==='rooms'){wx.navigateTo({url:'/pages/rooms/index'});return;}
    if(screen==='compose'){
      this.setData({postKind:draft&&draft.kind||'hard',title:draft&&draft.title||'',content:draft&&draft.content||'',
        subject:draft&&SUBJECTS.includes(draft.subject)?draft.subject:'其他学习',method:draft&&draft.method||'',tags:'',photo:''});
    }
    if(screen==='hard'||screen==='secret'){this.setData({kind:screen,screen:'feed'});this.loadScreen();S.sync(this);return;}
    this.setData({screen:screen==='feed'?'feed':screen});
    if(screen==='feed')this.setData({kind:'all'});
    if(['compose','matches','inbox','saved','profile','challenges'].includes(screen)&&!this.requireGuest()){S.sync(this);return;}
    if(screen==='profile'&&this.data.guest)this.setData({nickname:this.data.guest.nickname,interests:(this.data.guest.interests||[]).join(', ')});
    this.loadScreen();S.sync(this);
  },
  async loadMe(){
    if(!api.configured()){this.setData({connected:false,error:'请配置共享社区的 HTTPS 地址。学习功能仍可使用。'});return;}
    try{const r=await api.call('/me');this.setData({guest:r.guest||null,error:''});}
    catch(e){this.setData({error:e.message});}
  },
  async loadScreen(){
    if(!api.configured())return;
    const s=this.data.screen;
    S.sync(this);this.setData({loading:true,error:''});
    try{
      let r;
      if(s==='feed'||s==='saved'){
        const url=(s==='saved'?'/saved':'/feed')+'?kind='+this.data.kind+'&search='+encodeURIComponent(this.data.search);
        r=await api.call(url);
        this.setData({feed:(r.items||[]).map(x=>({...x,kindText:x.kind==='hard'?'太难记漂流瓶':'记忆秘诀瓶'}))});
      }else if(s==='matches'){r=await api.call('/matches');this.setData({matches:(r.users||[]).map(x=>({...x,commonText:(x.common_interests||[]).join(' / ')}))});}
      else if(s==='challenges'){r=await api.call('/challenges');this.setData({challenges:r.items||[]});}
      else if(s==='leaders'){r=await api.call('/leaderboard');this.setData({leaders:r.users||[]});}
      else if(s==='inbox'){r=await api.call('/inbox');this.setData({inbox:r.users||[]});}
    }catch(e){this.setData({error:e.message});}
    finally{this.setData({loading:false});}
  },
  requireGuest(){if(this.data.guest)return true;this.resumeAfterGuest=this.data.screen==='guest'?'feed':this.data.screen;this.setData({screen:'guest'});wx.showToast({title:'随便起昵称即可进入',icon:'none'});return false;},
  switchScreen(e){const screen=e.currentTarget.dataset.screen;
    if(screen==="rooms"){wx.navigateTo({url:"/pages/rooms/index"});return;}this.setData({screen});if(['compose','matches','challenges','inbox','saved','profile'].includes(screen)&&!this.requireGuest())return;
    this.setData({screen,nickname:screen==='profile'&&this.data.guest?this.data.guest.nickname:this.data.nickname,
      interests:screen==='profile'&&this.data.guest?this.data.guest.interests.join(', '):this.data.interests});this.loadScreen();},
  selectKind(e){this.setData({kind:e.currentTarget.dataset.kind,screen:'feed'});this.loadScreen();},
  selectPostKind(e){this.setData({postKind:e.currentTarget.dataset.kind});},
  subjectChange(e){this.setData({subject:SUBJECTS[Number(e.detail.value)]||'英语'});},
  field(e){this.setData({[e.currentTarget.dataset.key]:e.detail.value});},
  async guestSubmit(e){
    const nick=(this.data.nickname||'').trim();
    if(!nick)return wx.showToast({title:'任意昵称不能为空',icon:'none'});
    try{const d=await api.call('/guest',{nickname:nick,interests:this.data.interests.split(/[,，、]/).map(x=>x.trim()).filter(Boolean).slice(0,8)});
      api.saveGuest(d.token);this.setData({guest:d.guest,screen:this.resumeAfterGuest||'feed',error:''});this.resumeAfterGuest=null;this.loadScreen();}
    catch(err){this.setData({error:err.message});}
  },
  newBottle(e){this.setData({screen:'compose',postKind:e.currentTarget.dataset.kind||'hard',title:'',content:'',method:'',tags:'',photo:''});if(!this.requireGuest())return;S.sync(this);},
  choosePhoto(){
    wx.chooseImage({count:1,sizeType:['compressed'],sourceType:['album','camera'],success:async r=>{
      const file=r.tempFilePaths[0];
      wx.getFileInfo({filePath:file,success:info=>{
        if(info.size>500000)return wx.showToast({title:'请选 500KB 内的图片',icon:'none'});
        wx.getFileSystemManager().readFile({filePath:file,encoding:'base64',success:res=>{
          const ext=file.toLowerCase().endsWith('.png')?'png':file.toLowerCase().endsWith('.webp')?'webp':'jpeg';
          this.setData({photo:'data:image/'+ext+';base64,'+res.data});
        }});
      }});
    }});
  },
  async publish(){
    if(!this.requireGuest())return;
    try{const d=await api.call('/bottles',{kind:this.data.postKind,title:this.data.title,content:this.data.content,
      subject:this.data.subject,method:this.data.method,tags:this.data.tags.split(/[,，、]/).map(x=>x.trim()).filter(Boolean).slice(0,8),
      image:this.data.photo});
      this.setData({title:'',content:'',tags:'',photo:'',screen:'feed'});this.loadScreen();
      wx.navigateTo({url:'/pages/bottle/index?id='+d.id});
    }catch(e){this.setData({error:e.message});}
  },
  async random(){
    try{const d=await api.call('/random?kind='+this.data.kind);if(!d.item)return wx.showToast({title:'暂时没有瓶子',icon:'none'});
      wx.navigateTo({url:'/pages/bottle/index?id='+d.item.id});
    }catch(e){this.setData({error:e.message});}
  },
  openBottle(e){wx.navigateTo({url:'/pages/bottle/index?id='+e.currentTarget.dataset.id});},
  openPartner(e){wx.navigateTo({url:'/pages/partner/index?id='+e.currentTarget.dataset.id});},
  searchInput(e){this.setData({search:e.detail.value});},
  search(){this.loadScreen();},
  async toggleFollow(e){
    if(!this.requireGuest())return;
    try{await api.call('/follow',{user_id:e.currentTarget.dataset.id});this.loadScreen();}
    catch(err){this.setData({error:err.message});}
  },
  async challengeAction(e){
    if(!this.requireGuest())return;
    const id=e.currentTarget.dataset.id,action=e.currentTarget.dataset.action;
    try{await api.call('/challenge',{id,action});this.loadScreen();}
    catch(err){this.setData({error:err.message});}
  },
  async saveProfile(){
    if(!this.requireGuest())return;
    try{const r=await api.call('/profile',{nickname:this.data.nickname||this.data.guest.nickname,
      interests:(this.data.interests||'').split(/[,，、]/).map(x=>x.trim()).filter(Boolean).slice(0,8)});
      this.setData({guest:r.guest,screen:'feed'});this.loadScreen();}
    catch(err){this.setData({error:err.message});}
  },
  changeGuest(){api.clearGuest();this.setData({guest:null,nickname:'',screen:'guest'});}
});