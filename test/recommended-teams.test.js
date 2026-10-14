'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {currentTeams}=require('../recommended-teams');
const {teams}=require('../cycle3-teams');
const {prelim,normalize}=require('../lab');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
test('ladder trial E uses Psychic, preserved historical E still uses Trick',()=>{
 const r=currentTeams();
 assert.deepEqual(Object.keys(r),['C_final','E_final']);
 const e=r.E_final.find(p=>p.species==='Starmie');
 assert.deepEqual(e.moves,['Ice Beam','Hydro Pump','Grass Knot','Psychic']);
 const original=teams().E_ee_primarina_for_skeledirge.find(p=>p.species==='Starmie');
 assert.ok(original.moves.includes('Trick'));
 assert.equal(e.moves.includes('Trick'),false);
 assert.equal(r.C_final.find(p=>p.species==='Garchomp').moves.join('/'),
   'Earthquake/Dragon Claw/Rock Slide/Poison Jab');
});
test('both updated ladder-trial rosters remain exact legal M-C',()=>{
 const v=sim.TeamValidator.get('gen9championsbssregmc');
 for(const [name,team]of Object.entries(currentTeams())){
  assert.doesNotThrow(()=>prelim(team,name));
  assert.ok(!v.validateTeam(normalize(team)),name);
 }
});