'use strict';
// PR #100 request (ChatGPT review #5722319208 of PR #99), item 4. Opt-in,
// NEW file: pr96-paired.js / pr98-timing.js and every saved JSON stay
// unchanged, so PR #97 / #99 results replay as before.
//
// New P1 (reported by ChatGPT on an isolated-V8 synthetic request):
//   pr98 immuneAware98 (and pr96 immuneAware) disable the public-immunity
//   moves in a cloned request `req2` and re-ask the script, but never check
//   that the returned choice is legal in req2. A script that ignores
//   `disabled` and returns the masked slot again was passed through to
//   Showdown (where the slot is NOT disabled, so the engine accepts it and the
//   rival attacks into the immunity) while the record said
//   `replacement:'move:<masked move>'`.
//   Every script used by PR #90-#99 (pr82 BRANCHES / rivalScriptV2 /
//   ratSwitch / the base Bot) respects `disabled`, so this is LATENT: it
//   could not happen in the saved battles (checked in test/pr100.test.js and
//   in reports/data/pr100-join-*.json: 0 re-decisions returned a masked slot).
//   A second latent hole: when the re-asked script returned null/'default'
//   and no switch was possible, `b[0].i` threw.
//
// immuneAware100: same as immuneAware98 except
//   (1) the re-decided choice is validated against req2 (legalUnder100);
//   (2) if illegal: base Bot AI on req2 (respects disabled/pp) -> first legal
//       unmasked move (with Mega if available) -> first legal switch ->
//       forced ('none (no alternative)', the original choice is sent and the
//       record says so). Every rejected choice is kept in rec.rejected;
//   (3) public grounding removes Ground immunities from the mask
//       (publicImmuneMoves100): Gravity on the field (Bot.terrain === 'gravity',
//       set by the public `-fieldstart|move: Gravity` line) or a PUBLIC Iron
//       Ball on our active. Showdown isGrounded(): Gravity / Iron Ball ground
//       Flying types, Levitate and Air Balloon holders (pinned engine, test).
//       Not tracked (Bot keeps no public state for them; listed as residual):
//       Smack Down / Thousand Arrows grounding, Ingrain, Magnet Rise, Roost.
// Identity: when the re-decided choice is legal and nothing is grounded,
// the output equals immuneAware98 (same script calls, same order).
const Y=require('./pr98-timing');
const id=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const alive=p=>!/ fnt$/.test(String(p.condition));

// Is `choice` a legal first-slot choice for request `req` (singles)?
function legalUnder100(req,choice){
  const a=req.active?.[0];if(!a||typeof choice!=='string')return false;
  let m=/^move (\d+)( mega)?$/.exec(choice);
  if(m){const mv=a.moves[Number(m[1])-1];
    if(!mv||mv.disabled)return false;
    if(typeof mv.pp==='number'&&mv.pp<=0&&mv.id!=='struggle')return false;
    if(m[2]&&!a.canMegaEvo)return false;
    return true;}
  m=/^switch (\d+)$/.exec(choice);
  if(m){if(a.trapped||a.maybeTrapped)return false;
    const p=req.side.pokemon[Number(m[1])-1];return !!p&&!p.active&&alive(p);}
  return false;
}

// Public grounding of OUR active as seen by the rival bot.
function publicGrounded100(bot){
  const why=[];
  if(bot.terrain==='gravity')why.push('gravity');
  if(id(bot.foeItem)==='ironball')why.push('ironball');
  return why;
}
const GROUND_WHY=/^(type|ability levitate|airballoon)$/;
function publicImmuneMoves100(dex,req,bot){
  const out=Y.publicImmuneMoves98(dex,req,bot);
  if(!publicGrounded100(bot).length)return out;
  return out.filter(x=>!(x.type==='Ground'&&GROUND_WHY.test(x.why)));
}

function immuneAware100(script,dex,rec,{immFn=publicImmuneMoves100}={}){
  const {Bot}=require('./lab');
  const base=(bot,req)=>Bot.prototype.decide.call(bot,req);
  const decideWith=(req,bot,info)=>(script&&script(req,bot,info))||base(bot,req);
  const push=(k,v)=>(rec[k]||(rec[k]=[])).push(v);
  return (req,bot,info)=>{
    const imm=immFn(dex,req,bot);
    if(!imm.length)return script?script(req,bot,info):null;
    const sw=bot.switches;
    const orig=decideWith(req,bot,info),m=/^move (\d+)/.exec(orig||'');
    const hit=m&&imm.find(x=>x.i===Number(m[1])-1);
    if(!hit)return orig;
    bot.switches=sw;
    const req2=structuredClone(req);for(const x of imm)req2.active[0].moves[x.i].disabled=true;
    const a2=req2.active[0];
    const left=a2.moves.some(x=>!x.disabled&&x.pp>0);
    const bench=req.side.pokemon.map((p,i)=>({p,i})).filter(x=>!x.p.active&&alive(x.p));
    const canSwitch=!req.active[0].trapped&&!req.active[0].maybeTrapped&&bench.length>0;
    const forced=reason=>{push('masked',{turn:info.turn,move:hit.move,why:hit.why,replacement:'none (no alternative)',reason});return orig;};
    if(!left&&!canSwitch)return forced(req.active[0].trapped||req.active[0].maybeTrapped?'trapped':'no bench');
    let c2=left?decideWith(req2,bot,info):null,via='script';
    if(!legalUnder100(req2,c2)){
      if(c2!=null&&c2!=='default')push('rejected',{turn:info.turn,choice:c2,masked:imm.map(x=>x.move)});
      c2=null;
      if(left){const b=base(bot,req2);if(legalUnder100(req2,b)){c2=b;via='base';}}
      if(!c2&&left){const i=a2.moves.findIndex(x=>!x.disabled&&x.pp>0);c2='move '+(i+1)+(a2.canMegaEvo?' mega':'');via='first-legal';}
      if(!c2&&canSwitch){c2='switch '+(bench[0].i+1);via='switch';}
      if(!c2)return forced('no legal unmasked choice');
    }
    const m2=/^move (\d+)/.exec(c2);
    push('masked',{turn:info.turn,move:hit.move,why:hit.why,replacement:m2?'move:'+req.active[0].moves[Number(m2[1])-1].move:c2.startsWith('switch')?'switch':c2,...(via==='script'?{}:{via})});
    return c2;
  };
}

module.exports={legalUnder100,publicGrounded100,publicImmuneMoves100,immuneAware100};
