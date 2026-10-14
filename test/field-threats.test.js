'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path');
const {opponents}=require('../threat-scenarios-20261014');
const {prelim,normalize,game,hashSeed}=require('../lab');
const {estimateDamage,incomingRisk}=require('../damage');
const {blockedByPsychicTerrain,evaluateMoveV3}=require('../field-counterplay');
const {teams}=require('../cycle3-teams');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
const dex=sim.Dex.mod('champions');
test('five new public-six opponents are distinct and M-C legal',()=>{
  const v=sim.TeamValidator.get('gen9championsbssregmc');
  const keys=new Set();
  assert.equal(Object.keys(opponents).length,5);
  for(const [name,team]of Object.entries(opponents)){
    assert.doesNotThrow(()=>prelim(team,name));
    const issues=v.validateTeam(normalize(team));
    assert.ok(!issues?.length,name+': '+issues?.join('; '));
    const key=team.map(p=>p.species).sort().join('/');
    assert.ok(!keys.has(key));
    keys.add(key);
  }
});
test('psychic terrain blocks priority into grounded targets, but not flying or airborne targets',()=>{
  assert.equal(blockedByPsychicTerrain(dex,'Indeedee','Sucker Punch',{terrain:'psychicterrain'}),true);
  assert.equal(blockedByPsychicTerrain(dex,'Dragonite','Sucker Punch',{terrain:'psychicterrain'}),false);
  assert.equal(blockedByPsychicTerrain(dex,'Gholdengo','First Impression',{terrain:'psychicterrain',foeItem:'Air Balloon'}),false);
  assert.equal(blockedByPsychicTerrain(dex,'Gholdengo','First Impression',{terrain:'psychicterrain'}),true);
  assert.equal(blockedByPsychicTerrain(dex,'Indeedee','Leech Life',{terrain:'psychicterrain'}),false);
  const gl=teams().C_rill_gholdengo_for_gengar.find(p=>p.species==='Golisopod');
  const context={terrain:'psychicterrain',foeHP:.22,ratio:1,available:gl.moves};
  assert.ok(evaluateMoveV3(dex,gl,'Indeedee','Sucker Punch',context)<0);
  assert.ok(evaluateMoveV3(dex,gl,'Indeedee','Leech Life',context)>0);
});
test('sun increases fire damage, cuts water damage and raises public threat',()=>{
 const prim=teams().C_rill_gholdengo_for_gengar.find(p=>p.species==='Primarina');
 const char=opponents.sun_charizard_y[0];
 const fire=estimateDamage(dex,char,'Rillaboom','Flamethrower');
 const sunFire=estimateDamage(dex,char,'Rillaboom','Flamethrower',{weather:'SunnyDay'});
 assert.ok(sunFire.mid>fire.mid*1.45);
 const water=estimateDamage(dex,prim,'Charizard','Sparkling Aria');
 const sunWater=estimateDamage(dex,prim,'Charizard','Sparkling Aria',{weather:'SunnyDay'});
 assert.ok(sunWater.mid<water.mid*.56);
 const rilla=teams().C_rill_gholdengo_for_gengar.find(p=>p.species==='Rillaboom');
 const risk=incomingRisk(dex,rilla,'Charizard-Mega-Y');
 const sunRisk=incomingRisk(dex,rilla,'Charizard-Mega-Y',{weather:'SunnyDay'});
 assert.ok(sunRisk>risk);
});
test('real battle chooses both sides independently with no forced three',async()=>{
 const our=teams().C_rill_gholdengo_for_gengar,opp=opponents.psychic_terrain_singles;
 const g=await game(sim,our,opp,hashSeed(249921),true,null,false,
 {previewPolicy:'stochastic',candidateDecisionPolicy:'v3',opponentDecisionPolicy:'v2'});
 assert.equal(g.trace.errors.length,0);
 assert.equal(g.trace.selections.length,2);
 assert.equal(g.trace.selections[0].chosen.length,3);
 assert.equal(g.trace.selections[1].chosen.length,3);
});