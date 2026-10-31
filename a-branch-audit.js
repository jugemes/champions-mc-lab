#!/usr/bin/env node
'use strict';
// PR #72 request items 1-2: for the candidate own picks from a-preview-matrix
// (top by worst case over the rational rival set, best Rotom-Wash pick, and the
// PR #71 Primarina trio), replay the rival's rational picks with explicit
// rival T1/T2 branches in full pinned-Showdown games:
//   T1, T2 in ai | each of the rival lead's 4 moves | ratSwitch (PR #71)
//   Encore-locked rival: ratSwitch (stay-in-Encore wins are not evidence)
// Each scripted rival action is classified at decision time from the RIVAL's
// knowledge only (its own set + our public species/HP/boosts/seen moves):
//   blunder   damaging move into a public immunity; Swords Dance while our
//             public threat (incomingRisk incl. seen moves) already KOs it
//   weak      damaging move < 1/4 of its best available damaging move, or SD at +4
//   plausible otherwise (ai = the rival's heuristic choice)
// The rational worst case uses only games whose scripted T1/T2 were plausible.
// It is a counterexample search over listed branches, not a proof that no
// human line exists, and NOT a ladder win rate.
//   SHOWDOWN_DIR=... MATRIX=reports/data/a-preview-matrix-20261030.json OUT=... node a-branch-audit.js
const fs=require('node:fs');
const path=require('node:path');
const {load}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {battle,bench,nameOf}=require('./encore-lead-audit');
const {ratSwitch}=require('./encore-turn-p0-audit');
const {estimateDamage,incomingRisk}=require('./damage');
const {hypotheses,SEEDS,OWN_AI,label}=require('./a-preview-matrix-audit');
const BR=['ai','m1','m2','m3','m4','ratSwitch'];

function classify(dex,req,bot,moveName){
  const cur=req.side.pokemon.find(p=>p.active),set=bot.getSet(cur);
  const me={...set,species:nameOf(cur.details)};
  const [h,m]=String(cur.condition).split(' ')[0].split('/').map(Number),ratio=m>0?h/m:1;
  const info={foeAbility:bot.foeAbility,foeItem:bot.foeItem,foeHP:bot.foeHP,boosts:bot.boosts,foeBoosts:bot.foeBoosts};
  const dmg=n=>{const e=estimateDamage(dex,me,bot.foeActive,n,info);return e.immune?0:e.mid*e.accuracy;};
  const best=Math.max(0,...req.active[0].moves.filter(x=>!x.disabled).map(x=>dmg(x.move)));
  const mv=dex.moves.get(moveName);
  if(mv.category==='Status'){
    if(mv.id==='swordsdance'){
      const threat=incomingRisk(dex,me,bot.foeActive,{foeBoosts:bot.foeBoosts,seenMoves:bot.seenMoves[bot.foeActive]});
      if(threat>=ratio)return 'blunder';
      if((bot.boosts.atk||0)>=4)return 'weak';
    }
    return 'plausible';
  }
  const d=dmg(moveName);
  if(d===0&&mv.id!=='suckerpunch')return 'blunder';
  if(mv.priority<=0&&d<best/4)return 'weak';
  return 'plausible';
}
function script(plan,dex,log){
  return (req,bot,info)=>{
    const act=req.active[0],mega=act.canMegaEvo?' mega':'';
    if(info.lockReason==='encore')return info.canSwitch?ratSwitch(req,bot,dex,{encore:true}):null;
    const p=info.turn===1?plan.t1:info.turn===2?plan.t2:'ai';
    if(info.turn>2||p==='ai'){if(info.turn<=2)log[info.turn]='ai';return null;}
    if(p==='ratSwitch'){const c=info.canSwitch?ratSwitch(req,bot,dex,{encore:false}):null;log[info.turn]=c?'plausible':'ai';return c;}
    const k=Number(p.slice(1))-1,mv=act.moves[k];
    if(!mv||mv.disabled||mv.pp<=0){log[info.turn]='ai';return null;}
    log[info.turn]=classify(dex,req,bot,mv.move);log['n'+info.turn]=mv.move;
    return 'move '+(k+1)+mega;
  };
}
function candidates(matrix){
  const a=matrix.grids['H0|new'].analysis;
  // Own: our top-3 equilibrium picks, best Rotom-Wash pick vs the rival
  // equilibrium, and the PR #71 Primarina trio (both leads).
  const rot=a.own.filter(o=>o.three.includes('Rotom-Wash')).sort((x,y)=>y.vsEq-x.vsEq)[0];
  const own=new Set([...a.ownEq.slice(0,3).map(o=>o.pick),rot.pick,
    'Primarina>Metagross/Garchomp','Garchomp>Metagross/Primarina']);
  const foe={};
  // Rival: its equilibrium picks with weight >= 5% plus the old forcedA lead.
  for(const [k,g] of Object.entries(matrix.grids))if(k.endsWith('|new'))
    foe[k.split('|')[0]]=[...new Set([...g.analysis.foeEq.filter(r=>r.p>=0.05).map(r=>r.pick),'Golisopod>Garchomp/Mimikyu'])];
  return {own:[...own],foe};
}
const parse=l=>{const [lead,rest]=l.split('>');return [lead,...rest.split('/')];};
async function run({matrixFile,out}){
  const sim=load(),dex=sim.Dex.mod('champions');
  const matrix=JSON.parse(fs.readFileSync(matrixFile,'utf8'));
  const C=candidates(matrix),H=hypotheses(),own=reportedLive(),rows=[];
  // SHARD=i/n splits the (hyp, own, rival) pairs across processes; MERGE joins outputs.
  const [si0,sn]=(process.env.SHARD||'0/1').split('/').map(Number);let pairIdx=-1;
  for(const [hyp,foePicks] of Object.entries(C.foe))for(const op of C.own)for(const fp of foePicks)
  if(++pairIdx%sn===si0)for(const t1 of BR)for(const t2 of BR)for(const [si,seed] of SEEDS().entries())for(const reverse of [false,true]){
    const log={};
    const r=await battle(sim,structuredClone(own),structuredClone(H[hyp]),seed,{ownThree:parse(op),foeThree:parse(fp),reverse,
      script:script({t1,t2},dex,log),ownOptions:OWN_AI.new});
    if(r.errors)throw Error('choice errors '+[hyp,op,fp,t1,t2,si,reverse]);
    const ok=x=>x===undefined||x==='ai'||x==='plausible';
    rows.push({hyp,own:op,foe:fp,t1,t2,si,reverse,won:r.won,turns:r.turns,c1:log[1]||'-',c2:log[2]||'-',m1:log.n1||'',m2:log.n2||'',rational:ok(log[1])&&ok(log[2])});
  }
  return finish(C,rows,out);
}
function finish(C,rows,out){
  // Summary: per (hyp, own, foe): ai-only wins, worst over rational branches per seed/side.
  const sum={};
  for(const r of rows){
    const k=[r.hyp,r.own,r.foe].join('|');
    const s=sum[k]||(sum[k]={hyp:r.hyp,own:r.own,foe:r.foe,ai:[0,0],games:{},blunderOrWeak:0,beatenBy:{}});
    if(r.t1==='ai'&&r.t2==='ai'){s.ai[0]+=r.won;s.ai[1]++;}
    if(!r.rational){s.blunderOrWeak++;continue;}
    const g=r.si+(r.reverse?'r':'');if(!(g in s.games))s.games[g]=true;
    if(!r.won){s.games[g]=false;const b=(r.m1||r.t1)+'>'+(r.m2||r.t2);s.beatenBy[b]=(s.beatenBy[b]||0)+1;}
  }
  const summary=Object.values(sum).map(s=>({hyp:s.hyp,own:s.own,foe:s.foe,aiOnly:s.ai.join('/'),
    worstRational:Object.values(s.games).filter(Boolean).length+'/'+Object.keys(s.games).length,
    nonRationalBranchGames:s.blunderOrWeak,
    topBeatenBy:Object.entries(s.beatenBy).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k,n])=>k+' x'+n)}));
  // Compact per-pair outcome string, order t1 x t2 x seed x side (BR x BR x 6 x 2):
  // '1'/'0' = won/lost with plausible scripted actions, 'w'/'l' = won/lost on a
  // branch that contained a weak/blunder scripted action.
  const bits={};
  for(const r of rows){const k=[r.hyp,r.own,r.foe].join('|');
    const i=((BR.indexOf(r.t1)*BR.length+BR.indexOf(r.t2))*6+r.si)*2+(r.reverse?1:0);
    const b=bits[k]||(bits[k]=Array(BR.length*BR.length*12).fill('.'));b[i]=r.rational?(r.won?'1':'0'):(r.won?'w':'l');}
  const res={showdown:'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',format:'gen9championsbssregmc',ownAI:OWN_AI.new,candidates:C,branches:BR,
    note:'worstRational = seed/side games won under EVERY plausible rival T1/T2 branch. bits: per pair, index ((t1*6+t2)*6+seed)*2+reversed; 1/0 plausible won/lost, w/l non-plausible branch won/lost. m1/m2 = the lead move behind m1..m4 in that pair (see summary topBeatenBy).',
    summary,bits:Object.fromEntries(Object.entries(bits).map(([k,v])=>[k,v.join('')]))};
  if(process.env.FULL_ROWS)res.rows=rows;
  if(out){fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(res));}
  return res;
}
async function main(){
  if(process.env.MERGE){
    const parts=process.env.MERGE.split(',').map(f=>JSON.parse(fs.readFileSync(f,'utf8')));
    const rows=parts.flatMap(p=>p.rows).sort((a,b)=>(a.hyp+a.own+a.foe+a.t1+a.t2).localeCompare(b.hyp+b.own+b.foe+b.t1+b.t2)||a.si-b.si||a.reverse-b.reverse);
    const res=finish(parts[0].candidates,rows,process.env.OUT);
    for(const s of res.summary)console.log(s.hyp,s.own.padEnd(34),'vs',s.foe.padEnd(34),'ai',s.aiOnly,'worstRational',s.worstRational,'nonRat',s.nonRationalBranchGames,s.topBeatenBy.join(', '));
    return;
  }
  const res=await run({matrixFile:process.env.MATRIX||path.join(__dirname,'reports','data','a-preview-matrix-20261030.json'),
    out:process.env.OUT||path.join(__dirname,'output','a-branch-audit.json')});
  for(const s of res.summary)console.log(s.hyp,s.own.padEnd(34),'vs',s.foe.padEnd(34),'ai',s.aiOnly,'worstRational',s.worstRational,'nonRat',s.nonRationalBranchGames,s.topBeatenBy.join(', '));
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={run,classify,script,candidates};
