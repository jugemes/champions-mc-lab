// PR 43 audit: Showdown getDamage single-sample table for report P0-1
const {load}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const A=require('./hybrid01-audit');
const {engineDamageSample}=require('./engine-reference');
const {groups}=require('./environment-m7-teams');
const sim=load();
const live=reportedLive();
const sk=A.set('Skeledirge','Rocky Helmet','Unaware','Bold',{hp:32,def:32,spd:2},['Torch Song','Shadow Ball','Will-O-Wisp','Slack Off']);
const s=structuredClone(live);s[s.findIndex(x=>x.species==='Hydreigon')]=sk;
const cases=[];
for(const g of groups){const foe=g.team;
 for(const f of foe){ const own=f.species; const mv=f.moves.filter(m=>['Earthquake','Shadow Claw','Sucker Punch','Shadow Sneak','Rock Slide','Play Rough','Stone Edge','Liquidation','Waterfall','Scald','Surf','Hydro Pump','Knock Off','Crunch','Dark Pulse','Shadow Ball'].includes(m));
  for(const m of mv){cases.push([g.name,own,m,foe])}}}
const seen=new Set();
for(const [gn,own,m,foe] of cases){ const k=own+m; if(seen.has(k))continue; seen.add(k);
 for(const [lab,team,tgt] of [['S',s,'Skeledirge'],['L',live,'Rotom-Wash'],['L',live,'Hydreigon']]){
  try{
   // our six = foe team here (attacker), opponent six = our team (defender)
   const r=engineDamageSample(sim,groups.find(g=>g.name===gn).team,team,{ourLead:own,opponentLead:tgt,move:m});
   console.log(lab,own,m,'->',tgt,r.rawDamage+'/'+r.opponentMaxHP,(r.fraction*100).toFixed(0)+'%',r.immune?'immune':'');
  }catch(e){console.log('ERR',own,m,tgt,e.message.slice(0,80))}
 }}
