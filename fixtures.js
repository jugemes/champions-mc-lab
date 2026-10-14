'use strict';
// EXPERIMENTAL team fixtures. Abilities, learnsets and items MUST pass Showdown validation.
// Format: species | item | ability | nature | stat-points | four moves
// Stat abbreviations: H hp, A atk, B def, C spa, D spd, S spe.
const row=(species,item,ability,nature,points,moves)=>({
  species,item,ability,nature,moves:moves.split('/'),
  evs:Object.fromEntries(points.split(',').map(t=>[({H:'hp',A:'atk',B:'def',C:'spa',D:'spd',S:'spe'})[t[0]],Number(t.slice(1))]))
});
const st=(spe=31)=>row('Starmie','Choice Scarf','Natural Cure','Timid',`H${34-spe},C32,S${spe}`,'Ice Beam/Hydro Pump/Grass Knot/Trick');
const pri=row('Primarina','Sitrus Berry','Torrent','Modest','H32,C32,S2','Moonblast/Sparkling Aria/Aqua Jet/Encore');
const sk=row('Skeledirge','Leftovers','Unaware','Bold','H32,B32,D2','Torch Song/Shadow Ball/Will-O-Wisp/Slack Off');
const go=row('Gholdengo','Air Balloon','Good as Gold','Modest','H2,C32,S32','Shadow Ball/Make It Rain/Nasty Plot/Thunderbolt');
const ri=row('Rillaboom','Miracle Seed','Grassy Surge','Adamant','H32,A32,D2','Grassy Glide/High Horsepower/Knock Off/U-turn');
const lu=row('Lucario','Lucarionite','Inner Focus','Jolly','H2,A32,S32','Close Combat/Meteor Mash/Bullet Punch/Swords Dance');
const ee=row('Eelektross','Rocky Helmet','Levitate','Modest','H32,C25,D9','Thunderbolt/Volt Switch/Flamethrower/Grass Knot');
const ga=row('Garchomp','Choice Scarf','Rough Skin','Jolly','H2,A32,S32','Earthquake/Dragon Claw/Rock Slide/Poison Jab');
const co=row('Corviknight','Rocky Helmet','Mirror Armor','Impish','H32,B32,D2','Roost/U-turn/Body Press/Iron Head');
const ge=row('Gengar','Gengarite','Cursed Body','Timid','H2,C32,S32','Shadow Ball/Thunderbolt/Taunt/Perish Song');
const gl=row('Golisopod','Golisopite','Emergency Exit','Adamant','H32,A32,D2','First Impression/Sucker Punch/Iron Head/Leech Life');
const variants={
  A_rillaboom:[st(),ri,lu,go,sk,pri],
  B_eelektross:[st(),ee,lu,go,sk,pri],
  C_master:[gl,ga,pri,co,sk,ge],
  D_starmieS29:[st(29),ri,lu,go,sk,pri],
};
// Synthetic archetypes for ENGINE TESTING, not rank-representative samples.
const archetypes={
  rain:[
    row('Pelipper','Focus Sash','Drizzle','Bold','H32,B32,D2','Hurricane/Weather Ball/U-turn/Roost'),
    row('Swampert','Swampertite','Torrent','Adamant','H2,A32,S32','Liquidation/Earthquake/Ice Punch/Flip Turn'),
    row('Archaludon','Sitrus Berry','Stamina','Modest','H32,C32,D2','Electro Shot/Draco Meteor/Flash Cannon/Body Press'),
    row('Dragonite','Lum Berry','Multiscale','Adamant','H2,A32,S32','Dragon Dance/Extreme Speed/Earthquake/Fire Punch'),
    row('Gholdengo','Air Balloon','Good as Gold','Modest','H2,C32,S32','Shadow Ball/Make It Rain/Nasty Plot/Thunderbolt'),
    ri,
  ],
  setup:[
    row('Salamence','Salamencite','Intimidate','Jolly','H2,A32,S32','Dragon Dance/Double-Edge/Earthquake/Roost'),
    row('Volcarona','Leftovers','Flame Body','Timid','H2,C32,S32','Quiver Dance/Fiery Dance/Bug Buzz/Giga Drain'),
    row('Dragonite','Lum Berry','Multiscale','Adamant','H2,A32,S32','Dragon Dance/Extreme Speed/Earthquake/Fire Punch'),
    ga,
    row('Skeledirge','Sitrus Berry','Unaware','Bold','H32,B32,D2','Torch Song/Shadow Ball/Will-O-Wisp/Slack Off'),
    ri,
  ],
  stall:[
    row('Toxapex','Rocky Helmet','Regenerator','Bold','H32,B32,D2','Recover/Haze/Toxic Spikes/Chilling Water'),
    row('Blissey','Leftovers','Natural Cure','Bold','H32,B32,D2','Soft-Boiled/Seismic Toss/Thunder Wave/Shadow Ball'),
    row('Corviknight','Sitrus Berry','Mirror Armor','Impish','H32,B32,D2','Roost/U-turn/Body Press/Iron Head'),
    row('Clodsire','Covert Cloak','Water Absorb','Careful','H32,D32,B2','Earthquake/Toxic/Recover/Stealth Rock'),
    row('Dondozo','Chesto Berry','Unaware','Impish','H32,B32,D2','Wave Crash/Rest/Sleep Talk/Curse'),
    go,
  ],
};
module.exports={variants,archetypes};
