const assert=require('node:assert/strict');
const C=require('../web/data/catalog.js');
require('../web/data/expansion.js')(C);
assert.equal(C.DIMENSIONS.length,30);
assert.equal(C.TOPICS.length,26);
assert.equal(C.LESSONS.length,122);
const ids=C.LESSONS.map(x=>x.id);
assert.equal(new Set(ids).size,ids.length,'Every learning card needs a stable unique ID');
const subjects=new Set(C.TOPICS.map(x=>x.subject));
assert.ok(subjects.size>=10,'Subject coverage');
const chapterIDs=[];
for(const topic of C.TOPICS){
  const chapters=C.getTopicChapters(topic.id);
  assert.ok(chapters.length>=1,topic.id);
  const lessonIDs=chapters.flatMap(c=>c.lessonIds);
  assert.equal(new Set(lessonIDs).size,lessonIDs.length,topic.id+' should not duplicate lesson IDs');
  for(const lessonId of lessonIDs){
    assert.ok(ids.includes(lessonId),topic.id+' missing '+lessonId);
    assert.equal(C.LESSONS.find(x=>x.id===lessonId).topicId,topic.id);
  }
  chapterIDs.push(...chapters.map(x=>x.id));
}
assert.equal(new Set(chapterIDs).size,chapterIDs.length);
for(const x of C.LESSONS){
  assert.ok(C.topicsById[x.topicId],x.id+' topic');
  for(const key of ['title','cue','question','answer','explanation','method','goal'])
    assert.ok(x[key],x.id+' '+key);
  assert.ok(C.evaluateAnswer(x,x.answer),x.id+' reference answer');
  assert.ok(x.minutes>0);
}
for(const d of C.DIMENSIONS){
  const choices=C.facetOptions(C.LESSONS,d.key,{saved:{},attempts:{}});
  assert.ok(choices.length>0,d.key);
  const found=C.filterLessonsMulti(C.LESSONS,{facets:{[d.key]:[choices[0]]}},{saved:{},attempts:{}});
  assert.ok(found.length>0,d.key);
}
const withEnglish=C.filterLessonsMulti(C.LESSONS,{facets:{subject:['英语']}},{});
assert.ok(withEnglish.length>=12);
assert.ok(withEnglish.every(x=>x.subject==='英语'));
const cross=C.filterLessonsMulti(C.LESSONS,{facets:{subject:['英语'],method:['组块']}},{});
assert.ok(cross.length>0);
assert.ok(cross.every(x=>x.subject==='英语'&&x.method==='组块'));
const union=C.filterLessonsMulti(C.LESSONS,{facets:{subject:['英语','数学']}},{});
assert.ok(union.length>withEnglish.length);
assert.ok(union.every(x=>['英语','数学'].includes(x.subject)));
const empty=C.filterLessonsMulti(C.LESSONS,{facets:{subject:['不存在的学科']}},{});
assert.equal(empty.length,0);
const facetCounts=C.facetCountMap(C.LESSONS,'method',{facets:{subject:['英语']}},{});
assert.ok(facetCounts['组块']>0);
const numeric=['mem-zero','mem-double-zero','mem-pairs','mem-reverse'];
for(const id of numeric){
  const x=C.LESSONS.find(x=>x.id===id);
  assert.ok(x);
  assert.equal(C.evaluateAnswer(x,x.answer),true);
  assert.ok(!x.question.includes(x.answer),'Numeric recall question leaks answer: '+id);
}
assert.equal(C.evaluateAnswer(C.LESSONS.find(x=>x.id==='mem-zero'),'31427'),false);
assert.equal(C.filterLessonsMulti(C.LESSONS,{search:'lend'},{}).length>0,true);
console.log('PASS: '+C.DIMENSIONS.length+' facets, '+C.TOPICS.length+' topics, '+C.LESSONS.length+' distinct learning cards');
