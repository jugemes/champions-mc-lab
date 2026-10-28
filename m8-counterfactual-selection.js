#!/usr/bin/env node
'use strict';
/**
 * A disciplined retrospective upper-bound stress test, NOT an opponent
 * hidden-three-informed preview policy. Each proposed own trio/lead is fixed
 * BEFORE choosing which opponent forced triple is actually played.
 * We compare across BOTH rival triples and both player sides and keep all
 * conditions, rather than exploiting an oracle that sees the unseen three.
 */
const fs=require('node:fs'),path=require('node:path');
const {load,game,hashSeed}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {rankRationalPreview}=require('./preview-rational');
const {groups}=require('./environment-m7-teams');
const sim=load(),ownSix=reportedLive();
const focus=[
 '01_M7_golisopod_balance','03_M7_charizardY_offense',
 '06_M7_golisopod_basculegion','07_M7_baxcalibur_offense'
];
const presets=[
 ['Hydreigon','Metagross','Primarina'],
 ['Hydreigon','Garchomp','Tyranitar'],
 ['Metagross','Primarina','Garchomp'],
 ['Tyranitar','Hydreigon','Metagross'],
 ['Rotom-Wash','Hydreigon','Primarina']
];
function treatments(group){
 const top=rankRationalPreview(sim.Dex.mod('champions'),ownSix,
  group.team.map(x=>x.species))[0];
 const baseline=[...top.leads.slice(0,1).map(l=>ownSix[l.i].species),
  ...top.three.filter(i=>i!==top.leads[0].i).map(i=>ownSix[i].species)];
 const combos=[baseline,...presets],seen=new Set(),out=[];
 for(const c of combos){
  if(c.length!==3||new Set(c).size!==3||
    c.some(s=>!ownSix.some(p=>p.species===s)))throw Error('Bad own trio');
  const key=[...c].sort().join('/');
  if(seen.has(key))continue;
  seen.add(key);
  for(const lead of c){
   out.push({three:[lead,...c.filter(x=>x!==lead)],
    source:c===baseline?'rational-top-public-six':'preregistered-synergy-trio',
    baselineThree:baseline});
  }
 }
 return out;
}
async function run(){
 const records=[];
 for(const name of focus){
  const g=groups.find(x=>x.name===name);
  for(const trio of treatments(g)){
   for(const kind of ['forcedA','forcedB'])for(const reverse of [false,true]){
    const idx=groups.indexOf(g);
    const seed=hashSeed(1500000+(idx*4+['forcedA','forcedB'].indexOf(kind)*2+
      Number(reverse))*37);
    const opts={megaAware:true,
      candidatePreviewPolicy:'rational-top',
      opponentPreviewPolicy:'rational',
      candidateDecisionPolicy:'v3-public-immunity',
      opponentDecisionPolicy:'v3-public-immunity',
      candidateForced:trio.three,opponentForced:g[kind]};
    const match=await game(sim,reverse?g.team:ownSix,reverse?ownSix:g.team,
      seed,false,null,reverse,opts);
    if(match.trace.errors.length)throw Error('Illegal choice '+name+
      ': '+JSON.stringify(match.trace.errors));
    const ownSide=reverse?'p2':'p1',enemySide=reverse?'p1':'p2';
    const ourSelection=match.trace.selections.find(x=>x.side===ownSide);
    const theirSelection=match.trace.selections.find(x=>x.side===enemySide);
    if(ourSelection.chosen.join('/')!==trio.three.join('/'))
      throw Error('Candidate forced treatment was not respected');
    if(theirSelection.chosen.join('/')!==g[kind].join('/'))
      throw Error('Enemy forced selection mismatch');
    records.push({
     group:name,opponentPublicSix:g.team.map(x=>x.species),
     assumedEnemyThreeAfterwards:g[kind],
     opponentForcedKind:kind,reverse,seed,ourThree:trio.three,
     trioSource:trio.source,
     baselineThree:trio.baselineThree,
     won:match.winner===(reverse?'opponent':'candidate'),
     turns:match.turns,
     ownImmuneObserved:match.trace.immuneObservations
       .filter(x=>x.side===ownSide).length,
     foeImmuneObserved:match.trace.immuneObservations
       .filter(x=>x.side===enemySide).length
    });
   }
  }
 }
 const boards=[];
 for(const name of focus){
  const g=groups.find(x=>x.name===name);
  const keyer=x=>x.ourThree.slice().sort().join('/');
  const byTrio=new Map();
  for(const r of records.filter(x=>x.group===name)){
   const key=keyer(r);
   if(!byTrio.has(key))byTrio.set(key,{three:[...r.ourThree].sort(),
     byLead:new Map(),sumWins:0,matchups:0});
   const rec=byTrio.get(key),lead=r.ourThree[0];
   if(!rec.byLead.has(lead))rec.byLead.set(lead,{lead,forcedA:0,forcedB:0,n:0,
     wins:0});
   const lr=rec.byLead.get(lead);
   lr[r.opponentForcedKind]+=Number(r.won);
   lr.wins+=Number(r.won);lr.n++;rec.sumWins+=Number(r.won);rec.matchups++;
  }
  const assessment=[...byTrio.values()].flatMap(t=>
   [...t.byLead.values()].map(x=>({three:t.three,lead:x.lead,
    winFixedA:x.forcedA,winFixedB:x.forcedB,scenarios:x.n,
    total:x.wins,weakestPattern:Math.min(x.forcedA,x.forcedB)})));
  assessment.sort((a,b)=>b.weakestPattern-a.weakestPattern||
    b.total-a.total||a.lead.localeCompare(b.lead));
  boards.push({group:name,publicSix:g.team.map(x=>x.species),
    baseline:treatments(g)[0],trioAndLeadCandidates:assessment,
    allEnemyThreeAlternatives:[g.forcedA,g.forcedB],
    warning:'No preview may know the actual enemy 3. This is a retrospective set of stress-tested fixed treatments, not a newly trained selector.'});
  console.log('M8_TREATMENT_GROUP '+JSON.stringify({
   group:name,baseline:treatments(g)[0],top:assessment.slice(0,8)
  }));
 }
 const dir=path.join('output','m8-preseason');fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'counterfactual-selections.json'),
  JSON.stringify({tested:records.length,records,boards},null,2));
 const summary={tested:records.length,groups:boards.map(x=>({
  name:x.group,top:x.trioAndLeadCandidates.slice(0,4),
  baseline:x.baseline
 })),message:'Retrospective synthetic test of preset trios vs both opponent triples and side orders. Not a human-ladder winner prediction.'};
 console.log('M8_TREATMENT_SUMMARY '+JSON.stringify(summary));
}
if(require.main===module)run().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={treatments,presets,focus};
