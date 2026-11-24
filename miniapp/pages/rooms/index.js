const S=require('../../utils/scene.js');
const api=require('../../utils/community.js');
Page({
  data:{rooms:[],guest:null,error:'',compose:false,title:'',question:'',hint:'',answer:'',subject:'记忆训练'},
  onShow(){S.socialPage();this.load();},
  async load(){
    try{const [rooms,who]=await Promise.all([api.call('/rooms'),api.call('/me')]);this.setData({rooms:rooms.items||[],guest:who.guest,error:''});}
    catch(e){this.setData({error:e.message});}
  },
  createToggle(){if(!this.data.guest)return wx.showToast({title:'先到交友页填写游客昵称',icon:'none'});
    this.setData({compose:!this.data.compose});},
  field(e){this.setData({[e.currentTarget.dataset.key]:e.detail.value});},
  async createRoom(){
    try{const r=await api.call('/rooms',{title:this.data.title,subject:this.data.subject,
      question:this.data.question,hint:this.data.hint,answer:this.data.answer});
      this.setData({compose:false,title:'',question:'',hint:'',answer:''});
      wx.navigateTo({url:'/pages/room/index?id='+r.id});
    }catch(e){this.setData({error:e.message});}
  },
  openRoom(e){wx.navigateTo({url:'/pages/room/index?id='+e.currentTarget.dataset.id});}
});