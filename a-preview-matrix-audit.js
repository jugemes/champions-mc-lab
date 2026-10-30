#!/usr/bin/env node
'use strict';
// PR #72 request item 1-2: case A public six vs our reportedLive() six, BOTH
// sides choosing 3 + lead from the other side's public six only.
// Every one of our 20 threes x 3 leads (60) is played against every one of the
// rival's 60, in full pinned-Showdown games (same seeds as PR #67/#69/#71 case A
// x side reversal = 12 games per cell). A pick is a fixed strategy: it cannot
// depend on the other side's hidden three, items or moves (no leak by
// construction). The turn AI on both sides reads the public log only.
// "Rational" rival picks are then derived from the matrix itself, not from
// hand-picked answers: the rival's equilibrium support (zero-sum, our wins) and
// its pure maximin picks, plus the old forcedA/forcedB for continuity.
// Rival set hypotheses (both legal, item clause, 66 points; NOT observed sets):
//   H0  environment-m7-teams A: Mega Golisopod + Choice Scarf Garchomp
//   H1  Mega Garchomp-Z (special) + Golisopod with Lum Berry (no Mega)
// Own turn AI: new = {encoreGuard:'speed', publicMegaAbility:true}; old = {}.
// Rival turn AI: baseline (as in PR #67-#71) EXCEPT that an Encore-locked
// rival takes PR #71 ratSwitch (RIVAL=encoreRat, default). RIVAL=stay keeps the
// baseline, which stays in Encore and inflates Encore picks (reference only,
// saved as grids 'H?|ai|rivalEncoreStay').
// Heuristic AI vs heuristic AI, NOT a ladder win rate.
//   SHOWDOWN_DIR=... OUT=output/a-preview-matrix.json node a-preview-matrix-audit.js
// Env: HYP=H0,H1 AIS=new,old(old only for H0) WORKERS=4
const fs=require('node:fs');
const path=require('node:path');
const {fork}=require('node:child_process');
const {hashSeed,load,normalize,prelim}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {caseList}=require('./legal-search-v2-compare');
const FORMAT='gen9championsbssregmc';
const SHOWDOWN='3a766f2cfb5e51c1e428cfe87d0dba91a8f01640';
const SEED_BASES=[7400000,7500000,7600000];
const SEEDS=()=>SEED_BASES.flatMap(b=>[0,1].map(s=>hashSeed(b+0*1000+s*10)));
const OWN_AI={new:{encoreGuard:'speed',publicMegaAbility:true},old:{}};

function hypotheses(){
  const A=caseList().find(c=>c.id==='A_golisopod');
  const H0=structuredClone(A.team);
  const H1=structuredClone(A.team).map(p=>{
    if(p.species==='Garchomp')return {species:'Garchomp',item:'Garchompite Z',ability:'Rough Skin',nature:'Timid',
      evs:{hp:2,spa:32,spe:32},moves:['Earth Power','Draco Meteor','Flamethrower','Stealth Rock']};
    if(p.species==='Golisopod')return {...p,item:'Lum Berry'};
    return p;
  });
  return {H0,H1};
}
// 20 threes x 3 leads; the two back members keep roster order.
function picks(team){
  const names=team.map(p=>p.species),out=[];
  for(let a=0;a<6;a++)for(let b=a+1;b<6;b++)for(let c=b+1;c<6;c++){
    const t=[names[a],names[b],names[c]];
    for(const lead of t)out.push([lead,...t.filter(x=>x!==lead)]);
  }
  return out;
}
const label=p=>p[0]+'>'+p.slice(1).join('/');
// Rival script: only an Encore-locked rival with a legal switch takes ratSwitch.
function encoreRat(dex){
  const {ratSwitch}=require('./encore-turn-p0-audit');
  return (req,bot,info)=>info.lockReason==='encore'&&info.canSwitch?ratSwitch(req,bot,dex,{encore:true}):null;
}
async function worker(){
  const {battle}=require('./encore-lead-audit');
  const sim=load(),dex=sim.Dex.mod('champions');
  const rival=process.env.RIVAL==='stay'?null:encoreRat(dex);
  process.on('message',async({hyp,ai,ownIdx})=>{
    const own=reportedLive(),foe=hypotheses()[hyp];
    const O=picks(own),F=picks(foe),seeds=SEEDS(),rows=[];
    for(const oi of ownIdx)for(let fi=0;fi<F.length;fi++)for(let si=0;si<seeds.length;si++)for(const reverse of [false,true]){
      const r=await battle(sim,structuredClone(own),structuredClone(foe),seeds[si],{ownThree:O[oi],foeThree:F[fi],reverse,script:rival,ownOptions:OWN_AI[ai]});
      if(r.errors)throw Error('choice errors '+[hyp,ai,oi,fi,si,reverse]);
      rows.push([oi,fi,si,reverse?1:0,r.won?1:0,r.turns]);
    }
    process.send(rows);
  });
}
async function runGrid(hyp,ai,workers){
  const n=picks(reportedLive()).length,chunks=[...Array(workers)].map(()=>[]);
  for(let i=0;i<n;i++)chunks[i%workers].push(i);
  const parts=await Promise.all(chunks.map(ownIdx=>new Promise((res,rej)=>{
    const c=fork(__filename,['--worker'],{env:process.env});
    c.on('message',m=>{res(m);c.kill();});c.on('error',rej);
    c.on('exit',code=>{if(code)rej(Error('worker exit '+code));});
    c.send({hyp,ai,ownIdx});
  })));
  return parts.flat().sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[2]-b[2]||a[3]-b[3]);
}
// Zero-sum equilibrium of W (our win fraction) by multiplicative weights.
function equilibrium(W,iters=20000){
  const m=W.length,n=W[0].length,eta=0.05;
  let x=Array(m).fill(1/m),y=Array(n).fill(1/n);const xs=Array(m).fill(0),ys=Array(n).fill(0);
  for(let t=0;t<iters;t++){
    const gx=W.map(r=>r.reduce((s,v,j)=>s+v*y[j],0));
    const gy=W[0].map((_,j)=>W.reduce((s,r,i)=>s+r[j]*x[i],0));
    x=x.map((v,i)=>v*Math.exp(eta*gx[i]));y=y.map((v,j)=>v*Math.exp(-eta*gy[j]));
    const sx=x.reduce((a,b)=>a+b),sy=y.reduce((a,b)=>a+b);x=x.map(v=>v/sx);y=y.map(v=>v/sy);
    for(let i=0;i<m;i++)xs[i]+=x[i];for(let j=0;j<n;j++)ys[j]+=y[j];
  }
  const X=xs.map(v=>v/iters),Y=ys.map(v=>v/iters);
  const value=W.reduce((s,r,i)=>s+X[i]*r.reduce((a,v,j)=>a+v*Y[j],0),0);
  const bestOwn=Math.max(...W.map(r=>r.reduce((a,v,j)=>a+v*Y[j],0)));
  const bestFoe=Math.min(...W[0].map((_,j)=>W.reduce((a,r,i)=>a+r[j]*X[i],0)));
  return {x:X,y:Y,value,gap:bestOwn-bestFoe};
}
function analyse(rows,O,F,foeTeam){
  const A=caseList().find(c=>c.id==='A_golisopod');
  const W=O.map(()=>F.map(()=>0)),N=O.map(()=>F.map(()=>0));
  for(const [oi,fi,,,won] of rows){W[oi][fi]+=won;N[oi][fi]++;}
  const P=W.map((r,i)=>r.map((v,j)=>v/N[i][j]));
  const eq=equilibrium(P);
  const foeMaximin=F.map((f,j)=>({j,worstForFoe:Math.max(...P.map(r=>r[j]))}));
  const foeMean=F.map((f,j)=>({j,mean:P.reduce((s,r)=>s+r[j],0)/O.length}));
  const findF=t=>F.findIndex(f=>f[0]===t[0]&&f.slice().sort().join()===t.slice().sort().join());
  const R=new Set([
    ...eq.y.map((p,j)=>[p,j]).filter(([p])=>p>=0.02).map(([,j])=>j),
    ...foeMaximin.sort((a,b)=>a.worstForFoe-b.worstForFoe).slice(0,3).map(x=>x.j),
    ...foeMean.sort((a,b)=>a.mean-b.mean).slice(0,3).map(x=>x.j),
    findF(A.forcedA),findF([A.forcedB[0],...A.forcedB.slice(1)])].filter(j=>j>=0));
  const Rl=[...R];
  const own=O.map((o,i)=>{
    const worst=Math.min(...Rl.map(j=>P[i][j])),worstJ=Rl.filter(j=>P[i][j]===worst);
    return {i,pick:label(o),three:o.slice().sort().join('/'),lead:o[0],
      vsEq:+P[i].reduce((a,v,j)=>a+v*eq.y[j],0).toFixed(3),
      worstR:+worst.toFixed(3),worstRBy:worstJ.map(j=>label(F[j])),
      worstAll:+Math.min(...P[i]).toFixed(3),meanAll:+(P[i].reduce((a,b)=>a+b)/F.length).toFixed(3),
      eqWeight:+eq.x[i].toFixed(3),
      vsR:Object.fromEntries(Rl.map(j=>[label(F[j]),W[i][j]+'/'+N[i][j]]))};
  });
  return {value:+eq.value.toFixed(3),gap:+eq.gap.toFixed(4),
    foeEq:eq.y.map((p,j)=>({pick:label(F[j]),p:+p.toFixed(3)})).filter(x=>x.p>=0.01).sort((a,b)=>b.p-a.p),
    ownEq:eq.x.map((p,i)=>({pick:label(O[i]),p:+p.toFixed(3)})).filter(x=>x.p>=0.01).sort((a,b)=>b.p-a.p),
    rational:Rl.map(j=>({pick:label(F[j]),eqP:+eq.y[j].toFixed(3),foeWorst:+Math.max(...P.map(r=>r[j])).toFixed(3),foeMeanLoss:+(P.reduce((s,r)=>s+r[j],0)/O.length).toFixed(3)})),
    own:own.sort((a,b)=>b.worstR-a.worstR||b.vsEq-a.vsEq),P:P.map(r=>r.map(v=>Math.round(v*12)))};
}
async function main(){
  const sim=load();const validator=sim.TeamValidator.get(FORMAT);
  const H=hypotheses();
  for(const [k,t] of Object.entries(H)){prelim(t,k);const pr=validator.validateTeam(normalize(t));if(pr?.length)throw Error(k+': '+pr.join('; '));}
  const want=(process.env.HYP||'H0,H1').split(','),ais=(process.env.AIS||'new,old').split(','),workers=Number(process.env.WORKERS||4);
  const own=reportedLive(),O=picks(own);
  const out={showdown:SHOWDOWN,format:FORMAT,own:'reportedLive()',case:'A_golisopod public six',seeds:SEEDS().map(s=>s.join('-')),
    ownPicks:O.map(label),ownAI:OWN_AI,hypotheses:H,
    rival:process.env.RIVAL==='stay'?'baseline (stays in Encore)':'baseline + ratSwitch when Encore-locked',
    note:'Every own pick (20 threes x 3 leads) vs every rival pick, 12 games per cell (6 seeds x side reversal). rows: [ownIdx, foeIdx, seedIdx, reversed, won, turns]. Heuristic AI vs heuristic AI, NOT a ladder win rate.',
    grids:{}};
  for(const hyp of want)for(const ai of ais){
    if(ai==='old'&&hyp!=='H0')continue;
    const t0=Date.now();const rows=await runGrid(hyp,ai,workers);
    const F=picks(H[hyp]);out.foePicks=out.foePicks||{};out.foePicks[hyp]=F.map(label);
    const a=analyse(rows,O,F,H[hyp]);
    out.grids[hyp+'|'+ai+(process.env.RIVAL==='stay'?'|rivalEncoreStay':'')]={rows,analysis:a};
    console.log(hyp,ai,rows.length,'games',((Date.now()-t0)/1000).toFixed(0)+'s','value',a.value,'gap',a.gap);
    console.log(' rival eq:',a.foeEq.map(x=>x.pick+' '+x.p).join(', '));
    console.log(' rational rival set:',a.rational.map(x=>x.pick).join(', '));
    for(const o of a.own.slice(0,8))console.log('  ',o.pick.padEnd(36),'worstR',o.worstR,'vsEq',o.vsEq,'worstAll',o.worstAll,'mean',o.meanAll);
    const rot=a.own.filter(o=>o.three.includes('Rotom-Wash')).slice(0,3);
    for(const o of rot)console.log('  rotom',o.pick.padEnd(30),'worstR',o.worstR,'vsEq',o.vsEq);
  }
  const file=process.env.OUT||path.join(__dirname,'output','a-preview-matrix.json');
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(out));
}
if(process.argv.includes('--worker'))worker();
else if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={hypotheses,picks,label,equilibrium,analyse,encoreRat,SEEDS,OWN_AI};
