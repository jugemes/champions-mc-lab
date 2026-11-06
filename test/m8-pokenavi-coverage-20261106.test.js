'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { rosters, opponents, readyPlans } = require('../m8-pokenavi-coverage-20261106');

test('each candidate plan fixes a legal selection shape using the visible species only', () => {
  const roster = new Set(rosters().energy.map(member => member.species));
  const byPublicSix = new Map();
  for (const scenario of opponents(true, true, true)) {
    const selection = readyPlans[scenario.id];
    assert.equal(selection.length, 3, scenario.id);
    assert.equal(new Set(selection).size, 3, scenario.id);
    assert.ok(selection.every(species => roster.has(species)), scenario.id);
    const publicSix = scenario.team.map(member => member.species).sort().join('/');
    if (byPublicSix.has(publicSix)) assert.deepEqual(byPublicSix.get(publicSix), selection, scenario.id);
    byPublicSix.set(publicSix, selection);
  }
  assert.deepEqual(readyPlans.charX, readyPlans.sun);
});
