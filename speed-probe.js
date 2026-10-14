#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
const {normalize}=require('./lab');
const {variants,archetypes}=require('./fixtures');
const serperior={species:'Serperior',item:'Choice Scarf',ability:'Contrary',nature:'Timid',
  evs:{hp:2,spa:32,spe:32},moves:['Leaf Storm','Dragon Pulse','Glare','Taunt']};
const others=archetypes.setup.filter(s=>s.species!=='Garchomp');
const opponents=[serperior,...others];
const validator=sim.TeamValidator.get('gen9championsbssregmc');
assert.equal(opponents.length,6);
const bad=validator.validateTeam(normalize(opponents));
if(bad?.length)throw Error('Serperior probe opponent illegal:\n'+bad.join('\n'));
function probe(team){
  const b=new sim.Battle({formatid:'gen9championsbssregmc',seed:[10,20,30,40]});
  b.setPlayer('p1',{name:'Star',team:normalize(team)});
  b.setPlayer('p2',{name:'Snake',team:normalize(opponents)});
  b.choose('p1','team 123');
  b.choose('p2','team 123');
  const p1=b.sides[0].active[0],p2=b.sides[1].active[0];
  assert.equal(p1.baseSpecies.baseSpecies,'Starmie');
  assert.equal(p2.baseSpecies.baseSpecies,'Serperior');
  const result={starmie:p1.getStat('spe'),serperior:p2.getStat('spe')};
  b.destroy?.();
  return result;
}
const s31=probe(variants.A_rillaboom);
const s29=probe(variants.D_starmieS29);
console.log('Showdown M-C actual effective scarf speeds:',JSON.stringify({S29:s29,S31:s31}));
assert.deepEqual(s29,{starmie:270,serperior:271},'S29 must be one below scarf Serperior');
assert.deepEqual(s31,{starmie:273,serperior:271},'S31 must outpace scarf Serperior');
console.log('PASS: Stat-point S29 vs S31 speed benchmarks verified using actual Showdown battle state.');
