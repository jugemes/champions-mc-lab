'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdirSync, writeFileSync } = require('node:fs');
const { load, normalize, hashSeed } = require('./lab');
const { validate, PIN } = require('./m8-open8-battle-study-20261105');
const { battle } = require('./encore-lead-audit');
const rw = require('./m8-pokenavi-rework-20261106');

const format = 'gen9championsbssregmc';
const original = rw.build('charRain');
const goodra = original.find(set => set.species.startsWith('Goodra')).species;
const alternatives = {
  charH10: ['Charizard', { hp: 10, spa: 24, spe: 32 }],
  charModest: ['Charizard', { hp: 8, spa: 26, spe: 32 }, 'Modest'],
  gholdH5: ['Gholdengo', { hp: 5, spa: 29, spe: 32 }],
  gholdH6: ['Gholdengo', { hp: 6, spa: 28, spe: 32 }],
  gholdTimid: ['Gholdengo', { hp: 2, spa: 32, spe: 32 }, 'Timid'],
  goliD3: ['Golisopod', { hp: 32, atk: 31, spd: 3 }],
  goliD6: ['Golisopod', { hp: 32, atk: 28, spd: 6 }],
  dirgeD5: ['Skeledirge', { hp: 29, def: 32, spd: 5 }],
  meowH3: ['Meowscarada', { hp: 3, atk: 31, spe: 32 }],
  meowH6: ['Meowscarada', { hp: 6, atk: 28, spe: 32 }],
  goodraD8: [goodra, { hp: 32, spa: 26, spd: 8 }],
  goodraQuiet: [goodra, { hp: 32, spa: 26, spd: 8 }, 'Quiet'],
  goodraS3: [goodra, { hp: 32, spa: 31, spe: 3 }],
  goodraS3D1: [goodra, { hp: 32, spa: 30, spd: 1, spe: 3 }],
  goodraS3Bulk: [goodra, { hp: 31, spa: 30, spd: 2, spe: 3 }],
};

const spread = (set, evs, nature = set.nature) => ({ ...set, evs, nature });
const own = species => original.find(set => set.species === species);

function pinnedEngine() {
  const sha = execFileSync('git', ['-C', process.env.SHOWDOWN_DIR, 'rev-parse', 'HEAD'],
    { encoding: 'utf8' }).trim();
  if (sha !== PIN) throw new Error(`Unexpected Showdown commit ${sha}`);
  return load();
}

function bench(audit) {
  const sim = pinnedEngine();
  const cases = rw.fixtures(audit, true, true, true);
  const foe = (id, species) => cases.find(c => c.id === id).team.find(set => set.species === species);
  const mirror = { ...own('Gholdengo'), nature: 'Timid' };
  const swamp = spread(foe('rain', 'Swampert'), { hp: 32, spd: 32, spe: 2 }, 'Careful');
  const dragonite = foe('mixed', 'Dragonite');
  const physicalDragonite = spread(dragonite, { hp: 2, atk: 32, spe: 32 }, 'Adamant');
  const garchomp = foe('mixed', 'Garchomp');
  const greninja = { ...foe('mixed', 'Greninja'), item: 'Greninjite' };
  const archaludon = foe('rain', 'Archaludon');
  const primarina = foe('mixed', 'Primarina');
  const heat = { ownMega: true, weather: 'sunnyday' };
  const megas = { ownMega: true, rivalMega: true };
  const incoming = { incoming: true };
  const grass = { protean: true };
  const hits = (a, b, move, opts) => damageRolls(sim, a, b, move, opts);
  const report = (id, ...args) => {
    const result = hits(...args);
    console.log(id, JSON.stringify(result));
    return result;
  };

  for (const [id, hp, spa] of [['live', 2, 32], ['c23', 11, 23], ['c24', 10, 24]]) {
    const zard = spread(own('Charizard'), { hp, spa, spe: 32 });
    report(`char-${id}-solar`, zard, swamp, 'Solar Beam', { ...heat, rivalMega: true });
    report(`char-${id}-flame`, zard, archaludon, 'Flamethrower', heat);
    const chip = hits(own('Meowscarada'), archaludon, 'U-turn', grass).min;
    report(`char-${id}-flame-after-uturn`, zard, archaludon, 'Flamethrower', { ...heat, chip });
  }
  for (const [id, hp, spa, nature] of [
    ['live', 2, 32, 'Modest'], ['c27', 7, 27, 'Modest'], ['h5', 5, 29, 'Modest'],
    ['h6', 6, 28, 'Modest'], ['timid', 2, 32, 'Timid'],
  ]) {
    const ghold = spread(own('Gholdengo'), { hp, spa, spe: 32 }, nature);
    report(`ghold-${id}-mirror`, ghold, mirror, 'Shadow Ball');
    report(`ghold-${id}-bulky-mirror`, ghold, spread(mirror, { hp: 6, spa: 28, spe: 32 }), 'Shadow Ball');
    report(`ghold-${id}-mimikyu`, ghold, foe('mence', 'Mimikyu'), 'Shadow Claw', incoming);
  }
  for (const atk of [0, 31, 32]) {
    const goli = spread(own('Golisopod'), { hp: 32, atk, spd: Math.min(32, 34 - atk), def: Math.max(0, 2 - atk) });
    report(`goli-a${atk}-greninja`, goli, greninja, 'First Impression', megas);
    report(`goli-a${atk}-garchomp`, goli, garchomp, 'First Impression', { ownMega: true });
  }
  const dirge = own('Skeledirge');
  const fromDragon = { ...incoming, rivalMega: true, attackBoost: 1 };
  const boosted = report('dirge-mega-dnite-eq', dirge, physicalDragonite, 'Earthquake', fromDragon);
  assert.deepEqual(boosted, hits(dirge, physicalDragonite, 'Earthquake', { ...fromDragon, attackBoost: 0 }));
  for (const def of [31, 32]) {
    const s = spread(dirge, { hp: 32, def, spd: 34 - def });
    const first = report(`dirge-b${def}-eq`, s, garchomp, 'Earthquake', incoming);
    const second = report(`dirge-b${def}-burned-eq`, s, garchomp, 'Earthquake', { ...incoming, burn: true });
    console.log(`dirge-b${def}-after-two`, first.hp + Math.floor(first.hp / 16) - first.max - second.max);
  }
  for (const atk of [28, 31, 32]) {
    const meow = spread(own('Meowscarada'), { hp: 34 - atk, atk, spe: 32 });
    report(`meow-a${atk}-mirror`, meow, mirror, 'Knock Off', grass);
    report(`meow-a${atk}-swamp`, meow, swamp, 'Flower Trick', { rivalMega: true, weather: 'raindance' });
  }
  for (const [id, spa, spd, spe] of [['live', 32, 2, 0], ['s3', 31, 0, 3], ['s3d1', 30, 1, 3]]) {
    const g = spread(own(goodra), { hp: 32, spa, spd, spe });
    report(`goodra-${id}-primarina`, g, primarina, 'Thunderbolt');
    report(`goodra-${id}-ice`, g, dragonite, 'Ice Beam', { rivalMega: true });
    report(`goodra-${id}-draco`, g, dragonite, 'Draco Meteor', { ...incoming, rivalMega: true });
  }
}

function damageRolls(sim, ownSet, rivalSet, name, options = {}) {
  const b = new sim.Battle({ formatid: format, seed: [10, 20, 30, 40] });
  const filled = first => normalize([first, ...original.filter(set => set.species !== first.species)].slice(0, 6));
  b.setPlayer('p1', { name: 'own', team: filled(ownSet) });
  b.setPlayer('p2', { name: 'rival', team: filled(rivalSet) });
  b.choose('p1', 'team 123');
  b.choose('p2', 'team 123');
  const [a, c] = b.sides.map(side => side.active[0]);
  if (options.ownMega) assert.ok(b.actions.runMegaEvo(a));
  if (options.rivalMega) assert.ok(b.actions.runMegaEvo(c));
  if (options.weather && b.field.weather !== options.weather) b.field.setWeather(options.weather, a);
  if (options.attackBoost) c.boosts.atk = options.attackBoost;
  if (options.burn) assert.ok(c.setStatus('brn', a));
  if (options.chip) c.hp -= options.chip;
  if (options.protean) assert.ok(a.setType(b.dex.moves.get(name).type));
  const [attacker, defender] = options.incoming ? [c, a] : [a, c];
  const damage = Array.from({ length: 16 }, (_, i) => {
    const move = b.dex.getActiveMove(name);
    move.willCrit = move.id === 'flowertrick';
    b.setActiveMove(move, attacker, defender);
    b.randomizer = base => Math.floor(base * (85 + i) / 100);
    const hit = b.actions.getDamage(attacker, defender, move, true);
    assert.ok(Number.isInteger(hit));
    return hit;
  });
  const result = { min: Math.min(...damage), max: Math.max(...damage), hp: defender.hp,
    ko: damage.filter(hit => hit >= defender.hp).length, speed: [a.getStat('spe'), c.getStat('spe')] };
  b.destroy();
  return result;
}

async function replay(audit, seedBase, trials, ids) {
  const sim = pinnedEngine();
  assert.ok(Number.isSafeInteger(seedBase) && Number.isInteger(trials) && trials >= 1 && trials <= 40);
  assert.ok(ids.length && ids.every(id => id.split('+').every(part => Object.hasOwn(alternatives, part))));
  const rosters = { baseline: original };
  for (const id of ids) {
    const changes = id.split('+').map(part => alternatives[part]);
    rosters[id] = original.map(set => {
      const update = changes.find(([species]) => species === set.species);
      return update ? spread(set, update[1], update[2]) : set;
    });
  }
  for (const [id, roster] of Object.entries(rosters)) validate(sim, roster, id);
  const rows = [];
  for (const [ci, c] of rw.fixtures(audit, true, true, true).entries()) {
    const ourThree = rw.select('charRain', c.id);
    for (const [bi, branch] of c.branches.entries()) {
      const rival = c.team.map(member => {
        const set = branch.sets?.find(x => x.species === member.species) ?? member;
        const item = branch.itemOverrides?.[member.species] ??
          (branch.three[0] === member.species ? branch.item : undefined) ?? set.item;
        return { ...set, item };
      });
      validate(sim, rival, branch.id);
      const wins = {};
      for (const [id, roster] of Object.entries(rosters)) {
        wins[id] = 0;
        for (let i = 0; i < trials; i++) {
          const r = await battle(sim, structuredClone(roster), structuredClone(rival),
            hashSeed(seedBase + ci * 1000 + bi * 40 + i), {
              ownThree: ourThree, foeThree: branch.three, reverse: i % 2 === 1,
              script: branch.makePolicy([]), rivalImmuneAware: true,
              ownOptions: { script: rw.play.bind(null, 'charRain', c.id === 'charX' ? 'sun' : c.id) },
            });
          assert.equal(r.errors, 0);
          assert.deepEqual(r.foe, branch.three);
          wins[id] += Number(r.won);
        }
      }
      rows.push({ scenario: c.id, branch: branch.id, wins });
    }
  }
  for (const id of Object.keys(rosters)) {
    console.log(id, rows.reduce((sum, row) => sum + row.wins[id], 0), '/', rows.length * trials,
      'swept branches:', rows.filter(row => row.wins[id] === 0).map(row => [row.scenario, row.branch]));
  }
  mkdirSync('output', { recursive: true });
  writeFileSync(`output/m8-pokenavi-spreads-${seedBase}.json`, JSON.stringify({ trials, rows }, null, 2));
}

if (require.main === module) {
  const audit = require('./m8-pokenavi-claude-audit-20261106');
  const [seed, trials, ...ids] = process.argv.slice(2);
  if (seed === undefined) bench(audit);
  else replay(audit, Number(seed), Number(trials), ids).catch(e => { console.error(e); process.exitCode = 1; });
}
module.exports = { bench, replay };
