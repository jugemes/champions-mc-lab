'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { team, preview, scenarios } = require('../m8-pokenavi-aerodactyl-20261105');

test('the same public six fixes the same three and lead across Charizard stones', () => {
  const own = new Set(team().map(member => member.species));
  const visibleSix = new Map();
  const all = scenarios();
  const sun = all.find(scenario => scenario.id === 'sun');
  const charX = all.find(scenario => scenario.id === 'charX');
  const publicKey = scenario => scenario.team.map(member => member.species).sort().join('/');
  assert.equal(publicKey(sun), publicKey(charX));
  assert.notEqual(sun.team.find(member => member.species === 'Charizard').item,
    charX.team.find(member => member.species === 'Charizard').item);

  for (const scenario of all) {
    const chosen = preview[scenario.id];
    assert.equal(chosen.length, 3);
    assert.equal(new Set(chosen).size, 3);
    assert.ok(chosen.every(species => own.has(species)), scenario.id);
    const key = publicKey(scenario);
    if (visibleSix.has(key)) assert.deepEqual(chosen, visibleSix.get(key), scenario.id);
    visibleSix.set(key, chosen);
  }
});
