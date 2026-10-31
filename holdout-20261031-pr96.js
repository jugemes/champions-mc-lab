'use strict';
// PR #96 request (CLAUDE-TASK after ChatGPT review #5721799952 of PR #95).
// Declared and committed BEFORE any PR #96 FINAL battle and before anything
// is tuned. Nothing here is tuned on a FINAL result.
//
//  1 two NEW public sixes (N5 Kangaskhan, N6 Altaria). On 2026-10-31 every
//    species is absent from every quoted name in *.js / test/*.js except the
//    pr96 files; none is in our six. N3/N4/F1-F3/N1/N2/A/B/C/Indeedee/E/HX/
//    U1-U3 are DEV. Two legal hypotheses each (66 P, each <= 32, four legal
//    moves, TeamValidator gen9championsbssregmc):
//      a = the ace Megas; b = another member Megas, the ace holds a non-Mega
//      item and different moves.
//    Constructed, NOT sampled from the ladder, no usage weight (hypotheses).
//    Chosen to be HARD and to stress known gaps, not to be easy:
//      N5 Mega Kangaskhan = Parental Bond (missing from pr94 withMegaAbility),
//         Scrappy Fake Out, Fighting / Ground / Ice / Fairy / Fire-Ghost
//         coverage into our Tyranitar / Garchomp / Hydreigon / Metagross,
//         Queenly Majesty blocks our Aqua Jet / Bullet Punch, Golurk sets
//         Stealth Rock (T2 hazard key), Mega Golurk in b.
//      N6 Mega Altaria = Pixilate Dragon Dance into Hydreigon / Garchomp /
//         Tyranitar, Samurott-Hisui Ceaseless Edge / Chesnaught Spikes (T2
//         hazard key), Intimidate, Mega Delphox in b.
//    Hidden sets are used only to RUN battles, never as a selector / table
//    input (selectors get the six species strings; tested).
//  2 TWO rival models for the evaluated 3 + lead (both from the rival's view:
//    its own sets vs our PUBLIC six), reused unchanged:
//      rational  pr92 rationalCellsPR92 (ace given)
//      tm        holdout-20261031-pr94 tmCells (type matchup, ace lead / ace
//                back / random threes with the ace)
//    The verdict is computed on ACE cells (cells whose three contains the
//    ace): a win where the rival did not bring its ace is reported apart and
//    never counts as a counterplay win. A model with < 2 ace cells on a
//    hypothesis makes that hypothesis x model 'insufficient' (reported, not
//    a pass).
//  3 rival behaviour: pr96 immune-aware rival (pr96-paired immuneAware) for
//    the PRIMARY metric; the pr95 naive rival only as a secondary column.
//    Branches ai/attack/setup/switch/utilityRational (pr82 BRANCHES minus the
//    forced-irrational 'utility' branch, dropped for every policy alike).
//  4 seeds: FINAL eval hashSeed(9600000+ui*100000+hi*20000+mi*10000+ci*1000
//    +bi*50+s), s=0..3, one side each (reverse = s%2===1). Same-seed opposite
//    side only on s=0 as a separate agreement statistic, never in n.
//    Selector seed bases 9610000+ui*1000 (A) and 9660000+ui*1000 (B, seed-
//    stability only), T1/T2 9615000+ui*1000. DEV eval 9620000, DEV selector
//    9630000 (A) / 9680000 (B).
//  5 policies (selectors see ONLY the six public species strings): legacy,
//    quick, v2, pr93 (+T1T2), pr95 (= pr94 cover, decision 'floor' as frozen
//    in PR #95) (+ pr94-key T1T2), pr96 (= pr94 cover pipeline with the
//    immune-aware rival and paired all-game cell values, decision 'floor':
//    NO new variant choice) (+ keyOf96 T1/T2).
//  6 metric: meanAce = paired mean win over ALL games of ace cells (primary),
//    worstAceCell, meanAll (all cells), per cell, masked re-decisions,
//    residual public-immune hits, aceBrought share, T1/T2 executed use.
//  7 verdict (FINAL run ONCE, after DEV): pr96 is NOT READY if on any FINAL
//    hypothesis x model (a) worstAceCell = 0, or (b) meanAce < max(legacy,
//    v2, pr95) - 0.05, or (c) DEV A/H1 or N2/a meanAce(pr96) < v2 - 0.10, or
//    (d) any selector / table input is non-public. Stop (abstain, NOT READY)
//    if every policy is >= .90 meanAce on every FINAL hypothesis x model
//    (no discrimination: report 'too easy', no pass). T1/T2 is reported as
//    'not a human recommendation' if FINAL forced rules = 0.
//  8 budget: selector <= 300 s and T1/T2 build <= 300 s per public six, 4
//    workers. Total battle wall time <= 60 min on 4 CPUs.
const {hashSeed}=require('./lab');
const H94=require('./holdout-20261031-pr94');
const H92=require('./holdout-20261031-pr92');
const FINAL_SEED_BASE=9600000,SEARCH_SEED_BASE=9610000,SEARCH_SEED_BASE_B=9660000,T1T2_SEED_BASE=9615000,DEV_SEED_BASE=9620000,DEV_SEARCH_BASE=9630000,DEV_SEARCH_BASE_B=9680000;
const SEEDS=[0,1,2,3];
const BRANCHES=['ai','attack','setup','switch','utilityRational'];
const sideOf=s=>s%2===1;
const evalSeed=(base,ui,hi,mi,ci,bi,s)=>hashSeed(base+ui*100000+hi*20000+mi*10000+ci*1000+bi*50+s);
const S=(species,item,ability,nature,moves,evs)=>({species,item,ability,nature,moves,evs});
const PHYS={hp:2,atk:32,spe:32},SPEC={hp:2,spa:32,spe:32};
function unseenSixesPR96(){
  return {
    N5_kangaskhan:{ace:'Kangaskhan',hypotheses:{
      a:[S('Kangaskhan','Kangaskhanite','Scrappy','Jolly',['Fake Out','Double-Edge','Low Kick','Sucker Punch'],PHYS),
        S('Quaquaval','Life Orb','Moxie','Jolly',['Aqua Step','Close Combat','Brave Bird','Ice Spinner'],PHYS),
        S('Ninetales-Alola','Light Clay','Snow Warning','Timid',['Aurora Veil','Moonblast','Blizzard','Freeze-Dry'],SPEC),
        S('Typhlosion-Hisui','Choice Scarf','Frisk','Timid',['Eruption','Shadow Ball','Focus Blast','Fire Blast'],SPEC),
        S('Golurk','Leftovers','No Guard','Adamant',['Earthquake','Poltergeist','Dynamic Punch','Stealth Rock'],{hp:32,atk:32,def:2}),
        S('Tsareena','Focus Sash','Queenly Majesty','Jolly',['Power Whip','High Jump Kick','Triple Axel','U-turn'],PHYS)],
      b:[S('Kangaskhan','Silk Scarf','Scrappy','Adamant',['Fake Out','Double-Edge','Drain Punch','Sucker Punch'],{hp:32,atk:32,spe:2}),
        S('Quaquaval','Sitrus Berry','Moxie','Adamant',['Aqua Step','Close Combat','Roost','Bulk Up'],{hp:32,atk:32,spe:2}),
        S('Ninetales-Alola','Focus Sash','Snow Warning','Timid',['Blizzard','Moonblast','Encore','Aurora Veil'],SPEC),
        S('Typhlosion-Hisui','Wise Glasses','Frisk','Modest',['Eruption','Shadow Ball','Focus Blast','Overheat'],{hp:32,spa:32,spe:2}),
        S('Golurk','Golurkite','No Guard','Jolly',['Earthquake','Poltergeist','Dynamic Punch','Ice Punch'],PHYS),
        S('Tsareena','Choice Scarf','Queenly Majesty','Jolly',['Power Whip','High Jump Kick','Knock Off','U-turn'],PHYS)]}},
    N6_altaria:{ace:'Altaria',hypotheses:{
      a:[S('Altaria','Altarianite','Natural Cure','Adamant',['Dragon Dance','Double-Edge','Earthquake','Roost'],PHYS),
        S('Samurott-Hisui','Focus Sash','Sharpness','Jolly',['Ceaseless Edge','Razor Shell','Sucker Punch','Swords Dance'],PHYS),
        S('Chesnaught','Leftovers','Bulletproof','Impish',['Spikes','Body Press','Spiky Shield','Drain Punch'],{hp:32,def:32,atk:2}),
        S('Delphox','Life Orb','Blaze','Timid',['Fire Blast','Psyshock','Dazzling Gleam','Nasty Plot'],SPEC),
        S('Overqwil','Sitrus Berry','Intimidate','Adamant',['Crunch','Gunk Shot','Liquidation','Swords Dance'],{hp:32,atk:32,spe:2}),
        S('Espathra','Colbur Berry','Speed Boost','Bold',['Lumina Crash','Dazzling Gleam','Calm Mind','Protect'],{hp:32,def:32,spa:2})],
      b:[S('Altaria','Leftovers','Natural Cure','Bold',['Draco Meteor','Flamethrower','Roost','Will-O-Wisp'],{hp:32,def:32,spa:2}),
        S('Samurott-Hisui','Choice Scarf','Sharpness','Jolly',['Ceaseless Edge','Razor Shell','Sacred Sword','Aqua Jet'],PHYS),
        S('Chesnaught','Rocky Helmet','Bulletproof','Impish',['Spikes','Body Press','Leech Seed','Spiky Shield'],{hp:32,def:32,spd:2}),
        S('Delphox','Delphoxite','Blaze','Timid',['Fire Blast','Psyshock','Dazzling Gleam','Nasty Plot'],SPEC),
        S('Overqwil','Focus Sash','Intimidate','Jolly',['Crunch','Gunk Shot','Liquidation','Swords Dance'],PHYS),
        S('Espathra','Wise Glasses','Speed Boost','Timid',['Lumina Crash','Dazzling Gleam','Shadow Ball','Stored Power'],SPEC)]}},
  };
}
module.exports={unseenSixesPR96,tmCells:H94.tmCells,rationalCells:H92.rationalCellsPR92,evalSeed,FINAL_SEED_BASE,SEARCH_SEED_BASE,SEARCH_SEED_BASE_B,T1T2_SEED_BASE,DEV_SEED_BASE,DEV_SEARCH_BASE,DEV_SEARCH_BASE_B,SEEDS,BRANCHES,sideOf};
