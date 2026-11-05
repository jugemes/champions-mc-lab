'use strict';
// Preregistered PR #104 comment #6651669519: OPEN8 real Battle wiring smoke test.
// This is NOT a candidate adoption test or human ladder win rate.
const test=require('node:test'),assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {load,normalize,prelim,hashSeed,chooseThree}=require('../lab');
const {discover}=require('../m8-open6-universe-minimax-20261104');
const {groups}=require('../environment-m7-teams');
const {battle}=require('../encore-lead-audit');
const {evaluateEvidence}=require('../m8-open8-evidence-gate-20261105');
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
const ENGINE='3a766f2cfb5e51c1e428cfe87d0dba91a8f01640';
const foeBranches=[
 {id:'A',three:['Gyarados','Garchomp','Mimikyu']},
 {id:'B',three:['Mimikyu','Gholdengo','Corviknight']}
];
const seeds=[155501,155502];
const clone=x=>structuredClone(x);
test('OPEN8 evidence gate accepts 24 pinned real 3v3 battles with 3 leads and 2 enemy branches',{skip,timeout:240000},async t=>{
 const sim=load(),validator=sim.TeamValidator.get('gen9championsbssregmc');
 const team=discover(sim,{seed:1543,rounds:5,samples:90}).candidates[0].team;
 const foe=groups[8].team;
 prelim(team,'OPEN8 own');prelim(foe,'OPEN8 foe');
 assert.ok(!validator.validateTeam(normalize(team))?.length);
 assert.ok(!validator.validateTeam(normalize(foe))?.length);
 const publicSix=foe.map(x=>x.species),ownSix=team.map(x=>x.species);
 const selected=chooseThree(sim.Dex.mod('champions'),team,publicSix).map(i=>team[i-1].species);
 assert.equal(selected.length,3);
 assert.equal(new Set(selected).size,3);
 const manifest=[],records=[],rows=[];
 for(const lead of selected)for(const branch of foeBranches)for(const seed of seeds)for(const side of [0,1]){
  const three=[lead,...selected.filter(x=>x!==lead)];
  const id=['open8',lead,branch.id,seed,side].join('-');
  const m={id,three,lead,branch:branch.id,seed,side};manifest.push(m);
 }
 assert.equal(manifest.length,24);
 // No outcome is inspected until the full manifest is frozen above.
 for(const m of manifest){
  const b=foeBranches.find(x=>x.id===m.branch);
  const result=await battle(sim,clone(team),clone(foe),hashSeed(m.seed),{
   ownThree:m.three,foeThree:b.three,reverse:Boolean(m.side),script:null,
   rivalImmuneAware:true,choiceAudit:true
  });
  assert.equal(result.errors,0,m.id);
  const logDigest=crypto.createHash('sha256').update(result.log).digest('hex');
  records.push({...m,battleId:m.id,engineCommit:ENGINE,logDigest,result:result.won?'win':'loss'});
  rows.push({id:m.id,won:result.won,turns:result.turns,logDigest,
   foeFirstChoices:result.choiceTrace.filter(x=>x.side===result.foeSide&&x.requestKind==='normal').slice(0,2)});
 }
 const report=evaluateEvidence({ownSix,publicSix,branches:foeBranches,manifest,records});
 assert.equal(report.evidence.registered,24);
 assert.equal(report.evidence.received,24);
 assert.deepEqual(report.evidence.missing,[]);
 assert.equal(report.evidence.completeGroups,6);
 assert.equal(report.coverage.completeChoices,3);
 assert.ok(report.selected);
 t.diagnostic('M8_OPEN8_REAL_BATTLE_WIRING '+JSON.stringify({
  prereg:'PR104#6651669519',games:24,errors:0,
  chosenFromPublicSix:selected,selected:report.selected,
  coverage:report.coverage,evidence:report.evidence,rows,
  notHumanWinRate:true,notAdoptionEvidence:true,
  logDigestNotVerifiedAgainstCIArtifact:true,rivalPolicyNotCertifiedRational:true
 }));
});
