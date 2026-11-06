'use strict';
// M8 OPEN1 broad FIRST-PASS structural survey: not restricted to ranking TOP30.
// This scans every non-battle-only species/form in pinned Champions Dex,
// then keeps only species for which public learnset role templates pass the
// exact M-C TeamValidator. This is an executable COVERAGE LOWER BOUND: a legal
// species without a successful role template is NOT declared illegal.
// Types, ability risks and move pressure here are proxies, NOT battle outcomes.
const test=require('node:test'),assert=require('node:assert/strict');
const {load,prelim,normalize}=require('../lab');
const {legalRoleHypotheses}=require('../legal-role-hypotheses');
const {builders}=require('../m8-open1-20261104');
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
const TYPES=['Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground',
 'Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy'];
// Conditional, set-specific immunities are a first-pass STRUCTURAL proxy.
// Not actual turn damage: Gravity, Mold Breaker and broken Air Balloon are
// separate game states, so the caller may suppress the relevant protection.
const IMMUNE_ABILITY={
 Ground:['Levitate','Earth Eater'],
 Water:['Water Absorb','Storm Drain','Dry Skin'],
 Electric:['Volt Absorb','Lightning Rod','Motor Drive'],
 Fire:['Flash Fire','Well-Baked Body'],
 Grass:['Sap Sipper']
};
function multiplier(dex,attack,form,set,{balloonIntact=true,abilityActive=true}={}){
 if(!dex.getImmunity(attack,form.types))return 0;
 const raw=2**dex.getEffectiveness(attack,form.types);
 if(attack==='Ground'&&balloonIntact&&set?.item==='Air Balloon')return 0;
 const ability=form.isMega?form.abilities['0']:set?.ability;
 if(abilityActive&&IMMUNE_ABILITY[attack]?.includes(ability))return 0;
 return raw;
}
function effectiveForm(dex,p){
 const item=dex.items.get(p.item),name=item.megaStone?.[p.species]||p.species;
 return dex.species.get(name);
}
test('M8 first-pass type screen honors actual Levitate and temporary Air Balloon',{skip},()=>{
 const sim=load(),dex=sim.Dex.mod('champions'),team=builders.O2_megaMetagross_unaware();
 const get=s=>team.find(p=>p.species===s);
 const score=(p,attack,opts)=>multiplier(dex,attack,effectiveForm(dex,p),p,opts);
 const wash=get('Rotom-Wash'),gold=get('Gholdengo'),meta=get('Metagross');
 assert.ok(wash&&gold&&meta,'O2 fixture roles');
 assert.equal(score(wash,'Ground'),0,'Rotom Levitate blocks Ground while active');
 assert.equal(score(wash,'Ground',{abilityActive:false}),2,'Gravity/Mold Breaker needs separate branch');
 assert.equal(score(gold,'Ground'),0,'intact Air Balloon');
 assert.equal(score(gold,'Ground',{balloonIntact:false}),2,'popped balloon restores Ground weakness');
 assert.equal(score(meta,'Ground'),2,'Mega Metagross is Ground weak');
 const megaGarch=builders.O4_megaGarchZ_antiSetup().find(p=>p.species==='Garchomp');
 const form=effectiveForm(dex,megaGarch);
 assert.ok(form.isMega,'Mega Garchomp Z must be recognised as Mega form');
 if(form.abilities['0']==='Levitate'){
  assert.equal(score(megaGarch,'Ground'),0,'post-Mega public Levitate');
  assert.equal(score(megaGarch,'Ground',{abilityActive:false}),1,'Garchomp Ground/Dragon is neutral when Levitate is negated');
 }
});
test('M8 OPEN1 broad M-C legal template universe: ALL species/forms, no TOP30 cut',{skip},t=>{
 const sim=load(),dex=sim.Dex.mod('champions'),candidates=dex.species.all()
  .filter(s=>s.exists&&s.num>0&&!s.isMega&&!s.battleOnly);
 const legal=[],unresolved=[],seen=new Set();
 for(const s of candidates){
  if(seen.has(s.name))continue;seen.add(s.name);
  try{
   const r=legalRoleHypotheses(sim,s.name,{version:'v2'});
   if(r.sets.length)legal.push({species:s.name,
    forms:[...new Set(r.sets.map(x=>x.form))],
    sets:r.sets,
    tags:[...new Set(r.sets.flatMap(x=>x.tags))],
    fast:r.sets.some(x=>x.item==='Choice Scarf')});
   else unresolved.push({name:s.name,why:'no M-C-validated role template'});
  }catch(e){unresolved.push({name:s.name,why:String(e.message||e).slice(0,130)});}
 }
 assert.ok(legal.length>=100,'Scan produced suspiciously few validated species '+legal.length);
 const threats=Object.fromEntries(['setup','priority','recovery','weather','levitate','scarf'].map(tag=>[tag,
  legal.filter(x=>x.tags.includes(tag)).length]));
 const names=Object.keys(builders),typeProfiles={},broadFlags={};
 for(const [name,build] of Object.entries(builders)){
  const own=build();prelim(own,name);
  const validator=sim.TeamValidator.get('gen9championsbssregmc');
  assert.ok(!validator.validateTeam(normalize(own))?.length,name+' still legal');
  const ownForms=own.map(p=>({form:effectiveForm(dex,p),set:p}));
  const profile=TYPES.map(type=>{
   const ms=ownForms.map(({form,set})=>multiplier(dex,type,form,set));
   const popped=ownForms.map(({form,set})=>multiplier(dex,type,form,set,{balloonIntact:false}));
   return {type,weak:ms.filter(n=>n>=2).length,resist:ms.filter(n=>n<=0.5).length,
    weakIfBalloonPops:popped.filter(n=>n>=2).length,
    risk:ms.filter(n=>n>=2).length-ms.filter(n=>n<=0.5).length};
  }).sort((a,b)=>b.risk-a.risk||b.weak-a.weak);
  typeProfiles[name]=profile.slice(0,7);
  const suspicious=[];
  for(const h of legal){
   const attackTypes=new Set(h.sets.flatMap(set=>set.moves.map(m=>dex.moves.get(m).type)
    .filter(type=>type&&TYPES.includes(type))));
   let maxWeak=0,attackType='';
   for(const type of attackTypes){
    const weak=ownForms.filter(({form,set})=>multiplier(dex,type,form,set)>=2).length;
    if(weak>maxWeak){maxWeak=weak;attackType=type;}
   }
   if(maxWeak>=3){
    const riskTags=h.tags.filter(x=>['setup','priority','scarf','weather'].includes(x)||x.startsWith('mega:'));
    suspicious.push({species:h.species,type:attackType,weakMembers:maxWeak,
      flags:riskTags.slice(0,3)});
   }
  }
  suspicious.sort((a,b)=>b.weakMembers-a.weakMembers||b.flags.length-a.flags.length||a.species.localeCompare(b.species));
  broadFlags[name]={count:suspicious.length,sample:suspicious.slice(0,15)};
 }
 t.diagnostic('M8_OPEN1_ALL_LEGAL_SCREEN '+JSON.stringify({
  dexSpeciesFormsConsidered:candidates.length,
  mCValidatedTemplates:legal.length,
  unclassifiedOrUnavailable:candidates.length-legal.length,
  note:'A non-generated legal species remains unresolved, NOT confirmed illegal; official full list not independently reconciled',
  threats,types:TYPES.length,typeProfiles,broadFlags,
  firstUnresolved:unresolved.slice(0,8),
  proxyLimit:'Pre-hit type immunities from each set ability/item; Air Balloon can pop, Mold Breaker/Gravity can negate protection, move power/turns not modelled',
  notABattleWinRate:true,
  noRankingThreshold:true,includesLowFrequencyIfLegalTemplate:true}));
});
