#!/usr/bin/env node
'use strict';
// Claude independent audit A (Issue #13 / launch PR #18): why did rational and
// rational-risk match in all 42 conditions? Uses only own six + public rival species.
const {load}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {groups}=require('./environment-m7-teams');
const {rankRationalPreview,selectionDistribution}=require('./preview-rational');
const {rankRationalRisk,riskMatrix,PROBES}=require('./preview-risk');
const sim=load(),dex=sim.Dex.mod('champions'),validator=sim.TeamValidator.get('gen9championsbssregmc');
const own=reportedLive();
const out=[];
let nonzeroCells=0,cells=0;
for(const g of groups){
  const six=g.team.map(p=>p.species);
  const old=rankRationalPreview(dex,own,six);
  const risk=rankRationalRisk(dex,own,six,validator);
  const m=riskMatrix(dex,own,six,validator);
  let nz=0,tot=0;const nzList=[];
  for(const [k,row] of Object.entries(m))row.forEach(r=>{tot++;if(r.penalty>0){nz++;nzList.push(`${own[k.split(':')[0]].species}${k.endsWith('true')?'(M)':''}<-${r.foe}:${r.penalty.toFixed(1)}`);}});
  nonzeroCells+=nz;cells+=tot;
  const probed=six.filter(s=>PROBES[s]);
  const gap=r=>+(r[0].score-r[1].score).toFixed(2);
  const oldD=selectionDistribution(old),newD=selectionDistribution(risk);
  const key=d=>d.candidate.three.join('')+':'+d.candidate.mega;
  const sameTop=key(oldD[0])===key(newD[0]);
  const maxTeamAdj=Math.max(...risk.map(c=>c.riskAdjustment));
  const topAdj=risk[0].riskAdjustment;
  const leadAdjTop=risk[0].leads.map(l=>+l.riskAdjustment.toFixed(2));
  const pL=d=>d[0].leads.map(l=>own[l.i].species+':'+l.p.toFixed(2)).join(',');
  // total variation distance between trio distributions
  const mapO=new Map(oldD.map(d=>[key(d),d.p])),mapN=new Map(newD.map(d=>[key(d),d.p]));
  let tv=0;for(const k of new Set([...mapO.keys(),...mapN.keys()]))tv+=Math.abs((mapO.get(k)||0)-(mapN.get(k)||0));tv/=2;
  const rank=ranked=>ranked.slice(0,3).map(c=>c.three.map(i=>own[i].species.slice(0,4)).join('/')+(c.mega==null?'':'*'));
  console.log(JSON.stringify({team:g.name,probedFoesInSix:probed,penaltyNonzero:`${nz}/${tot}`,
    nzList,oldTop:rank(old),riskTop:rank(risk),oldGap12:gap(old),riskGap12:gap(risk),
    sameTopTrio:sameTop,trioPoolOld:oldD.length,trioPoolRisk:newD.length,tvTrio:+tv.toFixed(4),
    maxTeamAdj:+maxTeamAdj.toFixed(3),topTrioTeamAdj:+topAdj.toFixed(3),topTrioLeadAdj:leadAdjTop,
    leadProbOldTop:pL(oldD),leadProbRiskTop:pL(newD)}));
}
console.log('SUMMARY nonzero risk cells '+nonzeroCells+'/'+cells);
console.log('NOTE rival modes (rational/forced-pressure/forced-alternative) never enter the candidate preview: only 14 distinct preview inputs exist, not 42.');
