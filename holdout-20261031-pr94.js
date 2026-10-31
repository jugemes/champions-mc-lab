'use strict';
// PR #94 request (CLAUDE-TASK after ChatGPT review #5721596824 of PR #93).
// Declared and committed BEFORE any PR #94 FINAL battle and before the
// selector variant is frozen. Nothing here is tuned on a FINAL result.
//
//  1 two NEW public sixes (N3 Mawile, N4 Houndoom). Every species is absent
//    from every quoted name in *.js / test/*.js except the pr94 files on
//    2026-10-31 (test/pr94-holdout.test.js), none is in our six. Two legal
//    hypotheses each (66 P, each <=32, four legal moves, TeamValidator):
//      a = the ace Megas; b = nobody Megas (the ace holds a non-Mega item).
//    Constructed, NOT sampled from the ladder, no usage weight. Hidden sets
//    are used only to RUN battles, never as a selector / table input.
//    N4 has a Drought user (sun) and a Sap Sipper / Chlorophyll core so the
//    T2 weather key is exercised. From now on A/C/F2/F3/N1/N2 are DEV
//    (diagnosis), never holdouts.
//  2 TWO rival models for the evaluated 3 + lead (rival's view: its own sets
//    vs our PUBLIC six):
//      rational  pr92 rationalCellsPR92 (= pr88 rationalCells + view3), the
//                model PR #93's selector also uses
//      tm        INDEPENDENT of rankTrios / rationalCells / chooseThree:
//                type-matchup score of each rival member from its own moves
//                vs our six public species' types (offence: best STAB-weighted
//                effectiveness of its damaging moves; defence: our best STAB
//                effectiveness on it), top-3 by score. Leads: tmLead (top
//                score), speedLead (fastest base Spe of the three),
//                aceLead (ace + top-2 others, ace leads), aceBack (ace + top-2
//                others, best other leads), and two seeded random threes that
//                contain the ace with a random lead (seed TM_RANDOM_SEED).
//                A model that leaves the ace out of more than half its cells
//                is invalid (tested).
//  3 seeds: FINAL eval hashSeed(9500000+ui*100000+hi*20000+ci*1000+bi*50+s),
//    s=0..3, each seed ONE side (reverse = s%2===1): every (six, hyp, model,
//    cell, branch, s) job has its own seed (model offset +10000). The paired
//    same-seed-both-sides check is a SEPARATE statistic on s=0 only.
//    Selector seeds 9510000+ui*1000, T1/T2 9515000+ui*1000. DEV eval seeds
//    hashSeed(9520000+...), DEV selector 9530000+ui*1000.
//  4 policies (selectors see ONLY the six public species strings):
//    legacy, quick (pr82), v2 (#91 pr90), pr93 (pr92 cover FROZEN) and
//    pr93+T1T2 (pr92 table), pr94 (pr94 cover, FROZEN variant) and
//    pr94+T1T2 (pr94 table).
//  5 metrics per hypothesis x rival model: meanRat94 (games rational94 =
//    pr86 rational AND no rival T1/T2 attack into a PUBLIC immunity),
//    worstCellRat94, per-cell values, the old pr86 meanRat for comparison,
//    cell-cluster standard error, ace-brought share, T1/T2 executed use
//    (rule forced / abstain / unseen / unavailable / forced replacements).
//  6 freeze rule (DEV only, before FINAL): pr94 decision 'cvar' vs 'floor'
//    = the higher DEV mean of meanRat94 (rational model) over the DEV
//    hypotheses; tie -> 'floor'.
//  7 verdict (FINAL run ONCE): pr94 is NOT READY if on any FINAL hypothesis
//    x model (a) worstCellRat94 = 0, or (b) meanRat94 < max(legacy, v2,
//    pr93) - 0.10, or if (c) the pr94 T2 table forced 0 rules over all FINAL
//    evaluation battles, or (d) any selector / table input is non-public.
//    Also reported, not part of the rule: DEV N2/a and A/H1 vs v2.
//    A win where the rival did not bring its ace is not a counterplay win.
//  8 budget: selector <= 300 s and T1/T2 build <= 300 s per public six with
//    4 workers (offline pre-computation; over the selector budget it abstains
//    to legacy). Total PR #94 battle wall time <= 90 min on 4 CPUs.
const H92=require('./holdout-20261031-pr92');
const {hashSeed}=require('./lab');
const FINAL_SEED_BASE=9500000,SEARCH_SEED_BASE=9510000,DEV_SEED_BASE=9520000,DEV_SEARCH_BASE=9530000,TM_RANDOM_SEED=9540000;
const SEEDS=[0,1,2,3];
const sideOf=s=>s%2===1;
const evalSeed=(base,ui,hi,mi,ci,bi,s)=>hashSeed(base+ui*100000+hi*20000+mi*10000+ci*1000+bi*50+s);
// ---- rival model 'tm' (independent of rankTrios / rationalCells) ----
function tmScores(dex,team,ownSpecies){
  const own=ownSpecies.map(s=>dex.species.get(s));
  return team.map((p,i)=>{
    const sp=dex.species.get(p.species);
    const off=own.reduce((s,o)=>s+Math.max(0,...p.moves.map(m=>dex.moves.get(m)).filter(m=>m.category!=='Status'&&m.basePower)
      .map(m=>(dex.getImmunity(m.type,o.types)?2**dex.getEffectiveness(m.type,o.types):0)*(sp.types.includes(m.type)?1.5:1))),0);
    const def=own.reduce((s,o)=>s+Math.max(...o.types.map(t=>(dex.getImmunity(t,sp.types)?2**dex.getEffectiveness(t,sp.types):0)*1.5)),0);
    return {i,species:p.species,score:off-def,spe:sp.baseStats.spe};
  }).sort((a,b)=>b.score-a.score||b.spe-a.spe||a.species.localeCompare(b.species));
}
function lcg(seed){let x=seed>>>0;return ()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
function tmCells({dex,team,ownSpecies,ace,seed=TM_RANDOM_SEED}){
  const S=tmScores(dex,team,ownSpecies),out=[],seen=new Set();
  const add=(foe,src)=>{const k=foe.join('/');if(seen.has(k))return;seen.add(k);out.push({src,foe});};
  const top=S.slice(0,3).map(x=>x.species);
  add(top,'tmLead');
  add(top.slice().sort((a,b)=>dex.species.get(b).baseStats.spe-dex.species.get(a).baseStats.spe||a.localeCompare(b)),'speedLead');
  const others=S.filter(x=>x.species!==ace).slice(0,2).map(x=>x.species);
  add([ace,...others],'aceLead');add([others[0],ace,others[1]],'aceBack');
  const r=lcg(seed+team.map(p=>p.species).join('').length),rest=team.map(p=>p.species).filter(s=>s!==ace);
  for(let k=0;k<2;k++){const a=rest.slice();const pick=[];while(pick.length<2)pick.push(a.splice(Math.floor(r()*a.length),1)[0]);
    const three=[ace,...pick],l=Math.floor(r()*3);add([three[l],...three.filter((_,i)=>i!==l)],'random'+(k+1));}
  return {cells:out};
}
const S=(species,item,ability,nature,moves,evs)=>({species,item,ability,nature,moves,evs});
const PHYS={hp:2,atk:32,spe:32},SPEC={hp:2,spa:32,spe:32};
function unseenSixesPR94(){
  return {
    N3_mawile:{ace:'Mawile',hypotheses:{
      a:[S('Mawile','Mawilite','Intimidate','Adamant',['Play Rough','Iron Head','Sucker Punch','Swords Dance'],{hp:32,atk:32,def:2}),
        S('Arcanine','Sitrus Berry','Intimidate','Careful',['Flare Blitz','Extreme Speed','Will-O-Wisp','Morning Sun'],{hp:32,spd:32,atk:2}),
        S('Slowking','Leftovers','Regenerator','Calm',['Scald','Psychic','Slack Off','Thunder Wave'],{hp:32,spd:32,def:2}),
        S('Toxicroak','Focus Sash','Dry Skin','Jolly',['Gunk Shot','Drain Punch','Sucker Punch','Swords Dance'],PHYS),
        S('Staraptor','Choice Scarf','Reckless','Jolly',['Brave Bird','Close Combat','Double-Edge','U-turn'],PHYS),
        S('Polteageist','White Herb','Cursed Body','Timid',['Shell Smash','Shadow Ball','Giga Drain','Stored Power'],SPEC)],
      b:[S('Mawile','Life Orb','Intimidate','Adamant',['Play Rough','Iron Head','Sucker Punch','Fire Fang'],PHYS),
        S('Arcanine','Choice Scarf','Intimidate','Jolly',['Flare Blitz','Extreme Speed','Close Combat','Wild Charge'],PHYS),
        S('Slowking','Sitrus Berry','Regenerator','Modest',['Psychic','Scald','Fire Blast','Trick Room'],{hp:32,spa:32,spd:2}),
        S('Toxicroak','Lum Berry','Dry Skin','Careful',['Gunk Shot','Drain Punch','Taunt','Sucker Punch'],{hp:32,spd:32,atk:2}),
        S('Staraptor','Focus Sash','Reckless','Jolly',['Brave Bird','Close Combat','Quick Attack','Double-Edge'],PHYS),
        S('Polteageist','Leftovers','Cursed Body','Timid',['Shadow Ball','Giga Drain','Will-O-Wisp','Strength Sap'],{hp:32,spe:32,spa:2})]}},
    N4_houndoom:{ace:'Houndoom',hypotheses:{
      a:[S('Houndoom','Houndoominite','Flash Fire','Timid',['Fire Blast','Dark Pulse','Sludge Bomb','Nasty Plot'],SPEC),
        S('Torkoal','Leftovers','Drought','Bold',['Lava Plume','Stealth Rock','Solar Beam','Rapid Spin'],{hp:32,def:32,spa:2}),
        S('Venusaur','Life Orb','Chlorophyll','Modest',['Giga Drain','Sludge Bomb','Weather Ball','Growth'],SPEC),
        S('Goodra-Hisui','Sitrus Berry','Sap Sipper','Calm',['Draco Meteor','Flash Cannon','Fire Blast','Protect'],{hp:32,spd:32,spa:2}),
        S('Kleavor','Focus Sash','Sharpness','Jolly',['Stone Axe','X-Scissor','Close Combat','Swords Dance'],PHYS),
        S('Toxtricity','Choice Scarf','Punk Rock','Timid',['Overdrive','Boomburst','Sludge Bomb','Volt Switch'],SPEC)],
      b:[S('Houndoom','Focus Sash','Flash Fire','Timid',['Fire Blast','Dark Pulse','Sludge Bomb','Nasty Plot'],SPEC),
        S('Torkoal','Sitrus Berry','Drought','Quiet',['Lava Plume','Solar Beam','Stealth Rock','Body Press'],{hp:32,spa:32,def:2}),
        S('Venusaur','Leftovers','Chlorophyll','Modest',['Giga Drain','Sludge Bomb','Weather Ball','Sleep Powder'],SPEC),
        S('Goodra-Hisui','Life Orb','Sap Sipper','Modest',['Draco Meteor','Flash Cannon','Thunderbolt','Fire Blast'],{hp:32,spa:32,spd:2}),
        S('Kleavor','Choice Scarf','Sharpness','Jolly',['Stone Axe','X-Scissor','Close Combat','U-turn'],PHYS),
        S('Toxtricity','Wise Glasses','Punk Rock','Modest',['Overdrive','Boomburst','Sludge Bomb','Shift Gear'],{hp:32,spa:32,spe:2})]}},
  };
}
const rationalCells=H92.rationalCellsPR92;
module.exports={unseenSixesPR94,tmScores,tmCells,rationalCells,evalSeed,FINAL_SEED_BASE,SEARCH_SEED_BASE,DEV_SEED_BASE,DEV_SEARCH_BASE,TM_RANDOM_SEED,SEEDS,sideOf};
