'use strict';
// PR #80 item 6 sensitivity: the same search with n1=12 (more survivors) and
// r2=4 (twice the refine seeds) for two top threats; compare with the default
// n1=8 / r2=2 v2 search. SHOWDOWN_DIR=... node pr80-sensitivity.js
const repo=__dirname;
const {searchPublicSix}=require(repo+'/public-six-general');const {load}=require(repo+'/lab');
const {reportedLive}=require(repo+'/reported-live-roster-20261027');const {caseList}=require(repo+'/legal-search-v2-compare');
const {holdoutSixes}=require(repo+'/holdout-20261031-general');const fs=require('fs');
if(require.main===module)(async()=>{const sim=load(),own=reportedLive(),out={};
 const sixes={C_charizardY:caseList().find(c=>c.id==='C_charizardY').team.map(p=>p.species),HX_rain:holdoutSixes().HX_rain.publicSix};
 for(const [id,six] of Object.entries(sixes)){const s=await searchPublicSix({sim,own,publicSix:six,opts:{n1:12,r2:4,workers:4}});out[id]=s;
  console.log(id,'sec',s.security,'raw',s.raw.security,'mean',s.mean,'games',s.games.total,s.seconds+'s','pure0',s.pure[0].pick,JSON.stringify(s.support.slice(0,4).map(x=>[x.pick,x.p])));}
 fs.writeFileSync(repo+'/reports/data/pr80-search-sensitivity-n1-12-r2-4.json',JSON.stringify(out,null,1));})();
