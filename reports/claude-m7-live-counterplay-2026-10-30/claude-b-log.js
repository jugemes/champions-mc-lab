'use strict';
const {game,load,hashSeed}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {groups}=require('./environment-m7-teams');
const sim=load(),own=reportedLive();
const [gname,trio,kind,rev]=process.argv.slice(2);
const g=groups.find(x=>x.name===gname);
const reversed=rev==='rev';
const seed=hashSeed(2900000+groups.indexOf(g)*400+(kind==='forcedA'?0:100)+(reversed?50:0));
(async()=>{
const opts={candidatePreviewPolicy:'rational-top',opponentPreviewPolicy:'rational',
 candidateDecisionPolicy:'v3-public-immunity',opponentDecisionPolicy:'v3-public-immunity',
 megaAware:true,opponentForced:g[kind],candidateForced:trio.split('/')};
const m=await game(sim,reversed?g.team:own,reversed?own:g.team,seed,true,null,reversed,opts);
const me=reversed?'p2':'p1';
console.log('WIN',m.winner===(reversed?'opponent':'candidate'),'turns',m.turns,'own side',me);
for(const l of m.log.split('\n'))if(/^\|(move|switch|drag|-damage|-heal|faint|turn|-mega|detailschange|-weather|-boost|-unboost|-status|-crit|-supereffective|-resisted|-immune|-miss|-activate|-enditem|cant|-fail)\|/.test(l))console.log(l);
})();
