'use strict';
// M8 OPEN6: rank-agnostic minimax SCREEN, PR #104 comment #6627434262.
// Not a battle simulator, not a win-rate estimate, not proof of exhaustive
// M-C coverage. Every output set is M-C validated by legalRoleHypotheses.
// All 6 slots are free; no named species, type, weather or Mega is required.
const {legalRoleHypotheses}=require('./legal-role-hypotheses');
const {normalize,prelim}=require('./lab');
const TYPES_IMMUNE={
  Ground:['Levitate','Earth Eater'],
  Water:['Water Absorb','Storm Drain','Dry Skin'],
  Electric:['Volt Absorb','Lightning Rod','Motor Drive'],
  Fire:['Flash Fire','Well-Baked Body'],
  Grass:['Sap Sipper']
};
const clone=x=>structuredClone(x);
function rng(seed){
 let s=seed>>>0;return ()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return(s>>>0)/4294967296;};
}
function effective(dex,s){
 const form=dex.species.get(s.form||s.species);
 if(!form.exists)throw Error('Unknown form '+(s.form||s.species));
 const ability=form.isMega?form.abilities['0']:s.ability;
 return {...s,formData:form,abilityActual:ability,
  speed:form.baseStats.spe+(s.evs.spe||0)*0.65,
  moveData:s.moves.map(m=>dex.moves.get(m))};
}
function eff(dex,typ,target,{balloonIntact=true,abilityActive=true}={}){
 const form=target.formData;
 if(!dex.getImmunity(typ,form.types))return 0;
 if(typ==='Ground'&&balloonIntact&&target.item==='Air Balloon')return 0;
 if(abilityActive&&TYPES_IMMUNE[typ]?.includes(target.abilityActual))return 0;
 return 2**dex.getEffectiveness(typ,form.types);
}
function offense(dex,source,target){
 const a=source.formData.baseStats,b=target.formData.baseStats;
 let best=0;
 for(const m of source.moveData){
  if(m.category==='Status'||m.ohko||!m.basePower)continue;
  const type=eff(dex,m.type,target);
  if(!type)continue;
  const stat=m.category==='Physical'?a.atk:a.spa;
  const defense=m.category==='Physical'?b.def:b.spd;
  const stab=source.formData.types.includes(m.type)?1.5:1;
  // Deliberately no weather, terrain, setup or priority assumptions.
  const p=Math.min(m.basePower,150)*type*stab*
    (stat+20)/Math.max(40,defense+20)*
    (typeof m.accuracy==='number'?m.accuracy/100:1);
  if(p>best)best=p;
 }
 return best;
}
function duel(dex,a,b){
 const ab=offense(dex,a,b),ba=offense(dex,b,a);
 let val=Math.log((ab+12)/(ba+12));
 // Only a bounded, deliberately coarse speed/survival tie-breaker.
 const speedA=a.speed*(a.item==='Choice Scarf'?1.5:1);
 const speedB=b.speed*(b.item==='Choice Scarf'?1.5:1);
 if(speedA>speedB)val+=.10;else if(speedB>speedA)val-=.10;
 const bulkA=a.formData.baseStats.hp+Math.min(a.formData.baseStats.def,a.formData.baseStats.spd);
 const bulkB=b.formData.baseStats.hp+Math.min(b.formData.baseStats.def,b.formData.baseStats.spd);
 val+=.09*Math.log((bulkA+70)/(bulkB+70));
 return Math.max(-4,Math.min(4,val));
}
function roleCandidates(all){
 const out=[];
 for(const a of all){
  const by=a.sets;
  const chosen=[];
  // Representative *complete* validated sets, not arbitrary move mix.
  const prefs=[
    by.find(s=>s.form!==a.species&&s.role==='attacker'),
    by.find(s=>s.role==='scarf'),
    by.find(s=>s.role==='setup'),
    by.find(s=>s.role==='bulky'),
    by.find(s=>s.role==='attacker')
  ].filter(Boolean);
  for(const x of prefs){if(chosen.length>=3)break;
   if(!chosen.some(y=>y.item===x.item&&y.species===x.species&&y.moves.join()===x.moves.join()))chosen.push(x);
  }
  if(!chosen.length)chosen.push(by[0]);
  out.push(...chosen);
 }
 return out;
}
function prepare(sim){
 const dex=sim.Dex.mod('champions');
 const candidates=dex.species.all().filter(s=>s.exists&&s.num>0&&!s.isMega&&!s.battleOnly);
 const all=[],unresolved=[];const seen=new Set();
 for(const s of candidates){
  if(seen.has(s.name))continue;seen.add(s.name);
  try{
   const x=legalRoleHypotheses(sim,s.name,{version:'v2'});
   if(x.sets.length)all.push(x);
   else unresolved.push(s.name);
  }catch(e){unresolved.push(s.name);}
 }
 const sources=roleCandidates(all).map(x=>effective(dex,x));
 const rivals=all.map(a=>a.sets.slice(0,2).map(s=>effective(dex,s)));
 // A selected candidate's lower-bound success over *independent* rival
 // species is worst across two rival hypothesis sets for that species.
 const matrix=sources.map(a=>rivals.map(h=>Math.min(...h.map(b=>duel(dex,a,b)))));
 return {dex,rawCount:candidates.length,speciesCount:all.length,
  unresolvedCount:unresolved.length,rivalCount:rivals.reduce((n,x)=>n+x.length,0),
  sources,matrix};
}
function fitness(ids,screen){
 const scores=[],backs=[];
 for(let k=0;k<screen.speciesCount;k++){
  let best=-100,second=-100;
  for(const id of ids){const v=screen.matrix[id][k];
   if(v>best){second=best;best=v;}else if(v>second)second=v;
  }
  scores.push(best);backs.push(second);
 }
 const sorted=scores.slice().sort((a,b)=>a-b);
 const n=Math.max(1,Math.ceil(sorted.length*.10));
 const qAvg=sorted.slice(0,n).reduce((a,b)=>a+b,0)/n;
 const mean=scores.reduce((a,b)=>a+b,0)/scores.length;
 const backups=backs.filter(v=>v>0).length/backs.length;
 const nonResponse=scores.filter(v=>v<-.5).length;
 const value=qAvg*2.8+mean*.45+backups*.35-nonResponse/scores.length;
 return {value,qAvg,mean,backups,nonResponse,worst:sorted.slice(0,5)};
}
function valid(ids,screen){
 if(ids.length!==6)return false;
 const species=new Set(),items=new Set();let mega=0;
 for(const i of ids){
  const s=screen.sources[i];
  if(species.has(s.species)||items.has(s.item))return false;
  species.add(s.species);items.add(s.item);
  if(screen.dex.items.get(s.item).megaStone)mega++;
 }
 // One-Mega-at-once; restrict this proxy to zero or one Mega stone to avoid
 // scoring two simultaneous Mega forms. Other legal dual-Mega strategies may
 // be evaluated in later full-Battle comparisons; this is a search shortcut.
 return mega<=1;
}
function findTeam(screen,{seed=1126,rounds=6,samples=110,avoid=new Set()}={}){
 const random=rng(seed);const total=screen.sources.length;
 let champ=null;
 for(let start=0;start<rounds;start++){
  const ids=[];let tries=0;
  while(ids.length<6&&tries++<20000){
   const k=Math.floor(random()*total);
   if(avoid.has(screen.sources[k].species))continue;
   if(valid([...ids,k,...Array(5-ids.length).fill(k)],screen)){} // no-op
   // Partial uniqueness/item/Mega checks, separate from full-team check.
   const s=screen.sources[k];
   if(ids.some(i=>screen.sources[i].item===s.item||screen.sources[i].species===s.species))continue;
   if(screen.dex.items.get(s.item).megaStone&&ids.some(i=>screen.dex.items.get(screen.sources[i].item).megaStone))continue;
   ids.push(k);
  }
  if(ids.length!==6)throw Error('Unable to construct six unique validated sets');
  let score=fitness(ids,screen);
  for(let pass=0;pass<4;pass++){
   let changed=false;
   for(let slot=0;slot<6;slot++){
    let best=score,replace=ids[slot];
    for(let trial=0;trial<samples;trial++){
     const v=Math.floor(random()*total),p=screen.sources[v];
     if(avoid.has(p.species)||v===ids[slot])continue;
     const alt=ids.slice();alt[slot]=v;
     if(!valid(alt,screen))continue;
     const next=fitness(alt,screen);
     if(next.value>best.value+1e-7){best=next;replace=v;}
    }
    if(replace!==ids[slot]){ids[slot]=replace;score=best;changed=true;}
   }
   if(!changed)break;
  }
  if(!champ||score.value>champ.score.value)champ={ids:ids.slice(),score};
 }
 const members=champ.ids.map(i=>screen.sources[i]).map(s=>({
  species:s.species,item:s.item,ability:s.ability,nature:s.nature,
  evs:clone(s.evs),moves:s.moves.slice()
 }));
 return {team:members,score:champ.score};
}
function discover(sim,{seed=1543,rounds=5,samples=90}={}){
 const screen=prepare(sim),first=findTeam(screen,{seed,rounds,samples});
 const excluded=new Set(first.team.slice(0,4).map(x=>x.species));
 const second=findTeam(screen,{seed:seed+999,rounds,samples,avoid:excluded});
 const validator=sim.TeamValidator.get('gen9championsbssregmc');
 for(const [key,a] of [['candidateA',first],['candidateB',second]]){
  prelim(a.team,key);const issues=validator.validateTeam(normalize(a.team));
  if(issues?.length)throw Error(key+' invalid: '+issues.join(';'));
 }
 return {coverage:{formsConsidered:screen.rawCount,validatedSpeciesLowerBound:screen.speciesCount,
  unresolvedNotNecessarilyIllegal:screen.unresolvedCount,sourceSets:screen.sources.length,
  opponentHypothesisSets:screen.rivalCount},
  candidates:[first,second],limitations:[
   '1v1 rough offense/defense and speed proxy, NOT actual damage, setup, statuses, switches or selected-three',
   'Current held Air Balloon is modelled as intact, Levitate as active; transitions need full Battle',
   'Only a maximum of one Mega stone in this first-pass search, not a game rule banning dual stones',
   'Validated role hypotheses are not the full M-C legal universe or usage distribution']};
}
module.exports={discover,prepare,fitness,eff,duel};
