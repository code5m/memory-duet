const api=require('../../utils/community.js');
Page({
  data:{item:null,replies:[],error:'',text:'',method:'',guest:null},
  onLoad(o){this.id=o.id||'';this.load();},
  onShow(){this.load();},
  async load(){
    if(!this.id)return;
    try{const [d,m]=await Promise.all([api.call('/bottles/'+encodeURIComponent(this.id)),api.call('/me')]);
      this.setData({item:{...d.item,kindText:d.item.kind==='hard'?'太难记漂流瓶':'记忆秘诀瓶'},
        replies:d.replies||[],guest:m.guest,error:''});
      wx.setNavigationBarTitle({title:d.item.title.slice(0,20)});
    }catch(e){this.setData({error:e.message});}
  },
  requireGuest(){if(this.data.guest)return true;wx.showToast({title:'先到交友页输入昵称',icon:'none'});return false;},
  input(e){this.setData({[e.currentTarget.dataset.key]:e.detail.value});},
  async reply(){
    if(!this.requireGuest())return;
    try{await api.call('/replies',{bottle_id:this.id,content:this.data.text,method:this.data.method});
      this.setData({text:'',method:''});this.load();}
    catch(e){this.setData({error:e.message});}
  },
  async reaction(e){
    if(!this.requireGuest())return;
    try{await api.call('/reaction',{target_type:e.currentTarget.dataset.type||'bottle',
      target_id:e.currentTarget.dataset.id||this.id,kind:e.currentTarget.dataset.kind});
      this.load();}
    catch(e){this.setData({error:e.message});}
  },
  async best(e){
    if(!this.requireGuest())return;
    try{await api.call('/best',{reply_id:e.currentTarget.dataset.id});this.load();}
    catch(err){this.setData({error:err.message});}
  },
  openAuthor(e){wx.navigateTo({url:'/pages/partner/index?id='+e.currentTarget.dataset.id});},
  async report(e){
    if(!this.requireGuest())return;
    wx.showModal({title:'举报内容',editable:true,placeholderText:'请描述原因',success:async r=>{
      if(r.confirm&&r.content&&r.content.trim()){
        try{await api.call('/report',{target_type:e.currentTarget.dataset.type||'bottle',
          target_id:e.currentTarget.dataset.id||this.id,reason:r.content});wx.showToast({title:'举报已提交'});}
        catch(err){this.setData({error:err.message});}
      }
    }});
  }
});