#!/usr/bin/env node
'use strict';
// PR #100 request items 1/3: DEV-only mechanism probe for N2 (PR #92 holdout,
// already developed). Our Scarf Garchomp lead vs the rival's Mega setup ace:
// in the saved PR #97 losses (seed [5619,3428,14210,18518] p1 and
// [7294,3627,123,36187] p2) Garchomp is locked into Dragon Claw, the ace Megas
// + Swords Dance at 84/157, then +2 Close Combat KOs Garchomp (Rough Skin
// leaves it at 1/157). No T1 attack (Earthquake 45 dmg / Poison Jab 49 / Dragon
// Claw 73) stops it; T1 switch to Metagross wins both seeds.
// Executable T1 rule tested here (public info at the T1 decision only: our
// active, the rival's revealed lead species, legal switch):
//   T1, our active Garchomp, rival active = public ace species -> switch Metagross.
// The rival lead is the first of its forced three, so the rule's condition
// is known per job and the rule is applied as plan.force at T1 (pr96
// planScript96); nothing hidden is read at decision time.
// Same jobs/seeds/sides/cells as pr96-eval DEV for the pr96 pick; rule vs
// none on the identical jobs (paired). The ace name is read from the holdout
// file (repo tests forbid quoting holdout species in other .js files).
// NOT a holdout result: N2 is DEV. Heuristic AI vs heuristic AI.
const fs=require('node:fs');
const {load,chooseThree}=require('./lab');
const H=require('./holdout-20261031-pr96');
const X=require('./pr96-paired');
const E94=require('./pr94-eval');
const H92=require('./holdout-20261031-pr92'),H94=require('./holdout-20261031-pr94');
const {rivalCandidates}=require('./preview-legal-search');
const MODELS=['rational','tm'];
const cellsFor=(model,a)=>model==='rational'?H92.rationalCellsPR92({...a,chooseThree,rivalCandidates}).cells:H94.tmCells(a).cells;
async function main(){
  const target=process.env.SIX||'N2_heracross',W=Number(process.env.WORKERS||4);
  const saved=JSON.parse(fs.readFileSync('reports/data/pr96-eval-dev.json','utf8'));
  const sim=load(),dex=sim.Dex.mod('champions');
  const own=require('./reported-live-roster-20261027').reportedLive(),ownSpecies=own.map(p=>p.species);
  const sixes=(()=>{const d=E94.devSixes();for(const x of E94.finalSixes())d.push(x);return d;})();
  const ui=sixes.findIndex(x=>x.id===target),x=sixes[ui];
  const pick=saved.sixes[target].selection.pr96.split('>');
  const J=[],teams=[];
  Object.entries(x.hyps).forEach(([k,t],hi)=>{const ti=teams.push(t)-1;
    MODELS.forEach((model,mi)=>{const cells=cellsFor(model,{dex,team:t,ownSpecies,ace:x.ace});
      cells.forEach((c,ci)=>H.BRANCHES.forEach((branch,bi)=>H.SEEDS.forEach(s=>{for(const arm of ['none','rule']){
        J.push({six:target,hyp:k,model,arm,team:ti,own:pick,foe:c.foe,cell:c.src,aceCell:c.foe.includes(x.ace),aceLead:c.foe[0]===x.ace,ci,branch,s,keyVer:'pr96',immuneAware:true,
          plan:arm==='rule'&&pick[0]==='Garchomp'&&c.foe[0]===x.ace?{force:{turn:1,label:'switch:Metagross'}}:{},seed:H.evalSeed(H.DEV_SEED_BASE,ui,hi,mi,ci,bi,s),reverse:H.sideOf(s)});}})));});});
  const R=await X.runGames96(own,teams,J,{workers:W});
  const res={};
  for(const hyp of Object.keys(x.hyps))for(const model of MODELS)for(const arm of ['none','rule']){
    const Z=J.map((j,i)=>({j,r:R[i]})).filter(z=>z.j.hyp===hyp&&z.j.model===model&&z.j.arm===arm);
    const m=a=>a.length?+(a.reduce((s,z)=>s+z.r.won,0)/a.length).toFixed(3):null;
    const byCell={};for(const z of Z)(byCell[z.j.cell]||(byCell[z.j.cell]=[])).push(z);
    res[hyp+'/'+model+'/'+arm]={n:Z.length,meanAce:m(Z.filter(z=>z.j.aceCell)),meanAll:m(Z),aceLeadGames:Z.filter(z=>z.j.aceLead).length,meanAceLead:m(Z.filter(z=>z.j.aceLead)),
      byBranchAceLead:Object.fromEntries(H.BRANCHES.map(b=>[b,m(Z.filter(z=>z.j.aceLead&&z.j.branch===b))])),
      worstCell:Math.min(...Object.values(byCell).map(m)),fired:Z.filter(z=>(z.r.used||{})[1]==='switch:Metagross').length};
  }
  // paired flips on identical jobs
  const flips={win2loss:0,loss2win:0};
  for(let i=0;i<J.length;i+=2){const a=R[i].won,b=R[i+1].won;if(a&&!b)flips.win2loss++;if(!a&&b)flips.loss2win++;}
  console.log(JSON.stringify({six:target,pick:pick.join('>'),showdown:'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',format:'gen9championsbssregmc',jobs:J.length,
    rule:'T1: own active Garchomp and rival active = public ace -> switch Metagross',res,flips,
    note:'DEV only (N2 was developed in PR #92-#97). Rule chosen after reading N2 loss logs: in-sample, NOT a generalisation result. Heuristic AI vs heuristic AI, NOT a ladder win rate.'},null,1));
}
main().catch(e=>{console.error(e);process.exit(1);});
