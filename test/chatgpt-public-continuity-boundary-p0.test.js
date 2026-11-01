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

test('public continuity: active Mega is not a hypothetical bench switch',{skip},()=>{
 const sim=load(),dex=sim.Dex.mod('champions');
 const own=reportedLive().find(x=>x.species==='Garchomp');
 const options=own.moves.map((move,i)=>({move,i}));
 // Two unrelated legal Mega species: the exclusion must be generic.
 for(const base of ['Salamence','Swampert']){
   const mega=base+'-Mega';
   assert.equal(dex.species.get(mega).baseSpecies,base);
   const six=[base,'Toxapex','Rotom-Wash','Gholdengo','Skarmory','Dragonite'];
   const rows=moveRows(dex,own,mega,six,options);
   // Internal test oracle only: replacing the base label by the already-active
   // form must not change the five eligible bench species or move scores.
   // This is NOT a second legal public-six fixture.
   const oracle=moveRows(dex,own,mega,[mega,...six.slice(1)],options);
   assert.deepEqual(rows.map(x=>({move:x.move,meanSwitch:x.meanSwitch,
     worstSwitch:x.worstSwitch,score:x.score})),
     oracle.map(x=>({move:x.move,meanSwitch:x.meanSwitch,
       worstSwitch:x.worstSwitch,score:x.score})),base);
   assert.ok(rows.every(x=>!x.immuneSwitches.includes(base)),
     'active '+mega+' cannot be an additional opposing bench Pokemon');
 }
});
