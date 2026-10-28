'use strict';
// What the SELECTING player knows about its OWN six at team preview: the held
// Mega Stone fixes the Mega form (X/Y included), its single ability, typing and
// base stats; a weather ability on its own set is known too. Nothing here
// reads an opposing set: opponents are public species names only.
const {effectiveness}=require('./damage');
// lab.js requires the preview modules, so its matchup() is resolved lazily.
const matchup=(...args)=>require('./lab').matchup(...args);
const canon=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const WEATHER={drought:'sunnyday',drizzle:'raindance',sandstream:'sandstorm',snowwarning:'snowscape'};
const BYPASS=new Set(['moldbreaker','teravolt','turboblaze']);
function megaFormOf(dex,set){
  const stone=dex.items.get(set.item).megaStone;
  if(!stone)return '';
  const base=dex.species.get(set.species);
  const form=stone[base.name]||stone[base.baseSpecies];
  return form&&dex.species.get(form).exists?form:'';
}
// The form a set battles in. `mega:false` = the holder does not Mega Evolve
// (e.g. another team member uses the one Mega slot).
function ownForm(dex,set,{mega=true}={}){
  const megaForm=mega?megaFormOf(dex,set):'';
  const species=dex.species.get(megaForm||set.species);
  return {
    species:species.name,isMega:Boolean(megaForm),
    ability:megaForm?species.abilities['0']:set.ability,
    types:species.types,baseStats:species.baseStats
  };
}
function weatherOf(ability){return WEATHER[canon(ability)]||'';}
function weatherMultiplier(weather,move){
  const w=canon(weather),type=move.type;
  if(w==='sunnyday')return type==='Fire'?1.5:type==='Water'?0.5:1;
  if(w==='raindance')return type==='Water'?1.5:type==='Fire'?0.5:1;
  return 1;
}
// Same scale as lab.js matchup() so policies stay comparable; only the form,
// its ability and its own weather are corrected. Two-turn Solar Beam/Blade
// outside sun is counted at half value.
function ownMatchup(dex,set,foe,moveName,{mega=true,weather=''}={}){
  const form=ownForm(dex,set,{mega});
  const move=dex.moves.get(moveName);
  let value=matchup(dex,{...set,species:form.species,ability:form.ability},foe,moveName);
  if(!value)return 0;
  value*=weatherMultiplier(weather,move);
  if(['solarbeam','solarblade'].includes(move.id)&&canon(weather)!=='sunnyday')value*=0.5;
  return value;
}
// Public-STAB exposure of our member in its battle form. Our own ability is
// known (e.g. Levitate, Flash Fire); it is ignored only when the attacker's
// public species could have an ability-ignoring ability. Sandstorm raises a
// Rock type's Sp. Def x1.5 and snow an Ice type's Defense x1.5.
function ownExposure(dex,set,foeName,{mega=true,weather=''}={}){
  const form=ownForm(dex,set,{mega}),foe=dex.species.get(foeName);
  if(!foe.exists)return 0;
  const bypass=Object.values(foe.abilities||{}).some(a=>BYPASS.has(canon(a)));
  const w=canon(weather);
  const spdMod=w==='sandstorm'&&form.types.includes('Rock')?1.5:1;
  const defMod=w==='snowscape'&&form.types.includes('Ice')?1.5:1;
  let worst=0;
  for(const type of foe.types){
    const mult=effectiveness(dex,{type,id:'publicstab'},{types:form.types},
      {foeAbility:bypass?'':form.ability});
    if(!mult)continue;
    const phys=foe.baseStats.atk/Math.max(40,form.baseStats.def*defMod);
    const special=foe.baseStats.spa/Math.max(40,form.baseStats.spd*spdMod);
    worst=Math.max(worst,mult*Math.max(phys,special)*weatherMultiplier(weather,{type}));
  }
  return worst*100;
}
// Effective Lv50 stat of our own battle form (Champions points formula).
function ownStat(dex,set,stat,{mega=true}={}){
  const form=ownForm(dex,set,{mega}),n=dex.natures.get(set.nature||'Serious');
  const raw=form.baseStats[stat]+(set.evs?.[stat]||0)+(stat==='hp'?75:20);
  if(stat==='hp')return raw;
  return Math.floor(raw*(n.plus===stat?1.1:n.minus===stat?0.9:1)+1e-9);
}
module.exports={megaFormOf,ownForm,weatherOf,weatherMultiplier,ownMatchup,ownExposure,ownStat};
