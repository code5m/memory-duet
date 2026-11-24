const assert=require('node:assert/strict');
const C=require('../web/data/catalog.js');
assert.equal(C.DIMENSIONS.length,30);
assert.equal(C.TOPICS.length,22);
assert.ok(C.LESSONS.length>=40);
assert.equal(new Set(C.DIMENSIONS.map(x=>x.key)).size,30);
assert.equal(new Set(C.LESSONS.map(x=>x.id)).size,C.LESSONS.length);
for(const x of C.LESSONS){assert.ok(C.topicsById[x.topicId],x.id);assert.ok(x.cue&&x.question&&x.answer&&x.method,x.id)}
for(const d of C.DIMENSIONS){
  const options=C.facetOptions(C.LESSONS,d.key,{});
  assert.ok(options.length>0,d.key);
  assert.ok(C.filterLessons(C.LESSONS,{dimension:d.key,value:options[0]},{}).length>0,d.key);
}
const digits=C.LESSONS.find(x=>x.id==='mem-zero');
assert.equal(C.evaluateAnswer(digits,'031427'),true);
assert.equal(C.evaluateAnswer(digits,'31427'),false);
const id=C.LESSONS[0].id;
assert.equal(C.progressState(id,{}),'未开始');
assert.equal(C.progressState(id,{[id]:[{at:new Date().toISOString(),outcome:'incorrect'}]}),'需巩固');
assert.equal(C.progressState(id,{[id]:[{at:new Date().toISOString(),outcome:'prompted-correct'}]}),'提示后答对');
assert.equal(C.progressState(id,{[id]:[{at:'2020-01-01T00:00:00Z',outcome:'independent-correct'}]}),'待复习');
console.log('PASS 30 facets; 22 topics; '+C.LESSONS.length+' lessons');
