'use strict';
// M-7 singles *constructed opponent teams*: NOT actual sampled 6-member rosters.
// Popular species & set traits: https://pokenavi.jp/ranking/
// https://www.pokemon-zone.com/champions/ranked-seasons/singles/
// https://news.pokemon-home.com/ja/page/816.html
const {variants,archetypes}=require('./fixtures');
const {opponents}=require('./threat-scenarios-20261014');
const {reportedLive}=require('./reported-live-roster-20261027');
const A=require('./hybrid01-audit');
const clone=p=>structuredClone(p);
const C=p=>structuredClone(p);
const live=reportedLive();
const copy=s=>clone(live.find(p=>p.species===s)||
  [...Object.values(archetypes),...Object.values(variants),...Object.values(opponents)]
    .flat().find(p=>p.species===s)||(()=>{throw Error('Missing set '+s)})());
const mk=(s,item,ability,nature,points,moves)=>A.set(s,item,ability,nature,points,moves);
const ga=copy('Garchomp'); // Scarf
const pr=copy('Primarina'); // Sitrus
const go=copy('Gholdengo'); // Air Balloon from fixtures
const gl=copy('Golisopod'); // Golisopite
const mt=copy('Metagross'); // Mega
const co=copy('Corviknight'); // Rocky Helmet
const hi=mk('Hippowdon','Leftovers','Sand Stream','Impish',{hp:32,def:32,spd:2},
 ['Earthquake','Yawn','Stealth Rock','Slack Off']);
const mi=mk('Mimikyu','Life Orb','Disguise','Adamant',{hp:2,atk:32,spe:32},
 ['Play Rough','Shadow Sneak','Swords Dance','Shadow Claw']);
const ba=mk('Baxcalibur','Focus Sash','Thermal Exchange','Adamant',{hp:2,atk:32,spe:32},
 ['Ice Shard','Earthquake','Glaive Rush','Icicle Crash']);
const lu=mk('Lucario','Lucarionite Z','Inner Focus','Timid',{hp:2,spa:32,spe:32},
 ['Aura Sphere','Dark Pulse','Flash Cannon','Nasty Plot']);
const ar=mk('Archaludon','White Herb','Stamina','Modest',{hp:32,spa:32,spd:2},
 ['Draco Meteor','Flash Cannon','Thunderbolt','Stealth Rock']);
const bas=mk('Basculegion','Choice Scarf','Adaptability','Adamant',{hp:2,atk:32,spe:32},
 ['Last Respects','Aqua Jet','Wave Crash','Flip Turn']);
const gy=mk('Gyarados','Sitrus Berry','Intimidate','Jolly',{hp:2,atk:32,spe:32},
 ['Dragon Dance','Waterfall','Earthquake','Taunt']);
const charY=clone(opponents.sun_charizard_y.find(p=>p.species==='Charizard'));
const charX=mk('Charizard','Charizardite X','Blaze','Jolly',{hp:2,atk:32,spe:32},
 ['Dragon Dance','Flare Blitz','Dragon Claw','Earthquake']);
const sa=clone(archetypes.setup.find(p=>p.species==='Salamence'));
const dn=copy('Dragonite');
const rill=copy('Rillaboom');
const vol=copy('Volcarona');
const skel=copy('Skeledirge');
const p={gl,ga,pr,go,mt,co,hi,mi,ba,lu,ar,bas,gy,charY,charX,sa,dn,rill,vol,skel};
const group=(name,tags,members,forcedA,forcedB)=>({name,tags,team:members.map(x=>C(p[x])),
 forcedA:forcedA.map(x=>p[x].species),forcedB:forcedB.map(x=>p[x].species)});
const groups=[
 group('01_M7_golisopod_balance',['top-heavy','mega'],['gl','ga','pr','mi','hi','go'],['gl','ga','mi'],['hi','pr','go']),
 group('02_M7_lucarioZ_offense',['top-heavy','mega'],['lu','ga','pr','mi','ar','co'],['lu','ga','mi'],['co','pr','ar']),
 group('03_M7_charizardY_offense',['top-heavy','sun'],['charY','ga','pr','mi','go','ba'],['charY','ga','mi'],['pr','ba','go']),
 group('04_M7_charizardX_offense',['top-heavy','sun-x'],['charX','ga','pr','mi','go','ba'],['charX','ga','mi'],['pr','ba','go']),
 group('05_M7_salamence_balance',['top-heavy','mega'],['sa','ga','pr','mi','hi','go'],['sa','ga','mi'],['hi','pr','go']),
 group('06_M7_golisopod_basculegion',['top-heavy','last-respects'],['gl','bas','pr','mi','hi','go'],['gl','bas','mi'],['pr','hi','go']),
 group('07_M7_baxcalibur_offense',['top-heavy','priority'],['gl','ga','ba','pr','mi','go'],['gl','ba','mi'],['ga','pr','go']),
 group('08_M7_metagross_balance',['top-heavy','mega'],['mt','ga','pr','mi','co','hi'],['mt','ga','mi'],['hi','pr','co']),
 group('09_M7_gyarados_setup',['mid','setup'],['gy','ga','mi','go','co','ba'],['gy','ga','ba'],['mi','go','co']),
 group('10_M7_lucario_hazard',['mid','hazards'],['lu','ga','hi','mi','go','pr'],['lu','ga','mi'],['hi','pr','go']),
 group('11_M7_psychic_terrain',['mid','psychic'],[],[],[]),
 group('12_M7_rain',['mid','rain'],[],[],[]),
 group('13_M7_stall',['mid','stall'],[],[],[]),
 group('14_M7_salamence_setup',['mid','setup'],[],[],[])
];
function patch(i,team,a,b){
 const k=groups[i];k.team=team.map(C);k.forcedA=a;k.forcedB=b;
}
patch(10,opponents.psychic_terrain_singles,
 ['Indeedee','Gengar','Dragonite'],['Gholdengo','Volcarona','Rillaboom']);
patch(11,archetypes.rain,
 ['Pelipper','Swampert','Archaludon'],['Pelipper','Dragonite','Gholdengo']);
patch(12,archetypes.stall,
 ['Toxapex','Umbreon','Corviknight'],['Slowbro','Skarmory','Gholdengo']);
patch(13,archetypes.setup,
 ['Salamence','Volcarona','Dragonite'],['Gholdengo','Skeledirge','Rillaboom']);
module.exports={groups};
