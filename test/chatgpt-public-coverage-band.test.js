'use strict';
// This is a diagnostic for public-six risk, NOT a ladder policy or win-rate claim.
// All rival sets are legality hypotheses. No hidden opposing three or actual set.
const test=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('../lab');
const {reportedLive}=require('../reported-live-roster-20261027');
const {incomingRisk}=require('../damage');
const {candidates,publicCoverageBand,upperHit}=require('../public-coverage-band');
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';

test('public six: legal Fairy coverage and possible Scarf speed expose Hydreigon lead risk',{skip},t=>{
  const sim=load(),dex=sim.Dex.mod('champions');
  const own=reportedLive().find(p=>p.species==='Hydreigon');
  const band=publicCoverageBand(sim,own,'Indeedee');
  const fairy=band.coverage.find(m=>m.move==='Dazzling Gleam');
  assert.ok(fairy,'Dazzling Gleam must be legal in a coherent four-move M-C set');
  assert.ok(fairy.upperRatio>=1,'possible Fairy attack can KO: '+JSON.stringify(fairy));
  assert.ok(incomingRisk(dex,own,'Indeedee',{})<1,'old STAB-only baseline misses the threat');
  assert.equal(band.ownSpeed,165);
  assert.equal(band.speed.scarfPossible,true);
  assert.ok(band.speed.scarfMax>band.ownSpeed);
  t.diagnostic('PUBLIC COVERAGE B: '+JSON.stringify({fairy,old:incomingRisk(dex,own,'Indeedee',{}),speed:band.speed}));
});
test('public six: known Levitate prevents Ground coverage false positive',{skip},()=>{
  const sim=load(),dex=sim.Dex.mod('champions');
  const own=reportedLive().find(p=>p.species==='Rotom-Wash');
  const legal=candidates(sim,'Garchomp').legal;
  const ground=legal.find(x=>x.type==='Ground'&&x.move==='Earthquake');
  assert.ok(ground,'legal Ground move exists in the public Garchomp hypothesis pool');
  assert.equal(upperHit(dex,own,ground.form,ground),0,'known Levitate must not be scored as a hit');
});
test('public six: distinct weather/physical archetype can be evaluated without rival private sets',{skip},t=>{
  const sim=load(),own=reportedLive();
  const pairs=[['Metagross','Charizard'],['Primarina','Lucario'],['Tyranitar','Gyarados']];
  const rows=pairs.map(([ours,foe])=>{
    const band=publicCoverageBand(sim,own.find(p=>p.species===ours),foe);
    assert.ok(band.coverage.length>0,foe+' must have legal attacking candidates');
    assert.ok(band.coverage.every(x=>Number.isFinite(x.upperRatio)));
    return {ours,foe,top:band.coverage.slice(0,2),speed:band.speed};
  });
  t.diagnostic('PUBLIC COVERAGE CROSS ARCHETYPE '+JSON.stringify(rows));
});

test('pinned full Battle: opt-in public coverage preview versus legacy across distinct public sixes',{skip},async t=>{
  const {chooseThree,matchup,hashSeed}=require('../lab');
  const {rankPreview}=require('../preview-policy');
  const {choosePublicCoveragePreview}=require('../public-coverage-preview');
  const {caseList}=require('../legal-search-v2-compare');
  const {battle}=require('../legal-search-compare');
  const sim=load(),dex=sim.Dex.mod('champions'),own=reportedLive();
  // The HOLD case is an EXISTING regression holdout, not newly unseen.
  const ids=['A_golisopod','B_lucarioZ','C_charizardY',
    'Real_indeedee_scarf','HOLD_sun_balance'];
  const rows=[];
  for(const id of ids){
    const c=caseList().find(x=>x.id===id);
    assert.ok(c&&c.forcedA&&c.forcedB,'legal two-branch case '+id);
    const six=c.team.map(x=>x.species);
    const old=chooseThree(dex,own,six).map(i=>own[i-1].species);
    const result=choosePublicCoveragePreview(sim,own,six,matchup);
    const fresh=result.selection.map(i=>own[i-1].species);
    // Three-arm causal control: the proposed policy starts from rankPreview(),
    // whereas legacy chooseThree() uses a DIFFERENT formula and lead ranking.
    // Isolate the effect of the public-coverage penalty before attributing
    // a win/loss change to coverage. Same rival three/seed/side in all arms.
    const unpenalized=rankPreview(dex,own,six,matchup)[0];
    const controlLead=unpenalized.leads[0].i;
    const controlRest=unpenalized.three.filter(i=>i!==controlLead).sort((a,b)=>{
      const sa=unpenalized.leads.find(x=>x.i===a).score;
      const sb=unpenalized.leads.find(x=>x.i===b).score;
      return sb-sa||a-b;
    });
    const control=[controlLead,...controlRest].map(i=>own[i].species);
    const rec={id,publicSix:six,legacy:old,unpenalized:control,proposed:fresh,
      oldWins:0,controlWins:0,newWins:0,oldFoeTagged:0,controlFoeTagged:0,newFoeTagged:0,
      oldOwnTagged:0,controlOwnTagged:0,newOwnTagged:0,
      oldToControlFlips:0,controlToNewFlips:0,winFlips:0,errors:0};
    for(const foeThree of [c.forcedA,c.forcedB]){
      for(const n of [0,1])for(const reverse of [false,true]){
        const seed=hashSeed(10402000+c.gi*100+n);
        const run=three=>battle(sim,structuredClone(own),structuredClone(c.team),seed,
          {ownForced:three,foeForced:foeThree,reverse});
        const a=await run(old),controlGame=await run(control),b=await run(fresh);
        rec.oldWins+=+a.won;rec.controlWins+=+controlGame.won;rec.newWins+=+b.won;
        rec.oldToControlFlips+=+(a.won!==controlGame.won);
        rec.controlToNewFlips+=+(controlGame.won!==b.won);
        rec.winFlips+=+(a.won!==b.won);
        rec.oldFoeTagged+=+Object.values(a.foeMisplay).some(Boolean);
        rec.controlFoeTagged+=+Object.values(controlGame.foeMisplay).some(Boolean);
        rec.newFoeTagged+=+Object.values(b.foeMisplay).some(Boolean);
        rec.oldOwnTagged+=+Object.values(a.ownMisplay).some(Boolean);
        rec.controlOwnTagged+=+Object.values(controlGame.ownMisplay).some(Boolean);
        rec.newOwnTagged+=+Object.values(b.ownMisplay).some(Boolean);
        rec.errors+=a.errors+controlGame.errors+b.errors;
      }
    }
    assert.equal(rec.errors,0,'all actual Showdown choices must be legal: '+id);
    rows.push(rec);
  }
  t.diagnostic('PUBLIC COVERAGE PAIRED FULL BATTLE '+JSON.stringify(rows));
});
