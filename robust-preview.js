#!/usr/bin/env node
'use strict';
// PR #74 P0-C (ChatGPT review #5715279320 of PR #73): the PR #73 60x60 matrix
// solved each rival hypothesis (H0 Mega Golisopod + Scarf Garchomp, H1 Mega
// Garchomp-Z + Lum Golisopod) separately, i.e. AFTER knowing which one is true.
// That is not a preview policy. This file is an opt-in policy that uses only:
//   - the rival's PUBLIC six species (to build its 60 picks), and
//   - a list of LEGAL set hypotheses for that six, each with a simulated matrix
//     P_h[own pick][rival pick] (our win fraction). The true hypothesis, the
//     rival's hidden three, items and moves are never an input.
// The rival is assumed to know its own sets and to best-respond to our policy
// (security level), not to our realised pick.
//   robust     max_x min_h min_j (x P_h)_j
//   weighted   max_x sum_h w_h min_j (x P_h)_j   (w = prior over hypotheses)
//   pureRobust the single pick maximising min_h min_j P_h[i][j]
// Each is reported per hypothesis next to the oracle (hypothesis known)
// equilibrium value and the legacy chooseThree pick. A holdout hypothesis H2
// (legal, NOT used to build the policy) is then played in full pinned-Showdown
// games for the policy support + legacy pick vs all 60 rival picks, same 6
// seeds x side reversal as PR #73.
// Heuristic AI vs heuristic AI, NOT a ladder win rate.
//   SHOWDOWN_DIR=... OUT=output/robust-preview.json node robust-preview.js
const fs=require('node:fs');
const path=require('node:path');
const {fork}=require('node:child_process');
const {load,chooseThree,normalize}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {hypotheses,picks,label,equilibrium,SEEDS,OWN_AI,encoreRat}=require('./a-preview-matrix-audit');
const MATRIX=path.join(__dirname,'reports','data','a-preview-matrix-20261030.json');

// Holdout rival sets for the same public six (legal, item clause, 66 points).
function holdout(){
  return {H2:structuredClone(hypotheses().H0).map(p=>
    p.species==='Gholdengo'?{...p,item:'Choice Scarf',nature:'Timid',moves:['Make It Rain','Shadow Ball','Thunderbolt','Trick']}:
    p.species==='Garchomp'?{...p,item:'Yache Berry',moves:['Earthquake','Dragon Claw','Rock Slide','Swords Dance']}:p)};
}
const colMin=(x,P)=>Math.min(...P[0].map((_,j)=>P.reduce((s,r,i)=>s+x[i]*r[j],0)));
// Exponentiated (super)gradient ascent on the concave objective, best iterate kept.
function solve(Ps,weights,mode,iters=20000){
  const m=Ps[0].length;let x=Array(m).fill(1/m),best={f:-1,x};
  const f=x=>{const v=Ps.map(P=>colMin(x,P));return mode==='robust'?Math.min(...v):v.reduce((s,a,h)=>s+weights[h]*a,0);};
  for(let t=1;t<=iters;t++){
    const v=Ps.map(P=>{let jm=0,vm=Infinity;for(let j=0;j<P[0].length;j++){const s=P.reduce((a,r,i)=>a+x[i]*r[j],0);if(s<vm){vm=s;jm=j;}}return {vm,jm};});
    const g=Array(m).fill(0);
    if(mode==='robust'){const h=v.reduce((b,a,k)=>a.vm<v[b].vm?k:b,0);for(let i=0;i<m;i++)g[i]=Ps[h][i][v[h].jm];}
    else for(let h=0;h<Ps.length;h++)for(let i=0;i<m;i++)g[i]+=weights[h]*Ps[h][i][v[h].jm];
    const eta=0.5/Math.sqrt(t);
    x=x.map((a,i)=>a*Math.exp(eta*g[i]));const s=x.reduce((a,b)=>a+b);x=x.map(a=>a/s);
    if(t%50===0){const fx=f(x);if(fx>best.f)best={f:fx,x:x.slice()};}
  }
  return best;
}
function matrices(file=MATRIX){
  const M=JSON.parse(fs.readFileSync(file,'utf8')),out={};
  for(const h of ['H0','H1']){const P=M.grids[h+'|new'].analysis.P;out[h]=P.map(r=>r.map(v=>v/12));}
  return {P:out,ownPicks:M.ownPicks,foePicks:M.foePicks};
}
function legacyPick(dex,own,foeTeam){
  const s=chooseThree(dex,own,foeTeam.map(p=>p.species)).map(n=>own[n-1].species);
  const O=picks(own),i=O.findIndex(o=>o[0]===s[0]&&o.slice().sort().join()===s.slice().sort().join());
  return {i,pick:label(O[i])};
}
function policies(P,ownPicks){
  const H=Object.keys(P),Ps=H.map(h=>P[h]),out={};
  out.robust=solve(Ps,null,'robust');
  for(const w of [0.25,0.5,0.75])out['weighted_H0='+w]=solve(Ps,[w,1-w],'weighted');
  const pr=ownPicks.map((_,i)=>Math.min(...Ps.map(Q=>Math.min(...Q[i])))),ib=pr.indexOf(Math.max(...pr));
  out.pureRobust={x:ownPicks.map((_,i)=>i===ib?1:0)};
  for(const h of H)out['oracle_'+h]={x:equilibrium(P[h],20000).x,oracle:h};
  return out;
}
function report(P,ownPicks,pols,legacy){
  const H=Object.keys(P),rows=[];
  const add=(name,x)=>rows.push({policy:name,
    support:x.map((p,i)=>[ownPicks[i],+p.toFixed(3)]).filter(([,p])=>p>=0.03).sort((a,b)=>b[1]-a[1]),
    security:Object.fromEntries(H.map(h=>[h,+colMin(x,P[h]).toFixed(3)])),
    vsOracleRival:Object.fromEntries(H.map(h=>{const y=equilibrium(P[h],20000).y;return [h,+x.reduce((s,a,i)=>s+a*P[h][i].reduce((t,v,j)=>t+v*y[j],0),0).toFixed(3)];}))});
  for(const [k,p] of Object.entries(pols))add(k,p.x);
  add('legacy chooseThree '+legacy.pick,ownPicks.map((_,i)=>i===legacy.i?1:0));
  return rows;
}
// Holdout games: given own rows (indices) x all 60 rival picks under a holdout team.
async function worker(){
  const {battle}=require('./encore-lead-audit');
  const sim=load(),dex=sim.Dex.mod('champions'),rival=encoreRat(dex);
  process.on('message',async({team,ownIdx})=>{
    const own=reportedLive(),O=picks(own),F=picks(team),seeds=SEEDS(),rows=[];
    for(const oi of ownIdx)for(let fi=0;fi<F.length;fi++)for(let si=0;si<seeds.length;si++)for(const reverse of [false,true]){
      const r=await battle(sim,structuredClone(own),structuredClone(team),seeds[si],{ownThree:O[oi],foeThree:F[fi],reverse,script:rival,ownOptions:OWN_AI.new});
      if(r.errors)throw Error('choice errors '+[oi,fi,si,reverse]);
      rows.push([oi,fi,si,reverse?1:0,r.won?1:0]);
    }
    process.send(rows);
  });
}
async function holdoutGames(team,ownIdx,workers){
  const chunks=[...Array(workers)].map(()=>[]);ownIdx.forEach((i,k)=>chunks[k%workers].push(i));
  const parts=await Promise.all(chunks.filter(c=>c.length).map(idx=>new Promise((res,rej)=>{
    // Own flag: a-preview-matrix-audit (required above) starts its worker on '--worker'.
    const c=fork(__filename,['--robust-worker'],{env:process.env});
    c.on('message',m=>{res(m);c.kill();});c.on('error',rej);c.on('exit',code=>{if(code)rej(Error('worker exit '+code));});
    c.send({team,ownIdx:idx});
  })));
  return parts.flat();
}
async function main(){
  const sim=load(),dex=sim.Dex.mod('champions'),own=reportedLive();
  const {P,ownPicks}=matrices();
  const legacy=legacyPick(dex,own,hypotheses().H0);
  const pols=policies(P,ownPicks);
  const table=report(P,ownPicks,pols,legacy);
  for(const r of table)console.log(r.policy.padEnd(44),'security',JSON.stringify(r.security),'vsOracleRival',JSON.stringify(r.vsOracleRival),r.support.slice(0,5).map(s=>s.join(' ')).join(', '));
  const out={showdown:'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',format:'gen9championsbssregmc',inputs:'rival public six + legal hypotheses H0/H1 (PR #73 matrix, reports/data/a-preview-matrix-20261030.json); true hypothesis never an input',
    note:'security = min over the 60 rival picks of our expected win fraction (rival best-responds to our policy knowing its own sets). Heuristic AI vs heuristic AI, NOT a ladder win rate.',
    table};
  if(!process.env.SKIP_HOLDOUT){
    const validator=sim.TeamValidator.get('gen9championsbssregmc');
    const H=holdout(),O=picks(own);
    for(const [k,t] of Object.entries(H)){const pr=validator.validateTeam(normalize(t));if(pr?.length)throw Error(k+': '+pr.join('; '));}
    const idx=new Set([legacy.i]);
    for(const [name,p] of Object.entries(pols))if(!name.startsWith('oracle'))p.x.forEach((v,i)=>{if(v>=0.03)idx.add(i);});
    const t0=Date.now(),rows=await holdoutGames(H.H2,[...idx],Number(process.env.WORKERS||3));
    const W={},N={};for(const [oi,fi,,,won] of rows){const k=oi+','+fi;W[k]=(W[k]||0)+won;N[k]=(N[k]||0)+1;}
    const F=picks(H.H2),Q=i=>F.map((_,j)=>W[i+','+j]/N[i+','+j]);
    // Security on the holdout restricted to evaluated rows (policy mass renormalised over them).
    const holdoutSec=x=>{const keep=[...idx],m=keep.reduce((s,i)=>s+x[i],0);
      return {security:+Math.min(...F.map((_,j)=>keep.reduce((s,i)=>s+x[i]*Q(i)[j],0)/m)).toFixed(3),coveredMass:+m.toFixed(3),
        mean:+(keep.reduce((s,i)=>s+x[i]*Q(i).reduce((a,b)=>a+b)/F.length,0)/m).toFixed(3)};};
    out.holdout={team:'H2 '+JSON.stringify(H.H2.filter(p=>['Gholdengo','Garchomp'].includes(p.species)).map(p=>[p.species,p.item,p.moves])),
      games:rows.length,seconds:Math.round((Date.now()-t0)/1000),
      perPick:[...idx].map(i=>({pick:ownPicks[i],worst:+Math.min(...Q(i)).toFixed(3),mean:+(Q(i).reduce((a,b)=>a+b)/F.length).toFixed(3),
        worstBy:F.map(label).filter((_,j)=>Q(i)[j]===Math.min(...Q(i))).slice(0,3)})),
      policies:Object.fromEntries(Object.entries(pols).filter(([n])=>!n.startsWith('oracle')).map(([n,p])=>[n,holdoutSec(p.x)]).concat([['legacy '+legacy.pick,holdoutSec(ownPicks.map((_,i)=>i===legacy.i?1:0))]])),
      rows};
    console.log('holdout H2',out.holdout.games,'games',out.holdout.seconds+'s');console.log(out.holdout.perPick,out.holdout.policies);
  }
  if(process.env.OUT){fs.mkdirSync(path.dirname(process.env.OUT),{recursive:true});fs.writeFileSync(process.env.OUT,JSON.stringify(out));}
}
if(process.argv.includes('--robust-worker'))worker();
else if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={solve,colMin,policies,report,matrices,legacyPick,holdout};
