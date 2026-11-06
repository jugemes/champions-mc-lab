'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const cov = require('../m8-pokenavi-coverage-20261106');
const audit = require('../m8-pokenavi-claude-audit-20261106');

test('audit branches use only the public six and keep the PR selection fixed per public six', () => {
  const cases = Object.fromEntries(cov.opponents(true, true, true).map(c => [c.id, c]));
  const roster = new Set(cov.rosters().energy.map(member => member.species));
  for (const branch of audit.BRANCHES) {
    const visible = new Set(cases[branch.scenario].team.map(member => member.species));
    assert.equal(new Set(branch.three).size, 3, branch.id);
    assert.ok(branch.three.every(species => visible.has(species)), branch.id);
    const own = cov.readyPlans[branch.scenario];
    assert.ok(own.every(species => roster.has(species)), branch.id);
    const script = branch.rival(); // null = default rival AI (scarfChompLead)
    assert.ok(script === null || typeof script === 'function', branch.id);
  }
  for (const three of Object.values(audit.RAIN_SELECTIONS)) {
    if (three) assert.ok(three.every(species => roster.has(species)));
  }
});

// Minimal request: Primarina active, Skeledirge on the bench, gyarados public six.
function primarinaRequest() {
  return {
    side: { pokemon: [
      { active: true, details: 'Primarina, L50, M', condition: '150/200' },
      { active: false, details: 'Skeledirge, L50, M', condition: '200/200' },
    ] },
    active: [{ moves: ['moonblast', 'sparklingaria', 'energyball', 'encore'].map(id => ({ id, move: id, disabled: false })) }],
  };
}

test('PR #108 Mimikyu rules stop firing once the public log shows Mimikyu-Busted', () => {
  const info = { turn: 4, canSwitch: true, lockReason: null };
  const policy = (bot, variant = 'pr') => audit.ownScript(variant, 'gyarados')(primarinaRequest(), bot, info);
  assert.equal(policy({ foeActive: 'Mimikyu', foeStatus: '' }), 'switch 2');
  // The documented defect: after Disguise breaks the same rule is skipped.
  assert.notEqual(policy({ foeActive: 'Mimikyu-Busted', foeStatus: '' }), 'switch 2');
  // The post-hoc formFix diagnostic restores the intended rule without other aliases.
  assert.equal(policy({ foeActive: 'Mimikyu-Busted', foeStatus: '' }, 'formFix'), 'switch 2');
  assert.equal(audit.aliasBot({ foeActive: 'Garchomp-Mega-Z' }).foeActive, 'Garchomp-Mega-Z');
});
