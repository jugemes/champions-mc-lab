'use strict';
// Issue #118: Greninja lead -> physical Mega Dragonite pivot that opens with Extreme Speed or Earthquake
// (moves outside goodraFinal's physicalDragoniteMoves set). Seed 71200000, 8 trials per policy.
// Run: SHOWDOWN_DIR=<pinned 3a766f2c> node claude-m8-goodra-final-audit-20261106.js
const R = __dirname + '/';
process.chdir(R);
const { load, hashSeed } = require(R + 'lab');
const { validate, PIN } = require(R + 'm8-open8-battle-study-20261105');
const engine = require('node:child_process').execFileSync('git', ['-C', process.env.SHOWDOWN_DIR, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (engine !== PIN) throw new Error('Unexpected engine ' + engine);
const { battle, earlyLines } = require(R + 'encore-lead-audit');
function pickMove(request, id, mega = false) {
  const active = request.active[0];
  const index = active.moves.findIndex(entry => entry.id === id && !entry.disabled);
  if (index < 0) return null;
  return `move ${index + 1}${mega && active.canMegaEvo ? ' mega' : ''}`;
}

function pivot(request, info, species) {
  if (!info.canSwitch) return null;
  const index = request.side.pokemon.findIndex(member => !member.active &&
    !member.condition.endsWith(' fnt') && speciesOf(member) === species);
  return index < 0 ? null : `switch ${index + 1}`;
}

const speciesOf = m => m.details.split(',')[0];
const rw = require(R + 'm8-pokenavi-rework-20261106');
const audit = require(R + 'm8-pokenavi-claude-audit-20261106');
const c = rw.fixtures(audit, true, true).find(c => c.id === 'mixed');
const dn = { species: 'Dragonite', item: 'Dragoninite', ability: 'Multiscale', nature: 'Adamant',
  evs: { hp: 2, atk: 32, spe: 32 }, moves: ['Dragon Dance', 'Extreme Speed', 'Earthquake', 'Fire Punch'] };
const three = ['Greninja', 'Dragonite', 'Sneasler'];
const branches = ['extremespeed', 'earthquake'].map(move => ({ id: `gren-pivot-physical-${move}`, move }));
(async () => {
  const sim = load();
  const seedBase = 71200000, trials = 8;
  const enemy = c.team.map(m => m.species === 'Dragonite' ? dn : m);
  validate(sim, enemy, 'extra');
  for (const [bi, b] of branches.entries()) {
    const out = {};
    for (const id of ['goodraGuard', 'goodraFinal']) {
      const team = rw.build(id); validate(sim, team, id);
      let wins = 0, used = 0, piv = 0, ownGoodra = 0;
      for (let si = 0; si < trials; si++) {
        let opened = false;
        const script = (request, bot, info) => {
          const active = speciesOf(request.side.pokemon.find(x => x.active));
          if (info.turn === 2 && active === 'Greninja') return pivot(request, info, 'Dragonite');
          if (opened || active !== 'Dragonite' || info.turn === 1) return null;
          const ch = pickMove(request, b.move, true); if (ch) opened = true; return ch;
        };
        const r = await battle(sim, structuredClone(team), structuredClone(enemy), hashSeed(seedBase + bi * 40 + si), {
          ownThree: rw.select(id, 'mixed'), foeThree: three, reverse: si % 2 === 1, script, rivalImmuneAware: true,
          ownOptions: { script: rw.play.bind(null, id, 'mixed') } });
        if (r.errors || r.foe.join('/') !== three.join('/')) throw new Error('invalid');
        const log = earlyLines(r.log, r.ownSide, 9).join('\n');
        wins += r.won; if (/RIVAL:Dragonite\|(Extreme Speed|Earthquake)/.test(log)) used++;
        if (/switch\|RIVAL:Dragonite/.test(log)) piv++; if (/switch\|OWN:Goodra/.test(log)) ownGoodra++;
        
      }
      out[id] = { wins, used, piv, ownGoodra };
    }
    console.log(b.id, JSON.stringify(out));
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
