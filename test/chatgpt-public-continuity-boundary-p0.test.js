'use strict';
// Public six screening boundaries, no hidden opponent set information.
// Supports the preregistered #104 continuity holdout; not a win-rate test.
const test=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('../lab');
const {reportedLive}=require('../reported-live-roster-20261027');
const {moveRows,chooseContinuityPreview}=require('../public-continuity-preview');
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';

test('public continuity: scarf lock respects known Levitate/Flying immunities, not hidden Air Balloon',{skip},()=>{
 const sim=load(),dex=sim.Dex.mod('champions');
 const own=reportedLive().find(x=>x.species==='Garchomp');
 assert.equal(own.item,'Choice Scarf');
 const publicSix=['Toxapex','Rotom-Wash','Dragonite','Pelipper','Gholdengo','Swampert'];
 const options=own.moves.map((move,i)=>({move,i}));
 const rows=moveRows(dex,own,'Toxapex',publicSix,options);
 const quake=rows.find(x=>x.move==='Earthquake');
 assert.ok(quake,'known Garchomp Earthquake');
 for(const name of ['Rotom-Wash','Dragonite','Pelipper'])
   assert.ok(quake.immuneSwitches.includes(name),'public immunity '+name);
 assert.ok(!quake.immuneSwitches.includes('Gholdengo'),
   'do not infer unrevealed Air Balloon from the fixture');
 assert.ok(rows.every(x=>Number.isFinite(x.score)));
});
test('public continuity rejects hidden opposing set objects at team preview',{skip},()=>{
 const sim=load(),dex=sim.Dex.mod('champions'),own=reportedLive();
 const six=['Pelipper','Salamence','Toxapex','Skeledirge','Rillaboom','Skarmory'];
 assert.equal(chooseContinuityPreview(dex,own,six).selection.length,3);
 assert.throws(()=>chooseContinuityPreview(dex,own,
   six.map((s,i)=>i===0?{species:s,item:'Focus Sash',moves:['Hurricane']}:s)),
   /public species six/);
});
