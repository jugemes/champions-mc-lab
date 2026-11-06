'use strict';
// PR #88 request (ChatGPT review #5720659334 of PR #87). Declared and committed
// BEFORE the P0-1 fix re-run, before pr88-guarded-preview.js exists and before
// any PR #88 battle. Nothing here is tuned on a result.
//  1 FINAL2 seeds for the P0-1 re-selected (DEV-disjoint) FINAL cells:
//    hashSeed(8680000+ci*100+{0,1}), both sides. The old PR #86 FINAL
//    (8660000+) is kept as is and is NOT reused for tuning.
//  2 three NEW public sixes for the one-shot selection FINAL. Every species is
//    absent from every quoted name in *.js / test/*.js on 2026-10-31 (checked by
//    test/pr88.test.js against the tree WITHOUT this file), none is in our six.
//    Two legal hypotheses each: a = the ace Megas; b = the ace holds a non-Mega
//    item and nobody Megas (no partner has a Champions Mega Stone). Constructed, NOT sampled from the ladder,
//    no usage weight. Hidden sets are used only to RUN battles.
//  3 rival 3+lead cells, from the RIVAL's view (its own sets vs our public six),
//    declared as rules; the concrete threes are printed in the result:
//      legacy   rival chooseThree
//      view1/2  preview-legal-search rivalCandidates top two distinct threes
//               other than legacy, with their best lead
//      aceLead  ace leads + the legacy partners (first two non-ace legacy)
//      aceBack  the ace held back: best rivalCandidates three containing the
//               ace with a non-ace lead (or legacy with the ace moved last)
//    Rival T1/T2: pr82-eval BRANCHES (ai/attack/setup/switch/utility/...)
//  4 seeds: FINAL-selection hashSeed(8690000+ui*100+{0,1}), both sides.
//    Selector-internal search seeds: 8700000+ (pr88-guarded-preview.js).
//    DEV (known / already seen sixes) for the selector: hashSeed(8710000+..).
const FINAL2_SEED_BASE=8680000,SEL_FINAL_SEED_BASE=8690000,SEL_SEARCH_SEED_BASE=8700000,SEL_DEV_SEED_BASE=8710000;
const key=p=>p.join('/');
// cells for a rival team (its real sets: the rival knows its own team) vs our
// PUBLIC species only.
function rationalCells({dex,team,ownSpecies,ace,chooseThree,rivalCandidates}){
  const legacy=chooseThree(dex,team,ownSpecies).map(n=>team[n-1].species);
  const ranked=rivalCandidates(dex,team,ownSpecies,6,'best',{truncate:false});
  const U=new Set(),out=[];
  const add=(src,foe)=>{if(foe&&!U.has(key(foe))){out.push({src,foe});U.add(key(foe));}};
  const same=(a,b)=>a.slice().sort().join()===b.slice().sort().join();
  add('legacy',legacy);
  ranked.filter(r=>!same(r.three,legacy)).slice(0,2).forEach((r,i)=>add('view'+(i+1),r.three));
  const partners=legacy.filter(x=>x!==ace).slice(0,2);
  add('aceLead',[ace,...partners]);
  const back=ranked.find(r=>r.three.includes(ace)&&r.three[0]!==ace&&!U.has(key(r.three)));
  add('aceBack',back?back.three:legacy.includes(ace)&&legacy[0]!==ace?null:[...partners,ace]);
  return {legacy,cells:out};
}
const S=(species,item,ability,nature,moves,evs)=>({species,item,ability,nature,moves,evs});
const PHYS={hp:2,atk:32,spe:32},SPEC={hp:2,spa:32,spe:32};
function unseenSixesPR88(){
  return {
    F1_gallade:{ace:'Gallade',hypotheses:{
      a:[S('Gallade','Galladite','Sharpness','Jolly',['Sacred Sword','Psycho Cut','Leaf Blade','Swords Dance'],PHYS),
        S('Arcanine-Hisui','Sitrus Berry','Intimidate','Adamant',['Head Smash','Flare Blitz','Extreme Speed','Wild Charge'],{hp:32,atk:32,spe:2}),
        S('Rotom-Frost','Shuca Berry','Levitate','Modest',['Blizzard','Thunderbolt','Will-O-Wisp','Protect'],{hp:32,spa:32,def:2}),
        S('Garganacl','Leftovers','Purifying Salt','Careful',['Salt Cure','Recover','Body Press','Iron Defense'],{hp:32,spd:32,def:2}),
        S('Whimsicott','Focus Sash','Prankster','Timid',['Moonblast','Encore','Tailwind','Taunt'],{hp:2,spa:32,spe:32}),
        S('Hydrapple','Lum Berry','Regenerator','Modest',['Draco Meteor','Giga Drain','Earth Power','Fickle Beam'],{hp:32,spa:32,spd:2})],
      b:[S('Gallade','Focus Sash','Sharpness','Jolly',['Sacred Sword','Psycho Cut','Night Slash','Swords Dance'],PHYS),
        S('Arcanine-Hisui','Life Orb','Rock Head','Jolly',['Head Smash','Flare Blitz','Extreme Speed','Close Combat'],PHYS),
        S('Rotom-Frost','Choice Scarf','Levitate','Timid',['Blizzard','Thunderbolt','Trick','Volt Switch'],SPEC),
        S('Garganacl','Leftovers','Purifying Salt','Impish',['Salt Cure','Recover','Stealth Rock','Protect'],{hp:32,def:32,spd:2}),
        S('Whimsicott','Mental Herb','Prankster','Bold',['Moonblast','Encore','Tailwind','Taunt'],{hp:32,def:32,spa:2}),
        S('Hydrapple','Sitrus Berry','Regenerator','Quiet',['Draco Meteor','Giga Drain','Earth Power','Dragon Tail'],{hp:32,spa:32,def:2})]}},
    F2_feraligatr:{ace:'Feraligatr',hypotheses:{
      a:[S('Feraligatr','Feraligite','Sheer Force','Adamant',['Liquidation','Ice Fang','Crunch','Dragon Dance'],PHYS),
        S('Infernape','Life Orb','Iron Fist','Jolly',['Close Combat','Flare Blitz','Mach Punch','Thunder Punch'],PHYS),
        S('Hatterene','Leftovers','Magic Bounce','Quiet',['Psychic','Dazzling Gleam','Mystical Fire','Trick Room'],{hp:32,spa:32,def:2}),
        S('Mudsdale','Sitrus Berry','Stamina','Impish',['High Horsepower','Heavy Slam','Stealth Rock','Rest'],{hp:32,def:32,atk:2}),
        S('Noivern','Choice Scarf','Infiltrator','Timid',['Draco Meteor','Boomburst','Flamethrower','U-turn'],SPEC),
        S('Aegislash','Lum Berry','Stance Change','Quiet',['Shadow Ball','Flash Cannon','King\'s Shield','Shadow Sneak'],{hp:32,spa:32,atk:2})],
      b:[S('Feraligatr','Choice Scarf','Sheer Force','Jolly',['Liquidation','Ice Fang','Crunch','Dragon Claw'],PHYS),
        S('Infernape','Focus Sash','Blaze','Timid',['Overheat','Close Combat','Grass Knot','Fake Out'],{hp:2,spa:32,spe:32}),
        S('Hatterene','Sitrus Berry','Magic Bounce','Modest',['Psychic','Dazzling Gleam','Mystical Fire','Calm Mind'],{hp:32,spa:32,spd:2}),
        S('Mudsdale','Leftovers','Stamina','Careful',['High Horsepower','Heavy Slam','Rock Slide','Protect'],{hp:32,spd:32,atk:2}),
        S('Noivern','Life Orb','Infiltrator','Timid',['Draco Meteor','Hurricane','Flamethrower','Boomburst'],SPEC),
        S('Aegislash','Lum Berry','Stance Change','Brave',['Shadow Sneak','Iron Head','Close Combat','King\'s Shield'],{hp:32,atk:32,def:2})]}},
    F3_glimmora:{ace:'Glimmora',hypotheses:{
      a:[S('Glimmora','Glimmoranite','Toxic Debris','Timid',['Power Gem','Sludge Wave','Earth Power','Mortal Spin'],SPEC),
        S('Conkeldurr','Black Belt','Iron Fist','Adamant',['Drain Punch','Mach Punch','Knock Off','Ice Punch'],{hp:32,atk:32,def:2}),
        S('Grimmsnarl','Light Clay','Prankster','Careful',['Spirit Break','Reflect','Light Screen','Taunt'],{hp:32,spd:32,def:2}),
        S('Cinderace','Life Orb','Blaze','Jolly',['Pyro Ball','High Jump Kick','U-turn','Sucker Punch'],PHYS),
        S('Basculegion-F','Choice Scarf','Adaptability','Timid',['Wave Crash','Shadow Ball','Hydro Pump','Ice Beam'],SPEC),
        S('Sinistcha','Leftovers','Hospitality','Bold',['Matcha Gotcha','Shadow Ball','Strength Sap','Calm Mind'],{hp:32,def:32,spa:2})],
      b:[S('Glimmora','Focus Sash','Toxic Debris','Timid',['Power Gem','Sludge Wave','Stealth Rock','Spikes'],SPEC),
        S('Conkeldurr','Sitrus Berry','Iron Fist','Adamant',['Drain Punch','Mach Punch','Knock Off','Ice Punch'],{hp:32,atk:32,spd:2}),
        S('Grimmsnarl','Leftovers','Prankster','Impish',['Spirit Break','Parting Shot','Foul Play','Taunt'],{hp:32,def:32,spd:2}),
        S('Cinderace','Choice Scarf','Blaze','Jolly',['Pyro Ball','High Jump Kick','U-turn','Gunk Shot'],PHYS),
        S('Basculegion-F','Life Orb','Adaptability','Modest',['Hydro Pump','Shadow Ball','Ice Beam','Aqua Jet'],{hp:2,spa:32,spe:32}),
        S('Sinistcha','Lum Berry','Hospitality','Calm',['Matcha Gotcha','Shadow Ball','Strength Sap','Trick Room'],{hp:32,spd:32,spa:2})]}},
  };
}
module.exports={rationalCells,unseenSixesPR88,FINAL2_SEED_BASE,SEL_FINAL_SEED_BASE,SEL_SEARCH_SEED_BASE,SEL_DEV_SEED_BASE};
