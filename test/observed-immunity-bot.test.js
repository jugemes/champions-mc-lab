'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {Bot,load}=require('../lab');
const {reportedLive}=require('../reported-live-roster-20261027');
const {groups}=require('../environment-m7-teams');
const sim=load(),dex=sim.Dex.mod('champions'),own=reportedLive();
const foe=groups.find(g=>g.name==='07_M7_baxcalibur_offense').team;
const trace=()=>({choices:[],selections:[],errors:[],immuneObservations:[]});
function fakeStream(lines){
 return {async *[Symbol.asyncIterator](){yield lines;},write:async()=>{}};
}
test('real public Thermal Exchange immunity teaches Rotom Bot not to repeat Will-O-Wisp',async()=>{
 const log='|switch|p2a: Baxcalibur|Baxcalibur, L50|192/192\n'+
  '|turn|6\n|move|p1a: Rotom|Will-O-Wisp|p2a: Baxcalibur\n'+
  '|-immune|p2a: Baxcalibur|[from] ability: Thermal Exchange\n';
 const t=trace(),b=new Bot(fakeStream(log),dex,own,'p1',t,null,null,
   {decisionPolicy:'v3-public-immunity'});
 await b.run();
 assert.equal(b.knownImmuneMoves.Baxcalibur.has('willowisp'),true);
 assert.equal(t.immuneObservations.length,1);
 const rotom=own.find(x=>x.species==='Rotom-Wash');
 const choice=b.decide({side:{pokemon:own.map(p=>({
   active:p.species==='Rotom-Wash',details:p.species+', L50',condition:'157/157'
 }))},active:[{moves:rotom.moves.map(m=>({id:m.toLowerCase().replace(/[^a-z0-9]/g,''),
   move:m,pp:8,disabled:false})),canMegaEvo:false}]});
 assert.match(choice,/^move [1-3]$/,'cannot recommend Will-O-Wisp again after confirmed immunity');
});
test('opponent Bot learns observed Levitate Ground immunity from public logs, not private set',async()=>{
 const log='|switch|p1a: Rotom|Rotom-Wash, L50|157/157\n'+
  '|turn|6\n|move|p2a: Baxcalibur|Earthquake|p1a: Rotom\n'+
  '|-immune|p1a: Rotom|[from] ability: Levitate\n';
 const t=trace(),b=new Bot(fakeStream(log),dex,foe,'p2',t,null,null,
   {decisionPolicy:'v3-public-immunity'});
 await b.run();
 assert.equal(b.knownImmuneMoves['Rotom-Wash'].has('earthquake'),true);
 assert.equal(t.immuneObservations.length,1);
});
test('a plain miss never creates learned immunity; base v3 does not silently change policy',async()=>{
 const log='|switch|p2a: Baxcalibur|Baxcalibur, L50|192/192\n'+
  '|turn|6\n|move|p1a: Rotom|Will-O-Wisp|p2a: Baxcalibur|[miss]\n';
 const t=trace(),b=new Bot(fakeStream(log),dex,own,'p1',t,null,null,
   {decisionPolicy:'v3-public-immunity'});
 await b.run();
 assert.equal(b.knownImmuneMoves.Baxcalibur,undefined);
 const baseline=new Bot(fakeStream(log),dex,own,'p1',trace(),null,null,
   {decisionPolicy:'v3'});
 await baseline.run();
 assert.equal(baseline.publicImmunityAware,false);
 assert.equal(baseline.knownImmuneMoves.Baxcalibur,undefined);
});
// Claude independent audit (PR #30): a confirmed immunity is only valid while the
// public cause persists. Each log below publicly ends that cause, so the learned
// ban on the move must be released instead of staying -1e6 for the whole game.
const sit='|switch|p1a: Rotom|Rotom-Wash, L50|157/157\n|switch|p2a: Baxcalibur|Baxcalibur, L50|192/192\n'+
  '|turn|6\n|move|p1a: Rotom|Thunderbolt|p2a: Baxcalibur\n|-immune|p2a: Baxcalibur\n';
for(const [name,release] of [
  ['Air Balloon popping','|-enditem|p2a: Baxcalibur|Air Balloon\n'],
  ['Magnet Rise ending','|-end|p2a: Baxcalibur|Magnet Rise\n'],
  ['Smack Down grounding','|-start|p2a: Baxcalibur|Smack Down\n'],
  ['Gravity starting','|-fieldstart|move: Gravity\n'],
])test('learned immunity is released after public '+name,async()=>{
  const t=trace(),b=new Bot(fakeStream(sit+release),dex,own,'p1',t,null,null,
    {decisionPolicy:'v3-public-immunity'});
  await b.run();
  assert.equal(b.knownImmuneMoves.Baxcalibur?.has('thunderbolt')||false,false);
});
