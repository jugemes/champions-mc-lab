'use strict';
// Opt-in public-six preview AI: "legal-search". Research only, NOT a ladder
// win rate and NOT adopted for live play until reviewed.
//
// Inputs are OUR six full sets (known) and the rival's six PUBLIC species
// names. Rival sets are role hypotheses from legal-role-hypotheses.js; each
// rival scenario fixes one full legal set per species for the whole branch.
// Rival trio/lead candidates are chosen from the rival's own view (its
// hypothesised sets vs our public species names), never from an actual
// rival selection, set, item or log.
//
// Each (our trio, our lead) x (scenario, rival trio, rival lead) cell is
// played in the pinned Showdown engine for a SHORT horizon (default 3 turns)
// with several rival T1 branches (turn AI / strongest attack / setup /
// switch to its best answer); the rival is credited with its best branch.
// The heuristic turn AI then continues for the remaining turns of the
// horizon. Score = remaining HP fraction (ours - rival's, chosen threes).
const {Bot,normalize,hashSeed,matchup,chooseThree}=require('./lab');
const {legalRoleHypotheses,rivalScenario,coverageScenarios}=require('./legal-role-hypotheses');
const {canonical}=require('./tactics');
const FORMAT='gen9championsbssregmc';
const SETUP=new Set(['swordsdance','dragondance','nastyplot','calmmind','quiverdance','bulkup',
  'shellsmash','coil','tidyup','shiftgear','victorydance']);
const trios=n=>{const o=[];for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)for(let k=j+1;k<n;k++)o.push([i,j,k]);return o;};
const maxHit=(dex,set,foe)=>Math.max(0,...set.moves.map(m=>matchup(dex,set,foe,m)));
// Public-species-only threat estimate of a species we only know by name:
// 90 BP STAB of its best attacking stat (no hidden moves assumed).
function stabThreat(dex,attacker,defender){
  const a=dex.species.get(attacker),d=dex.species.get(defender);
  const stat=Math.max(a.baseStats.atk,a.baseStats.spa);
  return Math.max(...a.types.map(t=>{
    if(!dex.getImmunity(t,d.types))return 0;
    const def=a.baseStats.atk>=a.baseStats.spa?d.baseStats.def:d.baseStats.spd;
    return 90*1.5*2**dex.getEffectiveness(t,d.types)*stat/Math.max(40,def);
  }));
}
// Trio ranking from ONE side's view: its own full sets vs the other side's
// public species names. Same function for us and for the modelled rival.
function rankTrios(dex,sets,otherSpecies){
  return trios(sets.length).map(t=>{
    const off=otherSpecies.reduce((s,f)=>s+Math.max(...t.map(i=>maxHit(dex,sets[i],f))),0)/otherSpecies.length;
    const def=t.reduce((s,i)=>s+Math.max(...otherSpecies.map(f=>stabThreat(dex,f,sets[i].species))),0)/3;
    const megas=t.filter(i=>dex.items.get(sets[i].item).megaStone).length;
    const lead=[...t].sort((a,b)=>otherSpecies.reduce((s,f)=>s+maxHit(dex,sets[b],f)-maxHit(dex,sets[a],f),0)||a-b);
    return {idx:t,lead,score:off-0.5*def-(megas>1?25:0)};
  }).sort((a,b)=>b.score-a.score||a.idx.join().localeCompare(b.idx.join()));
}
// Rational rival candidates: its top trios plus, for every species, the best
// trio that contains it (so an ace such as Mega Charizard Y is never dropped
// just because the summed score prefers another three).
// truncate=true is the PR #65 behaviour: out.slice(0,k+2) could cut the
// per-species "best trio containing X" entries, i.e. drop an ace (P0-2).
function rivalCandidates(dex,scenario,ownSpecies,k=4,leads='best',{truncate=true}={}){
  const ranked=rankTrios(dex,scenario,ownSpecies),out=[],seen=new Set();
  const add=r=>{const key=[...r.idx].sort().join();if(seen.has(key))return;seen.add(key);out.push(r);};
  // The existing rival preview AI's own pick (lead first), then its top two.
  const legacy=chooseThree(dex,scenario,ownSpecies).map(n=>n-1);
  add({idx:legacy,lead:legacy,score:NaN});
  ranked.slice(0,2).forEach(add);
  for(let i=0;i<scenario.length;i++){const r=ranked.find(x=>x.idx.includes(i));if(r)add(r);}
  const top=(truncate?out.slice(0,k+2):out).map(r=>({three:r.lead.map(i=>scenario[i].species),score:r.score}));
  if(leads!=='all')return top;
  // v2 (2026-10-30 audit): every member of every candidate three may lead.
  // v1 ('best') gave each three ONE lead, so e.g. the C_charizardX search
  // never saw the Baxcalibur lead the rival preview actually used.
  const seen2=new Set(),all=[];
  for(const t of top)for(const l of t.three){const three=[l,...t.three.filter(x=>x!==l)];
    if(seen2.has(three.join()))continue;seen2.add(three.join());all.push({three,score:t.score});}
  return all;
}
class BranchBot extends Bot{
  constructor(stream,dex,team,side,trace,forced,branch){super(stream,dex,team,side,trace,forced,null,{});this.branch=branch;}
  decide(req){
    if(!req.teamPreview&&!req.forceSwitch&&this.branch&&this.turn===1&&!this.errors){
      const c=this.branch(this,req);if(c)return c;
    }
    return super.decide(req);
  }
}
const BRANCHES={
  ai:null,
  attack:(bot,req)=>{
    const a=req.active?.[0],cur=req.side.pokemon.find(p=>p.active);if(!a||!cur)return null;
    const set=bot.getSet(cur);let best=null,v=-1;
    a.moves.forEach((m,i)=>{if(m.disabled)return;const x=matchup(bot.dex,set,bot.foeActive,m.id||m.move);if(x>v){v=x;best=i;}});
    return best==null?null:'move '+(best+1)+(a.canMegaEvo?' mega':'');
  },
  setup:(bot,req)=>{
    const a=req.active?.[0];if(!a)return null;
    const i=a.moves.findIndex(m=>!m.disabled&&SETUP.has(canonical(m.id||m.move)));
    return i<0?null:'move '+(i+1)+(a.canMegaEvo?' mega':'');
  },
  switch:(bot,req)=>{
    if(req.active?.[0]?.trapped)return null;
    const bench=req.side.pokemon.map((p,i)=>({p,i})).filter(x=>!x.p.active&&!x.p.condition.endsWith(' fnt'));
    if(!bench.length)return null;
    const val=p=>maxHit(bot.dex,bot.getSet(p),bot.foeActive)-stabThreat(bot.dex,bot.foeActive,bot.getSet(p).species);
    bench.sort((x,y)=>val(y.p)-val(x.p));return 'switch '+(bench[0].i+1);
  },
};
// reverse=true seats our side as p2 (side-reversal check, P0-4).
async function shortBattle(sim,{own,ownThree,foe,foeThree,seed,horizon=3,branch='ai',reverse=false}){
  const bs=new sim.BattleStream({noCatch:true});
  const streams=sim.getPlayerStreams(bs);
  const dex=sim.Dex.mod('champions');
  const trace={choices:[],selections:[],errors:[]};
  const [os,fs]=reverse?['p2','p1']:['p1','p2'];
  const b1=new BranchBot(streams[os],dex,own,os,trace,ownThree,null);
  const b2=new BranchBot(streams[fs],dex,foe,fs,trace,foeThree,BRANCHES[branch]);
  const [oi,fi]=reverse?[1,0]:[0,1];
  let value=null,turns=0,ended=false;const lines=[];
  const snapshot=()=>{
    const side=s=>bs.battle.sides[s].pokemon.reduce((n,p)=>n+p.hp/p.maxhp,0);
    const boost=s=>{const a=bs.battle.sides[s].active[0];if(!a||a.fainted)return 0;
      return 0.08*['atk','spa','spe'].reduce((n,k)=>n+Math.max(0,a.boosts[k]),0);};
    return side(oi)+boost(oi)-side(fi)-boost(fi);
  };
  const watch=(async()=>{for await(const msg of streams.omniscient){
    for(const line of msg.split('\n')){
      if(line.startsWith('|turn|')){turns=Number(line.slice(6));
        if(turns>horizon&&!ended){ended=true;value=snapshot();void streams.omniscient.write('>forcetie');}}
      if(/^\|(win\||tie$)/.test(line)&&value==null){value=snapshot();ended=true;}
      if(!ended&&/^\|(move|switch|faint|-mega|detailschange)\|/.test(line))lines.push(line.replace(/\|\[from\].*$/,''));
    }
  }})();
  const r1=b1.run(),r2=b2.run();
  await streams.omniscient.write('>start '+JSON.stringify({formatid:FORMAT,seed})+
    '\n>player p1 '+JSON.stringify({name:reverse?'rival':'own',team:normalize(reverse?foe:own)})+
    '\n>player p2 '+JSON.stringify({name:reverse?'own':'rival',team:normalize(reverse?own:foe)}));
  await Promise.all([watch,r1,r2]);
  return {value,turns:Math.min(turns,horizon),errors:trace.errors.length,lines};
}
function toLabTeam(sets){return sets.map(s=>({species:s.species,item:s.item,ability:s.ability,nature:s.nature,evs:s.evs,moves:s.moves}));}
async function chooseLegalSearch(sim,ownTeam,foeSpecies,opts={}){
  if(opts.version==='v2')return chooseLegalSearchV2(sim,ownTeam,foeSpecies,opts);
  if(!Array.isArray(foeSpecies)||foeSpecies.length!==6||foeSpecies.some(s=>typeof s!=='string'))
    throw Error('legal-search takes the rival PUBLIC six as species names only');
  const dex=sim.Dex.mod('champions');
  const {scenarios:S=3,ownTrios:M=6,rivalTrios:K=4,horizon=3,seedBase=7300000,
    branches=['ai','attack','setup','switch'],include=[],rivalLeads='all'}=opts;
  const hyps=foeSpecies.map(s=>legalRoleHypotheses(sim,s));
  const scenarios=[];
  for(let k=0;k<S;k++)scenarios.push(toLabTeam(rivalScenario(hyps,k)));
  const ownSpecies=ownTeam.map(p=>p.species);
  const cells=[];
  scenarios.forEach((sc,si)=>{for(const r of rivalCandidates(dex,sc,ownSpecies,K,rivalLeads))cells.push({si,three:r.three});});
  const ranked=rankTrios(dex,ownTeam,foeSpecies);
  const pool=ranked.slice(0,M).map(r=>r.idx);
  for(const names of include){const idx=names.map(n=>ownTeam.findIndex(p=>p.species===n)).sort((a,b)=>a-b);
    if(!pool.some(t=>t.join()===idx.join()))pool.push(idx);}
  const options=[];
  for(const t of pool)for(const lead of t)options.push([lead,...t.filter(i=>i!==lead)].map(i=>ownTeam[i].species));
  const table=[];
  for(const three of options){
    const per=[];
    for(const [ci,c] of cells.entries()){
      let worst=Infinity,worstBranch='';
      for(const branch of branches){
        const seed=hashSeed(seedBase+ci*10+branches.indexOf(branch));
        const r=await shortBattle(sim,{own:structuredClone(ownTeam),ownThree:three,foe:structuredClone(scenarios[c.si]),
          foeThree:c.three,seed,horizon,branch});
        if(r.errors)throw Error('choice errors in short battle '+JSON.stringify({three,c,branch}));
        if(r.value<worst){worst=r.value;worstBranch=branch;}
      }
      per.push({cell:ci,scenario:c.si,rival:c.three,value:worst,worstBranch});
    }
    const min=Math.min(...per.map(x=>x.value)),mean=per.reduce((s,x)=>s+x.value,0)/per.length;
    table.push({three,lead:three[0],score:0.5*min+0.5*mean,min,mean,worstCell:per.find(x=>x.value===min),per});
  }
  table.sort((a,b)=>b.score-a.score||a.three.join().localeCompare(b.three.join()));
  return {chosen:table[0].three,lead:table[0].lead,table,cells,
    scenarios:scenarios.map(sc=>sc.map(p=>p.species+'@'+p.item+':'+p.moves.join('/')))};
}
// v2 (PR #65 review 5711453967 / PR #66 request). Differences from v1:
// P0-1 conditional hypotheses (Solar Beam in sun, Expanding Force with Psychic
//      Surge, Last Respects, First Impression) via legalRoleHypotheses v2;
// P0-2 all 20 trios x 3 leads (no ownTrios cut) and rival candidates without
//      the slice that could drop the best trio containing a given species;
// P0-3 coverageScenarios: every (species, threat tag) of the public six's
//      hypotheses appears in some scenario, else result.unverified;
// P0-4 one seed per (cell, rep) shared by all rival T1 branches, so branches
//      differ only by the rival's action; reps alternate side (p1/p2) and use
//      independent seeds. Cell value = mean over reps of the worst branch.
// The final score keeps v1's 0.5*worst + 0.5*mean (an arbitrary weight), and
// also reports the rank under pure mean / pure worst so the weight is visible.
function seedFor(seedBase,ci,rep){return hashSeed(seedBase+ci*10+rep);}
async function chooseLegalSearchV2(sim,ownTeam,foeSpecies,opts={}){
  if(!Array.isArray(foeSpecies)||foeSpecies.length!==6||foeSpecies.some(s=>typeof s!=='string'))
    throw Error('legal-search takes the rival PUBLIC six as species names only');
  const dex=sim.Dex.mod('champions');
  const {maxScenarios=8,rivalTrios:K=2,horizon=3,seedBase=7300000,
    branches=['ai','attack','setup','switch'],reps=[{rep:0,reverse:false},{rep:1,reverse:true}]}=opts;
  const hyps=foeSpecies.map(s=>legalRoleHypotheses(sim,s,{version:'v2'}));
  const cov=coverageScenarios(hyps,{max:maxScenarios});
  const scenarios=cov.scenarios.map(toLabTeam);
  const ownSpecies=ownTeam.map(p=>p.species);
  const cells=[],rivalMissing=[];
  scenarios.forEach((sc,si)=>{
    const cand=rivalCandidates(dex,sc,ownSpecies,K,'all',{truncate:false});
    for(const sp of foeSpecies){
      if(!cand.some(r=>r.three.includes(sp)))rivalMissing.push(si+':'+sp+' in any three');
      if(!cand.some(r=>r.three[0]===sp))rivalMissing.push(si+':'+sp+' as lead');
    }
    for(const r of cand)cells.push({si,three:r.three});
  });
  const options=[];
  for(const t of trios(ownTeam.length))for(const lead of t)options.push([lead,...t.filter(i=>i!==lead)].map(i=>ownTeam[i].species));
  const table=[];
  for(const three of options){
    const per=[];
    for(const [ci,c] of cells.entries()){
      const byRep=[];
      for(const {rep,reverse} of reps){
        const seed=seedFor(seedBase,ci,rep),vals={};
        for(const branch of branches){
          const r=await shortBattle(sim,{own:structuredClone(ownTeam),ownThree:three,foe:structuredClone(scenarios[c.si]),
            foeThree:c.three,seed,horizon,branch,reverse});
          if(r.errors)throw Error('choice errors in short battle '+JSON.stringify({three,c,branch}));
          vals[branch]=r.value;
        }
        const worstBranch=branches.reduce((a,b)=>vals[b]<vals[a]?b:a);
        byRep.push({rep,reverse,seed:seed.join('-'),vals,worstBranch,worst:vals[worstBranch]});
      }
      const value=byRep.reduce((s,x)=>s+x.worst,0)/byRep.length;
      per.push({cell:ci,scenario:c.si,rival:c.three,value,byRep});
    }
    const min=Math.min(...per.map(x=>x.value)),mean=per.reduce((s,x)=>s+x.value,0)/per.length;
    table.push({three,lead:three[0],score:0.5*min+0.5*mean,min,mean,worstCell:per.find(x=>x.value===min),per});
  }
  const rankBy=k=>[...table].sort((a,b)=>b[k]-a[k]||a.three.join().localeCompare(b.three.join())).map(x=>x.three.join('/'));
  const byMean=rankBy('mean'),byMin=rankBy('min');
  table.sort((a,b)=>b.score-a.score||a.three.join().localeCompare(b.three.join()));
  for(const x of table){x.rankMean=byMean.indexOf(x.three.join('/'))+1;x.rankMin=byMin.indexOf(x.three.join('/'))+1;}
  const unverified=[...cov.coverage.missing.map(m=>'scenario coverage '+m),...rivalMissing];
  return {version:'v2',chosen:table[0].three,lead:table[0].lead,table,cells,
    unverified:unverified.length?unverified:null,
    evidence:{ownOptions:options.length,ownTrios:new Set(options.map(o=>[...o].sort().join())).size,
      cells:cells.length,scenarios:scenarios.length,coverage:cov.coverage,reps,branches,
      shortBattles:options.length*cells.length*reps.length*branches.length},
    scenarios:scenarios.map(sc=>sc.map(p=>p.species+'@'+p.item+':'+p.moves.join('/')))};
}
module.exports={chooseLegalSearch,chooseLegalSearchV2,seedFor,trios,shortBattle,rankTrios,rivalCandidates,stabThreat,BRANCHES,toLabTeam};
