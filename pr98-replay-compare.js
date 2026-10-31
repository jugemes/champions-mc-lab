#!/usr/bin/env node
'use strict';
// PR #98 impact: compare a shadow replay of pr96-eval.js (run with
// `node -r ./pr98-shadow-hook.js`) against the SAVED PR #97 JSON, and
// summarise the shadow log (pr96 vs pr98 detector, pr96 vs pr98 masker).
// usage: node pr98-replay-compare.js <saved.json> <replay.json> <shadow.jsonl> [out.json]
const fs=require('node:fs');
const [saved,replay,shadow,outFile]=process.argv.slice(2);
const A=JSON.parse(fs.readFileSync(saved)),B=JSON.parse(fs.readFileSync(replay));
// 1. determinism: every aggregate and per-hypothesis policy value
const diffs=[];let compared=0;
for(const [id,o] of Object.entries(A.sixes)){
  const p=B.sixes[id];if(!p){diffs.push(id+': missing in replay');continue;}
  for(const k of ['selection','pr96SeedB'])if(JSON.stringify(o[k])!==JSON.stringify(p[k]))diffs.push(id+' '+k+': '+JSON.stringify(o[k])+' vs '+JSON.stringify(p[k]));
  for(const [h,x] of Object.entries(o.hyps))for(const [m,hm] of Object.entries(x.byModel))for(const [pol,v] of Object.entries(hm)){
    const w=p.hyps[h]?.byModel[m]?.[pol];compared++;
    for(const f of ['pick','meanAce','worstAceCell','meanAll','meanRat94','maskedGames','residualImmuneT12','irrationalT12'])
      if(JSON.stringify(v[f])!==JSON.stringify(w?.[f]))diffs.push([id,h,m,pol,f].join('/')+': '+v[f]+' vs '+w?.[f]);
  }
}
if(JSON.stringify(A.verdict.fails)!==JSON.stringify(B.verdict.fails))diffs.push('verdict fails differ');
// 2. shadow log
const L=fs.readFileSync(shadow,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
const counts=L.filter(x=>x.final).reduce((s,x)=>s+x.count,0);
const G=L.filter(x=>x.count===undefined);
const key=x=>x.turn+'|'+x.move;
const S={battlesLogged:G.length,workerBattleCountFinal:counts};
for(const grp of ['aware','naive']){
  const Z=G.filter(x=>(grp==='aware')===x.aware);
  const c={battles:Z.length,pr96Hit:0,pr98Known:0,pr96HitT12:0,pr98KnownT12:0,
    pr96OnlySameTurnMega:0,pr96OnlyLocked:0,pr96OnlyOther:0,pr98OnlyBalloon:0,possibleMega:0,lockedLines:0,maskerDisagree:0,
    knownWhy:{},knownT12Why:{},knownT12Choice:{}};
  for(const x of Z){
    const k98=new Set(x.known98.map(key)),poss=new Set(x.possible98.map(key));
    if(x.d96.length)c.pr96Hit++;if(x.known98.length)c.pr98Known++;
    if(x.d96.some(y=>y.turn<=2))c.pr96HitT12++;if(x.known98.some(y=>y.turn<=2))c.pr98KnownT12++;
    for(const y of x.d96)if(!k98.has(key(y))){if(poss.has(key(y)))c.pr96OnlySameTurnMega++;else if(x.locked98)c.pr96OnlyLocked++;else c.pr96OnlyOther++;}
    const k96=new Set(x.d96.map(key));for(const y of x.known98)if(!k96.has(key(y))&&y.why==='public airballoon')c.pr98OnlyBalloon++;
    c.possibleMega+=x.possible98.length;c.lockedLines+=x.locked98||0;c.maskerDisagree+=x.maskerDiv.length;
    for(const y of x.known98){const w=y.why+' | '+y.move+' -> '+y.target;c.knownWhy[w]=(c.knownWhy[w]||0)+1;
      if(y.turn<=2){c.knownT12Why[w]=(c.knownT12Why[w]||0)+1;
        const d=x.dec.find(z=>z.turn===y.turn);const ch=d?(d.choice===null?'base AI':d.choice)+(d.imm96?' [masker saw '+d.imm96+']':' [masker saw none]'):'no rival decision this turn';
        c.knownT12Choice[ch]=(c.knownT12Choice[ch]||0)+1;}}
  }
  S[grp]=c;
}
const ex=G.filter(x=>x.aware&&x.known98.some(y=>y.turn<=2)).slice(0,3).map(x=>({seed:x.seed,reverse:x.reverse,own:x.own,foe:x.foe,known98:x.known98,dec:x.dec,lines:x.lines}));
const out={saved,replay,determinism:{policyRowsCompared:compared,differences:diffs.length,first:diffs.slice(0,20)},shadow:S,awareResidualExamples:ex};
if(outFile)fs.writeFileSync(outFile,JSON.stringify(out,null,1));
console.log(JSON.stringify(out,null,1).slice(0,6000));
