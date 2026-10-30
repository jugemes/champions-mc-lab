'use strict';
// PR #80 request item 7: ONE additional genuinely unseen public six for the
// general public-six entry. Written and committed BEFORE public-six-general.js
// was run on it and before any PR #80 change was evaluated; not used to tune
// anything. This six (sand: Hippowdon + Excadrill, with Kingambit / Sylveon /
// Rotom-Heat / Dragapult) is not a case, holdout or environment team anywhere
// else in the repo. Two legal hand-written hypotheses (a: Mega Excadrill SD +
// Scarf Rotom-Heat + Sash Dragapult; b: Scarf Excadrill, no Mega, Calm Mind
// Sylveon, special Dragapult, bulky Will-O-Wisp Rotom-Heat). Constructed teams,
// NOT sampled ladder rosters, no usage weight. Hidden sets are only used to
// RUN battles; the preview entry receives species names only.
function holdoutSixPR80(){
  const a=[
    {species:'Hippowdon',item:'Leftovers',ability:'Sand Stream',nature:'Impish',moves:['Stealth Rock','Earthquake','Slack Off','Yawn'],evs:{hp:32,def:32,spd:2}},
    {species:'Excadrill',item:'Excadrite',ability:'Sand Rush',nature:'Jolly',moves:['Swords Dance','Earthquake','Iron Head','Rock Slide'],evs:{hp:2,atk:32,spe:32}},
    {species:'Kingambit',item:'Life Orb',ability:'Supreme Overlord',nature:'Adamant',moves:['Kowtow Cleave','Iron Head','Sucker Punch','Swords Dance'],evs:{hp:32,atk:32,spe:2}},
    {species:'Sylveon',item:'Sitrus Berry',ability:'Pixilate',nature:'Modest',moves:['Hyper Voice','Mystical Fire','Wish','Protect'],evs:{hp:32,spa:32,spd:2}},
    {species:'Rotom-Heat',item:'Choice Scarf',ability:'Levitate',nature:'Timid',moves:['Overheat','Thunderbolt','Volt Switch','Trick'],evs:{hp:2,spa:32,spe:32}},
    {species:'Dragapult',item:'Focus Sash',ability:'Clear Body',nature:'Jolly',moves:['Dragon Darts','Phantom Force','U-turn','Thunder Wave'],evs:{hp:2,atk:32,spe:32}},
  ];
  const b=[
    {species:'Hippowdon',item:'Rocky Helmet',ability:'Sand Stream',nature:'Impish',moves:['Stealth Rock','Earthquake','Slack Off','Yawn'],evs:{hp:32,def:32,spd:2}},
    {species:'Excadrill',item:'Choice Scarf',ability:'Sand Rush',nature:'Jolly',moves:['Earthquake','Iron Head','Rock Slide','Rapid Spin'],evs:{hp:2,atk:32,spe:32}},
    {species:'Kingambit',item:'Lum Berry',ability:'Defiant',nature:'Adamant',moves:['Swords Dance','Kowtow Cleave','Iron Head','Sucker Punch'],evs:{hp:32,atk:32,spd:2}},
    {species:'Sylveon',item:'Leftovers',ability:'Pixilate',nature:'Calm',moves:['Hyper Voice','Calm Mind','Wish','Protect'],evs:{hp:32,spd:32,spa:2}},
    {species:'Rotom-Heat',item:'Sitrus Berry',ability:'Levitate',nature:'Bold',moves:['Will-O-Wisp','Overheat','Volt Switch','Pain Split'],evs:{hp:32,def:32,spa:2}},
    {species:'Dragapult',item:'Life Orb',ability:'Infiltrator',nature:'Timid',moves:['Draco Meteor','Shadow Ball','Flamethrower','U-turn'],evs:{hp:2,spa:32,spe:32}},
  ];
  return {HX_sand:{publicSix:a.map(p=>p.species),hypotheses:{a,b},ace:'Excadrill',
    note:'a: Mega Excadrill SD + Scarf Rotom-Heat + Sash Dragapult; b: Scarf Excadrill (no Mega) + CM Sylveon + WoW Rotom-Heat + LO special Dragapult'}};
}
module.exports={holdoutSixPR80};
