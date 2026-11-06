'use strict';
// POST OPEN8, result-before-OPEN9 registration in docs/M8-OPEN9-PROTOCOL-2026-11-05.md.
// O2 had no zero branch in the primary table but failed the actual-E public
// six and Golisopod/Last-Respects diagnostics. A weather/dark bridge is a
// hypothesis, not a proven fix. Do not modify the user's live six.
const {builders}=require('./m8-open1-20261104');
const {reportedLive}=require('./reported-live-roster-20261027');
const {study}=require('./m8-open8-battle-study-20261105');
function candidates(){
 const o2=builders.O2_megaMetagross_unaware();
 const o8=o2.map(p=>p.species==='Gholdengo'?structuredClone(reportedLive().find(p=>p.species==='Tyranitar')):p);
 return {O2_control:o2,O8_sand_bridge:o8};
}
function diagnosticCases(){
 return require('./m8-open8-gimmick-diagnostics-20261105').scenarios().map(c=>({id:c.id,team:c.team,
  branches:c.threes.map((three,i)=>({id:'diagnostic_'+i,three,policy:'ai',openingMove:c.move}))}));
}
if(require.main===module){
 const diagnostic=process.argv.includes('--diagnostic-selection');
 study({teams:candidates(),...(diagnostic?{scenarios:diagnosticCases()}:{}),seedOffset:diagnostic?1200000:600000,
 out:diagnostic?'output/m8-open9-diagnostic-selection-20261105.json':'output/m8-open9-sand-bridge-20261105.json'}).catch(e=>{console.error(e.stack);process.exitCode=1;});
}
module.exports={candidates};
