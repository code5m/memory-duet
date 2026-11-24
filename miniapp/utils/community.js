const config=require('../config.js');
const KEY='duetGuestToken';
function token(){return wx.getStorageSync(KEY)||'';}
function configured(){return /^https:\/\/[^/]+/.test(config.baseUrl);}
function call(route,body){
  return new Promise((resolve,reject)=>{
    if(!configured()){reject(Error('请先在 miniapp/config.js 配置已部署的 HTTPS 社区域名'));return;}
    wx.request({
      url:config.baseUrl+'/api/community'+route,
      method:body?'POST':'GET',
      timeout:12000,
      data:body||{},
      header:{'Content-Type':'application/json',...(token()?{'Authorization':'Bearer '+token()}:{})},
      success:r=>{
        if(r.statusCode>=200&&r.statusCode<300&&r.data&&r.data.ok)resolve(r.data);
        else reject(Error(r.data&&r.data.error||'请求失败'));
      },
      fail:e=>reject(Error(e.errMsg||'无法连接社区'))
    });
  });
}
function saveGuest(t){wx.setStorageSync(KEY,t);}
function clearGuest(){wx.removeStorageSync(KEY);}
module.exports={call,token,saveGuest,clearGuest,configured};
