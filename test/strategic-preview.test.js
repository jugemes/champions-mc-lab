'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path');
const {rankStrategicPreview,chooseStrategicPreview}=require('../preview-strategic');
const {choosePreview,seededRandom}=require('../preview-policy');
const {opponents}=require('../threat-scenarios-20261014');
const {teams}=require('../cycle3-teams');
const {matchup,hashSeed}=require('../lab');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
const dex=sim.Dex.mod('champions');
test('public Charizard threat changes three-selection ranking for E without inspecting hidden moves',()=>{
 const e=teams().E_ee_primarina_for_skeledirge;
 const publicSix=opponents.sun_charizard_y.map(p=>p.species);
 const a=rankStrategicPreview(dex,e,publicSix,matchup);
 assert.equal(a.length,20);
 const tampered=opponents.sun_charizard_y.map(p=>({...p,moves:['Splash'],item:'Leftovers'}));
 assert.deepEqual(a,rankStrategicPreview(dex,e,tampered.map(p=>p.species),matchup));
});
test('strategic preview can choose a Psychic Surge setter and remains seed reproducible',()=>{
 const enemy=opponents.psychic_terrain_credible;
 const publicSix=teams().C_rill_gholdengo_for_gengar.map(p=>p.species);
 let setter=0;
 for(let i=0;i<100;i++){
  const seed=hashSeed(1010+i);
  const one=chooseStrategicPreview(dex,enemy,publicSix,seededRandom(seed),matchup);
  const two=chooseStrategicPreview(dex,enemy,publicSix,seededRandom(seed),matchup);
  assert.deepEqual(one,two);
  assert.equal(new Set(one).size,3);
  setter+=Number(one.some(x=>enemy[x-1].species==='Indeedee'));
 }
 assert.ok(setter>=10,'opposing AI must actually examine Psychic Surge win conditions');
});