'use strict';
// Opt-in, research-only: coherent rival set HYPOTHESES from a PUBLIC species
// name only. Input is never an observed rival set, item, selection or log.
// Each hypothesis is ONE complete set (exactly four moves, one item, one
// ability, nature, Champions stat points) built for a named tactical role and
// then checked twice: pinned TeamValidator (gen9championsbssregmc) plus the
// coherence checks the validator does NOT do (see coherenceProblems).
// Role order is a transparent heuristic, NOT a usage probability.
//
// Why not PR #63's shortlist->top quartets: audited 2026-10-30 on pinned
// Showdown 3a766f2. Ranking quartets by summed move score made Swords Dance
// 0/24 for Garchomp and Golisopod, Roost 0/24 for Corviknight, Slack Off 0/24
// for Hippowdon, Protect absent for every species, and filled slots with
// Hyper Beam/Last Resort/Future Sight/Upper Hand. The validator rejected 0
// sets in every case and accepted Charizardite Y on Garchomp, so "validated"
// alone did not certify item/mega coherence.
const FORMAT='gen9championsbssregmc';
// Moves whose raw base power overstates their value as a standing pick.
const IMPRACTICAL=new Set(['hyperbeam','gigaimpact','lastresort','futuresight','focuspunch',
  'upperhand','skyattack','fly','dig','dive','bounce','solarbeam','solarblade','meteorbeam',
  'electroshot','thrash','uproar','round','feint','selfdestruct','explosion','mistyexplosion',
  'dreameater','belch','steelroller','phantomforce','shadowforce','razorwind','skullbash',
  'freezeshock','iceburn','doomdesire','synchronoise','naturalgift','fling','bide','counter',
  'mirrorcoat','metalburst','endeavor','finalgambit','spitup','stockpile','lastrespects',
  'chargebeam','steelbeam','mindblown','snore','sleeptalk','rollout','iceball','echoedvoice','furycutter','present',
  'beatup','trumpcard','wringout','crushgrip','punishment','storedpower','powertrip',
  'frustration','return','hiddenpower','magnitude','facade','smellingsalts','wakeupslap',
  'dragonrush','zapcannon','inferno','focusblast','firstimpression','fakeout','risingvoltage',
  'expandingforce','grassyglide','terrainpulse','weatherball','burnup','doubleshock','pollenpuff']);
// Re-admitted per role (the role asks for exactly this kind of move).
const PRIORITY=['suckerpunch','extremespeed','aquajet','bulletpunch','shadowsneak','iceshard',
  'machpunch','vacuumwave','quickattack','accelerock','jetpunch','grassyglide','firstimpression'];
const SETUP=['swordsdance','dragondance','nastyplot','calmmind','quiverdance','bulkup',
  'shellsmash','coil','tidyup','shiftgear','victorydance','irondefense'];
const RECOVERY=['recover','roost','slackoff','moonlight','morningsun','synthesis','softboiled',
  'milkdrink','shoreup','strengthsap','wish'];
const UTILITY=['stealthrock','willowisp','thunderwave','yawn','encore','taunt','knockoff',
  'uturn','voltswitch','flipturn','partingshot','spikes','toxic','haze','trick','trickroom',
  'whirlwind','roar','leechseed','destinybond','foulplay','bodypress'];
const LEAD=['fakeout','stealthrock','encore','taunt','uturn','voltswitch','spikes',
  'thunderwave','willowisp','trick','followme'];
// Preference among legal abilities; anything else falls back to slot '0'.
const ABILITY_PREF=['Intimidate','Regenerator','Drought','Drizzle','Sand Stream','Snow Warning',
  'Psychic Surge','Electric Surge','Grassy Surge','Misty Surge','Levitate','Multiscale',
  'Disguise','Unaware','Magic Guard','Protean','Adaptability','Tough Claws','Technician',
  'Huge Power','Rough Skin','Thick Fat','Supreme Overlord','Good as Gold','Thermal Exchange',
  'Moxie','Guts','Swift Swim','Chlorophyll','Sharpness','Iron Fist','Strong Jaw','Sheer Force'];
const TYPES18=['Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground',
  'Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy'];
const id=s=>String(s).toLowerCase().replace(/[^a-z0-9]/g,'');
function megaOptions(dex,species){
  const sp=dex.species.get(species);
  return dex.items.all().filter(i=>i.megaStone&&!i.isNonstandard&&i.megaStone[sp.name])
    .map(i=>({item:i.name,form:i.megaStone[sp.name]}))
    .filter(x=>dex.species.get(x.form).exists)
    .sort((a,b)=>a.item.localeCompare(b.item));
}
function movePool(dex,species){
  const sp=dex.species.get(species);
  const src=sp.isMega||sp.forme?.startsWith('Mega')?dex.species.get(sp.baseSpecies):sp;
  let pool=dex.species.getMovePool(src.id);
  if(!(pool instanceof Set))pool=new Set(pool||[]);
  return [...pool].filter(m=>{const d=dex.moves.get(m);return d.exists&&!d.isNonstandard&&!d.isZ&&!d.isMax;}).sort();
}
function attackValue(dex,form,mid,category){
  const m=dex.moves.get(mid);
  if(m.category==='Status'||m.category!==category||!m.basePower||m.ohko)return 0;
  if(m.flags?.charge||m.flags?.recharge)return 0;
  const acc=typeof m.accuracy==='number'?m.accuracy/100:1;
  const hits=Array.isArray(m.multihit)?(m.multihit[0]+m.multihit[1])/2:(m.multihit||1);
  const stab=form.types.includes(m.type)?1.5:1;
  // Self-drop moves (Draco Meteor, Close Combat) stay, but slightly discounted.
  const drop=m.self?.boosts&&Object.values(m.self.boosts).some(v=>v<0)?0.9:1;
  return Math.min(150,m.basePower*hits)*acc*stab*drop;
}
// Greedy STAB-then-coverage: maximise the sum over 18 mono types of the best
// effective power, so the set is not four near-duplicates of the top STAB.
function pickAttacks(dex,form,pool,category,n,{allowImpractical=[]}={}){
  const cand=pool.filter(m=>(!IMPRACTICAL.has(m)||allowImpractical.includes(m))&&attackValue(dex,form,m,category)>0);
  const picked=[];
  const cover=set=>TYPES18.reduce((s,t)=>s+Math.max(0,...set.map(m=>{
    const d=dex.moves.get(m);
    if(!dex.getImmunity(d.type,[t]))return 0;
    return attackValue(dex,form,m,category)*2**dex.getEffectiveness(d.type,[t]);
  })),0);
  while(picked.length<n){
    let best=null,gain=0;
    for(const m of cand){
      if(picked.includes(m))continue;
      if(picked.some(p=>dex.moves.get(p).type===dex.moves.get(m).type))continue;
      const g=cover([...picked,m])-cover(picked);
      if(g>gain||g===gain&&best&&m<best){gain=g;best=m;}
    }
    // No coverage gain left: fill with the strongest unused new type.
    if(!best)best=cand.filter(m=>!picked.includes(m)&&!picked.some(p=>dex.moves.get(p).type===dex.moves.get(m).type))
      .sort((a,b)=>attackValue(dex,form,b,category)-attackValue(dex,form,a,category)||a.localeCompare(b))[0];
    if(!best)break;
    picked.push(best);
  }
  return picked;
}
const firstIn=(pool,list)=>list.find(m=>pool.includes(m));
function category(form){return form.baseStats.atk>=form.baseStats.spa?'Physical':'Special';}
// Pre-Mega ability; after Mega the form's own ability is fixed and public.
function chooseAbility(base){
  const legal=Object.values(base.abilities);
  return ABILITY_PREF.find(a=>legal.includes(a))||base.abilities['0'];
}
function coherenceProblems(dex,set,{formName}={}){
  const out=[];
  const it=dex.items.get(set.item);
  if(it.megaStone&&!it.megaStone[dex.species.get(set.species).name])
    out.push(set.item+' does not Mega Evolve '+set.species);
  if(formName&&dex.species.get(formName).isMega&&!it.megaStone)out.push('Mega form without its stone');
  if(/^Choice /.test(set.item)&&set.moves.some(m=>dex.moves.get(m).category==='Status'))
    out.push('Choice item with a status move');
  if(set.moves.length!==4||new Set(set.moves.map(id)).size!==4)out.push('not exactly four distinct moves');
  const pts=Object.values(set.evs).reduce((a,b)=>a+b,0);
  if(pts!==66||Object.values(set.evs).some(v=>v>32||v<0))out.push('stat points must total 66, each <=32');
  return out;
}
const POINTS={
  fast:(cat)=>cat==='Physical'?{hp:2,atk:32,def:0,spa:0,spd:0,spe:32}:{hp:2,atk:0,def:0,spa:32,spd:0,spe:32},
  bulkyPhys:()=>({hp:32,atk:0,def:32,spa:0,spd:2,spe:0}),
  bulkySpec:()=>({hp:32,atk:0,def:2,spa:0,spd:32,spe:0}),
};
const NATURE={fast:{Physical:'Jolly',Special:'Timid'},power:{Physical:'Adamant',Special:'Modest'}};
// Up to five role templates per public species. Every template fixes the
// whole set; a battle scenario never mixes moves from two templates.
function roleSets(dex,species){
  const base=dex.species.get(species);
  if(!base.exists||typeof species!=='string')throw Error('Unknown species: '+JSON.stringify(species));
  const pool=movePool(dex,base.name);
  const out=[];
  const push=(role,form,item,cat,moves,points,nature,rationale)=>{
    if(moves.length!==4)return;
    out.push({role,species:base.name,form:form.name,item,ability:chooseAbility(base),
      nature,level:50,evs:points,moves:moves.map(m=>dex.moves.get(m).name),
      speedPoints:points.spe,rationale});
  };
  const megas=megaOptions(dex,base.name);
  const forms=[...megas.map(m=>({form:dex.species.get(m.form),item:m.item})),{form:base,item:null}];
  for(const {form,item} of forms){
    const cat=category(form),tag=form.isMega?form.name+' ':'';
    // Solar Beam is a standing pick only under the form's own sun.
    const allow=Object.values(form.abilities).includes('Drought')?['solarbeam']:[];
    const prio=firstIn(pool,PRIORITY.filter(m=>dex.moves.get(m).category===cat));
    const setup=firstIn(pool,SETUP.filter(m=>{const b=dex.moves.get(m).boosts||{};
      return cat==='Physical'?b.atk:b.spa;}));
    const recov=firstIn(pool,RECOVERY);
    // 1. all-out attacker: 3 coverage + priority if any.
    const att=pickAttacks(dex,form,pool,cat,prio?3:4,{allowImpractical:allow});
    push('attacker',form,item||'Life Orb',cat,prio?[...att,prio]:att,POINTS.fast(cat),NATURE.fast[cat],
      tag+'best STAB/coverage'+(prio?' + priority':''));
    // 2. setup sweeper: setup + 2 attacks + (priority | recovery | Protect).
    if(setup){
      const last=prio||recov||(pool.includes('protect')?'protect':null);
      const a2=pickAttacks(dex,form,pool,cat,last?2:3,{allowImpractical:allow});
      push('setup',form,item||'Focus Sash',cat,[setup,...a2,...(last?[last]:[])],POINTS.fast(cat),NATURE.fast[cat],
        tag+setup+' + 2 attacks + '+(last||'third attack'));
    }
    if(form.isMega)continue; // non-Mega roles below are the same for every stone
    // 3. Choice Scarf: four attacks only (no status: coherence).
    push('scarf',form,'Choice Scarf',cat,pickAttacks(dex,form,pool,cat,4),POINTS.fast(cat),NATURE.fast[cat],
      'locked four attacks, outspeeds unboosted base 100+');
    // 4. bulky utility: recovery + one utility + 2 attacks; Speed P 0.
    const util=firstIn(pool,UTILITY.filter(m=>dex.moves.get(m).category==='Status'||m==='uturn'||m==='knockoff'||m==='voltswitch'||m==='flipturn'||m==='foulplay'||m==='bodypress'));
    const pieces=[recov,util].filter(Boolean);
    if(pieces.length){
      const bulkyPhys=base.baseStats.def>=base.baseStats.spd;
      const ex=pickAttacks(dex,form,pool,cat,4-pieces.length).filter(m=>!pieces.includes(m));
      push('bulky',form,'Leftovers',cat,[...pieces,...ex].slice(0,4),bulkyPhys?POINTS.bulkyPhys():POINTS.bulkySpec(),
        bulkyPhys?'Impish':'Calm',(recov||'no recovery')+' + '+(util||'-')+' , Speed P 0');
    }
    // 5. lead/support: up to two lead tools + attacks.
    const leads=LEAD.filter(m=>pool.includes(m)).slice(0,2);
    if(leads.length){
      const ex=pickAttacks(dex,form,pool,cat,4-leads.length).filter(m=>!leads.includes(m));
      const item2=leads.includes('fakeout')?'Focus Sash':'Sitrus Berry';
      push('lead',form,item2,cat,[...leads,...ex].slice(0,4),POINTS.fast(cat),NATURE.fast[cat],
        leads.join('+')+' lead');
    }
  }
  // Interleave Mega and non-Mega hypotheses so that scenario k=0,1,2 covers
  // "Mega ace", "Scarf/regular" and "the other Mega" (Charizard X/Y).
  const mega=out.filter(s=>s.form!==base.name),plain=out.filter(s=>s.form===base.name);
  const ROLE_ORDER=['scarf','attacker','bulky','setup','lead'];
  plain.sort((a,b)=>ROLE_ORDER.indexOf(a.role)-ROLE_ORDER.indexOf(b.role));
  mega.sort((a,b)=>(a.role==='attacker'?0:1)-(b.role==='attacker'?0:1)||a.form.localeCompare(b.form));
  const ordered=[];
  for(let i=0;i<Math.max(mega.length,plain.length);i++){if(mega[i])ordered.push(mega[i]);if(plain[i])ordered.push(plain[i]);}
  out.length=0;out.push(...ordered);
  return out;
}
let cachedValidator=null;
function legalRoleHypotheses(sim,species){
  const dex=sim.Dex.mod('champions');
  cachedValidator=cachedValidator||new sim.TeamValidator(FORMAT);
  const kept=[],rejected=[];
  for(const s of roleSets(dex,species)){
    const {form,role,rationale,speedPoints,...set}=s;
    const problems=[...(cachedValidator.validateSet(structuredClone(set),{})||[]),...coherenceProblems(dex,set,{formName:form})];
    (problems.length?rejected:kept).push({...s,problems,
      provenance:{source:'public-learnset role template (no usage data)',validator:FORMAT,
        showdown:'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640'}});
  }
  if(!kept.length)throw Error('No coherent legal hypothesis for '+species+': '+JSON.stringify(rejected.map(r=>r.problems)));
  return {species:dex.species.get(species).name,sets:kept,rejected};
}
const ITEM_FALLBACK=['Sitrus Berry','Leftovers','Focus Sash','Lum Berry','Rocky Helmet','Life Orb',
  'Shell Bell','Quick Claw',"King's Rock",'Bright Powder','White Herb','Mental Herb'];
// A team-level scenario = one fixed hypothesis per species (role index k,
// wrapping), in the public six's order. Item clause: on a clash take the species' next WHOLE hypothesis
// whose item is still free, so moves/item/points stay one coherent set (a
// Scarf moveset is never left holding Leftovers). Only if every hypothesis
// clashes is the item swapped, and that set is flagged itemSwapped.
// Claim order rotates with k: with a fixed order the first species always won
// the clash, so e.g. Scarf Garchomp never appeared once Golisopod held Scarf.
function rivalScenario(hyps,k){
  const used=new Set(),team=new Array(hyps.length);
  for(let r=0;r<hyps.length;r++){
    const at=(r+k)%hyps.length,h=hyps[at];
    const n=h.sets.length;
    let s=null;
    for(let j=0;j<n&&!s;j++){const c=h.sets[(k+j)%n];if(!used.has(c.item))s=structuredClone(c);}
    if(!s){s=structuredClone(h.sets[k%n]);s.item=ITEM_FALLBACK.find(i=>!used.has(i));s.itemSwapped=true;}
    used.add(s.item);team[at]=s;
  }
  return team;
}
module.exports={FORMAT,IMPRACTICAL,megaOptions,movePool,pickAttacks,roleSets,coherenceProblems,
  legalRoleHypotheses,rivalScenario};
