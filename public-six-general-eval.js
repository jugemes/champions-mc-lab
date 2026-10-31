#!/usr/bin/env node
'use strict';
// PR #78 evaluation of the general public-six entry (public-six-general.js)
// against the PR #77 fallback (legacy chooseThree on the public six) and, for
// A, the registered robust matrix entry (public-six-preview.js).
//   search  saved searchPublicSix result per public six (SEARCH=file), made
//           from species names only; never re-run with a hidden set
//   truth   each case is played under 1-3 LEGAL set hypotheses (the hidden
//           sets); they are only used to run games
//   rival   every one of its 60 picks (20 trios x 3 leads) -> security of our
//           policy = min over rival picks of our expected win fraction; plus
//           the rival-view picks of PR #77 (its legacy pick and the ace-lead
//           pick) under T1/T2 branches ai/attack/setup/switch on shared seeds,
//           with T1/T2 logs, requested-vs-executed check and v3 misplay tags
//   seeds   3 seeds x both sides, disjoint from the search seeds
// PR #80 item 6 adds, from the SAME saved search only (rules fixed before any
// PR #80 evaluation was run):
//   human1  one deterministic 3+lead = search.pure[0] (best worst-scenario
//           mean, then mean, over the refined survivors) - what a human can
//           actually commit to in preview
//   top2    the two largest emitted support entries, renormalised
// and the rival 'utility' T1/T2 branch (recovery/Encore/hazard/status move).
// EVAL_BRANCHES=ai,attack,setup,switch reproduces the PR #79 branch set.
// Heuristic AI vs heuristic AI. NOT a ladder win rate.
//   SHOWDOWN_DIR=... SEARCH=reports/data/....json SET=dev OUT=... node public-six-general-eval.js
const fs=require('node:fs');
const path=require('node:path');
const {load,hashSeed,chooseThree,normalize}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {caseList}=require('./legal-search-v2-compare');
const {picks,label,hypotheses:aHyps}=require('./a-preview-matrix-audit');
const {holdout:aHoldout,colMin}=require('./robust-preview');
const {choosePublicSixPreview}=require('./public-six-preview');
const {runGames,keyOf,cacheCheck}=require('./public-six-general');
const {rivalPicks}=require('./public-six-holdout');
const {holdoutSixes}=require('./holdout-20261031-general');
const {holdoutSixPR80}=require('./holdout-20261031-pr80');
const BRANCH_SET=(process.env.EVAL_BRANCHES||'ai,attack,setup,switch,utility').split(',');
// PR #80 human-actionable policies, derived from the search result only.
function humanPolicies(search){
  const out={};
  if(search.pure?.length)out.human1={[search.pure[0].pick]:1};
  const top=search.support.slice().sort((a,b)=>b.p-a.p).slice(0,2);
  if(top.length===2)out.top2=Object.fromEntries(top.map(t=>[t.pick,t.p]));
  return out;
}
const swap=(team,species,set)=>team.map(p=>p.species===species?{species,...set}:p);
// Second legal hypotheses for dev sixes that had only one (written for this
// evaluation, not used by the search, which never sees sets).
function devVariants(all){
  const B=all.find(c=>c.id==='B_lucarioZ').team,E=all.find(c=>c.id==='NEW_realE_sun').team;
  let B2=swap(B,'Garchomp',{item:'Yache Berry',ability:'Rough Skin',nature:'Jolly',moves:['Earthquake','Dragon Claw','Rock Slide','Swords Dance'],evs:{hp:2,atk:32,spe:32}});
  B2=swap(B2,'Corviknight',{item:'Leftovers',ability:'Pressure',nature:'Impish',moves:['Roost','U-turn','Body Press','Brave Bird'],evs:{hp:32,def:32,spd:2}});
  const E2=swap(E,'Charizard',{item:'Charizardite X',ability:'Blaze',nature:'Jolly',moves:['Dragon Dance','Flare Blitz','Dragon Claw','Earthquake'],evs:{hp:2,atk:32,spe:32}});
  return {B2,E2};
}
function cases(set){
  const all=caseList(),c=id=>all.find(x=>x.id===id).team,v=devVariants(all);
  if(set==='pr80'){
    const out=[];
    for(const [id,h] of Object.entries(holdoutSixPR80()))for(const [k,t] of Object.entries(h.hypotheses))out.push({six:id,hyp:k,team:t,ace:h.ace});
    return out;
  }
  if(set==='holdout'){
    const out=[];
    for(const [id,h] of Object.entries(holdoutSixes()))for(const [k,t] of Object.entries(h.hypotheses))out.push({six:id,hyp:k,team:t,ace:h.ace});
    out.push({six:'HOLD_psychic_offense',hyp:'case',team:c('HOLD_psychic_offense'),ace:'Alakazam'});
    out.push({six:'HOLD_sun_balance',hyp:'case',team:c('HOLD_sun_balance'),ace:'Charizard'});
    return out;
  }
  const A=aHyps();
  return [
    {six:'A_golisopod',hyp:'H0',team:A.H0,ace:'Golisopod'},{six:'A_golisopod',hyp:'H1',team:A.H1,ace:'Golisopod'},
    {six:'A_golisopod',hyp:'H2',team:aHoldout().H2,ace:'Golisopod'},
    {six:'B_lucarioZ',hyp:'case',team:c('B_lucarioZ'),ace:'Lucario'},{six:'B_lucarioZ',hyp:'B2',team:v.B2,ace:'Lucario'},
    {six:'C_charizard',hyp:'Y',team:c('C_charizardY'),ace:'Charizard'},{six:'C_charizard',hyp:'X',team:c('C_charizardX'),ace:'Charizard'},
    {six:'Indeedee',hyp:'scarf',team:c('Real_indeedee_scarf'),ace:'Indeedee'},{six:'Indeedee',hyp:'sash',team:c('Real_indeedee_sash'),ace:'Indeedee'},
    {six:'Indeedee',hyp:'quickclaw',team:require('./holdout-20261030').teams().realB_indeedee_quickclaw.team,ace:'Indeedee'},
    {six:'E_sun',hyp:'case',team:c('NEW_realE_sun'),ace:'Charizard'},{six:'E_sun',hyp:'E2',team:v.E2,ace:'Charizard'},
  ];
}
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
async function evalCase(sim,own,search,cs,ci,{workers}){
  const dex=sim.Dex.mod('champions'),validator=sim.TeamValidator.get('gen9championsbssregmc');
  const pr=validator.validateTeam(normalize(cs.team));if(pr?.length)throw Error(cs.six+'/'+cs.hyp+': '+pr.join('; '));
  const six=cs.team.map(p=>p.species);
  if(keyOf(six)!==search.publicKey)throw Error('search is for another public six');
  const O=picks(own),F=picks(cs.team),idx=pk=>O.findIndex(o=>label(o)===pk);
  const legacy=chooseThree(dex,own,six).map(n=>own[n-1].species);
  const legacyLabel=label(O.find(o=>o[0]===legacy[0]&&o.slice().sort().join()===legacy.slice().sort().join()));
  const pol={general:Object.fromEntries(search.support.map(s=>[s.pick,s.p])),...humanPolicies(search),fallback:{[legacyLabel]:1}};
  const reg=choosePublicSixPreview({dex,own,publicSix:six,seed:[1,2,3,4]});
  if(reg.status==='registered')pol.registeredA=Object.fromEntries(reg.support);
  const rows=[...new Set(Object.values(pol).flatMap(p=>Object.keys(p)))];
  const seeds=[0,1,2].map(s=>hashSeed(7900000+ci*100+s));
  const jobs=[];
  for(const pk of rows)F.forEach((fp,fj)=>seeds.forEach((seed,si)=>{for(const reverse of [false,true])jobs.push({pk,fj,si,team:0,own:O[idx(pk)],foe:fp,seed,reverse});}));
  const t0=Date.now(),res=await runGames(own,[cs.team],jobs,{workers});
  const Q={};jobs.forEach((j,k)=>{const q=Q[j.pk]||(Q[j.pk]=F.map(()=>0));q[j.fj]+=res[k].won/6;});
  // Rival-view picks (PR #77): legacy + ace lead, T1/T2 branches, logs kept.
  const rp=rivalPicks(dex,cs.team,own.map(p=>p.species),cs.ace).picks;
  const bj=[];
  for(const pk of rows)for(const r of rp)seeds.forEach((seed,si)=>{for(const reverse of [false,true])for(const branch of BRANCH_SET)
    bj.push({pk,rsrc:r.src,rival:r.pick.join('/'),si,reverse,branch,team:0,own:O[idx(pk)],foe:r.pick,seed});});
  const br=await runGames(own,[cs.team],bj,{workers,keepLog:true});
  const seconds=Math.round((Date.now()-t0)/1000);
  const summary={};
  for(const [name,x] of Object.entries(pol)){
    const ks=Object.keys(x),tot=ks.reduce((s,k)=>s+x[k],0),w=ks.map(k=>x[k]/tot);
    const col=F.map((_,j)=>ks.reduce((s,k,i)=>s+w[i]*Q[k][j],0));
    const sec=Math.min(...col),aceCols=F.map((f,j)=>f.includes(cs.ace)?col[j]:null).filter(v=>v!=null);
    const rational={};
    for(const r of rp){
      // per seed/side: rival credited with its best T1/T2 branch (shared seed)
      let v=0,clean=[0,0],ai=0;
      ks.forEach((k,i)=>seeds.forEach((_,si)=>[false,true].forEach(rev=>{
        const g=bj.map((j,n)=>({j,r:br[n]})).filter(({j})=>j.pk===k&&j.rsrc===r.src&&j.si===si&&j.reverse===rev);
        v+=w[i]*Math.min(...g.map(x=>x.r.won))/6;
        const a=g.find(x=>x.j.branch==='ai');ai+=w[i]*a.r.won/6;
        if(!a.r.foeTagged){clean[0]+=w[i]*a.r.won;clean[1]+=w[i];}
      })));
      const byBranch=Object.fromEntries(BRANCH_SET.map(b=>[b,+ks.reduce((t,k,i)=>t+w[i]*mean(bj.map((j,n)=>j.pk===k&&j.rsrc===r.src&&j.branch===b?br[n].won:null).filter(x=>x!=null)),0).toFixed(3)]));
      rational[r.src]={rival:r.pick.join('/'),aiBranch:+ai.toFixed(3),worstBranch:+v.toFixed(3),cleanAi:clean[1]?+(clean[0]/clean[1]).toFixed(3):null,byBranch};
    }
    summary[name]={support:ks.map((k,i)=>[k,+w[i].toFixed(3)]),security:+sec.toFixed(3),mean:+mean(col).toFixed(3),
      aceCoverage:+(aceCols.length?mean(aceCols):0).toFixed(3),
      aceSecurity:aceCols.length?+Math.min(...aceCols).toFixed(3):null,
      worstRival:F.map((f,j)=>[label(f),+col[j].toFixed(3)]).sort((a,b)=>a[1]-b[1]).slice(0,4),
      rivalsAtZero:col.filter(v=>v===0).length,rational};
  }
  const req={executed:0,preempted:0,forcedOut:0,mismatch:0};
  for(const r of br)for(const q of r.requested||[])req[q.result]++;
  const perPick=rows.map(k=>({pick:k,worst:+Math.min(...Q[k]).toFixed(3),mean:+mean(Q[k]).toFixed(3),
    worstBy:F.filter((_,j)=>Q[k][j]===Math.min(...Q[k])).map(label).slice(0,3)}));
  const branchGames=bj.map((j,n)=>({pick:j.pk,rival:j.rival,rsrc:j.rsrc,seed:j.seed.join('-'),reverse:j.reverse,branch:j.branch,
    won:br[n].won,turns:br[n].turns,foeTagged:br[n].foeTagged,ownTagged:br[n].ownTagged,aceMega:br[n].aceMega,sun:br[n].sun,requested:br[n].requested,t1t2:br[n].t1t2}));
  // PR #80: whether this saved search would be accepted by the live entry (a
  // PR #79 general-v1 file is evaluated as a historical policy, but refused live)
  const identity=cacheCheck(search,six,own);
  return {six:cs.six,hyp:cs.hyp,ace:cs.ace,searchAccepted:identity.ok,searchRejected:identity.reasons,sets:cs.team.map(p=>p.species+'@'+p.item+':'+p.moves.join('/')),
    games:jobs.length+bj.length,seconds,requestedCheck:req,summary,perPick,
    rows:jobs.map((j,k)=>[rows.indexOf(j.pk),j.fj,j.si,j.reverse?1:0,res[k].won]),rowPicks:rows,branchGames};
}
async function main(){
  const sim=load(),own=reportedLive(),set=process.env.SET||'dev';
  const searches=JSON.parse(fs.readFileSync(process.env.SEARCH,'utf8'));
  const bySix={};for(const s of Object.values(searches))bySix[s.publicKey]=s;
  const out={showdown:'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',format:'gen9championsbssregmc',set,own:'reportedLive (reported-live-roster-20261027.js)',
    branches:BRANCH_SET,search:process.env.SEARCH,
    note:'security = min over all 60 rival picks of our expected win fraction (3 seeds x both sides per cell). rational = PR #77 rival-view picks with T1/T2 branches; worstBranch credits the rival with its best branch per seed. Heuristic AI vs heuristic AI, NOT a ladder win rate.',
    cases:[]};
  const only=process.env.ONLY?new RegExp(process.env.ONLY):null;
  for(const [ci,cs] of cases(set).entries()){
    if(only&&!only.test(cs.six+'/'+cs.hyp))continue;
    const search=bySix[keyOf(cs.team.map(p=>p.species))];
    if(!search){console.log('no search for',cs.six);continue;}
    const r=await evalCase(sim,own,search,cs,ci,{workers:Number(process.env.WORKERS||4)});
    out.cases.push(r);
    console.log(cs.six+'/'+cs.hyp,r.games,'games',r.seconds+'s','req',JSON.stringify(r.requestedCheck));
    for(const [n,s] of Object.entries(r.summary))console.log('  ',n.padEnd(12),'sec',s.security,'mean',s.mean,'aceSec',s.aceSecurity,'zero',s.rivalsAtZero,
      'worst',JSON.stringify(s.worstRival.slice(0,2)),'rational',JSON.stringify(s.rational));
  }
  if(process.env.OUT){fs.mkdirSync(path.dirname(process.env.OUT),{recursive:true});fs.writeFileSync(process.env.OUT,JSON.stringify(out));}
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={cases,devVariants,evalCase};
