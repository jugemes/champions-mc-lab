'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { build, select, play, fixtures } = require('../m8-pokenavi-rework-20261106');
const { opponents } = require('../m8-pokenavi-coverage-20261106');

test('reworked choices stay within the six and use one preview plan for both Charizard stones', () => {
  for (const id of ['original', 'adjusted', 'goodra', 'goodraGuard', 'goodraFinal', 'charRain']) {
    const team = build(id);
    const own = new Set(team.map(member => member.species));
    const publicPlans = new Map();
    for (const c of opponents(true, true, true)) {
      const key = c.team.map(member => member.species).sort().join('/');
      const three = select(id, c.id);
      assert.equal(new Set(three).size, 3);
      assert.ok(three.every(species => own.has(species)), `${id}/${c.id}`);
      if (id === 'charRain') {
        assert.ok(three.filter(species => ['Charizard', 'Golisopod'].includes(species)).length <= 1);
      }
      if (publicPlans.has(key)) assert.deepEqual(three, publicPlans.get(key));
      publicPlans.set(key, three);
    }
  }
});

test('the rain plan selects Charizard and avoids charging Solar Beam under renewed rain', () => {
  assert.deepEqual(select('charRain', 'rain'), ['Meowscarada', 'Gholdengo', 'Charizard']);
  const request = {
    active: [{ canMegaEvo: 'Charizard-Mega-Y', moves: [{ id: 'solarbeam' }, { id: 'flamethrower' }] }],
    side: { pokemon: [{ active: true, details: 'Charizard, L50' }] },
  };
  const bot = { foeActive: 'Swampert-Mega', weather: 'raindance' };
  const info = { canSwitch: false, turn: 2 };
  assert.equal(play('charRain', 'rain', request, bot, info), 'move 1 mega');
  request.active[0].canMegaEvo = undefined;
  request.side.pokemon[0].details = 'Charizard-Mega-Y, L50';
  assert.equal(play('charRain', 'rain', request, bot, info), 'move 2');
});

test('the mixed plan preserves Skeledirge against a later Dragonite until physical moves are revealed', () => {
  const [lead, goodra, skeledirge] = select('goodraFinal', 'mixed');
  const request = { side: { pokemon: [lead, goodra, skeledirge].map((species, index) => ({
    active: index === 0, details: `${species}, L50`, condition: '100/100',
  })) } };
  const bot = { foeActive: 'Dragonite-Mega', lastMove: '', seenMoves: {} };
  assert.equal(play('goodraFinal', 'mixed', request, bot, { canSwitch: true, turn: 1 }), 'switch 3');
  assert.equal(play('goodraFinal', 'mixed', request, bot, { canSwitch: true, turn: 3 }), 'switch 2');
  bot.seenMoves[bot.foeActive] = ['Fire Punch'];
  assert.equal(play('goodraFinal', 'mixed', request, bot, { canSwitch: true, turn: 3 }), 'switch 3');
});

test('the rival double pivot reacts to either revealed bulky switch-in', () => {
  const audit = { BRANCHES: [{ scenario: 'gyarados', id: 'gyaraChompThenMimikyu' }],
    rival: { switchT1: () => () => null } };
  const fixture = fixtures(audit).find(c => c.id === 'gyarados');
  const branch = fixture.branches.find(b => b.id === 'gyaraChompThenMimikyu');
  const request = { side: { pokemon: [
    { active: true, details: 'Garchomp-Mega-Z, L50', condition: '100/100' },
    { active: false, details: 'Mimikyu, L50', condition: '100/100' },
  ] } };
  const goodra = build('goodra').find(member => member.species.startsWith('Goodra'));
  for (const foeActive of ['Primarina', goodra.species]) {
    const events = [];
    const play = branch.makePolicy(events);
    assert.equal(play(request, { foeActive: 'Gholdengo' }, { canSwitch: true, turn: 3 }), null);
    assert.equal(play(request, { foeActive }, { canSwitch: true, turn: 4 }), 'switch 2');
    assert.deepEqual(events, [{ turn: 4, facing: foeActive, switchTo: 'Mimikyu' }]);
    assert.equal(play(request, { foeActive }, { canSwitch: true, turn: 5 }), null);
  }
});
