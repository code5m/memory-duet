const L=require('../../utils/learning.js'),S=require('../../utils/scene.js');
Page({data:{title:'',subject:'其他学习',method:'组块',cue:'',question:'',answer:'',fromSecret:false},onLoad(){
  S.learnPage();
  const d=wx.getStorageSync('duetCreateDraft');wx.removeStorageSync('duetCreateDraft');
  if(d)this.setData({title:String(d.title||'').slice(0,65),subject:String(d.subject||'其他学习').slice(0,40),method:String(d.method||'组块').slice(0,60),cue:String(d.cue||'').slice(0,1200),fromSecret:true});
},field(e){this.setData({[e.currentTarget.dataset.key]:e.detail.value});},save(){
  const fields={};for(const k of ['title','subject','method','cue','question','answer'])fields[k]=String(this.data[k]||'').trim();
  if(Object.values(fields).some(x=>!x))return wx.showToast({title:'请核实并填写所有字段',icon:'none'});
  const card=L.create(fields);
  wx.redirectTo({url:'/pages/lesson/index?id='+encodeURIComponent(card.id)});
}});