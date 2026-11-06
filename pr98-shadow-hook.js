'use strict';
// PR #98 impact audit. Preload (`node -r ./pr98-shadow-hook.js pr96-eval.js`)
// to replay the PR #97 evaluation UNCHANGED while recording, per battle:
//  - pr96 publicImmune96 vs pr98 publicImmune98 on the same log (P0), and
//  - for every rival decision, pr96 publicImmuneMoves vs pr98
//    publicImmuneMoves98 on the same request / public bot state (P1).
// Nothing the battle sees is changed (shadow only), so the eval output must
// equal the saved PR #97 JSON if the pinned engine is deterministic. Forked
// pr96 workers inherit the preload through process.execArgv.
// Output: JSON lines in PR98_SHADOW_FILE (only battles with a detector hit or
// a masker disagreement) and a per-process battle counter.
const fs=require('node:fs');
const FILE=process.env.PR98_SHADOW_FILE;
if(FILE){
  // pr96-paired / pr98-timing are required lazily: in a forked worker
  // pr96-paired.js is the main module and must not be loaded (and start a
  // second workerMain) before it registers itself in require.cache.
  const E=require('./encore-lead-audit');
  let dex=null,cur=null,n=0,X,Y;
  // The rival script passed to battle() (pr96 immuneAware wrapper) is wrapped
  // so the public bot state is read just before each rival decision.
  const origBattle=E.battle;
  E.battle=async function(sim,own,foe,seed,opts){
    dex=dex||sim.Dex.mod('champions');X=X||require('./pr96-paired');Y=Y||require('./pr98-timing');
    cur={foeSide:opts.reverse?'p1':'p2',dec:[]};
    const script=opts.script;
    const wrapped=script?(req,bot,info)=>{
      let a='',b='';
      if(req.active?.[0]){a=X.publicImmuneMoves(dex,req,bot).map(x=>x.move).join('/');b=Y.publicImmuneMoves98(dex,req,bot).map(x=>x.move).join('/');}
      const c=script(req,bot,info);
      cur.dec.push({turn:info.turn,foeActive:bot.foeActive,foeItem:bot.foeItem,foeAbility:bot.foeAbility,imm96:a,imm98:b,choice:c});
      return c;
    }:script;
    const g=await origBattle.call(this,sim,own,foe,seed,{...opts,script:wrapped});
    n++;
    const d96=X.publicImmune96(g.log,g.foeSide,dex),d98=Y.publicImmune98(g.log,g.foeSide,dex);
    const div=cur.dec.filter(d=>d.imm96!==d.imm98);
    if(d96.length||d98.known.length||d98.possible.length||d98.locked||div.length){
      const turns=new Set([...d96,...d98.known,...d98.possible].map(x=>x.turn));
      const TT=require('./pr82-switch-utility-t1t2').splitTurns(g.log);
      const lines=[...turns].sort((a,b)=>a-b).slice(0,3).flatMap(t=>(TT[t]||[]).filter(l=>/^\|(move|switch|drag|detailschange|-immune|-item|-enditem|-mega|cant|faint)\|/.test(l)).map(l=>'T'+t+' '+l)).slice(0,30);
      // pr96 immuneAware wrapper vs a plain branch script (naive rival)
      const aware=!!script&&/publicImmuneMoves\(/.test(String(script));
      fs.appendFileSync(FILE,JSON.stringify({pid:process.pid,n,aware,seed,reverse:!!opts.reverse,own:opts.ownThree,foe:opts.foeThree,locked98:d98.locked,
        d96,known98:d98.known,possible98:d98.possible,maskerDiv:div,dec:cur.dec.filter(d=>turns.has(d.turn)),lines})+'\n');
    }
    if(n%500===0)fs.appendFileSync(FILE,JSON.stringify({pid:process.pid,count:n})+'\n');
    return g;
  };
  // flush the final count when the worker is killed
  const fin=()=>{try{fs.appendFileSync(FILE,JSON.stringify({pid:process.pid,count:n,final:true})+'\n');}catch{}};
  process.on('SIGTERM',()=>{fin();process.exit(0);});
}
