'use strict';
// Claude independent audit for Issue #126 (PR #125 @ e01e115).
// Uses full turn resolution in the pinned Showdown over many seeds instead of
// the damageRolls() randomizer hook, so speed order, mega timing, items and
// abilities are exercised by the engine itself. Crits are separated.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { load, normalize } = require('./lab');
const { validate, PIN } = require('./m8-open8-battle-study-20261105');
const rw = require('./m8-pokenavi-rework-20261106');
const audit = require('./m8-pokenavi-claude-audit-20261106');

const FORMAT = 'gen9championsbssregmc';
const sha = execFileSync('git', ['-C', process.env.SHOWDOWN_DIR, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
assert.equal(sha, PIN);
const sim = load();
const original = rw.build('charRain');
const own = sp => original.find(s => s.species === sp);
const GOODRA = original.find(s => s.species.startsWith('Goodra')).species; // avoid literal (pr94 holdout guard)
const cases = rw.fixtures(audit, true, true, true);
const foe = (id, sp) => cases.find(c => c.id === id).team.find(s => s.species === sp);
const spread = (s, evs, nature = s.nature) => ({ ...s, evs, nature });

// attacker uses `move` (slot), target uses a no-op so only one hit lands.
function trial(atkSet, defSet, move, seed, { atkMega = false, defMega = false } = {}) {
  const b = new sim.Battle({ formatid: FORMAT, seed });
  const noop = s => ({ ...s, moves: ['Splash'] });
  b.setPlayer('p1', { name: 'a', team: normalize([atkSet]) });
  b.setPlayer('p2', { name: 'd', team: normalize([noop(defSet)]) });
  b.choose('p1', 'team 1'); b.choose('p2', 'team 1');
  const d = b.p2.active[0];
  const hp0 = d.hp;
  const slot = atkSet.moves.indexOf(move) + 1;
  assert.ok(slot > 0, move);
  b.choose('p1', `move ${slot}${atkMega ? ' mega' : ''}`);
  b.choose('p2', `move 1${defMega ? ' mega' : ''}`);
  const log = b.log.join('\n');
  const crit = /\|-crit\|/.test(log);
  const order = b.log.filter(l => /^\|move\|/.test(l)).map(l => l.split('|')[2].slice(0, 2));
  const res = { dmg: hp0 - d.hp, hp0, fainted: d.fainted || d.hp === 0, crit, first: order[0],
    spe: [b.p1.active[0].getStat('spe'), d.getStat('spe')] };
  b.destroy();
  return res;
}

function run(id, a, d, move, opts, n = 400) {
  const nc = [], c = [];
  let first;
  for (let i = 0; i < n; i++) {
    const r = trial(a, d, move, [i + 1, 7 * i + 3, 13 * i + 5, 101 + i], opts);
    first = r;
    (r.crit ? c : nc).push(r);
  }
  const ko = nc.filter(r => r.fainted).length;
  const dm = nc.filter(r => !r.fainted).map(r => r.dmg);
  console.log(id, JSON.stringify({ hp: first.hp0, spe: first.spe, firstMover: first.first,
    noncrit: nc.length, koNoncrit: ko, koRate: +(ko / nc.length).toFixed(3),
    survMin: dm.length ? Math.min(...dm) : null, survMax: dm.length ? Math.max(...dm) : null,
    crits: c.length, critKO: c.filter(r => r.fainted).length }));
}

if (process.argv[2] !== 'battles') damage();
function damage() {
const ghold = (hp, spa, nature = 'Modest') => spread(own('Gholdengo'), { hp, spa, spe: 32 }, nature);
const mimikyu = foe('mence', 'Mimikyu');
const mirrorH2 = spread(own('Gholdengo'), { hp: 2, spa: 32, spe: 32 }, 'Timid');
const mirrorH6 = spread(own('Gholdengo'), { hp: 6, spa: 28, spe: 32 }, 'Timid');
for (const [id, s] of [['H2C32', ghold(2, 32)], ['H5C29', ghold(5, 29)], ['H6C28', ghold(6, 28)]]) {
  validate(sim, original.map(x => x.species === 'Gholdengo' ? s : x), id);
  run(`ghold-${id}-takes-LO-mimikyu-shadowclaw`, mimikyu, s, 'Shadow Claw');
  run(`ghold-${id}-shadowball-vs-HP164`, s, mirrorH2, 'Shadow Ball');
  run(`ghold-${id}-shadowball-vs-HP168`, s, mirrorH6, 'Shadow Ball');
}
const goodraBase = own(GOODRA);
const primarina = foe('mixed', 'Primarina');
const dnite = foe('mixed', 'Dragonite');
for (const [id, evs] of [['live', { hp: 32, spa: 32, spd: 2 }], ['S3', { hp: 32, spa: 31, spe: 3 }]]) {
  const g = spread(goodraBase, evs);
  validate(sim, original.map(x => x.species === goodraBase.species ? g : x), id);
  run(`goodra-${id}-tbolt-vs-primarina(order)`, g, primarina, 'Thunderbolt');
  run(`goodra-${id}-icebeam-vs-full-megadnite`, g, dnite, 'Ice Beam', { defMega: true });
  run(`goodra-${id}-takes-megadnite-draco`, dnite, g, 'Draco Meteor', { atkMega: true });
}
}

// ---- Limited battles: only the three branches named in Issue #126 ----
// Usage: node claude-m8-spread-audit-20261107.js battles <seedBase> <trials<=8>
const { battle } = require('./encore-lead-audit');
const { hashSeed } = require('./lab');
const { mkdirSync, writeFileSync } = require('node:fs');
const TARGETS = [['lucarioZ', 'B'], ['mixed', 'metaQuake'], ['mixed', 'dniteMegaDracoT1']];
const ALT = {
  gholdH5: ['Gholdengo', { hp: 5, spa: 29, spe: 32 }],
  goodraS3: [GOODRA, { hp: 32, spa: 31, spe: 3 }],
};
async function battles(seedBase, trials) {
  assert.ok(Number.isSafeInteger(seedBase) && trials >= 1 && trials <= 8);
  const mk = parts => original.map(s => {
    const u = parts.map(p => ALT[p]).find(([sp]) => sp === s.species);
    return u ? spread(s, u[1]) : s;
  });
  const rosters = { baseline: original, gholdH5: mk(['gholdH5']), goodraS3: mk(['goodraS3']),
    'gholdH5+goodraS3': mk(['gholdH5', 'goodraS3']) };
  for (const [id, r] of Object.entries(rosters)) validate(sim, r, id);
  const rows = [], logs = {};
  for (const [ti, [cid, bid]] of TARGETS.entries()) {
    const c = cases.find(x => x.id === cid);
    const branch = c.branches.find(b => b.id === bid);
    assert.ok(branch, `${cid}/${bid}`);
    const ourThree = rw.select('charRain', c.id);
    const rival = c.team.map(m => {
      const set = branch.sets?.find(x => x.species === m.species) ?? m;
      const item = branch.itemOverrides?.[m.species] ??
        (branch.three[0] === m.species ? branch.item : undefined) ?? set.item;
      return { ...set, item };
    });
    validate(sim, rival, branch.id);
    const row = { scenario: cid, branch: bid, ourThree, foeThree: branch.three, results: {} };
    for (const [id, roster] of Object.entries(rosters)) {
      row.results[id] = [];
      for (let i = 0; i < trials; i++) {
        const r = await battle(sim, structuredClone(roster), structuredClone(rival),
          hashSeed(seedBase + ti * 1000 + i), {
            ownThree: ourThree, foeThree: branch.three, reverse: i % 2 === 1,
            script: branch.makePolicy([]), rivalImmuneAware: true,
            ownOptions: { script: rw.play.bind(null, 'charRain', c.id === 'charX' ? 'sun' : c.id) },
          });
        assert.equal(r.errors, 0);
        assert.deepEqual(r.foe, branch.three);
        row.results[id].push({ won: r.won, turns: r.turns, ownSide: r.ownSide });
        logs[`${cid}-${bid}-${id}-${i}`] = r.log;
      }
    }
    rows.push(row);
    console.log(cid, bid, 'own', ourThree.join('/'), 'foe', branch.three.join('/'));
    for (const id of Object.keys(rosters))
      console.log('  ', id.padEnd(18), row.results[id].map(x => x.won ? 'W' : 'L').join(''),
        row.results[id].filter(x => x.won).length + '/' + trials);
  }
  mkdirSync('output', { recursive: true });
  writeFileSync(`output/claude-m8-spread-${seedBase}.json`, JSON.stringify({ seedBase, trials, rows }, null, 2));
  writeFileSync(`output/claude-m8-spread-${seedBase}-logs.json`, JSON.stringify(logs));
}
if (process.argv[2] === 'battles') battles(Number(process.argv[3]), Number(process.argv[4]))
  .catch(e => { console.error(e); process.exitCode = 1; });
