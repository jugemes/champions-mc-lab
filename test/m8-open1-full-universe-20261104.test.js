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
function multiplier(dex,attack,form){
 if(!dex.getImmunity(attack,form.types))return 0;
 return 2**dex.getEffectiveness(attack,form.types);
}
function effectiveForm(dex,p){
 const item=dex.items.get(p.item),name=item.megaStone?.[p.species]||p.species;
 return dex.species.get(name);
}
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
  const ownForms=own.map(p=>effectiveForm(dex,p));
  const profile=TYPES.map(type=>{
   const ms=ownForms.map(form=>multiplier(dex,type,form));
   return {type,weak:ms.filter(n=>n>=2).length,resist:ms.filter(n=>n<=0.5).length,
    risk:ms.filter(n=>n>=2).length-ms.filter(n=>n<=0.5).length};
  }).sort((a,b)=>b.risk-a.risk||b.weak-a.weak);
  typeProfiles[name]=profile.slice(0,7);
  const suspicious=[];
  for(const h of legal){
   const attackTypes=new Set(h.sets.flatMap(set=>set.moves.map(m=>dex.moves.get(m).type)
    .filter(type=>type&&TYPES.includes(type))));
   let maxWeak=0,attackType='';
   for(const type of attackTypes){
    const weak=ownForms.filter(form=>multiplier(dex,type,form)>=2).length;
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
  firstUnresolved:unresolved.slice(0,8),notABattleWinRate:true,
  noRankingThreshold:true,includesLowFrequencyIfLegalTemplate:true}));
});
