const api=require('../../utils/community.js');
Page({
  data:{user:null,guest:null,messages:[],content:'',error:''},
  onLoad(o){this.id=o.id;this.load();},
  async load(){
    if(!this.id)return;
    try{const [u,m]=await Promise.all([api.call('/users/'+encodeURIComponent(this.id)),api.call('/me')]);
      this.setData({user:u.user,guest:m.guest,error:''});
      if(u.user.mutual){
        const r=await api.call('/messages?peer='+encodeURIComponent(this.id));
        this.setData({messages:r.items||[]});
      }
    }catch(e){this.setData({error:e.message});}
  },
  async follow(){
    if(!this.data.guest)return wx.showToast({title:'请先以游客身份进入',icon:'none'});
    try{await api.call('/follow',{user_id:this.id});this.load();}
    catch(e){this.setData({error:e.message});}
  },
  async block(){
    if(!this.data.guest)return wx.showToast({title:'请先以游客身份进入',icon:'none'});
    try{await api.call('/block',{user_id:this.id});wx.navigateBack();}
    catch(e){this.setData({error:e.message});}
  },
  input(e){this.setData({content:e.detail.value});},
  async send(){
    try{await api.call('/messages',{to:this.id,content:this.data.content});
      this.setData({content:''});this.load();}
    catch(e){this.setData({error:e.message});}
  }
});