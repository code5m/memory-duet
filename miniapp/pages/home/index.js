const C=require('../../data/catalog.js');require('../../data/expansion.js')(C);
Page({data:{topics:C.TOPICS,dimensions:C.DIMENSIONS.length,lessons:C.LESSONS.length},
  catalog(){wx.switchTab({url:'/pages/catalog/index'});},
  social(){wx.switchTab({url:'/pages/social/index'});},
  openTopic(e){wx.setStorageSync('duetTopicFilter',e.currentTarget.dataset.id);wx.switchTab({url:'/pages/catalog/index'});}
});