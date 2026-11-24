const C=require('../data/catalog.js');require('../data/expansion.js')(C);
const KEY='duetMiniCustomCards';
function custom(){const x=wx.getStorageSync(KEY);return Array.isArray(x)?x:[];}
function all(){return C.LESSONS.concat(custom());}
function one(id){return all().find(x=>x.id===id);}
function create(fields){
  const base=C.LESSONS.find(x=>x.subject===fields.subject)||C.LESSONS[0];
  const card={...base,...fields,aliases:[],photo:'',id:'mini-user-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),
    topicId:'user-works',topic:'我的原创学习卡',icon:'✎',tone:'violet',minutes:3,
    explanation:'这是你创建的本机学习卡；请独立核对知识与参考答案。',goal:'独立回忆',recall:'文字填空',tags:['原创'],source:'本机原创'};
  wx.setStorageSync(KEY,custom().concat(card));return card;
}
module.exports={C,all,one,create,custom};
