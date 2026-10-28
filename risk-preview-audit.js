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
}
main().catch(e=>{console.error(e.stack||String(e));process.exitCode=1;});
