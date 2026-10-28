#!/usr/bin/env node
'use strict';
// P0-B2 paired / inspectable, not ladder win rates.
const {load,game,hashSeed}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {opponents}=require('./threat-scenarios-20261014');
const {comparePreviewDistributions,previewThreat,MODEL}=require('./preview-risk');
const FORMAT='gen9championsbssregmc';
const sim=load(),dex=sim.Dex.mod('champions'),validator=sim.TeamValidator.get(FORMAT);
const live=reportedLive();
const cases={
  'Real-B public six / our live six':{
    ours:live,six:['Indeedee','Hippowdon','Garchomp','Umbreon','Gengar','Gyarados']},
  'Psychic terrain stress / our live six':{
    ours:live,six:opponents.psychic_terrain_singles.map(x=>x.species)},
  'Mega-Y hypothesis vs our live public six':{
    ours:opponents.sun_charizard_y,six:live.map(x=>x.species)},
  'Our live six vs sunny threat six':{
    ours:live,six:opponents.sun_charizard_y.map(x=>x.species)}
};
async function main(){
 console.log('RISK PREVIEW AUDIT (hypotheses; no unrevealed rival sets are passed to preview)');
 console.log('Showdown pinned: 3a766f2cfb5e51c1e428cfe87d0dba91a8f01640');
 console.log('MODEL SENSITIVITY (NOT an estimated item/move use rate): '+JSON.stringify(MODEL));
 for(const [name,entry] of Object.entries(cases)){
  const compared=comparePreviewDistributions(dex,entry.ours,entry.six,validator);
  const round=x=>Object.fromEntries(Object.entries(x).map(([k,v])=>[k,Math.round(100*v)/100]));
  console.log('CASE '+name);
  console.log(' LEAD old='+JSON.stringify(round(compared.old.lead))+
    ' opt-in='+JSON.stringify(round(compared.risk.lead)));
  console.log(' THREE old='+JSON.stringify(compared.old.top.slice(0,2))+
    ' opt-in='+JSON.stringify(compared.risk.top.slice(0,2)));
 }
 const hyd=live.find(x=>x.species==='Hydreigon');
 const y=opponents.sun_charizard_y.find(x=>x.species==='Charizard');
 console.log('PROBE Indeedee -> own Hydreigon '+JSON.stringify(previewThreat(dex,hyd,'Indeedee',validator)));
 console.log('PROBE Garchomp -> own Mega-Charizard-Y '+JSON.stringify(previewThreat(dex,y,'Garchomp',validator)));
 // Evaluate choices and outcomes under a *separately fixed* plausible three:
 // the rival is not claimed to have selected these based on human reasoning.
 const foe=opponents.psychic_terrain_singles,forced=['Indeedee','Gengar','Dragonite'];
 let oldWins=0,newWins=0;
 const oldLeads=[],newLeads=[];
 for(let i=0;i<6;i++){
  const seed=hashSeed(13370+i);
  const common={decisionPolicy:'v2',megaAware:true,opponentForced:forced,
    opponentPreviewPolicy:'rational'};
  const a=await game(sim,live,foe,seed,false,null,false,
    {...common,candidatePreviewPolicy:'rational'});
  const b=await game(sim,live,foe,seed,false,null,false,
    {...common,candidatePreviewPolicy:'rational-risk'});
  oldWins+=Number(a.winner==='candidate');newWins+=Number(b.winner==='candidate');
  const own=t=>t.selections.find(x=>x.side==='p1');
  oldLeads.push(own(a.trace));newLeads.push(own(b.trace));
  if(a.trace.errors.length||b.trace.errors.length)throw Error('Bot selection/choice error');
 }
 console.log('PAIRED FIXED THREE '+JSON.stringify({forced,seedStart:13370,n:6,
  oldWins,newWins,oldLeads,newLeads,
  warning:'Fixed synthetic opponent three, known hypothesis sets. Does NOT show ladder win rates.'}));
 // Compare lead preferences *conditional on the exact three chosen by the
 // user in real case B (Hydreigon / Metagross / Rotom-Wash). Neither policy
 // is allowed to know the opponent's hidden three at preview.
 const {rankRationalPreview,SAMPLE}=require('./preview-rational');
 const {rankRationalRisk}=require('./preview-risk');
 const publicB=cases['Real-B public six / our live six'].six;
 const desired=['Metagross','Hydreigon','Rotom-Wash'];
 const conditional=ranked=>{
  const c=ranked.find(x=>desired.every(name=>x.three.some(i=>live[i].species===name)));
  if(!c)throw Error('real B chosen three not found');
  const leads=c.leads.filter(l=>l.score>=c.leads[0].score-SAMPLE.leadRange);
  const w=leads.map(l=>Math.exp((l.score-leads[0].score)/SAMPLE.leadTemperature));
  const total=w.reduce((a,b)=>a+b,0);
  return {teamScore:+c.score.toFixed(2),
    leads:leads.map((l,j)=>({species:live[l.i].species,prob:+(w[j]/total).toFixed(3),
      score:+l.score.toFixed(1),riskPenalty:+(l.riskAdjustment||0).toFixed(2)}))};
 };
 console.log('REAL B FIXED OWN THREE '+JSON.stringify({ownThree:desired,
   historical:conditional(rankRationalPreview(dex,live,publicB)),
   risk:conditional(rankRationalRisk(dex,live,publicB,validator))}));

 // Counterexample: one plausible opponent 3 brings the *known* live Scarf
 // Garchomp. The model is still only given the opposing public 6 to decide.
 const sunTeam=opponents.sun_charizard_y;
 const forcedLive=['Garchomp','Tyranitar','Primarina'];
 let winsOld=0,winsRisk=0;
 const leadsOld=[],leadsRisk=[];
 for(let i=0;i<6;i++){
  const seed=hashSeed(14000+i);
  const common={opponentForced:forcedLive,opponentPreviewPolicy:'rational',
    decisionPolicy:'v2',megaAware:true};
  const a=await game(sim,sunTeam,live,seed,false,null,false,
    {...common,candidatePreviewPolicy:'rational'});
  const b=await game(sim,sunTeam,live,seed,false,null,false,
    {...common,candidatePreviewPolicy:'rational-risk'});
  winsOld+=Number(a.winner==='candidate');winsRisk+=Number(b.winner==='candidate');
  leadsOld.push(a.trace.selections.find(x=>x.side==='p1')?.lead);
  leadsRisk.push(b.trace.selections.find(x=>x.side==='p1')?.lead);
  if(a.trace.errors.length||b.trace.errors.length)throw Error('Bot error in Mega-Y counterexample');
 }
 console.log('MEGA-Y RISK COUNTEREXAMPLE '+JSON.stringify({ourHypothesis:'sun_charizard_y',
  enemyRealLivePublicSix:true,forcedOpponentThree:forcedLive,n:6,
  oldWins:winsOld,riskWins:winsRisk,oldLeads:leadsOld,riskLeads:leadsRisk,
  warning:'The fixture sets and chosen enemy 3 are hypothetical. Not ladder outcomes.'}));

}
main().catch(e=>{console.error(e.stack||String(e));process.exitCode=1;});
