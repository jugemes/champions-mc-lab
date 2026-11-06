#!/usr/bin/env node
'use strict';
// PR #100 item 5: (a) determinism of a hooked pr96-eval replay vs the saved
// PR #97 JSON (policy rows), (b) summary of the pr100-join-hook JSONL: every
// pr98 `known` hit joined with the rival decision of that turn.
// usage: node pr100-join-summary.js <saved.json> <replay.json> <join.jsonl> > out.json
const fs=require('node:fs');
const [savedF,replayF,joinF]=process.argv.slice(2);
const saved=JSON.parse(fs.readFileSync(savedF,'utf8')),rep=JSON.parse(fs.readFileSync(replayF,'utf8'));
const KEYS=['pick','meanAce','worstAceCell','meanAll','meanRat94','maskedGames','residualImmuneT12','irrationalT12'];
let rows=0;const diff=[];
for(const [id,s] of Object.entries(saved.sixes))for(const [h,H] of Object.entries(s.hyps))for(const [m,M] of Object.entries(H.byModel))for(const [p,v] of Object.entries(M)){
  rows++;const r=rep.sixes?.[id]?.hyps?.[h]?.byModel?.[m]?.[p];for(const k of KEYS)if(!r||JSON.stringify(r[k])!==JSON.stringify(v[k]))diff.push({id,h,m,p,k,saved:v[k],replay:r?.[k]});}
const sel=Object.fromEntries(Object.entries(saved.sixes).map(([id,s])=>[id,JSON.stringify(s.selection)===JSON.stringify(rep.sixes[id].selection)&&s.pr96SeedB===rep.sixes[id].pr96SeedB]));
const L=fs.readFileSync(joinF,'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l));
const battles=L.filter(r=>!r.hits&&r.final).reduce((s,r)=>s+r.count,0);
const B=L.filter(r=>r.hits);
const tab={},forced={},why={},ex={};
for(const b of B)for(const h of b.hits){
  const rival=b.aware?'aware':'naive';
  const cls=rival==='naive'&&h.cls!=='forced'?'naive rival (no masker): would be masked':h.cls;
  const k=rival+' | '+(h.turn<=2?'T1-2':'T3+')+' | '+cls;tab[k]=(tab[k]||0)+1;
  if(h.cls==='forced'){const f=rival+' | '+h.forcedBy;forced[f]=(forced[f]||0)+1;}
  if(rival==='aware'){const w=cls+' | '+h.move+' -> '+h.target;why[w]=(why[w]||0)+1;
    const e=cls+' | '+(h.forcedBy||'');if((ex[e]||(ex[e]=[])).length<3)ex[e].push({seed:b.seed,reverse:b.reverse,own:b.own,foe:b.foe,turn:h.turn,move:h.move,target:h.target,decision:h.decision,protocol:b.lines});}
}
const aware=B.filter(b=>b.aware);
console.log(JSON.stringify({showdown:'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',format:'gen9championsbssregmc',
  determinism:{policyRows:rows,differences:diff.length,first:diff.slice(0,5),selectionsIdentical:sel,verdictSaved:saved.verdict?.fails,verdictReplay:rep.verdict?.fails},
  battlesThroughHook:battles,battlesWithKnown:{aware:aware.length,naive:B.length-aware.length,awareWithT3plus:aware.filter(b=>b.hits.some(h=>h.turn>=3)).length},
  knownHitsByClass:tab,forcedBy:forced,awareByMove:why,awareExamples:ex,
  note:'Shadow only (same choices). aware = pr96 immuneAware rival (selector, T1/T2 and eval games); naive = rivals without the masker (older selectors, naive eval rows). Heuristic AI vs heuristic AI, NOT a ladder win rate.'},null,1));
