'use strict';
// Claude independent audit of PR #108 (284574592e9e59dc9b8831b1e3c78ab5e483f215), Issue #111.
// Pre-registered rival branches: written and committed BEFORE the first run.
// Our side: the PR's --ready roster (rosters().energy), its readyPlans selection fixed per PUBLIC six,
// and its dualPolicy with the same flags as `--ready`. The rival's chosen three, items and moves are
// never passed to our selection or policy (dualPolicy reads only bot.foeActive / public log state).
// Rival scripts below act only on the rival side and only from the rival's own request + public log.
// Heuristic AI vs heuristic AI on pinned Showdown: NOT a ladder win rate.
//   SHOWDOWN_DIR=... M8_AUDIT_TRIALS=20 node m8-pokenavi-claude-audit-20261106.js
const { execFileSync } = require('node:child_process');
const { mkdirSync, writeFileSync } = require('node:fs');
const { load, hashSeed } = require('./lab');
const { validate, PIN } = require('./m8-open8-battle-study-20261105');
const { battle, earlyLines } = require('./encore-lead-audit');
const cov = require('./m8-pokenavi-coverage-20261106');

const nameOf = details => details.split(',')[0];
const activeSpecies = request => nameOf(request.side.pokemon.find(member => member.active).details);
function move(request, id, mega = false) {
  const active = request.active[0];
  const index = active.moves.findIndex(entry => entry.id === id && !entry.disabled);
  return index < 0 ? null : `move ${index + 1}${mega && active.canMegaEvo ? ' mega' : ''}`;
}
function switchTo(request, info, species) {
  if (!info.canSwitch) return null;
  const index = request.side.pokemon.findIndex(member => !member.active &&
    !member.condition.endsWith(' fnt') && nameOf(member.details).startsWith(species));
  return index < 0 ? null : `switch ${index + 1}`;
}

// Rival scripts. Each factory returns a fresh per-game closure.
const rival = {
  megaT1: id => () => (request, bot, info) => info.turn === 1 ? move(request, id, true) : null,
  switchT1: species => () => (request, bot, info) => info.turn === 1 ? switchTo(request, info, species) : null,
  // T1 switch A, then the first time our `trigger` faces `from`, switch to B (double switch).
  doubleSwitch: (first, from, trigger, second) => () => {
    let done = false;
    return (request, bot, info) => {
      if (info.turn === 1) return switchTo(request, info, first);
      if (!done && activeSpecies(request).startsWith(from) && bot.foeActive === trigger) {
        const choice = switchTo(request, info, second);
        if (choice) done = true;
        return choice;
      }
      return null;
    };
  },
  uturnT1: () => (request, bot, info) => info.turn === 1 ? move(request, 'uturn') : null,
  ai: () => () => null,
};

// Pre-registered branches. scenario = PR public-six id (our three is readyPlans[scenario]).
const BRANCHES = [
  // Mixed public six (Metagross/Sneasler/Greninja/Dragonite/Garchomp/Primarina).
  { scenario: 'mixed', id: 'dniteMegaDracoT1', three: ['Dragonite', 'Greninja', 'Sneasler'], rival: rival.megaT1('dracometeor') },
  { scenario: 'mixed', id: 'dniteMegaESpeedT1', three: ['Dragonite', 'Greninja', 'Sneasler'], rival: rival.megaT1('extremespeed') },
  { scenario: 'mixed', id: 'dniteToMetagross', three: ['Dragonite', 'Metagross', 'Garchomp'], rival: rival.switchT1('Metagross') },
  { scenario: 'mixed', id: 'scarfChompLead', three: ['Garchomp', 'Dragonite', 'Metagross'], rival: rival.ai() },
  // Gyarados public six (Gyarados/Garchomp-Z/Mimikyu/Gholdengo/Corviknight/Baxcalibur).
  { scenario: 'gyarados', id: 'chompZLeadMegaEP', three: ['Garchomp', 'Gyarados', 'Mimikyu'], rival: rival.megaT1('earthpower') },
  { scenario: 'gyarados', id: 'gyaraChompThenMimikyu', three: ['Gyarados', 'Garchomp', 'Mimikyu'],
    rival: rival.doubleSwitch('Garchomp', 'Garchomp', 'Primarina', 'Mimikyu') },
  // Rain public six (Pelipper/Swampert/Archaludon/Dragonite/Gholdengo/Rillaboom).
  { scenario: 'rain', id: 'pelipperSwampertThenArch', three: ['Pelipper', 'Swampert', 'Archaludon'],
    rival: rival.doubleSwitch('Swampert', 'Swampert', 'Meowscarada', 'Archaludon') },
  { scenario: 'rain', id: 'pelipperUturn', three: ['Pelipper', 'Swampert', 'Archaludon'], rival: rival.uturnT1() },
  { scenario: 'rain', id: 'pelipperToArch', three: ['Pelipper', 'Archaludon', 'Swampert'], rival: rival.switchT1('Archaludon') },
  { scenario: 'rain', id: 'pelipperToSwampertRepeat', three: ['Pelipper', 'Swampert', 'Archaludon'], rival: rival.switchT1('Swampert') },
  // Psychic-seed public six with Mega Gengar visible.
  { scenario: 'psychicSneasler', id: 'gengarMegaLead', three: ['Gengar', 'Sneasler', 'Gholdengo'], rival: rival.megaT1('shadowball') },
];

// Own-side variants. `pr` is the PR #108 --ready policy unchanged. The rain variants are diagnostics only
// (they change one public-information decision: our choice-locked Gholdengo facing Swampert).
function ownScript(variant, publicCase) {
  const pr = (request, bot, info) => cov.dualPolicy(true, true, true, publicCase, request, bot, info, true, true);
  if (variant === 'pr' || publicCase !== 'rain') return pr;
  const target = variant === 'lockedToMeow' ? 'Meowscarada' : 'Aerodactyl';
  return (request, bot, info) => {
    if (activeSpecies(request) === 'Gholdengo' && bot.foeActive.startsWith('Swampert') && info.lockReason === 'choice') {
      const choice = switchTo(request, info, target);
      if (choice) return choice;
    }
    return pr(request, bot, info);
  };
}

async function main() {
  const engine = execFileSync('git', ['-C', process.env.SHOWDOWN_DIR, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (engine !== PIN) throw new Error(`Unexpected engine ${engine}`);
  const sim = load();
  const team = cov.rosters().energy;
  validate(sim, team, 'pr108-ready');
  const cases = Object.fromEntries(cov.opponents(true, true, true).map(c => [c.id, c]));
  const trials = Number(process.env.M8_AUDIT_TRIALS || 20);
  const rows = [];
  for (const [bi, b] of BRANCHES.entries()) {
    const c = cases[b.scenario];
    const ownThree = cov.readyPlans[b.scenario];
    const foe = structuredClone(c.team);
    validate(sim, foe, `${b.scenario}/${b.id}`);
    if (!b.three.every(species => foe.some(member => member.species === species))) throw new Error(`Bad three ${b.id}`);
    const variants = b.scenario === 'rain' ? ['pr', 'lockedToMeow', 'lockedToAero'] : ['pr'];
    for (const variant of variants) {
      const games = [];
      for (let si = 0; si < trials; si++) {
        const seed = hashSeed(66110000 + bi * 1000 + si);
        const result = await battle(sim, structuredClone(team), structuredClone(foe), seed, {
          ownThree, foeThree: b.three, reverse: si % 2 === 1, script: b.rival(), rivalImmuneAware: true,
          ownOptions: { script: ownScript(variant, b.scenario) },
        });
        if (result.errors || result.foe.join('/') !== b.three.join('/')) throw new Error(`Invalid battle ${b.id}`);
        const foeSide = result.foeSide;
        const megas = result.log.split('\n').filter(line => line.startsWith('|-mega|'))
          .map(line => `${line.startsWith(`|-mega|${foeSide}`) ? 'rival' : 'own'}:${line.split('|')[3]}`);
        games.push({ seed: seed.join('-'), reverse: si % 2 === 1, won: result.won, turns: result.turns, megas,
          early: earlyLines(result.log, result.ownSide, 6) });
      }
      const wins = games.filter(game => game.won).length;
      rows.push({ scenario: b.scenario, branch: b.id, rivalThree: b.three, ownThree, variant, wins, trials, games });
      console.log(`${b.scenario}/${b.id} [${variant}] ${wins}/${trials}`);
    }
  }
  mkdirSync('output', { recursive: true });
  writeFileSync('output/m8-pokenavi-claude-audit-20261106.json', JSON.stringify({ engine, pr108: '284574592e9e59dc9b8831b1e3c78ab5e483f215', team, rows }, null, 2));
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { BRANCHES, ownScript, rival };
