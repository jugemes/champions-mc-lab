'use strict';
// replay one part1 game of claude-m7-live-counterplay.js with full log
const {game,load,hashSeed}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {groups}=require('./environment-m7-teams');
const sim=load(),own=reportedLive();
const [gname,trio,foe,rev,s]=process.argv.slice(2);
const g=groups.find(x=>x.name===gname),reversed=rev==='rev';
const seed=hashSeed(4500000+groups.indexOf(g)*1000+Number(s)*10+(reversed?5:0));
(async()=>{
const opts={candidatePreviewPolicy:'rational-top',opponentPreviewPolicy:'rational',
 candidateDecisionPolicy:'v3-public-immunity',opponentDecisionPolicy:'v3-public-immunity',
 megaAware:true,opponentForced:foe.split('/'),candidateForced:trio.split('/')};
const m=await game(sim,reversed?g.team:own,reversed?own:g.team,seed,true,null,reversed,opts);
console.log('WIN',m.winner===(reversed?'opponent':'candidate'),'turns',m.turns,'own',reversed?'p2':'p1');
for(const l of m.log.split('\n'))if(/^\|(move|switch|drag|-damage|-heal|faint|turn|-mega|-weather|-boost|-status|-crit|-immune|-miss|-activate|cant|-fail)\|/.test(l))console.log(l.replace(/\|\[from\].*$/,m=>m.slice(0,40)));
})();
