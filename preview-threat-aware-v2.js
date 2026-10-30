'use strict';
// Opt-in public-six -> three preview policy: previewPolicy:'threat-aware-v2'.
// Repair of PR #58 'threat-aware' (kept unchanged in preview-threat-aware.js so
// its 2016 saved battles stay reproducible). Inputs are still ONLY our own six
// known sets and the six public rival species names; rival moves, items,
// points, the hidden three and the omniscient battle are never read.
//
// What changed versus v1, each tied to an observed failure (PR #58 review):
// 1. Priority moves are tracked separately from the strongest move of a type.
//    v1 kept only the strongest Dark physical move (Throat Chop) and so never
//    saw that a learnable Sucker Punch after a learnable Swords Dance KOs the
//    lead (A forcedA 0/12). First-turn-only moves (Fake Out, First Impression)
//    count only on the turn the user enters.
// 2. A duel is a short turn-by-turn race (HP fractions, speed, priority,
//    setup, recovery, contact chip), not a closed-form race score.
// 3. The lead is a 2x2 simultaneous choice: we stay or switch, the rival
//    attacks or sets up. Switching hands the rival a free setup turn or a
//    free hit on the bench member; v1's max(stay, 0.8*pivot) ignored both.
//    It is evaluated for EVERY public variant of the rival lead (each Mega
//    form, each ability, Scarf), not the first one found.
// 4. Rocky Helmet (and other contact punishers) and reliable recovery are
//    possibilities of a hypothesis with a stated weight, never certainties
//    and never zero. Contact attackers are not counted as free answers.
// 5. Every rival member keeps ONE coherent variant inside a rival-selection
//    hypothesis (v1 maximised each column independently). All 20 rival threes
//    are scored, and our candidate is judged on the weighted mean AND the
//    mean of the three rival threes that hurt it most, so a rational three
//    outside a top-k list is not free.
// 6. The Mega holder of a rival hypothesis is used consistently; Sand Force
//    is applied only when the public six contains a sand setter (v1's
//    condition could never be true); Drought is applied for its holder.
// All weights are hypotheses, NOT usage data; see SENSITIVITY in the audit.
const {knownStat,estimateDamage,effectiveness}=require('./damage');
const V1=require('./preview-threat-aware');
const canon=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const DEFAULTS={scarfWeight:0.25,helmetWeight:0.25,megaWeight:0.65,temperature:0.08,
  worstK:3,worstWeight:0.4,sixWeight:0.2,coverageWeight:0.5,leadWorstWeight:0.4};
// Move mechanics (not species): usable only on the user's first turn out.
const FIRST_TURN_ONLY=new Set(['fakeout','firstimpression']);
const CONTACT_PUNISH={roughskin:1/8,ironbarbs:1/8};
const HELMET_CHIP=1/6;

function maxStat(dex,species,stat){
  const s=dex.species.get(species);
  return stat==='hp'?s.baseStats.hp+32+75:Math.floor((s.baseStats[stat]+32+20)*1.1);
}
function fixedAbility(species){
  const values=Object.values(species.abilities||{}).filter(Boolean);
  return values.length===1?values[0]:'';
}
// Public variants: every legal ability of the base form, the same with Scarf
// and with Rocky Helmet, and each Mega form (fixed ability). Weights within a
// species are relative hypotheses only.
function publicVariants(dex,name,opt=DEFAULTS){
  const base=dex.species.get(name);
  if(!base.exists)throw Error('Unknown public species '+name);
  const megas=(base.otherFormes||[]).map(f=>dex.species.get(f)).filter(f=>f.exists&&f.isMega);
  const abilities=[...new Set(Object.values(base.abilities||{}).filter(Boolean))];
  const out=[];
  for(const ability of abilities.length?abilities:['']){
    const w=1/Math.max(1,abilities.length);
    out.push({species:base.name,form:base.name,mega:false,item:'',weight:w,ability});
    out.push({species:base.name,form:base.name,mega:false,item:'choicescarf',weight:opt.scarfWeight*w,ability});
    out.push({species:base.name,form:base.name,mega:false,item:'rockyhelmet',weight:opt.helmetWeight*w,ability});
  }
  for(const m of megas)out.push({species:base.name,form:m.name,mega:true,item:'mega',weight:1,ability:fixedAbility(m)});
  return out;
}
// Learnable-move summary of a form: best move per type+category, and SEPARATELY
// the best priority move per type, plus setup and recovery availability.
const poolCache=new Map();
function movePool(dex,form){
  const key=canon(form);
  if(poolCache.has(key))return poolCache.get(key);
  const species=dex.species.get(form);
  let pool=new Set();
  try{pool=dex.species.getMovePool(species.id);}catch{}
  if(!pool.size&&species.baseSpecies)try{pool=dex.species.getMovePool(dex.species.get(species.baseSpecies).id);}catch{}
  const best={},prio={};
  let setup=0,recovery=false;
  for(const id of pool){
    const m=dex.moves.get(id);
    if(!m.exists)continue;
    if(m.category==='Status'){
      const b=m.target==='self'&&m.boosts||{};
      setup=Math.max(setup,b.atk||0,b.spa||0);
      if(m.heal&&m.heal[0]/m.heal[1]>=0.5&&m.target==='self')recovery=true;
      continue;
    }
    if(!m.basePower||m.basePower>=150||m.flags?.charge||m.selfdestruct||m.ohko||m.isZ||m.isMax)continue;
    if(m.id==='solarbeam'||m.id==='solarblade')continue;
    const acc=typeof m.accuracy==='number'?m.accuracy/100:1;
    const row={id:m.id,type:m.type,category:m.category,basePower:Math.min(m.basePower,100)*acc,
      priority:m.priority,contact:Boolean(m.flags?.contact),useDef:m.overrideOffensiveStat==='def',
      firstTurn:FIRST_TURN_ONLY.has(m.id)};
    const k=m.type+m.category;
    if(m.priority>0){if(!prio[k]||prio[k].basePower<row.basePower)prio[k]=row;}
    if(!row.firstTurn&&(!best[k]||best[k].basePower<row.basePower))best[k]=row;
  }
  const out={coverage:Object.values(best),priority:Object.values(prio),setup,recovery};
  poolCache.set(key,out);
  return out;
}
function rawDamage(power,attack,defence,mult){
  return (Math.floor(Math.floor(22*power*attack/defence)/50)+2)*mult;
}
// Public-only attack of a rival variant on our known (or a public) defender.
// Returns HP fractions: stab (STAB 90 only), worst (any learnable), and the
// best priority / first-turn priority, and contact of the worst move.
function variantAttack(dex,v,defender,{knownDefender,field={}}){
  const form=dex.species.get(v.form),def=dex.species.get(defender.species);
  const hp=knownDefender?knownStat(dex,defender,'hp'):maxStat(dex,defender.species,'hp')-32;
  const ability=canon(v.ability);
  const sun=ability==='drought';
  const sand=!sun&&field.sandSetter&&ability==='sandforce';
  const pool=movePool(dex,v.form);
  const moves=[];
  for(const type of form.types)for(const category of ['Physical','Special'])
    moves.push({type,category,basePower:90,stab:true,plain:true,contact:category==='Physical',priority:0});
  for(const m of pool.coverage)moves.push({...m,stab:form.types.includes(m.type)});
  for(const m of pool.priority)moves.push({...m,stab:form.types.includes(m.type)});
  if(sun)moves.push({type:'Grass',category:'Special',basePower:120,stab:false,priority:0});
  const out={stab:0,worst:0,priority:0,firstTurn:0,physical:0,special:0};
  for(const m of moves){
    const eff=effectiveness(dex,m,def,{foeAbility:knownDefender?defender.ability:fixedAbility(def),foeItem:knownDefender?defender.item:''});
    if(!eff)continue;
    const stat=m.category==='Physical'?'atk':'spa',dstat=m.category==='Physical'?'def':'spd';
    const atk=maxStat(dex,v.form,m.useDef?'def':stat);
    const dfn=knownDefender?knownStat(dex,defender,dstat):Math.floor(def.baseStats[dstat]+20);
    let mult=eff*(m.stab?(ability==='adaptability'?2:1.5):1);
    if(ability==='toughclaws'&&m.contact)mult*=1.3;
    if(ability==='aerilate'&&m.type==='Normal')mult*=1.2*1.5;
    if(ability==='technician'&&m.basePower<=60)mult*=1.5;
    if(sun&&m.type==='Fire')mult*=1.5;
    if(sun&&m.type==='Water')mult*=0.5;
    if(sand&&['Rock','Ground','Steel'].includes(m.type))mult*=1.3;
    const frac=rawDamage(m.basePower,atk,dfn,mult)*0.925/hp;
    if(m.priority>0){
      if(m.firstTurn)out.firstTurn=Math.max(out.firstTurn,frac);
      else out.priority=Math.max(out.priority,frac);
      continue;
    }
    if(m.plain&&m.stab)out.stab=Math.max(out.stab,frac);
    out.worst=Math.max(out.worst,frac);
    if(m.category==='Physical')out.physical=Math.max(out.physical,frac);else out.special=Math.max(out.special,frac);
  }
  out.stab=out.stab||out.worst;
  return out;
}
function ownForm(dex,set){
  const item=dex.items.get(set.item);
  if(item.megaStone){
    const mega=typeof item.megaStone==='string'?item.megaStone:Object.values(item.megaStone)[0];
    const form=dex.species.get(mega);
    if(form.exists)return {...set,species:form.name,ability:fixedAbility(form)||set.ability};
  }
  return set;
}
function ownItemMult(set,move){
  const item=canon(set.item);
  let k=1;
  if(item==='lifeorb')k*=1.3;
  if(item==='choiceband'&&move.category==='Physical')k*=1.5;
  if(item==='choicespecs'&&move.category==='Special')k*=1.5;
  if(canon(set.ability)==='toughclaws'&&move.flags?.contact)k*=1.3;
  return k;
}
// Our known moves vs a public variant: every damaging move as an option, so
// a contact-punished best move can be traded for a non-contact one.
function ownOptions(dex,set,v){
  const out=[];
  for(const name of set.moves){
    const move=dex.moves.get(name);
    if(move.category==='Status')continue;
    const hit=estimateDamage(dex,set,v.form,name,{foeAbility:v.ability});
    if(hit.immune)continue;
    out.push({move:move.name,dmg:hit.mid*ownItemMult(set,move),acc:hit.accuracy,priority:move.priority>0,
      contact:Boolean(move.flags?.contact),category:move.category,
      recoil:canon(set.item)==='lifeorb'?0.1:0});
  }
  return out;
}
// Turn-by-turn race on HP fractions. Rival plan: 'attack' or 'setup' (one
// boosting turn first, only if the rival survives our hit that turn).
// Our own known utility moves: encore (lock a rival that just boosted) and
// wisp (burn first, halving the rival's physical damage; 85% accuracy is
// applied by the caller). Returns a value in [0,1]: >0.5 means we KO first.
function race(p){
  let us=p.ourHP??1,them=p.theirHP??1,boost=p.boost||0,turn=0;
  let theirDmg=p.theirDmg,theirPrioBase=p.theirPrio;
  const mult=()=>1+0.5*Math.min(4,boost);
  let setupLeft=p.plan==='setup'&&p.setup>0?1:0;
  let healed=0,hitsDealt=0,encorePending=false,locked=0,wispLeft=p.wisp?1:0,berry=p.ourItem==='sitrusberry';
  while(turn<12){
    turn++;
    const theirHit=Math.max(theirDmg*mult(),turn===1&&p.firstTurnNow?p.theirFirst:0);
    const theirPrio=Math.max(theirPrioBase*mult(),turn===1&&p.firstTurnNow?p.theirFirst:0);
    // Our move: priority if it KOs and we are not faster, else the main hit.
    const usePrio=p.ourPrio>=them&&p.faster<1;
    const ourHit=usePrio?p.ourPrio:p.ourDmg;
    const ourPri=usePrio?1:0,theirPri=!locked&&theirPrio>0&&theirPrio>=us?1:0;
    const weFirst=ourPri!==theirPri?ourPri>theirPri:p.faster>=1;
    let actedFirst=false;
    const theyAct=()=>{
      if(locked>0){locked--;if(p.setup)boost+=p.setup;return;}
      if(setupLeft&&ourHit<them){setupLeft=0;boost+=p.setup;if(p.encore)encorePending=true;return;}
      // Recovery stall: heal when our hits cannot outpace 50% recovery.
      if(p.recovery&&ourHit<0.5&&them<=0.5&&healed<4){them=Math.min(1,them+0.5);healed++;return;}
      us-=theirPrio>=us?theirPrio:theirHit;
    };
    const weAct=()=>{
      // Encore lasts 3 turns; the current one counts only if we move first.
      if(encorePending){encorePending=false;locked=actedFirst?3:2;return;}
      if(wispLeft){wispLeft=0;theirDmg*=0.5;theirPrioBase*=0.5;return;}
      them-=ourHit;hitsDealt++;us-=(p.chip||0)+(p.recoil||0);
    };
    // Our known recovery items: Sitrus Berry once at <=50%, Leftovers 1/16.
    const berryCheck=()=>{if(berry&&us>0&&us<=0.5){us+=0.25;berry=false;}};
    if(weFirst){actedFirst=true;weAct();berryCheck();if(them>0)theyAct();}
    else{theyAct();berryCheck();if(us>0)weAct();}
    if(us<=0||them<=0)break;
    if(p.ourItem==='leftovers')us=Math.min(1,us+1/16);
    berryCheck();
  }
  const acc=(p.ourAcc||1)**Math.min(hitsDealt,3);
  if(them<=0&&us>0)return (0.7+0.3*Math.max(0,us))*acc+0.3*(1-acc)*(1-Math.max(0,them));
  if(us<=0)return 0.3*(1-Math.max(0,them));
  return 0.4;
}
// Duel of our known set vs one public variant. entry: 'lead' (both fresh,
// so first-turn-only moves are live), 'free' (we enter after a KO: the rival
// is already in, no first-turn move), 'swap' (we take one rival hit first),
// 'boosted' (we enter while the rival spent its turn boosting).
// Rival picks its plan to minimise our value; we pick our best move option.
const duelCache=new Map();
function duel(dex,own,v,{entry='free',field={},opt=DEFAULTS,boost=0}={}){
  const key=[own.species,own.item,v.form,v.ability,v.item,entry,boost,field.sandSetter?1:0,opt.coverageWeight].join('|');
  if(duelCache.has(key))return duelCache.get(key);
  const set=ownForm(dex,own);
  const theirs=variantAttack(dex,v,set,{knownDefender:true,field});
  const pool=movePool(dex,v.form);
  const ourSpe=knownStat(dex,set,'spe')*(canon(own.item)==='choicescarf'?1.5:1);
  const theirSpe=maxStat(dex,v.form,'spe')*(v.item==='choicescarf'?1.5:1);
  const faster=ourSpe>theirSpe?1:ourSpe===theirSpe?0.5:0;
  const ab=canon(v.ability);
  const options=ownOptions(dex,set,v);
  const contactChip=(v.item==='rockyhelmet'?HELMET_CHIP:0)+(CONTACT_PUNISH[ab]||0);
  const known=new Set(own.moves.map(canon));
  const choiceLocked=/^choice/.test(canon(own.item));
  const encore=known.has('encore')&&!choiceLocked&&ab!=='oblivious'&&ab!=='aromaveil';
  // Our Will-O-Wisp: only into a non-Fire, physically stronger variant.
  const wispable=known.has('willowisp')&&!choiceLocked&&!dex.species.get(v.form).types.includes('Fire')
    &&!['guts','magicguard','waterveil','waterbubble','flashfire','comatose','purifyingsalt'].includes(ab);
  const best=(theirDmg,plan,ourHP,firstTurnNow,full)=>{
    let top=0;
    for(const o of options.length?options:[{dmg:0,acc:1}]){
      let dmg=o.dmg;
      if(ab==='intimidate'&&o.category==='Physical'&&canon(own.ability)!=='clearbody')dmg*=2/3;
      const prio=options.filter(x=>x.priority).reduce((m,x)=>Math.max(m,x.dmg),0);
      // First-hit abilities as extra HP: Disguise absorbs a hit for 1/8,
      // Multiscale halves the first hit, Sturdy survives a full-HP OHKO.
      const theirHP=ab==='disguise'?1+dmg-0.125:ab==='multiscale'?1+dmg/2:ab==='sturdy'&&dmg>=1?dmg+0.01:1;
      const run=(faster,wisp)=>race({ourDmg:dmg,ourPrio:prio,ourAcc:o.acc,faster,theirDmg,
        theirPrio:full?theirs.priority:0,theirFirst:full?theirs.firstTurn:0,firstTurnNow,setup:full?pool.setup:0,
        plan,recovery:pool.recovery&&v.item!=='choicescarf',ourHP,theirHP,encore,wisp,ourItem:canon(own.item),
        chip:o.contact?contactChip:0,recoil:o.recoil,boost:entry==='boosted'?boost:0});
      const val=w=>faster===0.5?(run(1,w)+run(0,w))/2:run(faster,w);
      top=Math.max(top,val(false));
      // A burn only matters into physical damage: compare the dominant split.
      if(wispable&&theirs.physical>=theirs.special)top=Math.max(top,0.85*val(true)+0.15*val(false)*0.8);
    }
    return top;
  };
  // Two hypotheses of the rival's moves, both possibilities only: STAB-only,
  // and the full learnable kit (coverage, priority, first-turn moves, setup).
  const scenario=full=>{
    const hit=full?theirs.worst:theirs.stab;
    let ourHP=1,firstTurnNow=entry==='lead';
    if(entry==='swap'){ourHP=1-Math.max(hit,full?theirs.firstTurn:0);firstTurnNow=false;}
    if(ourHP<=0)return 0;
    const plans=['attack'];
    if(full&&pool.setup>0&&v.item!=='choicescarf'&&entry!=='boosted')plans.push('setup');
    return Math.min(...plans.map(pl=>best(hit,pl,ourHP,firstTurnNow,full)));
  };
  const cw=opt.coverageWeight;
  const value=(1-cw)*scenario(false)+cw*scenario(true);
  const out={value,faster,theirWorst:theirs.worst,theirPrio:theirs.priority,setup:pool.setup};
  duelCache.set(key,out);
  return out;
}
const combine=rows=>{
  const w=rows.reduce((s,x)=>s+x.w,0);
  return 0.25*Math.min(...rows.map(x=>x.v))+0.75*rows.reduce((s,x)=>s+x.v*x.w,0)/(w||1);
};
const TRIPLES=(()=>{const t=[];for(let a=0;a<6;a++)for(let b=a+1;b<6;b++)for(let c=b+1;c<6;c++)t.push([a,b,c]);return t;})();
const PERMS=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
const SAND_SETTERS=new Set(['sandstream']);
function publicField(dex,six){
  const sandSetter=six.some(n=>Object.values(dex.species.get(n).abilities||{}).some(a=>SAND_SETTERS.has(canon(a))));
  return {sandSetter};
}
// Rival selection from OUR public six. Each rival member is ONE coherent
// variant per hypothesis (the variant it would most likely bring), not a
// per-opponent maximum. Every one of the 20 threes is kept with a weight.
function rivalHypotheses(dex,ownPublic,rivalSix,opt=DEFAULTS){
  const ourVar=ownPublic.map(n=>V1.publicVariants(dex,n));
  const vsOurs=t=>ourVar.map(ov=>{
    const rows=ov.map(o=>({v:V1.publicDuel(dex,t,o),w:o.weight}));
    return 0.25*Math.min(...rows.map(x=>x.v))+0.75*rows.reduce((s,x)=>s+x.v*x.w,0)/rows.reduce((s,x)=>s+x.w,0);
  });
  const mean=r=>r.reduce((a,b)=>a+b,0)/r.length;
  const pick=vars=>{
    let top=null;
    for(const t of vars){const row=vsOurs(t);if(!top||mean(row)>mean(top.row))top={variant:t,row};}
    return top;
  };
  const theirVar=rivalSix.map(n=>V1.publicVariants(dex,n));
  const plain=theirVar.map(tv=>pick(tv.filter(t=>!t.mega)));
  const mega=theirVar.map(tv=>{const m=tv.filter(t=>t.mega);return m.length?pick(m):null;});
  const ranked=TRIPLES.map(three=>{
    let top=null;
    for(const holder of [null,...three.filter(i=>mega[i])]){
      const row=i=>(i===holder?mega[i]:plain[i]).row;
      const answer=ownPublic.map((_,j)=>Math.max(...three.map(i=>row(i)[j])));
      const score=mean(answer)+0.35*Math.min(...answer);
      if(!top||score>top.score)top={three,score,holder,
        leads:three.map(i=>({i,score:mean(row(i))})).sort((a,b)=>b.score-a.score||a.i-b.i)};
    }
    return top;
  }).sort((a,b)=>b.score-a.score||a.three.join('').localeCompare(b.three.join('')));
  const first=ranked[0].score,t=opt.temperature;
  const weights=ranked.map(x=>Math.exp((x.score-first)/t)),sum=weights.reduce((a,b)=>a+b,0);
  return ranked.map((x,k)=>{
    const lw=x.leads.map(l=>Math.exp((l.score-x.leads[0].score)/(3*t))),ls=lw.reduce((a,b)=>a+b,0);
    return {three:x.three.map(i=>rivalSix[i]),score:x.score,weight:weights[k]/sum,
      likelyMega:x.holder==null?null:rivalSix[x.holder],
      leads:x.leads.map((l,n)=>({species:rivalSix[l.i],p:lw[n]/ls}))};
  });
}
// Mega assignment inside one hypothesis: its own likely holder carries
// megaWeight; the rest is shared by no-Mega and the other capable members.
function megaScenarios(dex,hyp,opt){
  const capable=hyp.three.filter(n=>V1.publicVariants(dex,n).some(v=>v.mega));
  if(!capable.length)return [{mega:null,w:1}];
  const main=hyp.likelyMega;
  const others=[null,...capable.filter(n=>n!==main)];
  if(main==null)return [{mega:null,w:opt.megaWeight},...capable.map(n=>({mega:n,w:(1-opt.megaWeight)/capable.length}))];
  return [{mega:main,w:opt.megaWeight},...others.map(n=>({mega:n,w:(1-opt.megaWeight)/others.length}))];
}
function variantsFor(dex,name,megaHolder,opt){
  return publicVariants(dex,name,opt).filter(v=>megaHolder===name?v.mega:!v.mega);
}
function threatValue(dex,own,name,megaHolder,ctx,entry='mixed'){
  const key=own.species+'|'+name+'|'+(megaHolder===name)+'|'+entry;
  if(ctx.cache.has(key))return ctx.cache.get(key);
  const rows=variantsFor(dex,name,megaHolder,ctx.opt).map(v=>{
    const f=duel(dex,own,v,{entry:'free',field:ctx.field,opt:ctx.opt}).value;
    const s=duel(dex,own,v,{entry:'swap',field:ctx.field,opt:ctx.opt}).value;
    return {v:entry==='free'?f:0.6*f+0.4*s,w:v.weight};
  });
  const out=combine(rows);
  ctx.cache.set(key,out);
  return out;
}
// Lead value vs one rival lead: per public variant, the 2x2 maximin of
// (stay | switch to one bench member) x (rival attacks | rival sets up).
function leadValue(dex,team,three,lead,rivalLead,megaHolder,ctx){
  const key=['lead',three.join(''),lead,rivalLead,megaHolder===rivalLead].join('|');
  if(ctx.cache.has(key))return ctx.cache.get(key);
  const bench=three.filter(i=>i!==lead);
  const rows=variantsFor(dex,rivalLead,megaHolder,ctx.opt).map(v=>{
    const d=(i,entry,boost)=>duel(dex,team[i],v,{entry,field:ctx.field,opt:ctx.opt,boost}).value;
    const pool=movePool(dex,v.form);
    const canSetup=pool.setup>0&&v.item!=='choicescarf';
    const stay=d(lead,'lead',0); // already the min over the rival's plans
    const sw=Math.max(...bench.map(i=>Math.min(d(i,'swap',0),canSetup?d(i,'boosted',pool.setup):1)));
    // Switching spends our turn: a small tempo cost on top of the entry hit.
    const best=Math.max(stay,sw-0.05);
    return {v:best,w:v.weight,stay,sw};
  });
  const out={value:combine(rows),stay:combine(rows.map(r=>({v:r.stay,w:r.w}))),sw:combine(rows.map(r=>({v:r.sw,w:r.w})))};
  ctx.cache.set(key,out);
  return out;
}
function evaluateAgainst(dex,team,three,lead,hyp,ctx){
  const per=megaScenarios(dex,hyp,ctx.opt).map(sc=>{
    const mat=three.map(i=>hyp.three.map(n=>threatValue(dex,team[i],n,sc.mega,ctx)));
    let best=null;
    for(const p of PERMS){
      const vals=p.map((ownIdx,r)=>mat[ownIdx][r]);
      const s=0.5*Math.min(...vals)+0.5*vals.reduce((a,b)=>a+b,0)/3;
      if(!best||s>best.s)best={s,p,vals};
    }
    const backup=hyp.three.map((_,r)=>Math.max(...three.map((_,k)=>mat[k][r])));
    const li=three.indexOf(lead);
    // The rival's lead is predicted from public data only and the scores of
    // its three members are close, so the worst rival lead also counts.
    const lvs=hyp.leads.map(l=>{
      const r=hyp.three.indexOf(l.species);
      const x=leadValue(dex,team,three,lead,l.species,sc.mega,ctx);
      const reserved=best.p.indexOf(li);
      const cost=reserved>=0&&reserved!==r&&x.stay<0.5?0.15:0;
      return {p:l.p,v:x.value-cost};
    });
    const lv=(1-ctx.opt.leadWorstWeight)*lvs.reduce((s,x)=>s+x.p*x.v,0)+ctx.opt.leadWorstWeight*Math.min(...lvs.map(x=>x.v));
    return {w:sc.w,mega:sc.mega,assign:best,backup,leadValue:lv,
      score:0.5*best.s+0.15*backup.reduce((a,b)=>a+b,0)/3+0.35*lv};
  });
  const wsum=per.reduce((s,x)=>s+x.w,0);
  const score=0.5*Math.min(...per.map(x=>x.score))+0.5*per.reduce((s,x)=>s+x.score*x.w,0)/wsum;
  return {score,worst:per.reduce((a,b)=>a.score<=b.score?a:b),per};
}
function rankThreatAwareV2(dex,team,opponentSix,options={}){
  if(team.length!==6||!Array.isArray(opponentSix)||opponentSix.length!==6||opponentSix.some(s=>typeof s!=='string'))
    throw Error('Threat-aware preview requires own six sets and exactly six public rival species names');
  const opt={...DEFAULTS,...options};
  const hyps=rivalHypotheses(dex,team.map(p=>p.species),opponentSix,opt);
  const ctx={opt,field:publicField(dex,opponentSix),cache:new Map()};
  const anyForm=(i,n)=>Math.min(threatValue(dex,team[i],n,null,ctx),
    V1.publicVariants(dex,n).some(v=>v.mega)?threatValue(dex,team[i],n,n,ctx):1);
  const rows=TRIPLES.map(three=>{
    const six=opponentSix.map(n=>Math.max(...three.map(i=>anyForm(i,n))));
    const sixFloor=0.5*Math.min(...six)+0.5*six.reduce((a,b)=>a+b,0)/6;
    const megaCount=three.filter(i=>dex.items.get(team[i].item).megaStone).length;
    const leads=three.map(lead=>{
      const vs=hyps.map(h=>({h,r:evaluateAgainst(dex,team,three,lead,h,ctx)}));
      const mean=vs.reduce((s,x)=>s+x.h.weight*x.r.score,0);
      const worst=[...vs].sort((a,b)=>a.r.score-b.r.score).slice(0,opt.worstK);
      const worstMean=worst.reduce((s,x)=>s+x.r.score,0)/worst.length;
      const score=(1-opt.sixWeight)*((1-opt.worstWeight)*mean+opt.worstWeight*worstMean)
        +opt.sixWeight*sixFloor-(megaCount>1?0.05:0);
      return {i:lead,score,mean,worstMean,sixFloor,six,worst,vs};
    }).sort((a,b)=>b.score-a.score||a.i-b.i);
    return {three,score:leads[0].score,leads};
  }).sort((a,b)=>b.score-a.score||a.three.join('').localeCompare(b.three.join('')));
  return {hypotheses:hyps,ranked:rows,ctx};
}
function chooseThreatAwareV2(dex,team,opponentSix,options={}){
  const top=rankThreatAwareV2(dex,team,opponentSix,options).ranked[0];
  const lead=top.leads[0].i;
  return [lead,...top.three.filter(i=>i!==lead)].map(i=>i+1);
}
function explainThreatAwareV2(dex,team,opponentSix,{top=20,...options}={}){
  const {hypotheses,ranked,ctx}=rankThreatAwareV2(dex,team,opponentSix,options);
  const name=i=>team[i].species,fmt=x=>Number(x.toFixed(3));
  return {
    publicSix:[...opponentSix],
    hypotheses:hypotheses.slice(0,10).map(h=>({three:h.three,weight:fmt(h.weight),likelyMega:h.likelyMega,
      leads:h.leads.map(l=>l.species+':'+fmt(l.p)).join(' ')})),
    ranked:ranked.slice(0,top).map((c,rank)=>{
      const best=c.leads[0];
      const leadDetail=c.leads.map(l=>{
        const h=hypotheses[0],rl=h.leads[0].species;
        const x=leadValue(dex,team,c.three,l.i,rl,h.likelyMega,ctx);
        return name(l.i)+':'+fmt(l.score)+' vs '+rl+'(stay '+fmt(x.stay)+' switch '+fmt(x.sw)+')';
      }).join(' | ');
      return {rank:rank+1,selected:c.three.map(name),lead:name(best.i),score:fmt(c.score),
        mean:fmt(best.mean),worstMean:fmt(best.worstMean),sixFloor:fmt(best.sixFloor),
        publicSixAnswers:opponentSix.map((n,k)=>n+':'+fmt(best.six[k])).join(' '),
        leads:leadDetail,
        worstRivals:best.worst.map(x=>x.h.three.join('/')+'('+fmt(x.r.score)+')').join(' ; ')};
    })
  };
}
module.exports={DEFAULTS,publicVariants,movePool,variantAttack,duel,race,rivalHypotheses,leadValue,
  rankThreatAwareV2,chooseThreatAwareV2,explainThreatAwareV2};
