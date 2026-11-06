'use strict';
// PR #100 request item 5. Preload (`node -r ./pr100-join-hook.js ...`) into
// the pr96 workers (forked children inherit execArgv) to record, for every
// RIVAL decision, the request the rival actually saw and the immunity list the
// masker used, and to JOIN each pr98 `known` public-immunity hit of the
// protocol with the decision of that same turn. PR #99 only inferred from the
// code that T3+ known hits were the forced `none (no alternative)` path; this
// records it per hit. Shadow only: the battle receives the same choices.
// Output: JSON lines in PR100_JOIN_FILE, one per battle with >=1 known hit,
// plus per-process battle counts.
const fs=require('node:fs');
const FILE=process.env.PR100_JOIN_FILE;
if(FILE){
  const E=require('./encore-lead-audit');
  let dex=null,X,Y,n=0;
  const origBattle=E.battle;
  E.battle=async function(sim,own,foe,seed,opts){
    dex=dex||sim.Dex.mod('champions');X=X||require('./pr96-paired');Y=Y||require('./pr98-timing');
    const dec=[],script=opts.script;
    // pr96 immuneAware wrapper (aware rival) vs plain branch script (naive)
    const aware=!!script&&/publicImmuneMoves\(/.test(String(script));
    const wrapped=script?(req,bot,info)=>{
      const a=req.active?.[0],imm=a?X.publicImmuneMoves(dex,req,bot):[];
      const immSet=new Set(imm.map(x=>x.i));
      const bench=req.side.pokemon.filter(p=>!p.active&&!/ fnt$/.test(p.condition)).length;
      const c=script(req,bot,info);
      dec.push({turn:info.turn,foeActive:bot.foeActive,foeItem:bot.foeItem,imm:imm.map(x=>x.move+':'+x.why),
        enabled:a?a.moves.filter(m=>!m.disabled&&m.pp>0).map(m=>m.move):[],
        unmasked:a?a.moves.filter((m,i)=>!m.disabled&&m.pp>0&&!immSet.has(i)).map(m=>m.move):[],
        trapped:!!(a&&(a.trapped||a.maybeTrapped)),bench,lockReason:info.lockReason||null,
        item:String((req.side.pokemon.find(p=>p.active)||{}).item||''),choice:c});
      return c;
    }:script;
    const g=await origBattle.call(this,sim,own,foe,seed,{...opts,script:wrapped});
    n++;
    const d98=Y.publicImmune98(g.log,g.foeSide,dex);
    if(d98.known.length){
      const hits=d98.known.map(k=>{
        const ds=dec.filter(d=>d.turn===k.turn),d=ds[ds.length-1];
        let cls;
        if(!d)cls='no rival decision';
        else if(!d.imm.some(x=>x.startsWith(k.move+':')))cls='not in mask list';
        else if(!d.unmasked.length&&(d.trapped||!d.bench))cls='forced';
        else cls='masked move sent although an alternative existed';
        const forcedBy=cls!=='forced'?null:[d.lockReason?d.lockReason+' lock':d.enabled.length===1&&d.enabled[0]===k.move?'one legal move':'all legal moves masked',d.trapped?'trapped':!d.bench?'no bench':''].filter(Boolean).join(' + ');
        return {turn:k.turn,move:k.move,target:k.target,why:k.why,cls,forcedBy,decision:d||null};
      });
      const TT=require('./pr82-switch-utility-t1t2').splitTurns(g.log);
      const t0=hits[0].turn;
      const lines=(TT[t0]||[]).filter(l=>/^\|(move|switch|drag|detailschange|-immune|-start|-end|-enditem|cant|faint)\|/.test(l)).slice(0,14);
      fs.appendFileSync(FILE,JSON.stringify({pid:process.pid,n,aware,seed,reverse:!!opts.reverse,own:opts.ownThree,foe:opts.foeThree,hits,lines})+'\n');
    }
    return g;
  };
  const fin=()=>{try{fs.appendFileSync(FILE,JSON.stringify({pid:process.pid,count:n,final:true})+'\n');}catch{}};
  process.on('SIGTERM',()=>{fin();process.exit(0);});
}
