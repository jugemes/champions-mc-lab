'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {teams}=require('../cycle2-teams');
const {prelim,normalize}=require('../lab');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
test('all nine iteration candidates legal',()=>{
 const variants=teams(),v=sim.TeamValidator.get('gen9championsbssregmc');
 assert.equal(Object.keys(variants).length,9);
 for(const [name,team] of Object.entries(variants)){
  assert.doesNotThrow(()=>prelim(team,name));
  assert.ok(!v.validateTeam(normalize(team)),name);
 }
});
