'use strict';
// M-C damage *ranges*, not privileged battle damage or guaranteed OHKO claims.
// Champions stat-point formula checked against the pinned Showdown champions mod:
// at level 50 without Level Clause Mod: HP = base + points + 75;
// other stats = nature(base + points + 20).
// The opponent's stat points, nature, moves, and items are NOT assumed known.
const scaleStage=n=>n>=0?(2+n)/2:2/(2-n);
const canon=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
function natureMod(dex,nature,stat){
  const n=dex.natures.get(nature||'Serious');
  if(n.plus===stat)return 1.1;
  if(n.minus===stat)return 0.9;
  return 1;
}
function knownStat(dex,set,stat){
  const species=dex.species.get(set.species);
  if(!species.exists)return 0;
  const pts=set.evs?.[stat]||0;
  const raw=species.baseStats[stat]+pts+(stat==='hp'?75:20);
  return stat==='hp'?raw:Math.floor(raw*natureMod(dex,set.nature,stat)+1e-9);
}
function powerOf(move,foe){
  if(['grassknot','lowkick'].includes(move.id)){
    const kg=foe.weighthg/10;
    return kg>=200?120:kg>=100?100:kg>=50?80:kg>=25?60:kg>=10?40:20;
  }
  return move.basePower||0;
}
function effectiveness(dex,move,foe,info={}){
  if(!dex.getImmunity(move.type,foe.types))return 0;
  if(move.type==='Ground'&&canon(info.foeItem)==='airballoon')return 0;
  if(move.type==='Ground'&&canon(info.foeAbility)==='levitate')return 0;
  if(move.type==='Fire'&&canon(info.foeAbility)==='flashfire')return 0;
  if(move.type==='Electric'&&['voltabsorb','lightningrod','motordrive'].includes(canon(info.foeAbility)))return 0;
  if(move.type==='Water'&&['waterabsorb','stormdrain','dryskin'].includes(canon(info.foeAbility)))return 0;
  if(move.type==='Grass'&&canon(info.foeAbility)==='sapsipper')return 0;
  return 2**dex.getEffectiveness(move.type,foe.types);
}
function damage(level,power,attack,defence,stab,effect,roll=1){
  if(!effect||!power||!attack||!defence)return 0;
  let n=Math.floor(Math.floor((Math.floor(2*level/5)+2)*power*attack/defence)/50)+2;
  n=Math.floor(n*roll);
  n=Math.floor(n*stab);
  return Math.max(1,Math.floor(n*effect));
}
function estimateDamage(dex,attacker,foeName,moveName,info={}){
  const move=dex.moves.get(moveName),species=dex.species.get(attacker.species),foe=dex.species.get(foeName);
  const zero={min:0,max:0,mid:0,accuracy:1,immune:true};
  if(!move.exists||!species.exists||!foe.exists||move.category==='Status')return zero;
  const eff=effectiveness(dex,move,foe,info);
  if(!eff)return zero;
  const stat=move.category==='Physical'?'atk':'spa';
  const def=move.category==='Physical'?'def':'spd';
  const bypass=canon(info.foeAbility)==='unaware';
  const atkStage=bypass?0:Number(info.boosts?.[stat]||0);
  const defStage=Number(info.foeBoosts?.[def]||0);
  const atk=knownStat(dex,attacker,stat)*scaleStage(atkStage);
  // Grassy Terrain halves Earthquake/Bulldoze into grounded targets.
  // This is a public battle-state rule, not a guessed opponent set.
  const grounded=!foe.types.includes('Flying')
    &&canon(info.foeAbility)!=='levitate'
    &&canon(info.foeItem)!=='airballoon';
  const terrainReduction=canon(info.terrain)==='grassyterrain'
    &&grounded&&['earthquake','bulldoze','magnitude'].includes(move.id)?0.5:1;
  const power=powerOf(move,foe)*terrainReduction;
  const stab=species.types.includes(move.type)?1.5:1;
  const minDef=Math.floor((foe.baseStats[def]+20)*0.9);
  const maxDef=Math.floor((foe.baseStats[def]+32+20)*1.1);
  const minHp=foe.baseStats.hp+75,maxHp=minHp+32;
  const accuracy=typeof move.accuracy==='number'?move.accuracy/100:1;
  const weather=canon(info.weather);
  const weatherMultiplier=weather==='sunnyday'
    ?(move.type==='Fire'?1.5:move.type==='Water'?0.5:1)
    :weather==='raindance'
      ?(move.type==='Water'?1.5:move.type==='Fire'?0.5:1):1;
  let min=damage(50,power,atk,maxDef*scaleStage(defStage),stab,eff,.85)*weatherMultiplier/maxHp;
  let max=damage(50,power,atk,minDef*scaleStage(defStage),stab,eff,1)*weatherMultiplier/minHp;
  if(info.burned&&move.category==='Physical'&&canon(attacker.ability)!=='guts'&&move.id!=='facade'){
    min*=0.5;max*=0.5;
  }
  return {min,max,mid:(min+max)/2,accuracy,immune:false};
}
// A stress-risk bound: public STAB of an *unknown* opponent is plausible, not certain.
// Only explicitly observed extra coverage moves are evaluated as extra risks.
// Does not inspect the opposing team's private set or battle state.
function incomingRisk(dex,defender,foeName,info={}){
  const foe=dex.species.get(foeName),own=dex.species.get(defender.species);
  if(!foe.exists||!own.exists)return 0;
  const hp=knownStat(dex,defender,'hp');
  if(!hp)return 0;
  const moves=foe.types.map(type=>({type,category:'Physical',basePower:90,id:'publicstab'}))
    .concat(foe.types.map(type=>({type,category:'Special',basePower:90,id:'publicstab'})));
  for(const name of (info.seenMoves||[])){
    const move=dex.moves.get(name);
    if(move.exists&&move.category!=='Status'&&move.basePower)moves.push(move);
  }
  let peak=0;
  for(const move of moves){
    if(move.id==='publicstab'&&!foe.types.includes(move.type))continue;
    const eff=effectiveness(dex,move,own,{foeAbility:defender.ability,foeItem:defender.item});
    if(!eff)continue;
    const stat=move.category==='Physical'?'atk':'spa',def=move.category==='Physical'?'def':'spd';
    const stage=canon(defender.ability)==='unaware'?0:Number(info.foeBoosts?.[stat]||0);
    const atk=(foe.baseStats[stat]+32+20)*1.1*scaleStage(stage);
    const ourDef=knownStat(dex,defender,def);
    const stab=foe.types.includes(move.type)?1.5:1;
    const weather=canon(info.weather);
    const multiplier=weather==='sunnyday'
      ?(move.type==='Fire'?1.5:move.type==='Water'?0.5:1)
      :weather==='raindance'
        ?(move.type==='Water'?1.5:move.type==='Fire'?0.5:1):1;
    peak=Math.max(peak,damage(50,powerOf(move,own),atk,ourDef,stab,eff)*multiplier/hp);
  }
  return peak;
}
function moveUtility(dex,attacker,foeName,moveName,info={}){
  const hit=estimateDamage(dex,attacker,foeName,moveName,info);
  if(hit.immune)return 0;
  let value=hit.mid*100*hit.accuracy;
  if(Number.isFinite(info.foeHP)&&info.foeHP>0){
    // Confirmed within our public-point/nature model vs merely possible.
    if(hit.min>=info.foeHP)value+=70*hit.accuracy;
    else if(hit.max>=info.foeHP)value+=25*hit.accuracy;
  }
  return value;
}
module.exports={knownStat,estimateDamage,incomingRisk,moveUtility,effectiveness};
