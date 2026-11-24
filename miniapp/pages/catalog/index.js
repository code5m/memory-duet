const L=require('../../utils/learning.js'),S=require('../../utils/scene.js'),C=L.C;
Page({
  data:{dimensions:C.DIMENSIONS,index:0,values:['全部'],valueIndex:0,lessons:[],filters:[],count:0,topicId:'',sort:'curated'},
  onShow(){S.learnPage();S.take('catalog');S.sync(this);const topicId=wx.getStorageSync('duetTopicFilter')||'';wx.removeStorageSync('duetTopicFilter');if(topicId){this.facets={topic:[C.topicsById[topicId]?.title].filter(Boolean)};this.setData({topicId});}
    this.refresh();},
  refresh(){
    if(!this.facets)this.facets={};
    const key=C.DIMENSIONS[this.data.index].key;
    const attempts=wx.getStorageSync('duetMiniAttempts')||{};
    const ctx={attempts,saved:{}};
    const values=['全部'].concat(C.facetOptions(L.all(),key,ctx));
    const current=values[this.data.valueIndex]||'全部';
    const lessons=C.filterLessonsMulti(L.all(),{facets:this.facets,sort:this.data.sort},ctx);
    const filters=[];
    Object.keys(this.facets).forEach(k=>{
      const d=C.DIMENSIONS.find(x=>x.key===k);
      this.facets[k].forEach(v=>filters.push({key:k,value:v,label:(d?d.label:k)+'：'+v}));
    });
    this.setData({values,lessons,filters,count:lessons.length,valueIndex:Math.min(this.data.valueIndex,values.length-1)});
  },
  dimensionChange(e){this.setData({index:Number(e.detail.value),valueIndex:0});this.refresh();},
  valueChange(e){
    const idx=Number(e.detail.value),key=C.DIMENSIONS[this.data.index].key,choice=this.data.values[idx];
    if(choice==='全部')delete this.facets[key];
    else{const list=this.facets[key]||[];this.facets[key]=list.includes(choice)?list.filter(v=>v!==choice):list.concat(choice);
      if(!this.facets[key].length)delete this.facets[key];}
    this.setData({valueIndex:idx});this.refresh();
  },
  remove(e){const {key,value}=e.currentTarget.dataset;this.facets[key]=(this.facets[key]||[]).filter(v=>v!==value);
    if(!this.facets[key].length)delete this.facets[key];this.refresh();},
  clear(){this.facets={};this.setData({valueIndex:0,topicId:''});this.refresh();},
  open(e){wx.navigateTo({url:'/pages/lesson/index?id='+encodeURIComponent(e.currentTarget.dataset.id)});}
});