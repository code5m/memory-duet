const L=require('../../utils/learning.js'),S=require('../../utils/scene.js'),C=L.C;
Page({data:{due:[],later:[],attempts:0},onShow(){
  S.learnPage();S.take('review');S.sync(this);
  const attempts=wx.getStorageSync('duetMiniAttempts')||{};
  const practiced=L.all().filter(x=>(attempts[x.id]||[]).length).map(x=>({...x,status:C.progressState(x.id,attempts)}));
  this.setData({due:practiced.filter(x=>['待复习','需巩固','提示后答对'].includes(x.status)),later:practiced.filter(x=>x.status==='已练习'),attempts:Object.values(attempts).reduce((n,a)=>n+a.length,0)});
},open(e){wx.navigateTo({url:'/pages/lesson/index?id='+encodeURIComponent(e.currentTarget.dataset.id)});},catalog(){S.go('catalog');}});