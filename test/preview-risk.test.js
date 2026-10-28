'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
const dex=sim.Dex.mod('champions');
const validator=sim.TeamValidator.get('gen9championsbssregmc');
const {reportedLive}=require('../reported-live-roster-20261027');
const {opponents}=require('../threat-scenarios-20261014');
const {speedOutlook}=require('../public-risk-bands');
const {rankRationalPreview,chooseRationalPreview}=require('../preview-rational');
const {PROBES,previewThreat,rankRationalRisk,chooseRationalRiskPreview,comparePreviewDistributions}=require('../preview-risk');
const {seededRandom}=require('../preview-policy');
const {game,hashSeed}=require('../lab');
const live=reportedLive();
const caseB=['Indeedee','Hippowdon','Garchomp','Umbreon','Gengar','Gyarados'];

test('known own Choice Scarf raises own effective speed (a previous P0-B1 oversight)',()=>{
 const chomp=live.find(x=>x.species==='Garchomp');
 const vs=speedOutlook(dex,chomp,'Charizard');
 assert.equal(vs.ownSpeed,253);
 assert.equal(vs.normalOutlook.alwaysSlowerThanUs,true);
 assert.equal(vs.scarfOutlook.alwaysSlowerThanUs,true); // Charizard scarf max 250
});
test('Scarf-only Indeedee coverage is flagged as a *hypothetical* danger to live Hydreigon',()=>{
 const hyd=live.find(x=>x.species==='Hydreigon'),meta=live.find(x=>x.species==='Metagross');
 const a=previewThreat(dex,hyd,'Indeedee',validator,{mega:false});
 const b=previewThreat(dex,meta,'Indeedee',validator,{mega:true});
 assert.ok(a.upper>=1&&a.baseline<1);
 assert.equal(a.normalCanLead,false);
 assert.equal(a.scarfCanLead,true);
 assert.ok(a.consideredMoves.includes('Dazzling Gleam'));
 assert.ok(a.penalty>0);
 assert.ok(b.penalty<a.penalty,'Mega-Metagross resists Fairy coverage');
});
test('own Mega-Y must consider a possible public Scarf Garchomp Rock Slide counter',()=>{
 const cz=opponents.sun_charizard_y.find(x=>x.species==='Charizard');
 const danger=previewThreat(dex,cz,'Garchomp',validator);
 assert.ok(danger.consideredMoves.includes('Rock Slide'));
 assert.ok(danger.upper>danger.baseline);
 assert.equal(danger.normalCanLead,true, 'Garchomp itself can outspeed Charizard-Y at max speed');
 assert.ok(danger.penalty>0);
});
test('with no coverage probes, rational-risk rank and chosen trio/lead are exactly historical',()=>{
 const empty={probes:{}};
 const old=rankRationalPreview(dex,live,caseB);
 const next=rankRationalRisk(dex,live,caseB,validator,empty);
 assert.deepEqual(next.map(x=>[x.three,x.score,x.leads.map(l=>[l.i,l.score])]),
   old.map(x=>[x.three,x.score,x.leads.map(l=>[l.i,l.score])]));
 for(let i=0;i<12;i++){
   const s=hashSeed(900+i);
   assert.deepEqual(chooseRationalRiskPreview(dex,live,caseB,seededRandom(s),validator,empty),
     chooseRationalPreview(dex,live,caseB,seededRandom(s)));
 }
});
test('risk version lowers Hydreigon lead preference for the exact real-B public six',()=>{
 const cmp=comparePreviewDistributions(dex,live,caseB,validator);
 const hyd=cmp.old.lead.Hydreigon;
 const risk=cmp.risk.lead.Hydreigon;
 assert.ok(risk<=hyd+1e-9,'risk policy should not increase the unsafe lead probability');
 const oldRank=rankRationalPreview(dex,live,caseB);
 const newRank=rankRationalRisk(dex,live,caseB,validator);
 const trio=oldRank.find(c=>c.three.includes(1));
 const modified=newRank.find(c=>c.three.join()==trio.three.join());
 const before=trio.leads.find(l=>l.i===1),after=modified.leads.find(l=>l.i===1);
 assert.ok(after.riskAdjustment>0&&after.score<before.score);
 assert.ok(after.mostDangerous.some(x=>x.foe==='Indeedee'));
});
test('scarf/coverage response relies solely on public opposing species, not their private set',()=>{
 const fake=opponents.psychic_terrain_singles;
 const names=fake.map(p=>p.species);
 const changed=fake.map(p=>({...p,item:'Choice Scarf',moves:['Splash']}));
 const a=rankRationalRisk(dex,live,names,validator);
 const b=rankRationalRisk(dex,live,changed.map(p=>p.species),validator);
 assert.deepEqual(a,b);
 assert.ok(PROBES.Indeedee.includes('Dazzling Gleam'));
});
test('same-seed real engine accepts explicit rational-risk policy and produces legal three',async()=>{
 const foe=opponents.psychic_terrain_singles;
 const g=await game(sim,live,foe,hashSeed(451),false,null,false,{
   candidatePreviewPolicy:'rational-risk',opponentPreviewPolicy:'rational',
   previewPolicy:'rational',decisionPolicy:'v2',megaAware:true});
 assert.equal(g.trace.selections.find(s=>s.side==='p1').chosen.length,3);
 assert.equal(g.trace.errors.length,0);
});
