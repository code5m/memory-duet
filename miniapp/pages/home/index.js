const L=require('../../utils/learning.js'),S=require('../../utils/scene.js'),C=L.C;
Page({
  data:{mode:'mixed',topics:C.TOPICS,dimensions:C.DIMENSIONS.length,lessons:0,last:null,due:0},
  onShow(){
    const mode=S.get();if(mode==='social'){S.go('social','feed');return;}
    S.take('home');S.sync(this);
    const last=L.one(wx.getStorageSync('duetLastLesson')),attempts=wx.getStorageSync('duetMiniAttempts')||{};
    const due=L.all().filter(x=>['待复习','需巩固','提示后答对'].includes(C.progressState(x.id,attempts))).length;
    this.setData({mode,lessons:L.all().length,last:last||null,due});
  },
  catalog(){S.go('catalog');},social(){S.choose('social');},learn(){S.choose('learn');},review(){S.go('review');},
  create(){wx.navigateTo({url:'/pages/create/index'});},
  resume(){if(this.data.last)wx.navigateTo({url:'/pages/lesson/index?id='+encodeURIComponent(this.data.last.id)});},
  openTopic(e){wx.setStorageSync('duetTopicFilter',e.currentTarget.dataset.id);S.go('catalog');}
});