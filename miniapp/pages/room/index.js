const api=require('../../utils/community.js');
Page({
  data:{room:null,guest:null,error:'',answer:'',hintUsed:false,joined:false},
  onLoad(o){this.id=o.id||'';this.load();},
  onShow(){this.load();},
  async load(){
    if(!this.id)return;
    try{const [r,u]=await Promise.all([api.call('/rooms/'+encodeURIComponent(this.id)),api.call('/me')]);
      const joined=!!(u.guest&&r.room.members.some(m=>m.id===u.guest.id));
      this.setData({room:r.room,guest:u.guest,joined,error:''});
    }catch(e){this.setData({error:e.message});}
  },
  async join(){
    if(!this.data.guest)return wx.showToast({title:'先填写游客昵称',icon:'none'});
    try{await api.call('/rooms/join',{id:this.id});this.load();}
    catch(e){this.setData({error:e.message});}
  },
  reveal(){this.setData({hintUsed:true});},
  input(e){this.setData({answer:e.detail.value});},
  async submit(){
    if(!this.data.answer.trim())return wx.showToast({title:'请先作答',icon:'none'});
    try{await api.call('/rooms/submit',{id:this.id,answer:this.data.answer,hint_used:this.data.hintUsed});this.load();}
    catch(e){this.setData({error:e.message});}
  },
  report(){
    if(!this.data.guest)return wx.showToast({title:'先填写游客昵称',icon:'none'});
    wx.showModal({title:'举报共学内容',editable:true,placeholderText:'请写举报原因',success:async r=>{
      if(r.confirm&&r.content&&r.content.trim()){
        try{await api.call('/report',{target_type:'room',target_id:this.id,reason:r.content});
          wx.showToast({title:'已提交'});}
        catch(e){this.setData({error:e.message});}
      }
    }});
  }
});