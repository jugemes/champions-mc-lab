'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {previewChoices,parseMctsOutput,inspectPreview,runExperimentalProbe} = require('../oss-engine-mcts-probe');
const six = ['Metagross','Hydreigon','Primarina','Garchomp','Tyranitar','Rotom-Wash'];
const stdout = 'Total Iterations: 1000\nside one: metagross,hydreigon,primarina,50.00,200|rotomwash,metagross,garchomp,15.00,150|garchomp,metagross,rotomwash,-5.00,100\nside two: golisopod,garchomp,mimikyu,22.00,300\n';

test('BSS has exactly 60 unique unordered-bench + lead choices', () => {
  const p = previewChoices(six);
  assert.equal(p.length, 60);
  assert.equal(new Set(p.map(x => x.key)).size, 60);
  assert.equal(new Set(p.map(x => x.bench.concat([x.lead]).sort().join('/'))).size, 20);
});
test('parses last two comma-separated numeric fields, retaining preview triple', () => {
  const s = parseMctsOutput(stdout);
  assert.equal(s.totalIterations, 1000);
  assert.equal(s.entries[0].action, 'metagross,hydreigon,primarina');
  assert.equal(s.entries[0].meanScore, .25);
  assert.equal(s.entries[2].totalScore, -5);
});
test('returns only legal own public-six candidates and no win probability', () => {
  const s = inspectPreview(stdout, six, {requireAll60:false});
  assert.equal(s.status, 'UNVALIDATED_ENGINE_CANDIDATE');
  assert.equal(s.candidateCount, 3);
  assert.equal(s.ranked[0].lead, 'metagross');
  assert.deepEqual(s.ranked[0].bench, ['hydreigon','primarina']);
  assert.equal(Object.hasOwn(s.ranked[0], 'winProbability'), false);
});
test('rejects partial preview by default and unlisted/duplicated candidates', () => {
  assert.throws(() => inspectPreview(stdout, six), /3\/60/);
  assert.throws(() => inspectPreview('side one: charizard,garchomp,metagross,1,1',six,{requireAll60:false}),/Not one/);
  assert.throws(() => inspectPreview('side one: garchomp,garchomp,primarina,1,1',six,{requireAll60:false}),/Non-preview/);
  assert.throws(() => parseMctsOutput('side one: metagross,hydreigon,primarina,1,1|metagross,hydreigon,primarina,2,2'),/duplicate/);
});
test('strictly requires a public-hypothesis provenance and bounded budget', () => {
  assert.throws(() => runExperimentalProbe({binary:'/bin/echo',stateString:'data',ownSix:six}),/Refuse hidden/);
  assert.throws(() => runExperimentalProbe({binary:'/bin/echo',stateString:'data',ownSix:six,scenarioProvenance:'public-six-hypothesis',timeMs:10000}),/budget/);
});
test('parses actual-shaped complete 60-actions output', () => {
  const candidates = previewChoices(six).map((c,i)=> c.key + ',' + (60-i) + ',' + (i+1));
  const s = inspectPreview('Total Iterations: 1830\nside one: '+candidates.join('|'),six);
  assert.equal(s.candidateCount,60);
  assert.equal(s.totalIterations,1830);
  assert.equal(s.ranked[0].visits,60);
});
test('rejects duplicate bench permutations of the same 3-from-6 selection', () => {
  const output = 'side one: metagross,hydreigon,primarina,5,10|metagross,primarina,hydreigon,6,10';
  assert.throws(() => inspectPreview(output, six, {requireAll60: false}), /Duplicate selection/);
});
