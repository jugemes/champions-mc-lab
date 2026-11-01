'use strict';
// Research-only public-six risk bounds. A move being legal in at least one
// coherent set does NOT imply that multiple such moves coexist in one set.
// No opposing chosen three, actual moves/items or omniscient battle state.
const {movePool,legalRoleHypotheses,FORMAT}=require('./legal-role-hypotheses');
const {knownStat,effectiveness}=require('./damage');
const cache=new Map();
const canon=x=>String(x||'').toLowerCase().replace(/[^a-z0-9]/g,'');
function valid(validator,set){
  const {form,role,rationale,speedPoints,problems,tags,provenance,itemSwapped,...core}=set;
  return !(validator.validateSet(structuredClone(core),{})||[]).length;
}
function candidates(sim,name){
  const dex=sim.Dex.mod('champions'),key=name;
  if(cache.has(key))return cache.get(key);
  const validator=sim.TeamValidator.get(FORMAT);
  const roles=legalRoleHypotheses(sim,name,{version:'v2'}).sets;
  const moves=movePool(dex,name).map(id=>dex.moves.get(id))
    .filter(m=>m.exists&&m.category!=='Status'&&m.basePower>=50&&!m.ohko
      &&!m.flags?.recharge&&!m.isNonstandard&&!m.isZ&&!m.isMax);
  // Keep the strongest two options of each type/category before legality
  // checking. This is a bounded screen, not an exhaustive legal-move proof.
  const byKind=new Map();
  for(const m of moves){
    const key=m.type+'|'+m.category;
    if(!byKind.has(key))byKind.set(key,[]);
    byKind.get(key).push(m);
  }
  const screened=[...byKind.values()].flatMap(a=>a.sort((x,y)=>
    (y.basePower*(typeof y.accuracy==='number'?y.accuracy/100:1))-
    (x.basePower*(typeof x.accuracy==='number'?x.accuracy/100:1))).slice(0,2));
  const legal=[],seen=new Set();
  for(const role of roles){
    const form=dex.species.get(role.form);
    for(const m of screened){
      if(m.flags?.charge&&!Object.values(form.abilities).includes('Drought'))continue;
      const replacement=role.moves.findIndex(x=>dex.moves.get(x).category===m.category);
      const index=replacement>=0?replacement:role.moves.findIndex(x=>dex.moves.get(x).category!=='Status');
      if(index<0)continue;
      const proposed=role.moves.slice();
      if(!proposed.some(x=>canon(x)===m.id))proposed[index]=m.name;
      const candidate={...role,moves:proposed};
      if(!valid(validator,candidate))continue;
      const k=role.form+'|'+m.id;
      if(seen.has(k))continue;
      seen.add(k);
      legal.push({form:role.form,item:role.item,move:m.name,type:m.type,
        category:m.category,basePower:m.basePower,accuracy:m.accuracy,
        weather:Object.values(form.abilities).includes('Drought')?'sun':
          Object.values(form.abilities).includes('Drizzle')?'rain':'none'});
    }
  }
  // Choice Scarf is an uncertainty band, not an assumed item.
  let scarfPossible=roles.some(r=>r.item==='Choice Scarf');
  if(!scarfPossible){
    for(const role of roles.filter(r=>!dex.species.get(r.form).isMega)){
      const attacks=legal.filter(x=>x.form===role.form).map(x=>x.move);
      const distinct=[...new Set(attacks.map(canon))].slice(0,4);
      if(distinct.length<4)continue;
      const names=distinct.map(id=>dex.moves.get(id).name);
      if(valid(validator,{...role,item:'Choice Scarf',moves:names})){scarfPossible=true;break;}
    }
  }
  const out={name,legal,forms:[...new Set(roles.map(r=>r.form))],scarfPossible,
    source:'pinned Showdown move pool + M-C validateSet on coherent 4-move candidate; screened top two per type/category'};
  cache.set(key,out);return out;
}
function upperHit(dex,own,formName,entry){
  const form=dex.species.get(formName),target=dex.species.get(own.species),m=dex.moves.get(entry.move);
  const eff=effectiveness(dex,m,target,{foeAbility:own.ability,foeItem:own.item});
  if(!eff)return 0;
  const a=m.category==='Physical'?'atk':'spa',d=m.category==='Physical'?'def':'spd';
  const atk=Math.floor((form.baseStats[a]+32+20)*1.1),def=knownStat(dex,own,d);
  const hp=knownStat(dex,own,'hp');
  const stab=form.types.includes(m.type)?1.5:1;
  const weather=entry.weather==='sun'?(m.type==='Fire'?1.5:m.type==='Water'?.5:1):
    entry.weather==='rain'?(m.type==='Water'?1.5:m.type==='Fire'?.5:1):1;
  const power=m.basePower*(Array.isArray(m.multihit)?m.multihit[1]:m.multihit||1);
  const raw=Math.floor(Math.floor((22*power*atk/Math.max(1,def))/50)+2);
  return +(Math.floor(raw*stab*eff)*weather/Math.max(1,hp)).toFixed(3);
}
function publicCoverageBand(sim,own,foeName){
  const dex=sim.Dex.mod('champions'),c=candidates(sim,foeName);
  const ownSpeed=knownStat(dex,own,'spe')*(canon(own.item)==='choicescarf'?1.5:1);
  const rows=c.legal.map(m=>({...m,upperRatio:upperHit(dex,own,m.form,m)}))
    .sort((a,b)=>b.upperRatio-a.upperRatio||a.move.localeCompare(b.move));
  const base=dex.species.get(foeName);
  // Legal public forms can include Mega evolutions. A Mega can outspeed an
  // unboosted base form, but cannot hold Choice Scarf at the same time.
  // Keep the two possibility bands separate: no Mega+Scarf hybrid set.
  const formSpeeds=c.forms.map(form=>{
    const species=dex.species.get(form);
    return {form,max:Math.floor((species.baseStats.spe+32+20)*1.1)};
  });
  const fastest=formSpeeds.reduce((a,b)=>b.max>a.max?b:a);
  const speedBaseMax=Math.floor((base.baseStats.spe+32+20)*1.1);
  const scarfMax=c.scarfPossible?Math.floor(speedBaseMax*1.5):null;
  return {foe:foeName,own:own.species,ownSpeed,speed:{
    unboostedMax:fastest.max,fastestUnboostedForm:fastest.form,
    scarfPossible:c.scarfPossible,scarfMax,
    canOutspeedUnboosted:fastest.max>ownSpeed,
    canOutspeedWithScarf:scarfMax!==null&&scarfMax>ownSpeed
  },coverage:rows.slice(0,8),worstPossible:rows[0]?.upperRatio||0,
  warning:'possibility upper screen only; not usage probability, true engine damage, or a guaranteed four-move combination'};
}
module.exports={candidates,publicCoverageBand,upperHit};
