'use strict';
// PR #98 request (ChatGPT review #5722096718 of PR #97). Opt-in, new file:
// pr96-paired.js and every saved PR #97 JSON stay unchanged.
//
// P0 (decision-time boundary). pr96 publicImmune96 moved the turn-start
//   forme `start` to the Mega forme on a same-turn |detailschange|, so a
//   rival move chosen against base Altaria (Dragon/Flying) that then hit the
//   freshly revealed Altaria-Mega (Dragon/Fairy) was tagged as an attack into
//   a KNOWN public immunity. The rival cannot see a Mega that happens after
//   both sides chose. publicImmune98 judges every hit against the forme that
//   was public when the turn began (= when the rival chose) and puts hits
//   that are immune only because of a same-turn Mega into a separate
//   `possible` list (anticipating a Mega is a prediction, not a known fact).
//   The next turn the Mega forme is public and a hit is `known` again.
//   Found while replaying PR #97 FINAL (not in the request): a
//   `|move|...|[from]lockedmove` line (Outrage / Petal Dance continuation) is
//   not a choice of that turn; pr96 tagged it as a known-immunity attack. It
//   is now counted in `locked` only.
//   A Air Balloon that was public at turn start (|-item| ... Air Balloon, not
//   yet popped) is also a known immunity for Ground moves.
// P1 (Air Balloon vs Mold Breaker). pr96 publicImmuneMoves dropped a public
//   Air Balloon when the rival had Mold Breaker / Teravolt / Turboblaze. Those
//   abilities ignore the target's ABILITIES (Levitate) only; Air Balloon is
//   an item and still makes the holder immune to Ground moves (checked on the
//   pinned Showdown in test/pr98.test.js). publicImmuneMoves98 keeps the
//   balloon immunity for any rival ability (Thousand Arrows still excepted).
const X=require('./pr96-paired');
const T=require('./pr94-t1t2');
const M=require('./pr82-switch-utility-t1t2');
const {ABILITY_IMMUNE}=X;
const id=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const TARGETS=['normal','any','adjacentFoe','allAdjacentFoes','allAdjacent','randomNormal'];

// ---------- P1: masker immunity list ----------
// Same as pr96 publicImmuneMoves, plus Ground moves into a PUBLIC Air Balloon
// when the rival's own ability is Mold Breaker-like (the only case pr96 missed).
function publicImmuneMoves98(dex,req,bot){
  const out=X.publicImmuneMoves(dex,req,bot);
  const act=req.active?.[0],cur=req.side.pokemon.find(p=>p.active);
  if(!act||!cur||id(bot.foeItem)!=='airballoon')return out;
  if(!dex.species.get(T.forme(bot.foeActive)).exists)return out;
  act.moves.forEach((m,i)=>{
    if(m.disabled||out.some(x=>x.i===i))return;
    const mv=dex.moves.get(m.id||m.move);if(!mv.exists||!TARGETS.includes(mv.target))return;
    if(mv.category==='Status'&&mv.ignoreImmunity!==false)return;
    if(mv.type==='Ground'&&mv.id!=='thousandarrows')out.push({i,move:mv.name,type:'Ground',why:'airballoon'});
  });
  return out.sort((a,b)=>a.i-b.i);
}

// Same wrapper as pr96 immuneAware, with an injectable immunity list.
// rec.masked: {turn, move, why, replacement}. rec.shadow (optional array):
// decisions where publicImmuneMoves98 and pr96 publicImmuneMoves disagree.
function immuneAware98(script,dex,rec,{immFn=publicImmuneMoves98,shadow=false}={}){
  const {Bot}=require('./lab');
  const base=(bot,req)=>Bot.prototype.decide.call(bot,req);
  const decideWith=(req,bot,info)=>(script&&script(req,bot,info))||base(bot,req);
  return (req,bot,info)=>{
    const imm=immFn(dex,req,bot);
    if(shadow){const a=X.publicImmuneMoves(dex,req,bot).map(x=>x.i).join(),b=imm.map(x=>x.i).join();
      if(a!==b)(rec.shadow||(rec.shadow=[])).push({turn:info.turn,pr96:a,pr98:b,foeActive:bot.foeActive,foeItem:bot.foeItem});}
    if(!imm.length)return script?script(req,bot,info):null;
    const sw=bot.switches;
    const orig=decideWith(req,bot,info),m=/^move (\d+)/.exec(orig||'');
    const hit=m&&imm.find(x=>x.i===Number(m[1])-1);
    if(!hit)return orig;
    bot.switches=sw;
    const req2=structuredClone(req);for(const x of imm)req2.active[0].moves[x.i].disabled=true;
    const left=req2.active[0].moves.some(x=>!x.disabled&&x.pp>0);
    const canSwitch=!req.active[0].trapped&&!req.active[0].maybeTrapped&&req.side.pokemon.some(p=>!p.active&&!/ fnt$/.test(p.condition));
    if(!left&&!canSwitch){(rec.masked||(rec.masked=[])).push({turn:info.turn,move:hit.move,why:hit.why,replacement:'none (no alternative)'});return orig;}
    let c2=left?decideWith(req2,bot,info):null;
    if(!c2||c2==='default'){const b=req.side.pokemon.map((p,i)=>({p,i})).filter(x=>!x.p.active&&!/ fnt$/.test(x.p.condition));c2='switch '+(b[0].i+1);}
    const m2=/^move (\d+)/.exec(c2);
    (rec.masked||(rec.masked=[])).push({turn:info.turn,move:hit.move,why:hit.why,replacement:m2?'move:'+req.active[0].moves[Number(m2[1])-1].move:c2.startsWith('switch')?'switch':c2});
    return c2;
  };
}

// ---------- P0: post-hoc detector with the decision-time boundary ----------
// Returns {known, possible, switchedIn, locked}.
//  known:    rival damaging move that hit -immune on our mon, where the
//            immunity (type chart / only ability / public Air Balloon) held for
//            the forme+item that was public at the START of the turn.
//  possible: immune only because of OUR Mega Evolution in that same turn
//            (why 'post-choice mega'). Not irrational; a rival may predict it.
//  switchedIn: target entered this turn (count only; never irrational).
//  locked:   forced lockedmove continuation (count only; never irrational).
function publicImmune98(log,foeSide,dex,{maxTurn=99}={}){
  const me=foeSide==='p1'?'p2':'p1',L=log.split('\n'),known=[],possible=[];let switchedIn=0,locked=0;
  let turn=0,active='',start='',entered=false,balloon=false,startBalloon=false;
  const pub=f=>{const sp=dex.species.get(f),abs=Object.values(sp.abilities||{}).map(id);return {sp,abs};};
  const whyFor=(f,type,bal)=>{const {sp,abs}=pub(f);if(!sp.exists)return null;
    if(!dex.getImmunity(type,sp.types))return 'type';
    if(abs.length===1&&ABILITY_IMMUNE[abs[0]]===type)return 'only ability '+abs[0];
    if(bal&&type==='Ground')return 'public airballoon';return null;};
  for(let i=0;i<L.length;i++){const a=L[i].split('|');
    if(a[1]==='turn'){turn=Number(a[2]);if(turn>maxTurn)break;start=active;startBalloon=balloon;entered=false;continue;}
    const mine=a[2]?.startsWith(me+'a:');
    if(mine&&['switch','drag','replace'].includes(a[1])){active=T.forme(a[3]);balloon=false;if(turn>=1)entered=true;}
    if(mine&&a[1]==='detailschange')active=T.forme(a[3]);// same mon, new forme: start is NOT moved
    if(mine&&a[1]==='-item'&&id(a[3])==='airballoon')balloon=true;
    if(mine&&a[1]==='-enditem'&&id(a[3])==='airballoon')balloon=false;
    if(turn<1||a[1]!=='move'||!a[2]?.startsWith(foeSide+'a:')||!a[4]?.startsWith(me+'a:'))continue;
    const mv=dex.moves.get(a[3]);if(mv.category==='Status')continue;
    let imm=false;for(let k=i+1;k<L.length&&!/^\|(move|turn|upkeep)(\||$)/.test(L[k]);k++)if(L[k].startsWith('|-immune|'+me+'a:'))imm=true;
    if(!imm)continue;
    if(entered){switchedIn++;continue;}// target switched in this turn: not a choice against it
    if(a.slice(5).some(x=>/^\[from\] ?lockedmove$/.test(x))){locked++;continue;}// forced continuation, chosen on an earlier turn
    const why=whyFor(start,mv.type,startBalloon);
    if(why){known.push({turn,move:mv.name,target:start,why});continue;}
    if(active!==start&&M.baseName(active)===M.baseName(start)){const w=whyFor(active,mv.type,false);
      if(w)possible.push({turn,move:mv.name,chosenAgainst:start,hit:active,why:'post-choice mega ('+w+')'});}
  }
  return {known,possible,switchedIn,locked};
}
// pr96 irrationalGame with the pr98 detector (known only). A known hit on a
// turn where the immune-aware rival recorded 'none (no alternative)' (every
// move masked and no switch: Encore / Choice lock / last mon) was forced, not
// chosen, and is not counted.
const forcedTurns=r=>new Set((r.masked||[]).filter(m=>/^none/.test(m.replacement)).map(m=>m.turn));
const irrationalGame98=(j,r)=>{const f=forcedTurns(r);
  return j.branch==='utility'||r.irrational.some(x=>Number(x.split(':')[0])<=2)||(r.immune98?.known||[]).some(x=>x.turn<=2&&!f.has(x.turn));};

module.exports={publicImmuneMoves98,immuneAware98,publicImmune98,irrationalGame98};
