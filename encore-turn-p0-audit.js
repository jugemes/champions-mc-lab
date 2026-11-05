#!/usr/bin/env node
'use strict';
// PR #70 request (PR #69 review 5712337767): P0-3 / P0-4 in full pinned-Showdown
// games.
//   Case A public six, our reportedLive() six, rival three forcedA
//   (Golisopod/Garchomp/Mimikyu, lead Golisopod), our three fixed to
//   Primarina/Metagross/Garchomp, lead Primarina vs lead Garchomp.
//   Own turn AI: old (baseline) vs guard (lab.js encoreGuard: no Encore into
//   an already Encored foe or a foe that has not moved since it came in).
//   Rival, scripted on the rival side only:
//     T1, T2: ai | each of Golisopod's 4 legal moves | ratSwitch | toGarchomp
//       (toGarchomp = PR #69's unconditional switch, kept ONLY as a reference:
//       not a rational branch; T1 only)
//     on an Encore-locked request (lockReason 'encore' from the rival's own
//     public log): stay | ratSwitch
//   ratSwitch: bench mon with the lowest public-info risk from our active
//   (lab incomingRisk: public STAB + moves already seen, own known set),
//   divided by its current HP, plus Stealth Rock chip on the rival's side,
//   Disguise intact = one hit absorbed. Switch only if that mon survives the
//   estimated hit and, outside Encore, if it takes clearly less than the
//   current mon. Our hidden sets never reach the rival script; the rival's
//   hidden sets never reach our side (our three is fixed, our AI reads the
//   public log only).
//   Same seeds as PR #67/#69 x side reversal. Heuristic AI vs heuristic AI,
//   NOT a ladder win rate.
// Rational-rival summary: per (lead, own AI, seed, side) the worst result for
// us over the rival's rational branches (T1/T2 in ai|4 moves|ratSwitch,
// Encore response ratSwitch). A stay-in-Encore game we won is reported apart;
// it counts as "encoreStayWorse" (counterfactually worse for the rival) only
// when the paired ratSwitch game with the same seed/side/T1/T2 is a loss for us.
//   SHOWDOWN_DIR=... OUT=output/encore-turn-p0-audit.json node encore-turn-p0-audit.js
const fs=require('node:fs');
const path=require('node:path');
const {load}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {caseList}=require('./legal-search-v2-compare');
const {incomingRisk}=require('./damage');
const {misplaysV3,anyTag,VOLUNTARY_PR69}=require('./misplay-tags-v3');
const {battle,encoreFacts,earlyLines,bench,nameOf,SEEDS,LEADS}=require('./encore-lead-audit');
const FORMAT='gen9championsbssregmc';
const SHOWDOWN='3a766f2cfb5e51c1e428cfe87d0dba91a8f01640';
const MOVES=['Iron Head','Leech Life','Sucker Punch','Swords Dance'];
const T1=['ai',...MOVES,'ratSwitch','toGarchomp'];
const T2=['ai',...MOVES,'ratSwitch'];
const ENC=['stay','ratSwitch'];
const OWN_AI={old:{},guard:{encoreGuard:true}};
const RATIONAL_T=new Set(['ai',...MOVES,'ratSwitch']);

const hpFrac=p=>{if(/ fnt$/.test(p.condition))return 0;const [h,m]=String(p.condition).split(' ')[0].split('/').map(Number);return m>0?h/m:1;};
// Stealth Rock on the rival's own side, read from the public log by the rival bot.
function rockChip(dex,species,bot){
  if(!bot.ownHazards||!bot.ownHazards.stealthrock)return 0;
  const t=dex.species.get(species).types;return 0.125*2**dex.getEffectiveness('Rock',t);
}
function riskOf(dex,bot,p){
  const set=bot.getSet(p),name=nameOf(p.details);
  let r=incomingRisk(dex,set,bot.foeActive,{foeBoosts:bot.foeBoosts,seenMoves:bot.seenMoves[bot.foeActive],weather:bot.weather});
  if(name==='Mimikyu'&&/Disguise/.test(set.ability||''))r=Math.min(r,0.125);// intact Disguise; Mimikyu-Busted shows in details
  const hp=hpFrac(p);return hp>0?r/hp+rockChip(dex,name,bot)/hp:Infinity;
}
// Rational switch target, or null to stay.
function ratSwitch(req,bot,dex,{encore}){
  const b=bench(req).map(x=>({...x,risk:riskOf(dex,bot,x.p)})).sort((a,c)=>a.risk-c.risk);
  if(!b.length)return null;
  const best=b[0];(bot.ratLog||(bot.ratLog=[])).push({turn:bot.turn,encore,to:nameOf(best.p.details),risk:+best.risk.toFixed(2)});
  if(best.risk>=1)return null;// switch-in is estimated to fall to one hit
  if(encore)return 'switch '+(best.i+1);// Encore-locked: staying gives a free turn
  const cur=riskOf(dex,bot,req.side.pokemon.find(p=>p.active));
  return best.risk<cur*0.6?'switch '+(best.i+1):null;
}
function script({t1,t2,enc},dex){
  return (req,bot,info)=>{
    const act=req.active[0];const mega=act.canMegaEvo?' mega':'';
    if(info.lockReason==='encore'){
      if(enc==='stay'||!info.canSwitch)return null;
      return ratSwitch(req,bot,dex,{encore:true});
    }
    const plan=info.turn===1?t1:info.turn===2?t2:'ai';
    if(plan==='ai')return null;
    if(plan==='ratSwitch')return info.canSwitch?ratSwitch(req,bot,dex,{encore:false}):null;
    if(plan==='toGarchomp'){const x=bench(req).find(y=>nameOf(y.p.details)==='Garchomp');return x&&info.canSwitch?'switch '+(x.i+1):null;}
    const i=act.moves.findIndex(m=>m.move===plan&&!m.disabled&&m.pp>0);
    return i>=0?'move '+(i+1)+mega:null;
  };
}
// Facts the review asked for: rival switch-ins that faint the same turn, and
// our Encore uses that fail / hit a foe that just switched in.
function facts(log,ownSide,foeSide){
  const f={rivalSwitchInFaintSameTurn:0,ownEncore:0,ownEncoreFail:0,ownEncoreIntoFreshSwitch:0,ownEncoreIntoEncored:0};
  let turn=0,swIn=null,foeMovedSinceIn=false,foeEnc=false,lastOwnEncoreLine=-1;const lines=log.split('\n');
  for(let k=0;k<lines.length;k++){
    const a=lines[k].split('|');
    if(a[1]==='turn'){turn=Number(a[2]);swIn=null;continue;}
    const side=(a[2]||'').slice(0,2);
    if((a[1]==='switch'||a[1]==='drag')&&side===foeSide){swIn=a[2].slice(5);foeMovedSinceIn=false;foeEnc=false;}
    if(a[1]==='faint'&&side===foeSide&&swIn===a[2].slice(5))f.rivalSwitchInFaintSameTurn++;
    if(a[1]==='move'&&side===foeSide)foeMovedSinceIn=true;
    if((a[1]==='-start'||a[1]==='-end')&&side===foeSide&&/Encore$/.test(a[3]||''))foeEnc=a[1]==='-start';
    if(a[1]==='move'&&side===ownSide&&a[3]==='Encore'){
      f.ownEncore++;lastOwnEncoreLine=k;
      if(!foeMovedSinceIn)f.ownEncoreIntoFreshSwitch++;else if(foeEnc)f.ownEncoreIntoEncored++;
    }
    if(a[1]==='-fail'&&side===ownSide&&k===lastOwnEncoreLine+1)f.ownEncoreFail++;
  }
  return f;
}
const nz=o=>Object.fromEntries(Object.entries(o).filter(([,v])=>v));
async function run({out}={}){
  const sim=load();const dex=sim.Dex.mod('champions');
  const A=caseList().find(c=>c.id==='A_golisopod');const own=reportedLive();
  const rows=[];
  for(const [lead,three] of Object.entries(LEADS))for(const [ai,ownOptions] of Object.entries(OWN_AI))
  for(const t1 of T1)for(const t2 of T2)for(const enc of ENC)for(const seed of SEEDS())for(const reverse of [false,true]){
    if(t1==='toGarchomp'&&t2!=='ai')continue;// reference branch only
    const r=await battle(sim,structuredClone(own),structuredClone(A.team),seed,{ownThree:three,foeThree:A.forcedA,reverse,script:script({t1,t2,enc},dex),ownOptions});
    if(r.errors)throw Error('choice errors '+[lead,ai,t1,t2,enc].join(' '));
    const v3=misplaysV3(r.log,{requests:r.reqLog});
    rows.push({lead,ai,t1,t2,enc,seed:seed.join('-'),reverse,won:r.won,turns:r.turns,
      rational:RATIONAL_T.has(t1)&&RATIONAL_T.has(t2)&&enc==='ratSwitch',
      foeV3:nz(v3[r.foeSide]),ownV3:nz(v3[r.ownSide]),foeTagged:anyTag(v3[r.foeSide]),foeTaggedPR69:anyTag(v3[r.foeSide],VOLUNTARY_PR69),
      encore:encoreFacts(r.log,r.foeSide,r.reqLog),facts:facts(r.log,r.ownSide,r.foeSide),
      foeLocks:r.reqLog.filter(x=>x.side===r.foeSide&&x.locked).map(x=>x.turn+':'+x.lockReason),
      early:earlyLines(r.log,r.ownSide,3)});
  }
  // counterfactual tier for encoreStay: paired same seed/side/T1/T2, enc ratSwitch
  const key=r=>[r.lead,r.ai,r.t1,r.t2,r.seed,r.reverse].join('|');
  const pair=new Map(rows.filter(r=>r.enc==='ratSwitch').map(r=>[key(r),r]));
  for(const r of rows)if(r.enc==='stay'&&(r.foeV3.encoreStay||0)>0){const p=pair.get(key(r));r.encoreStayWorse=Boolean(r.won&&p&&!p.won);}
  // cells
  const cells={};
  for(const r of rows){
    const k=[r.lead,r.ai,r.t1,r.t2,r.enc].join('|');
    const c=cells[k]||(cells[k]={lead:r.lead,ai:r.ai,t1:r.t1,t2:r.t2,enc:r.enc,rational:r.rational,w:0,n:0,winsWithEncoreStay:0,encoreStayWorse:0,
      ownEncoreFail:0,ownEncoreIntoFreshSwitch:0,ownEncoreIntoEncored:0,rivalSwitchInFaintSameTurn:0});
    c.w+=r.won;c.n++;c.winsWithEncoreStay+=r.won&&(r.foeV3.encoreStay||0)>0;c.encoreStayWorse+=Boolean(r.encoreStayWorse);
    for(const f of ['ownEncoreFail','ownEncoreIntoFreshSwitch','ownEncoreIntoEncored','rivalSwitchInFaintSameTurn'])c[f]+=r.facts[f];
  }
  // worst case over rational rival branches, per (lead, ai, seed, side)
  const worst={};
  for(const r of rows.filter(x=>x.rational)){
    const k=[r.lead,r.ai].join('|'),g=r.seed+'|'+r.reverse;
    const w=worst[k]||(worst[k]={lead:r.lead,ai:r.ai,games:{},rationalCells:0});
    if(!(g in w.games))w.games[g]={won:true,beatenBy:[]};
    if(!r.won){w.games[g].won=false;w.games[g].beatenBy.push(r.t1+'>'+r.t2);}
  }
  for(const w of Object.values(worst)){w.survivesAllRational=Object.values(w.games).filter(x=>x.won).length;w.n=Object.keys(w.games).length;
    for(const g of Object.values(w.games))g.beatenBy=g.beatenBy.slice(0,6);}
  const res={showdown:SHOWDOWN,format:FORMAT,own:'reportedLive()',case:'A_golisopod',rivalThree:A.forcedA,leads:LEADS,
    seeds:SEEDS().map(s=>s.join('-')),branches:{t1:T1,t2:T2,encore:ENC,ownAI:Object.keys(OWN_AI)},
    note:'Full pinned-Showdown games. Rival branches scripted on the rival side only; ownAI guard = lab.js encoreGuard. toGarchomp is PR #69\'s unconditional switch kept as a non-rational reference. Heuristic AI vs heuristic AI, NOT a ladder win rate.',
    worstCaseRational:Object.values(worst),cells:Object.values(cells),rows};
  if(out){fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(res));}// compact: ~1.8k rows with early traces
  return res;
}
async function main(){
  const res=await run({out:process.env.OUT||path.join(__dirname,'output','encore-turn-p0-audit.json')});
  for(const w of res.worstCaseRational)console.log('worst-case vs rational rival',w.lead.padEnd(14),w.ai.padEnd(6),w.survivesAllRational+'/'+w.n);
  const agg={};
  for(const c of res.cells){
    const k=[c.lead,c.ai,c.t1,c.enc].join('|');const a=agg[k]||(agg[k]={w:0,n:0,stayWins:0,worse:0,fail:0,fresh:0,enc:0,swFaint:0});
    a.w+=c.w;a.n+=c.n;a.stayWins+=c.winsWithEncoreStay;a.worse+=c.encoreStayWorse;a.fail+=c.ownEncoreFail;a.fresh+=c.ownEncoreIntoFreshSwitch;a.enc+=c.ownEncoreIntoEncored;a.swFaint+=c.rivalSwitchInFaintSameTurn;
  }
  for(const [k,a] of Object.entries(agg))console.log(k.padEnd(40),'win',a.w+'/'+a.n,'stayWins',a.stayWins,'stayWorse',a.worse,'ownEncFail',a.fail,'intoFresh',a.fresh,'intoEncored',a.enc,'rivalSwInFaint',a.swFaint);
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={run,script,ratSwitch,riskOf,facts,OWN_AI};
