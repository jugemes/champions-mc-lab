'use strict';
// PR #86 request (ChatGPT review #5720466858 of PR #85). Declared and committed
// BEFORE pr86-safe-entry.js / pr86-eval.js produced any battle result; nothing
// here is tuned on a result. Three parts:
//  1 DEV and FINAL rival 3+lead cells on the 22 known hypotheses. Disjoint from
//    the PR #83 train/test cells (rivalLegacy/aceLead/alt1/alt2) and from the
//    PR #85 holdout cells (reLead/aceAlt), and from each other. The PR #85
//    holdout is NOT reused for anything. DEV picks the abstain gate; FINAL is
//    run once, after the gate is frozen by its own commit.
//      DEV   lead3   rival legacy three (chooseThree from the rival's view of our
//                    six, its own sets) with its THIRD member leading
//            aceLeadB ace leads with the two legacy members it would not
//                    otherwise bring together (first unused pick, ace lead, by
//                    a fixed hash): the rival's ace started instead of held
//      FINAL aceBack2 the ace held back, rank-2 pick by a different hash salt
//            swapIn  legacy three with its last member replaced by the ace when
//                    the ace is not in it (lead = legacy lead); otherwise the
//                    rank-1 non-ace-lead pick under the FINAL salt
//  2 three public sixes that are NOT in the repo (no species of them appears as
//    a quoted name in any *.js on 2026-10-31, and none is in our six), each with
//    two legal hand-written hypotheses (one Mega each). Champions item pool (no Choice Band/Specs, Assault Vest, Orbs). Constructed, NOT sampled
//    from the ladder, no usage weight. Hidden sets only RUN battles.
//  3 seeds: DEV hashSeed(8650000+ci*100+{0,1}), FINAL hashSeed(8660000+..),
//    UNSEEN hashSeed(8670000+ui*100+{0,1}), both sides. Never used before (grep).
const crypto=require('node:crypto');
const h=(salt,s)=>crypto.createHash('sha256').update(salt+':'+s).digest('hex');
const DEV_SEED_BASE=8650000,FINAL_SEED_BASE=8660000,UNSEEN_SEED_BASE=8670000;
const key=p=>p.join('/');
function pick(cands,salt,label,used,rank=0){
  const c=cands.filter(p=>!used.has(key(p))).sort((a,b)=>h(salt,label(a))<h(salt,label(b))?-1:1);
  return c[rank]||null;
}
function devCells({picks,label,legacy,ace,used}){
  const U=new Set(used.map(key)),out=[];
  const add=(src,foe)=>{if(foe&&!U.has(key(foe))){out.push({src,foe});U.add(key(foe));}};
  add('lead3',[legacy[2],legacy[0],legacy[1]]);
  add('aceLeadB',pick(picks.filter(p=>p[0]===ace),'pr86dev',label,U));
  return out;
}
function finalCells({picks,label,legacy,ace,used}){
  const U=new Set(used.map(key)),out=[];
  const add=(src,foe)=>{if(foe&&!U.has(key(foe))){out.push({src,foe});U.add(key(foe));}};
  add('aceBack2',pick(picks.filter(p=>p.includes(ace)&&p[0]!==ace),'pr86final',label,U,1));
  if(!legacy.includes(ace))add('swapIn',[legacy[0],legacy[1],ace]);
  else add('swapIn',pick(picks.filter(p=>p[0]!==ace),'pr86final',label,U));
  return out;
}
// Unseen-six rival cells: what a rational rival brings from OUR public six,
// declared as rules (the concrete threes depend on chooseThree and are printed
// in the result): legacy, legacy with 2nd lead, ace lead (+ legacy partners),
// ace back (rank-0 hash pick).
function unseenCells({picks,label,legacy,ace}){
  const U=new Set(),out=[];
  const add=(src,foe)=>{if(foe&&!U.has(key(foe))){out.push({src,foe});U.add(key(foe));}};
  add('legacy',legacy);add('legacyLead2',[legacy[1],legacy[0],legacy[2]]);
  add('aceLead',legacy.includes(ace)?[ace,...legacy.filter(x=>x!==ace)]:[ace,legacy[0],legacy[1]]);
  add('aceBack',pick(picks.filter(p=>p.includes(ace)&&p[0]!==ace),'pr86unseen',label,U));
  return out;
}
const S=(species,item,ability,nature,moves,evs)=>({species,item,ability,nature,moves,evs});
const PHYS={hp:2,atk:32,spe:32},SPEC={hp:2,spa:32,spe:32};
function unseenSixesPR86(){
  return {
    U1_gardevoir:{ace:'Gardevoir',hypotheses:{
      a:[S('Gardevoir','Gardevoirite','Trace','Timid',['Hyper Voice','Psychic','Mystical Fire','Calm Mind'],SPEC),
        S('Incineroar','Sitrus Berry','Intimidate','Careful',['Fake Out','Flare Blitz','Darkest Lariat','Parting Shot'],{hp:32,spd:32,atk:2}),
        S('Gliscor','Rocky Helmet','Hyper Cutter','Impish',['Earthquake','Knock Off','Protect','Toxic'],{hp:32,def:32,spe:2}),
        S('Milotic','Leftovers','Competitive','Bold',['Scald','Recover','Ice Beam','Haze'],{hp:32,def:32,spa:2}),
        S('Weavile','Focus Sash','Pressure','Jolly',['Triple Axel','Knock Off','Ice Shard','Low Kick'],PHYS),
        S('Kommo-o','Life Orb','Bulletproof','Timid',['Clanging Scales','Aura Sphere','Flamethrower','Clangorous Soul'],SPEC)],
      b:[S('Gardevoir','Choice Scarf','Trace','Timid',['Moonblast','Psychic','Mystical Fire','Trick'],SPEC),
        S('Incineroar','Shuca Berry','Intimidate','Adamant',['Fake Out','Flare Blitz','Darkest Lariat','Parting Shot'],{hp:32,atk:32,spd:2}),
        S('Gliscor','Leftovers','Hyper Cutter','Jolly',['Earthquake','Swords Dance','Knock Off','Protect'],{hp:2,atk:32,spe:32}),
        S('Milotic','Lum Berry','Marvel Scale','Bold',['Scald','Recover','Ice Beam','Dragon Tail'],{hp:32,def:32,spa:2}),
        S('Weavile','Life Orb','Pressure','Jolly',['Triple Axel','Knock Off','Ice Shard','Swords Dance'],PHYS),
        S('Kommo-o','Focus Sash','Bulletproof','Jolly',['Close Combat','Dragon Claw','Poison Jab','Swords Dance'],PHYS)]}},
    U2_aerodactyl:{ace:'Aerodactyl',hypotheses:{
      a:[S('Aerodactyl','Aerodactylite','Unnerve','Jolly',['Stone Edge','Earthquake','Stealth Rock','Taunt'],PHYS),
        S('Mamoswine','Life Orb','Thick Fat','Adamant',['Icicle Crash','Earthquake','Ice Shard','Knock Off'],PHYS),
        S('Greninja','Choice Scarf','Protean','Timid',['Hydro Pump','Dark Pulse','Ice Beam','U-turn'],SPEC),
        S('Goodra','Expert Belt','Sap Sipper','Modest',['Draco Meteor','Fire Blast','Sludge Bomb','Thunderbolt'],{hp:32,spa:32,spd:2}),
        S('Talonflame','Sharp Beak','Gale Wings','Adamant',['Brave Bird','Flare Blitz','U-turn','Swords Dance'],PHYS),
        S('Klefki','Light Clay','Prankster','Bold',['Reflect','Light Screen','Thunder Wave','Spikes'],{hp:32,def:32,spd:2})],
      b:[S('Aerodactyl','Focus Sash','Unnerve','Jolly',['Stone Edge','Stealth Rock','Taunt','Earthquake'],PHYS),
        S('Mamoswine','Never-Melt Ice','Thick Fat','Adamant',['Icicle Crash','Earthquake','Ice Shard','Knock Off'],PHYS),
        S('Greninja','Greninjite','Protean','Timid',['Hydro Pump','Dark Pulse','Ice Beam','Water Shuriken'],SPEC),
        S('Goodra','Leftovers','Sap Sipper','Calm',['Draco Meteor','Fire Blast','Thunderbolt','Sludge Bomb'],{hp:32,spd:32,spa:2}),
        S('Talonflame','Choice Scarf','Gale Wings','Jolly',['Brave Bird','Flare Blitz','U-turn','Roost'],PHYS),
        S('Klefki','Sitrus Berry','Prankster','Calm',['Thunder Wave','Spikes','Play Rough','Foul Play'],{hp:32,spd:32,def:2})]}},
    U3_lopunny:{ace:'Lopunny',hypotheses:{
      a:[S('Lopunny','Lopunnite','Limber','Jolly',['Fake Out','High Jump Kick','Facade','Ice Punch'],PHYS),
        S('Snorlax','Leftovers','Thick Fat','Careful',['Curse','Body Slam','Rest','Heavy Slam'],{hp:32,spd:32,atk:2}),
        S('Chandelure','Choice Scarf','Flash Fire','Timid',['Shadow Ball','Flamethrower','Energy Ball','Trick'],SPEC),
        S('Krookodile','Life Orb','Intimidate','Jolly',['Earthquake','Knock Off','Stone Edge','Close Combat'],PHYS),
        S('Hawlucha','Sitrus Berry','Unburden','Jolly',['Swords Dance','Acrobatics','Close Combat','Taunt'],PHYS),
        S('Florges','Wise Glasses','Flower Veil','Calm',['Moonblast','Calm Mind','Synthesis','Psychic'],{hp:32,spd:32,def:2})],
      b:[S('Lopunny','Choice Scarf','Limber','Jolly',['High Jump Kick','Facade','Ice Punch','Fake Out'],PHYS),
        S('Snorlax','Chesto Berry','Thick Fat','Adamant',['Curse','Body Slam','Rest','Earthquake'],{hp:32,atk:32,def:2}),
        S('Chandelure','Chandelurite','Flash Fire','Modest',['Shadow Ball','Flamethrower','Energy Ball','Will-O-Wisp'],{hp:32,spa:32,spe:2}),
        S('Krookodile','Focus Sash','Intimidate','Jolly',['Earthquake','Knock Off','Stealth Rock','Taunt'],PHYS),
        S('Hawlucha','Sitrus Berry','Unburden','Jolly',['Swords Dance','Acrobatics','Close Combat','Encore'],PHYS),
        S('Florges','Fairy Feather','Flower Veil','Modest',['Moonblast','Psychic','Energy Ball','Draining Kiss'],{hp:32,spa:32,spd:2})]}},
  };
}
module.exports={devCells,finalCells,unseenCells,unseenSixesPR86,DEV_SEED_BASE,FINAL_SEED_BASE,UNSEEN_SEED_BASE};
