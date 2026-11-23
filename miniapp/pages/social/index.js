const api=require('../../utils/community.js');
const SUBJECTS=['英语','语文','数学','科学','历史','地理','编程','专业知识','生活技能','记忆训练','其他学习'];
Page({
  data:{guest:null,connected:api.configured(),error:'',screen:'feed',kind:'all',feed:[],search:'',
    nickname:'',interests:'',postKind:'hard',title:'',content:'',subject:'英语',method:'',tags:'',subjects:SUBJECTS,
    photo:'',matches:[],challenges:[],leaders:[],inbox:[],loading:false},
  onShow(){this.loadMe().then(()=>this.loadScreen());},
  async loadMe(){
    if(!api.configured()){this.setData({connected:false,error:'请配置共享社区的 HTTPS 地址。学习功能仍可使用。'});return;}
    try{const r=await api.call('/me');this.setData({guest:r.guest||null,error:''});}
    catch(e){this.setData({error:e.message});}
  },
  async loadScreen(){
    if(!api.configured())return;
    const s=this.data.screen;
    this.setData({loading:true,error:''});
    try{
      let r;
      if(s==='feed'||s==='saved'){
        const url=(s==='saved'?'/saved':'/feed')+'?kind='+this.data.kind+'&search='+encodeURIComponent(this.data.search);
        r=await api.call(url);
        this.setData({feed:(r.items||[]).map(x=>({...x,kindText:x.kind==='hard'?'太难记漂流瓶':'记忆秘诀瓶'}))});
      }else if(s==='matches'){r=await api.call('/matches');this.setData({matches:r.users||[]});}
      else if(s==='challenges'){r=await api.call('/challenges');this.setData({challenges:r.items||[]});}
      else if(s==='leaders'){r=await api.call('/leaderboard');this.setData({leaders:r.users||[]});}
      else if(s==='inbox'){r=await api.call('/inbox');this.setData({inbox:r.users||[]});}
    }catch(e){this.setData({error:e.message});}
    finally{this.setData({loading:false});}
  },
  requireGuest(){if(this.data.guest)return true;this.setData({screen:'guest'});wx.showToast({title:'随便起昵称即可进入',icon:'none'});return false;},
  switchScreen(e){const screen=e.currentTarget.dataset.screen;if(['compose','matches','challenges','inbox','saved'].includes(screen)&&!this.requireGuest())return;
    this.setData({screen});this.loadScreen();},
  selectKind(e){this.setData({kind:e.currentTarget.dataset.kind,screen:'feed'});this.loadScreen();},
  selectPostKind(e){this.setData({postKind:e.currentTarget.dataset.kind});},
  field(e){this.setData({[e.currentTarget.dataset.key]:e.detail.value});},
  async guestSubmit(e){
    const nick=(this.data.nickname||'').trim();
    if(!nick)return wx.showToast({title:'任意昵称不能为空',icon:'none'});
    try{const d=await api.call('/guest',{nickname:nick,interests:this.data.interests.split(/[,，、]/).map(x=>x.trim()).filter(Boolean).slice(0,8)});
      api.saveGuest(d.token);this.setData({guest:d.guest,screen:'feed',error:''});this.loadScreen();}
    catch(err){this.setData({error:err.message});}
  },
  newBottle(e){if(!this.requireGuest())return;this.setData({screen:'compose',postKind:e.currentTarget.dataset.kind||'hard'});},
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