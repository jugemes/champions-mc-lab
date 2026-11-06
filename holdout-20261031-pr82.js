'use strict';
// PR #82 request (ChatGPT review #5719297548 of PR #81): ONE additional
// genuinely unseen public six. Written and committed BEFORE public-six-general
// search, the pr82 executable T1/T2 table or any pr82 evaluation was run on it;
// not used to tune anything. None of these six species is a case, holdout or
// environment team anywhere else in the repo (grep 2026-10-31). Two legal
// hand-written hypotheses: a = Mega Scizor SD + Mystic Water Azumarill + Scarf Annihilape + hazard/
// Encore Tinkaton + Moonlight/Thunder Wave Clefable; b = no Mega, Scarf
// Tinkaton, Bulk Up Annihilape, Calm Mind Clefable, Sash Ceruledge.
// Constructed teams, NOT sampled ladder rosters, no usage weight. Hidden sets
// are only used to RUN battles; preview/T1 entries receive species names and
// public battle events only.
function holdoutSixPR82(){
  const a=[
    {species:'Scizor',item:'Scizorite',ability:'Technician',nature:'Adamant',moves:['Bullet Punch','Swords Dance','U-turn','Close Combat'],evs:{hp:32,atk:32,spe:2}},
    {species:'Azumarill',item:'Mystic Water',ability:'Huge Power',nature:'Adamant',moves:['Aqua Jet','Liquidation','Play Rough','Knock Off'],evs:{hp:32,atk:32,spe:2}},
    {species:'Tinkaton',item:'Leftovers',ability:'Mold Breaker',nature:'Jolly',moves:['Stealth Rock','Encore','Gigaton Hammer','Thunder Wave'],evs:{hp:32,spe:32,def:2}},
    {species:'Clefable',item:'Sitrus Berry',ability:'Magic Guard',nature:'Bold',moves:['Moonblast','Moonlight','Thunder Wave','Flamethrower'],evs:{hp:32,def:32,spd:2}},
    {species:'Annihilape',item:'Choice Scarf',ability:'Defiant',nature:'Jolly',moves:['Rage Fist','Close Combat','U-turn','Gunk Shot'],evs:{hp:2,atk:32,spe:32}},
    {species:'Ceruledge',item:'Life Orb',ability:'Flash Fire',nature:'Adamant',moves:['Bitter Blade','Poltergeist','Shadow Sneak','Swords Dance'],evs:{hp:2,atk:32,spe:32}},
  ];
  const b=[
    {species:'Scizor',item:'Rocky Helmet',ability:'Technician',nature:'Impish',moves:['Bullet Punch','Roost','U-turn','Swords Dance'],evs:{hp:32,def:32,atk:2}},
    {species:'Azumarill',item:'Sitrus Berry',ability:'Huge Power',nature:'Adamant',moves:['Belly Drum','Aqua Jet','Play Rough','Liquidation'],evs:{hp:32,atk:32,spe:2}},
    {species:'Tinkaton',item:'Choice Scarf',ability:'Mold Breaker',nature:'Jolly',moves:['Gigaton Hammer','Play Rough','Knock Off','Stone Edge'],evs:{hp:2,atk:32,spe:32}},
    {species:'Clefable',item:'Leftovers',ability:'Unaware',nature:'Calm',moves:['Moonblast','Calm Mind','Moonlight','Encore'],evs:{hp:32,spd:32,def:2}},
    {species:'Annihilape',item:'Lum Berry',ability:'Defiant',nature:'Adamant',moves:['Bulk Up','Rage Fist','Drain Punch','Rest'],evs:{hp:32,atk:32,def:2}},
    {species:'Ceruledge',item:'Focus Sash',ability:'Flash Fire',nature:'Jolly',moves:['Bitter Blade','Poltergeist','Close Combat','Shadow Sneak'],evs:{hp:2,atk:32,spe:32}},
  ];
  return {HX_fairy:{publicSix:a.map(p=>p.species),hypotheses:{a,b},ace:'Scizor',
    note:'a: Mega Scizor SD + Scarf Annihilape + SR/Encore Tinkaton + Moonlight/TWave Clefable; b: no Mega, Scarf Tinkaton, Bulk Up Annihilape, CM/Encore Clefable, Sash Ceruledge'}};
}
module.exports={holdoutSixPR82};
