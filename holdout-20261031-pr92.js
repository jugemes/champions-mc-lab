'use strict';
// PR #92 request (CLAUDE-TASK after ChatGPT review #5721340698 of PR #91).
// Declared and committed BEFORE pr92-rational-cover-preview.js exists and
// before any PR #92 battle. Nothing here is tuned on a result.
//
//  1 two NEW public sixes (N1, N2). Every species is absent from every quoted
//    name in *.js / test/*.js on 2026-10-31 (checked by test/pr92.test.js
//    against the tree WITHOUT the pr92 files), none is in our six. Two legal
//    hypotheses each (66 P, each <=32, four legal moves, TeamValidator):
//      a = the ace Megas and sets up; b = the ace holds a non-Mega item.
//    Constructed, NOT sampled from the ladder, no usage weight. Hidden sets
//    are used only to RUN battles, never as a selector input.
//    Known sixes A/H0, A/H2 (DEV) and F2/a (PR #88 FINAL) are DIAGNOSIS /
//    development only from now on. F1/F2/F3 and every older holdout are NOT
//    new unseen holdouts.
//  2 rival 3+lead cells (rival's view: its own sets vs our PUBLIC six):
//      legacy / view1 / view2 / aceLead / aceBack  = holdout-20261031-pr88
//                                                     rationalCells (unchanged)
//      view3   the best rivalCandidates three whose member SET differs from
//              every cell above (absent when none is left)
//    Rival T1/T2: pr82-eval BRANCHES (ai/attack/setup/switch/utility/...),
//    the rival's Encore-lock rational switch as in pr86-eval.
//  3 seeds: FINAL eval hashSeed(9400000+ui*100+s), s=0..3. Each seed is played
//    on ONE side only (reverse = s%2===1): PR #91 found same-seed left/right
//    almost always duplicate, so n is counted in independent seeds.
//    Selector-internal search seeds: 9410000+ui*1000. DEV (A, F2) diagnosis
//    eval seeds: hashSeed(9420000+..), the same rule.
//  4 compared policies (all see ONLY the six public species strings):
//      legacy (lab chooseThree), quick (pr82 livePreview), guarded (#89
//      pr88-guarded-preview), v2 (#91 pr90-guarded-preview-v2), proposed.
//  5 metrics per hypothesis: meanRat (rational-outcome games, pr86-eval
//    rational()), worstCellRat, per-cell loss lines; per policy the mean over
//    hypotheses and the number of hypotheses with worstCellRat = 0.
//  6 stop / verdict rules (fixed now): FINAL is run ONCE. The proposed policy
//    is called NOT READY if on any FINAL hypothesis (a) its worstCellRat is 0,
//    or (b) its meanRat is below max(legacy, v2) - 0.15, or if any selector
//    input contains non-public data, or T1/T2 output reads hidden fields.
//    A win where the rival did not bring its ace is not a counterplay win.
//  7 budget: selector + guard <= 300 s wall per public six with 4 workers
//    (offline pre-computation); over that the selector abstains to legacy.
//    The in-game preview timer is NOT known; a live claim is not made.
//    Total PR #92 battle wall time <= 60 min on the 4-CPU session.
const H88=require('./holdout-20261031-pr88');
const FINAL_SEED_BASE=9400000,SEARCH_SEED_BASE=9410000,DEV_SEED_BASE=9420000;
const SEEDS=[0,1,2,3];
const sideOf=s=>s%2===1;
function rationalCellsPR92({dex,team,ownSpecies,ace,chooseThree,rivalCandidates}){
  const rc=H88.rationalCells({dex,team,ownSpecies,ace,chooseThree,rivalCandidates});
  const key=p=>p.slice().sort().join('/'),seen=new Set(rc.cells.map(c=>key(c.foe)));
  const extra=rivalCandidates(dex,team,ownSpecies,6,'best',{truncate:false}).find(r=>!seen.has(key(r.three)));
  if(extra)rc.cells.push({src:'view3',foe:extra.three});
  return rc;
}
const S=(species,item,ability,nature,moves,evs)=>({species,item,ability,nature,moves,evs});
const PHYS={hp:2,atk:32,spe:32},SPEC={hp:2,spa:32,spe:32};
function unseenSixesPR92(){
  return {
    N1_blaziken:{ace:'Blaziken',hypotheses:{
      a:[S('Blaziken','Blazikenite','Speed Boost','Adamant',['Flare Blitz','Close Combat','Knock Off','Swords Dance'],PHYS),
        S('Rhyperior','Rindo Berry','Solid Rock','Adamant',['High Horsepower','Rock Slide','Megahorn','Protect'],{hp:32,atk:32,def:2}),
        S('Slowking-Galar','Sitrus Berry','Regenerator','Sassy',['Sludge Bomb','Psychic','Slack Off','Trick Room'],{hp:32,spd:32,def:2}),
        S('Froslass','Focus Sash','Cursed Body','Timid',['Ice Beam','Poltergeist','Spikes','Destiny Bond'],SPEC),
        S('Pawmot','Choice Scarf','Iron Fist','Jolly',['Double Shock','Close Combat','Ice Punch','Mach Punch'],PHYS),
        S('Inteleon','Life Orb','Sniper','Timid',['Hydro Pump','Ice Beam','Dark Pulse','U-turn'],SPEC)],
      b:[S('Blaziken','Life Orb','Speed Boost','Adamant',['Flare Blitz','Close Combat','Thunder Punch','Protect'],PHYS),
        S('Rhyperior','Leftovers','Solid Rock','Impish',['High Horsepower','Rock Slide','Stealth Rock','Protect'],{hp:32,def:32,atk:2}),
        S('Slowking-Galar','Wise Glasses','Regenerator','Modest',['Sludge Bomb','Psychic','Flamethrower','Trick Room'],{hp:32,spa:32,spd:2}),
        S('Froslass','Focus Sash','Cursed Body','Timid',['Ice Beam','Poltergeist','Will-O-Wisp','Destiny Bond'],SPEC),
        S('Pawmot','Sitrus Berry','Volt Absorb','Jolly',['Double Shock','Close Combat','Revival Blessing','Nuzzle'],PHYS),
        S('Inteleon','Choice Scarf','Sniper','Timid',['Hydro Pump','Ice Beam','Dark Pulse','U-turn'],SPEC)]}},
    N2_heracross:{ace:'Heracross',hypotheses:{
      a:[S('Heracross','Heracronite','Moxie','Adamant',['Close Combat','Pin Missile','Rock Blast','Swords Dance'],PHYS),
        S('Empoleon','Leftovers','Competitive','Calm',['Surf','Flash Cannon','Roost','Stealth Rock'],{hp:32,spd:32,def:2}),
        S('Reuniclus','Life Orb','Magic Guard','Modest',['Psychic','Focus Blast','Shadow Ball','Calm Mind'],{hp:32,spa:32,spe:2}),
        S('Lycanroc-Dusk','Focus Sash','Tough Claws','Jolly',['Accelerock','Stone Edge','Close Combat','Psychic Fangs'],PHYS),
        S('Rotom-Mow','Choice Scarf','Levitate','Timid',['Leaf Storm','Thunderbolt','Volt Switch','Shadow Ball'],SPEC),
        S('Mabosstiff','Sitrus Berry','Intimidate','Adamant',['Crunch','Psychic Fangs','Play Rough','Wild Charge'],{hp:32,atk:32,def:2})],
      b:[S('Heracross','Choice Scarf','Guts','Jolly',['Close Combat','Megahorn','Stone Edge','Knock Off'],PHYS),
        S('Empoleon','Sitrus Berry','Competitive','Modest',['Hydro Pump','Flash Cannon','Ice Beam','Grass Knot'],{hp:32,spa:32,spd:2}),
        S('Reuniclus','Leftovers','Magic Guard','Quiet',['Psychic','Focus Blast','Shadow Ball','Trick Room'],{hp:32,spa:32,def:2}),
        S('Lycanroc-Dusk','Life Orb','Tough Claws','Jolly',['Accelerock','Stone Edge','Close Combat','Swords Dance'],PHYS),
        S('Rotom-Mow','Focus Sash','Levitate','Timid',['Leaf Storm','Thunderbolt','Will-O-Wisp','Volt Switch'],SPEC),
        S('Mabosstiff','Rocky Helmet','Intimidate','Impish',['Crunch','Psychic Fangs','Play Rough','Protect'],{hp:32,def:32,atk:2})]}},
  };
}
module.exports={unseenSixesPR92,rationalCellsPR92,FINAL_SEED_BASE,SEARCH_SEED_BASE,DEV_SEED_BASE,SEEDS,sideOf};
