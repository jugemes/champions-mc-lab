'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {BASELINE,PINNED,relevantPath,lastBaseline,summarizeDiff,reviewUpstream}=
  require('../scripts/showdown-upstream-watch');
const next='a'.repeat(40);
const other='b'.repeat(40);
function mockGitHub({sha=next,comments=[],status='ahead',files=[],ahead_by=2,
                  respond=200}={}){
 const posts=[];
 const fetcher=async(url,request)=>{
  const path=url.replace('https://api.github.com','');
  let data;
  if(path==='/repos/smogon/pokemon-showdown/commits/master')data={sha};
  else if(path.includes('/issues/20/comments?'))data=comments;
  else if(path.startsWith('/repos/smogon/pokemon-showdown/compare/'))
    data={status,ahead_by,files};
  else if(path==='/repos/jugemes/champions-mc-lab/issues/20/comments'&&request.method==='POST'){
    posts.push(JSON.parse(request.body).body);
    data={id:123};
  }
  else throw Error('unexpected API URL '+path);
  return {ok:respond===200,status:respond,json:async()=>data,text:async()=>'error'};
 };
 return {fetcher,posts};
}
test('known mechanical paths are classified; UI changes are ignored',()=>{
 assert.equal(relevantPath('data/mods/champions/abilities.ts'),'champions-direct');
 assert.equal(relevantPath('data/mods/championsregmb/items.ts'),'champions-direct');
 assert.equal(relevantPath('sim/battle-actions.ts'),'engine-review');
 assert.equal(relevantPath('data/moves.ts'),'shared-mechanics');
 assert.equal(relevantPath('server/chat.ts'),null);
});
test('old saved head comes only from authenticated Issue comment marker',()=>{
 const text='<!-- showdown-upstream-reviewed-head:'+other+' -->';
 assert.equal(lastBaseline([{body:'unrelated'},{body:text,user:{login:'github-actions[bot]'}}]),other);
 assert.equal(lastBaseline([{body:'unrelated'}]),BASELINE);
});
test('no change does not create an Issue comment',async()=>{
 const g=mockGitHub({sha:BASELINE});
 const x=await reviewUpstream({token:'fake',repository:'jugemes/champions-mc-lab',fetcher:g.fetcher});
 assert.equal(x.status,'unchanged');assert.equal(g.posts.length,0);
});
test('unrelated changes produce no Issue comment',async()=>{
 const g=mockGitHub({files:[{filename:'server/chat.ts',status:'modified'}]});
 const x=await reviewUpstream({token:'fake',repository:'jugemes/champions-mc-lab',fetcher:g.fetcher});
 assert.equal(x.status,'no-mechanics-diff');assert.equal(g.posts.length,0);
});
test('new mechanics diff is written once, without changing pinned SHA',async()=>{
 const files=[{filename:'data/mods/champions/items.ts',status:'modified'},
  {filename:'server/chat.ts',status:'modified'}];
 const g=mockGitHub({files});
 const x=await reviewUpstream({token:'fake',repository:'jugemes/champions-mc-lab',fetcher:g.fetcher});
 assert.equal(x.status,'recorded');assert.equal(g.posts.length,1);
 assert.match(g.posts[0],/champions\/items\.ts/);
 assert.ok(g.posts[0].includes(PINNED));
 const nextRun=mockGitHub({files,comments:[{body:g.posts[0],user:{login:'github-actions[bot]'}}]});
 const y=await reviewUpstream({token:'fake',repository:'jugemes/champions-mc-lab',fetcher:nextRun.fetcher});
 assert.equal(y.status,'unchanged');assert.equal(nextRun.posts.length,0);
});
test('large diff fails closed and flags incomplete GitHub comparison',async()=>{
 const g=mockGitHub({ahead_by:301,files:[]});
 const x=await reviewUpstream({token:'fake',repository:'jugemes/champions-mc-lab',fetcher:g.fetcher});
 assert.equal(x.status,'recorded');assert.equal(x.needsReview,true);
 assert.match(g.posts[0],/手動検収必須/);
});
test('GitHub API denial is not converted to no updates',async()=>{
 const g=mockGitHub({respond:403});
 await assert.rejects(()=>reviewUpstream({
   token:'fake',repository:'jugemes/champions-mc-lab',fetcher:g.fetcher
 }),/GitHub API .* 403/);
});
