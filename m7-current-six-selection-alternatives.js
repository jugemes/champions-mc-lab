#!/usr/bin/env node
'use strict';
/**
 * Strongest counter-hypothesis to a roster change: try better PREDECLARED
 * public-six selections with the current live SIX, without swapping Rotom.
 * Compare equally against Heat Rotom using the SAME public enemy six,
 * forced rival A/B set after selection and p1/p2, with both turn AIs identical.
 * All 5 groups are already synthetic training archetypes, not independent holdout.
 */
const fs=require('node:fs'),path=require('node:path');
const assert=require('node:assert/strict');
const {load,game,hashSeed,normalize}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {groups}=require('./environment-m7-teams');
const {FORMAT}=require('./engine-reference');
const sim=load(),reported=reportedLive(),fingerprint=JSON.stringify(reported);
const cfg={
 '01_M7_golisopod_balance':[
   ['Hydreigon','Metagross','Primarina'],
   ['ROTOM','Metagross','Primarina'],
   ['Metagross','ROTOM','Primarina'],
   ['Primarina','Metagross','Hydreigon']
 ],
 '06_M7_golisopod_basculegion':[
   ['Hydreigon','Metagross','Primarina'],
   ['ROTOM','Metagross','Primarina'],
   ['ROTOM','Metagross','Garchomp'],
   ['Primarina','Metagross','ROTOM']
 ],
 '07_M7_baxcalibur_offense':[
   ['Hydreigon','Metagross','Primarina'],
   ['ROTOM','Metagross','Primarina'],
   ['Metagross','Hydreigon','ROTOM'],
   ['Metagross','Garchomp','Primarina']
 ],
 '02_M7_lucarioZ_offense':[
   ['Garchomp','Metagross','Primarina'],
   ['ROTOM','Metagross','Primarina'],
   ['Hydreigon','Metagross','Primarina'],
   ['Primarina','Metagross','Garchomp']
 ],
 '03_M7_charizardY_offense':[
   ['Tyranitar','Metagross','Hydreigon'],
   ['Tyranitar','Metagross','Primarina'],
   ['Garchomp','Tyranitar','Primarina'],
   ['ROTOM','Tyranitar','Metagross']
 ]
};
function roster(form){
 const team=structuredClone(reported);
 if(form==='heat'){
  const r=team.find(x=>x.species==='Rotom-Wash');
  r.species='Rotom-Heat';
  r.moves=['Overheat','Volt Switch','Thunderbolt','Will-O-Wisp'];
 }
 const failures=sim.TeamValidator.get(FORMAT).validateTeam(normalize(team))||[];
 if(failures.length)throw Error(form+' illegal: '+failures.join('; '));
 return team;
}
function transform(names,form){
 return names.map(n=>n==='ROTOM'?'Rotom-'+(form==='heat'?'Heat':'Wash'):n);
}
async function main(){
 const row=[];
 for(const [groupName,options] of Object.entries(cfg)){
  const group=groups.find(x=>x.name===groupName);
  assert.ok(group,'need original constructed group '+groupName);
  // Set options are fixed solely by the group public six, NOT the forced enemy 3.
  assert.equal(new Set(group.team.map(x=>x.species)).size,6);
  for(const forced of ['forcedA','forcedB'])for(const reversed of [false,true]){
   const foeThree=group[forced],seed=hashSeed(3700000+
    groups.indexOf(group)*200+(forced==='forcedA'?0:100)+(reversed?50:0));
   for(const form of ['wash','heat']){
    const own=roster(form),species=own.map(x=>x.species);
    for(const [rank,baseThree] of options.entries()){
     const trio=transform(baseThree,form);
     if(new Set(trio).size!==3||trio.some(n=>!species.includes(n)))
      throw Error('Invalid public trio: '+trio);
     const opts={megaAware:true,candidatePreviewPolicy:'rational-top',
      opponentPreviewPolicy:'rational',
      candidateDecisionPolicy:'v3-public-immunity',
      opponentDecisionPolicy:'v3-public-immunity',
      candidateForced:trio,opponentForced:foeThree};
     const g=await game(sim,reversed?group.team:own,
      reversed?own:group.team,seed,false,null,reversed,opts);
     if(g.trace.errors.length)throw Error('illegal turn: '+JSON.stringify(g.trace.errors));
     const ourSide=reversed?'p2':'p1',enemySide=reversed?'p1':'p2';
     const sel=g.trace.selections.find(s=>s.side===ourSide),
      enemy=g.trace.selections.find(s=>s.side===enemySide);
     if(!sel||sel.chosen.join('/')!==trio.join('/')||
         !enemy||enemy.chosen.join('/')!==foeThree.join('/'))
      throw Error('hidden opponent three may not influence preview trio');
     row.push({group:groupName,publicSix:group.team.map(x=>x.species),
      form,candidateId:rank,trio,lead:trio[0],
      forcedEnemyThreeAfterwards:foeThree,forcedKind:forced,reversed,seed,
      won:g.winner===(reversed?'opponent':'candidate'),
      turns:g.turns,
      firstOwnMoves:g.trace.choices.filter(c=>c.side===ourSide).slice(0,6),
      firstEnemyMoves:g.trace.choices.filter(c=>c.side===enemySide).slice(0,6)
     });
    }
   }
  }
 }
 if(JSON.stringify(reported)!==fingerprint)throw Error('Live roster mutated');
 const summary=Object.entries(cfg).map(([groupName,options])=>({
  group:groupName,
  candidates:options.map((baseThree,i)=>{
   const obj={rank:i,trioPattern:baseThree,forms:{}};
   for(const form of ['wash','heat']){
    const m=row.filter(x=>x.group===groupName&&x.candidateId===i&&x.form===form);
    obj.forms[form]={wins:m.filter(x=>x.won).length,n:m.length,
      winsVsA:m.filter(x=>x.won&&x.forcedKind==='forcedA').length,
      winsVsB:m.filter(x=>x.won&&x.forcedKind==='forcedB').length};
   }
   return obj;
  })
 }));
 const out={method:'5 pre-used synthetic groups x 4 selected public trios x 2 forced rival 3 x 2 seats x two own forms',summary,row,
  format:FORMAT,engineSHA:'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',
  caveat:'Hypothesis combinations and AI win counters, NOT actual human win rate or independent holdout. Choice of rival 3 is post hoc stress, never read by own selection heuristic. Inspect rational actions.'};
 fs.mkdirSync('output/m7-roster-deltas',{recursive:true});
 fs.writeFileSync(path.join('output/m7-roster-deltas','current-six-selection-alternatives.json'),JSON.stringify(out,null,2));
 console.log('M7_CURRENT_SIX_PREVIEW_ALTERNATIVES '+JSON.stringify(summary));
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
