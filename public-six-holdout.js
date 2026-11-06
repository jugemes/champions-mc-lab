#!/usr/bin/env node
'use strict';
// PR #76 P0-B: small pinned-Showdown regression of the public-six preview entry
// point (public-six-preview.js) on public sixes it has NO matrix for
// (B_lucarioZ, C_charizardY, Real_indeedee_scarf, NEW_realE_sun, and
// HOLD_psychic_offense as an unknown six) plus the registered A_golisopod.
//   our pick    entry point from the rival's public six species only; for A it
//               is a seeded draw from the robust mixture, also compared with the
//               legacy chooseThree pick on the same seeds/sides
//   rival picks from the rival's view of OUR public six: its legacy chooseThree
//               pick, and an ace-lead pick (the case's ace leads + the legacy
//               pick's other two), so the strong ace (Charizard-Y, Indeedee, ...)
//               is never cut by construction
//   rival sets  the case team (one legal role hypothesis; validated here), base AI
//   our turn AI pr75 = encoreGuard speedSafe + publicMegaAbility (PR #75);
//               pr76 = pr75 + publicCondition + ownCondition (PR #76 P0-A)
// Same seeds, both sides. T1/T2 lines from the engine log are saved per game.
// Heuristic AI vs heuristic AI, NOT a ladder win rate; per-cell n is tiny.
//   SHOWDOWN_DIR=... OUT=reports/data/public-six-holdout-20261031.json node public-six-holdout.js
const fs=require('node:fs');
const path=require('node:path');
const {load,normalize,hashSeed,chooseThree}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {caseList}=require('./legal-search-v2-compare');
const {battle,earlyLines}=require('./encore-lead-audit');
const {choosePublicSixPreview}=require('./public-six-preview');
const SHOWDOWN='3a766f2cfb5e51c1e428cfe87d0dba91a8f01640';
const CASES={A_golisopod:'Golisopod',B_lucarioZ:'Lucario',C_charizardY:'Charizard',Real_indeedee_scarf:'Indeedee',NEW_realE_sun:'Charizard',HOLD_psychic_offense:'Alakazam'};
const AI={pr75:{encoreGuard:'speedSafe',publicMegaAbility:true},pr76:{encoreGuard:'speedSafe',publicMegaAbility:true,publicCondition:true,ownCondition:true}};
function rivalPicks(dex,rival,ownSix,ace){
  const legacy=chooseThree(dex,rival,ownSix).map(n=>rival[n-1].species);
  const aceLead=[ace,...legacy.filter(x=>x!==ace)].slice(0,3);
  const out=[{src:'rivalLegacy',pick:legacy}];
  if(aceLead.join()!==legacy.join())out.push({src:'aceLead',pick:aceLead});
  return {picks:out,aceInLegacy:legacy.includes(ace)};
}
async function run({cases=Object.keys(CASES),seedN=3}={}){
  const sim=load(),dex=sim.Dex.mod('champions'),own=reportedLive(),all=caseList(),games=[],meta={};
  const validator=sim.TeamValidator.get('gen9championsbssregmc');
  for(const id of cases){
    const rival=all.find(c=>c.id===id).team,six=rival.map(p=>p.species);
    const prob=validator.validateTeam(normalize(rival));if(prob?.length)throw Error(id+': '+prob.join('; '));
    const rp=rivalPicks(dex,rival,own.map(p=>p.species),CASES[id]);
    meta[id]={publicSix:six,ace:CASES[id],rivalPicks:rp.picks,aceInRivalLegacy:rp.aceInLegacy};
    for(let s=0;s<seedN;s++){
      const seed=hashSeed(7630000+Object.keys(CASES).indexOf(id)*100+s);
      for(const reverse of [false,true]){
        const entry=choosePublicSixPreview({dex,own,publicSix:six,seed,side:reverse?'p2':'p1'});
        const ours=[{src:'entry',pick:entry.pick,log:entry}];
        if(entry.status==='registered')ours.push({src:'legacy',pick:chooseThree(dex,own,six).map(n=>own[n-1].species)});
        for(const o of ours)for(const r of rp.picks)for(const [mode,opt] of Object.entries(AI)){
          const g=await battle(sim,structuredClone(own),structuredClone(rival),seed,{ownThree:o.pick,foeThree:r.pick,reverse,script:null,ownOptions:opt});
          if(g.errors)throw Error('choice errors '+[id,s,reverse,mode]);
          const L=g.log.split('\n');
          games.push({case:id,seed:seed.join('-'),reverse,mode,ourSrc:o.src,ours:o.pick.join('/'),entryStatus:o.log?.status||'n/a',
            entryDraw:o.log?.draw,rivalSrc:r.src,rival:r.pick.join('/'),won:g.won,turns:g.turns,
            aceMega:L.some(l=>l.startsWith('|detailschange|'+g.foeSide+'a: '+CASES[id])),
            sun:L.some(l=>l.startsWith('|-weather|SunnyDay')),t1t2:earlyLines(g.log,g.ownSide,2)});
        }
      }
    }
  }
  // Same seed/side/picks: did PR #76 parsing change the game?
  const key=g=>[g.case,g.seed,g.reverse,g.ourSrc,g.rivalSrc].join('|'),by={};
  for(const g of games)(by[key(g)]||(by[key(g)]={}))[g.mode]=g;
  const pairs=Object.values(by).filter(p=>p.pr75&&p.pr76);
  const cell={};
  for(const g of games){const k=[g.case,g.ourSrc,g.rivalSrc,g.mode].join('|');const c=cell[k]||(cell[k]={case:g.case,ours:g.ourSrc,rival:g.rivalSrc,mode:g.mode,games:0,won:0});c.games++;c.won+=Number(g.won);}
  return {showdown:SHOWDOWN,format:'gen9championsbssregmc',own:'reportedLive (reported-live-roster-20261027.js)',ai:AI,meta,
    note:'Rival sets = the case team (one legal hypothesis each). Heuristic AI vs heuristic AI, NOT a ladder win rate; per cell n=2*seedN.',
    cells:Object.values(cell),
    pr75VsPr76:{pairs:pairs.length,sameT1T2:pairs.filter(p=>JSON.stringify(p.pr75.t1t2)===JSON.stringify(p.pr76.t1t2)).length,
      winChanged:pairs.filter(p=>p.pr75.won!==p.pr76.won).map(p=>key(p.pr75))},
    games};
}
// Rival best response to our entry pick: every rival 3+lead (60) from the case
// six, pr76 turn AI, same seeds/sides. For the fallback (deterministic) pick
// this is its security under this one legal hypothesis of the rival sets.
async function allRival({cases=Object.keys(CASES).filter(c=>c!=='A_golisopod'),seedN=3}={}){
  const {picks,label}=require('./a-preview-matrix-audit');
  const sim=load(),dex=sim.Dex.mod('champions'),own=reportedLive(),all=caseList(),out={};
  for(const id of cases){
    const rival=all.find(c=>c.id===id).team,six=rival.map(p=>p.species);
    const entry=choosePublicSixPreview({dex,own,publicSix:six,seed:[1,2,3,4]});
    if(entry.status!=='fallback')throw Error('allRival is for deterministic fallback picks only');
    const rows=[];
    for(const fp of picks(rival)){let won=0,n=0,aceMega=0;
      for(let s=0;s<seedN;s++)for(const reverse of [false,true]){
        const seed=hashSeed(7640000+Object.keys(CASES).indexOf(id)*100+s);
        const g=await battle(sim,structuredClone(own),structuredClone(rival),seed,{ownThree:entry.pick,foeThree:fp,reverse,script:null,ownOptions:AI.pr76});
        if(g.errors)throw Error('choice errors');won+=Number(g.won);n++;
        aceMega+=Number(g.log.includes('|detailschange|'+g.foeSide+'a: '+CASES[id]));}
      rows.push({rival:label(fp),won,n,aceIn:fp.includes(CASES[id]),aceMega});}
    rows.sort((a,b)=>a.won/a.n-b.won/b.n);
    const worst=rows[0].won/rows[0].n,aceRows=rows.filter(r=>r.aceIn);
    out[id]={ours:entry.pick.join('/'),status:entry.status,security:+worst.toFixed(3),mean:+(rows.reduce((t,r)=>t+r.won/r.n,0)/rows.length).toFixed(3),
      rivalPicksAtWorst:rows.filter(r=>r.won/r.n===worst).length,worst5:rows.slice(0,5),
      aceSecurity:aceRows.length?+(aceRows[0].won/aceRows[0].n).toFixed(3):null,worstAce:aceRows[0]||null,games:rows.length*2*seedN};
  }
  return out;
}
async function main(){
  const res=await run({seedN:Number(process.env.SEEDN||3)});
  res.allRival=await allRival({seedN:Number(process.env.SEEDN||3)});
  for(const [id,r] of Object.entries(res.allRival))console.log('allRival',id.padEnd(22),r.ours,'security',r.security,'mean',r.mean,'atWorst',r.rivalPicksAtWorst,'aceSec',r.aceSecurity,JSON.stringify(r.worst5.slice(0,3)));
  for(const [id,m] of Object.entries(res.meta))console.log(id.padEnd(22),'ace',m.ace,'inRivalLegacy',m.aceInRivalLegacy,JSON.stringify(m.rivalPicks));
  for(const c of res.cells)console.log(c.case.padEnd(22),c.ours.padEnd(7),c.rival.padEnd(12),c.mode,c.won+'/'+c.games);
  console.log(JSON.stringify(res.pr75VsPr76));
  if(process.env.OUT){fs.mkdirSync(path.dirname(process.env.OUT),{recursive:true});fs.writeFileSync(process.env.OUT,JSON.stringify(res,null,1));}
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={run,allRival,rivalPicks,CASES,AI};
