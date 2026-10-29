#!/usr/bin/env node
'use strict';
/**
 * Audit of PR #42 sections 2-A / 2-E: the claimed "L predeclared triple 4/4".
 * m8-three-roster-compare.js only forced the RIVAL three, so it never tested those
 * own triples; this script forces them (candidateForced) on the unchanged live six.
 * Seeds follow m7-predeclared-triples-stress.js. Constructed bot diagnostic only.
 */
const fs=require('node:fs'),path=require('node:path');
const {game,load,hashSeed,normalize}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {groups}=require('./environment-m7-teams');
const {FORMAT}=require('./engine-reference');
const sim=load(),own=reportedLive(),fingerprint=JSON.stringify(own);
const errors=sim.TeamValidator.get(FORMAT).validateTeam(normalize(own))||[];
if(errors.length)throw Error(errors.join('; '));
const claims=[
 {claim:'2-A L',group:'01_M7_golisopod_balance',trio:['Primarina','Metagross','Hydreigon']},
 {claim:'2-E L',group:'02_M7_lucarioZ_offense',trio:['Garchomp','Metagross','Primarina']}
];
async function main(){
 const rows=[];
 for(const c of claims){
  const g=groups.find(x=>x.name===c.group);
  for(const forcedKind of ['forcedA','forcedB'])for(const reversed of [false,true]){
   const seed=hashSeed(2900000+groups.indexOf(g)*400+(forcedKind==='forcedA'?0:100)+(reversed?50:0));
   const opts={candidatePreviewPolicy:'rational-top',opponentPreviewPolicy:'rational',
    candidateDecisionPolicy:'v3-public-immunity',opponentDecisionPolicy:'v3-public-immunity',
    megaAware:true,opponentForced:g[forcedKind],candidateForced:c.trio};
   const m=await game(sim,reversed?g.team:own,reversed?own:g.team,seed,false,null,reversed,opts);
   if(m.trace.errors.length)throw Error(JSON.stringify(m.trace.errors));
   rows.push({claim:c.claim,group:c.group,ownThree:c.trio,rivalThreePosthoc:g[forcedKind],
    forcedKind,reversed,seed,won:m.winner===(reversed?'opponent':'candidate'),turns:m.turns});
  }
 }
 if(JSON.stringify(own)!==fingerprint)throw Error('live six changed');
 const summary=claims.map(c=>{const r=rows.filter(x=>x.claim===c.claim);
  return {claim:c.claim,trio:c.trio.join('/'),wins:r.filter(x=>x.won).length,n:r.length,
   detail:r.map(x=>x.forcedKind+(x.reversed?'/rev':'/fwd')+':'+(x.won?'W':'L')+'@T'+x.turns)};});
 fs.mkdirSync('output/m8-three-roster',{recursive:true});
 fs.writeFileSync('output/m8-three-roster/live-predeclared-check.json',JSON.stringify({format:FORMAT,summary,rows},null,2));
 console.log('M8_LIVE_PREDECLARED '+JSON.stringify(summary));
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
