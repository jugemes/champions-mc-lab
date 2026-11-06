'use strict';
// Public-information battle state for engine search (opt-in research code).
//
// The pinned Showdown engine is the only rules authority. A decision-making
// side may NOT see the opponent's unrevealed moves, item, ability, stat points,
// nature, exact HP, PP, the two picks that have not appeared yet, or the PRNG.
// determinize() takes the real Battle, keeps everything the viewer can know
// (own side in full; opponent's public species/forme, HP %, status, boosts,
// volatiles, field, hazards, revealed moves/item/ability/Mega) and REPLACES
// every hidden opponent field with one legal hypothesis set. The returned JSON
// is what search code may use; it never receives the real Battle.
// Invariant enforced by test/engine-search.test.js: two real battles that
// differ only in hidden opponent data produce byte-identical outputs.
const canon=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');

// Public log: for every `|split|pN` block keep only the public (second) line.
function publicLines(log){
  const out=[];
  for(let i=0;i<log.length;i++){
    if(log[i].startsWith('|split|')){out.push(log[i+2]);i+=2;continue;}
    out.push(log[i]);
  }
  return out.filter(l=>typeof l==='string');
}
const ownerOf=(ident,side)=>typeof ident==='string'&&ident.startsWith(side)&&/^p\da?: /.test(ident)
  ?ident.replace(/^p\da?: /,''):null;
const tagValue=(parts,tag)=>{const p=parts.find(x=>x.startsWith(tag));return p?p.slice(tag.length).trim():'';};
// What the viewer has seen of each opposing Pokemon, keyed by its public name.
function opponentKnowledge(log,foe){
  const k={};
  const get=name=>k[name]||(k[name]={species:'',moves:new Set(),item:null,itemGone:false,ability:null,megaStone:null});
  for(const line of publicLines(log)){
    const a=line.split('|');
    const cmd=a[1],who=ownerOf(a[2],foe);
    const ofRaw=tagValue(a,'[of] ');
    // "[from] X|[of] Y": the effect belongs to Y; without [of], to the subject.
    const holder=ofRaw?ownerOf(ofRaw,foe):who;
    const fromItem=tagValue(a,'[from] item: '),fromAbility=tagValue(a,'[from] ability: ');
    if((cmd==='switch'||cmd==='drag'||cmd==='replace'||cmd==='detailschange')&&who){
      const sp=String(a[3]||'').split(',')[0];
      const e=get(who);if(!e.species||cmd!=='detailschange')e.species=e.species||sp;
    }
    if(cmd==='move'&&who&&!a.some(x=>x.startsWith('[from]'))&&a[3]!=='Struggle')get(who).moves.add(a[3]);
    if(cmd==='-mega'&&who){get(who).megaStone=a[4];get(who).item=a[4];}
    if(cmd==='-item'&&who){get(who).item=a[3];get(who).itemGone=false;}
    if(cmd==='-enditem'&&who){get(who).item=a[3];get(who).itemGone=true;}
    if(cmd==='-ability'&&who)get(who).ability=a[3];
    if(fromItem&&cmd!=='-item'&&cmd!=='-enditem'&&holder)get(holder).item=fromItem;
    if(fromAbility&&cmd!=='-ability'&&holder)get(holder).ability=fromAbility;
  }
  return k;
}
// Showdown's public HP percentage (pokemon.getHealth with reportPercentages).
function publicPercent(hp,maxhp){
  if(!hp)return 0;
  let p=Math.ceil(100*hp/maxhp);
  if(p===100&&hp<maxhp)p=99;
  return p;
}
const HIDDEN_KEYS=['moveSlots','baseMoveSlots','ppUps','hpType','hpPower','baseHpType','baseHpPower',
  'baseStoredStats','storedStats','baseAbility','ability','abilityState','item','itemState',
  'maxhp','baseMaxhp','hp','speed','canMegaEvo','canMegaEvoX','canMegaEvoY','canUltraBurst',
  'canGigantamax','canTerastallize','teraType','attackedBy','lastDamage','hurtThisTurn','set'];
const SPECIES_KEYS=['species','baseSpecies','speciesState','types','baseTypes','apparentType',
  'weighthg','details','gender','addedType','knownType'];
function consistent(dex,set,known,{noStone}){
  const ids=new Set(set.moves.map(canon));
  for(const m of known.moves)if(!ids.has(canon(m)))return false;
  if(known.megaStone&&canon(set.item)!==canon(known.megaStone))return false;
  if(!known.megaStone&&known.item&&canon(set.item)!==canon(known.item))return false;
  if(noStone&&dex.items.get(set.item).megaStone)return false;
  if(known.ability&&!known.megaStone&&canon(set.ability)!==canon(known.ability))return false;
  return true;
}
// Force a hypothesis to agree with what was revealed (moves, item, ability).
function patch(dex,set,known){
  const s=structuredClone(set);
  const ids=s.moves.map(canon);
  const missing=[...known.moves].filter(m=>!ids.includes(canon(m)));
  for(let i=s.moves.length-1;i>=0&&missing.length;i--)
    if(![...known.moves].some(m=>canon(m)===canon(s.moves[i])))s.moves[i]=missing.shift();
  if(known.megaStone)s.item=known.megaStone;else if(known.item)s.item=known.item;
  if(known.ability&&!known.megaStone)s.ability=known.ability;
  return s;
}
// Pick one hypothesis set for a species, respecting revealed facts.
function pickSet(dex,pool,species,known,rng,{noStone=false}={}){
  const sets=pool(species);
  if(!sets.length)throw Error('No hypothesis set for '+species);
  const ok=sets.filter(s=>consistent(dex,s,known,{noStone}));
  const from=ok.length?ok:sets.filter(s=>!noStone||!dex.items.get(s.item).megaStone);
  const chosen=(from.length?from:sets)[Math.floor(rng()*(from.length?from:sets).length)];
  return ok.length?structuredClone(chosen):patch(dex,chosen,known);
}
function toBattleSet(s,name){
  return {name,species:s.species,item:s.item||'',ability:s.ability,nature:s.nature,level:50,
    moves:s.moves.slice(),gender:s.gender||'',
    evs:{hp:0,atk:0,def:0,spa:0,spd:0,spe:0,...s.evs},ivs:{hp:31,atk:31,def:31,spa:31,spd:31,spe:31}};
}
const EMPTY_KNOWLEDGE={species:'',moves:new Set(),item:null,itemGone:false,ability:null,megaStone:null};
// One determinization of the viewer's information set, as a serialized battle.
// preview: the opponent's six public species. pool(species) -> legal sets.
function determinize(sim,battle,viewer,{preview,pool,rng,seed}){
  const dex=battle.dex;
  const foe=viewer==='p1'?'p2':'p1';
  const state=JSON.parse(JSON.stringify(battle.toJSON()));
  const knowledge=opponentKnowledge(battle.log,foe);
  state.log=[];state.inputLog=[];state.messageLog=[];
  state.prng=seed;state.prngSeed=seed;
  delete state.quickClawRoll;delete state.speedOrder;
  const fi=state.sides.findIndex(s=>s.id===foe),vi=1-fi;
  for(const s of state.sides){delete s.activeRequest;s.choice=JSON.parse(JSON.stringify(state.sides[vi].choice));}
  for(const s of state.sides){
    s.choice={...s.choice,actions:[],error:'',cantUndo:false,forcedSwitchesLeft:0,forcedPassesLeft:0,
      switchIns:[],mega:false,zMove:false,ultra:false,dynamax:false,terastallize:false};
  }
  const side=state.sides[fi];
  const live=battle.sides[fi];
  const megaUsed=live.pokemon.some(p=>p.species.isMega||knowledge[p.name]?.megaStone);
  const revealed=new Set(),seenSpecies=new Set();
  live.pokemon.forEach((p,j)=>{
    if(p.isActive||p.previouslySwitchedIn>0){revealed.add(j);seenSpecies.add(dex.species.get(p.set.species).name);}
  });
  const unseen=preview.filter(sp=>!seenSpecies.has(dex.species.get(sp).name));
  const fix=[];
  side.pokemon.forEach((ps,j)=>{
    const real=live.pokemon[j];
    if(revealed.has(j)){
      const known=knowledge[real.name]||EMPTY_KNOWLEDGE;
      const moved=real.activeMoveActions>0||known.moves.size>0;
      // Species as revealed (Mega Evolution rewrites baseSpecies, the set does not).
      const set=pickSet(dex,pool,dex.species.get(real.set.species).name,known,rng,
        {noStone:megaUsed&&!known.megaStone||(!real.species.isMega&&moved&&!megaUsed)});
      for(const k of HIDDEN_KEYS)delete ps[k];
      ps.set=toBattleSet(set,real.name);
      if(ps.statusState&&ps.status==='slp')ps.statusState={...ps.statusState,time:1+Math.floor(rng()*3)};
      fix.push({j,pct:publicPercent(real.hp,real.maxhp),known,megaForm:real.species.isMega?real.species.name:''});
    }else{
      const species=unseen.splice(Math.floor(rng()*unseen.length),1)[0];
      if(!species)throw Error('No unseen preview species left to determinize');
      const set=pickSet(dex,pool,species,EMPTY_KNOWLEDGE,rng,{noStone:megaUsed});
      for(const k of [...HIDDEN_KEYS,...SPECIES_KEYS])delete ps[k];
      ps.set=toBattleSet(set,dex.species.get(species).name);
      fix.push({j,pct:100,known:EMPTY_KNOWLEDGE,fresh:true});
    }
  });
  return {json:JSON.stringify(state),fixes:fix,foe,viewer};
}
// Rebuild a playable Battle from a determinization.
function restore(sim,det,seed){
  const b=sim.Battle.fromJSON(det.json);
  if(seed)b.prng=new sim.PRNG(seed);
  const side=b.sides.find(s=>s.id===det.foe);
  for(const f of det.fixes){
    const p=side.pokemon[f.j];
    const stats=b.spreadModify(p.species.baseStats,p.set);
    p.baseStoredStats=stats;
    for(const k of Object.keys(p.storedStats))p.storedStats[k]=stats[k];
    p.maxhp=p.baseMaxhp=stats.hp;
    p.hp=p.fainted||f.pct===0?0:Math.max(1,Math.round(f.pct*stats.hp/100));
    if(p.species.isMega){p.baseAbility=p.ability=canon(p.species.abilities['0']);}
    if(f.known.itemGone)p.item='';
  }
  if(side.pokemon.some(p=>p.species.isMega))for(const p of side.pokemon)p.canMegaEvo=null;
  // Requests depend on the hypothesis (moves, Mega); recompute both sides'.
  if(b.requestState){
    const requests=b.getRequests(b.requestState);
    b.sides.forEach((s,i)=>{s.activeRequest=requests[i];});
  }
  b.send=()=>{};
  return b;
}
module.exports={publicLines,opponentKnowledge,publicPercent,determinize,restore,toBattleSet,pickSet};
