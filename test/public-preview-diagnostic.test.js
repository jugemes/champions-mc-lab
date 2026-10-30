'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path');
const {reportedLive}=require('../reported-live-roster-20261027');
const {SCENARIOS,REFERENCE_OPEN_SIX_RECOMMENDATIONS,inspectPublicPreview,summarizePublicPreview}=require('../public-preview-diagnostic');
const {rankPreview}=require('../preview-policy');
const {matchup}=require('../lab');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
const dex=sim.Dex.mod('champions');
test('M7 A/B/C adversarial preview sees only rival public-six names (no hidden three or sets)',()=>{
  for(const [name,six] of Object.entries(SCENARIOS)){
    assert.equal(six.length,6,name);
    assert.equal(new Set(six).size,6,name);
    assert.ok(six.every(x=>typeof x==='string'),name);
    assert.deepEqual(Object.keys(REFERENCE_OPEN_SIX_RECOMMENDATIONS[name]).sort(),
      ['caveat','lead','selected'],name);
  }
});
test('each preview policy legally selects own three from M7 L and a lead within its three',()=>{
  const team=reportedLive(),own=new Set(team.map(x=>x.species));
  const x=inspectPublicPreview(dex,team);
  assert.deepEqual(Object.keys(x.scenarios),Object.keys(SCENARIOS));
  for(const [scenario,c] of Object.entries(x.scenarios)){
    for(const [policy,choice] of Object.entries(c.policies)){
      assert.equal(choice.selected.length,3,scenario+'/'+policy);
      assert.equal(new Set(choice.selected).size,3,scenario+'/'+policy);
      assert.ok(choice.selected.every(v=>own.has(v)),scenario+'/'+policy);
      assert.equal(choice.lead,choice.selected[0],scenario+'/'+policy);
      assert.ok(choice.selected.includes(choice.lead),scenario+'/'+policy);
      assert.equal(typeof choice.referenceMembersMatch,'boolean',scenario+'/'+policy);
      assert.equal(typeof choice.referenceLeadMatch,'boolean',scenario+'/'+policy);
    }
    assert.equal(c.topRaw.length,5);
    assert.equal(c.topStrategic.length,5);
    assert.ok(c.topRaw.every(v=>v.selected.length===3&&v.leadScores.length===3));
    assert.equal(rankPreview(dex,team,c.publicSix,matchup).length,20);
  }
});
test('same public six/known self team yields byte-identical diagnostic rankings with the same seeds',()=>{
  const a=inspectPublicPreview(dex),b=inspectPublicPreview(dex);
  assert.equal(JSON.stringify(a),JSON.stringify(b));
  console.log('M7 PUBLIC SIX PREVIEW DIAGNOSTIC (references are NOT known optima):\n'+summarizePublicPreview(dex));
});
