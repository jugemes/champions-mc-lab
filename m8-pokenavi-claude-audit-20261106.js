'use strict';
// Claude independent audit of PR #108 (284574592e9e59dc9b8831b1e3c78ab5e483f215), Issue #111.
// Pre-registered rival branches: written and committed BEFORE the first run.
// Our side: the PR's --ready roster (rosters().energy), its readyPlans selection fixed per PUBLIC six,
// and its dualPolicy with the same flags as `--ready`. The rival's chosen three, items and moves are
// never passed to our selection or policy (dualPolicy reads only bot.foeActive / public log state).
// Rival scripts below act only on the rival side and only from the rival's own request + public log.
// Heuristic AI vs heuristic AI on pinned Showdown: NOT a ladder win rate.
//   SHOWDOWN_DIR=... M8_AUDIT_TRIALS=20 node m8-pokenavi-claude-audit-20261106.js [--posthoc]
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
  { scenario: 'rain', id: 'pelipperUturn', three: ['Pelipper', 'Swampert', 'Archaludon'], rival: rival.uturnT1 },
  { scenario: 'rain', id: 'pelipperToArch', three: ['Pelipper', 'Archaludon', 'Swampert'], rival: rival.switchT1('Archaludon') },
  { scenario: 'rain', id: 'pelipperToSwampertRepeat', three: ['Pelipper', 'Swampert', 'Archaludon'], rival: rival.switchT1('Swampert') },
  // Psychic-seed public six with Mega Gengar visible.
  { scenario: 'psychicSneasler', id: 'gengarMegaLead', three: ['Gengar', 'Sneasler', 'Gholdengo'], rival: rival.megaT1('shadowball') },
];

// Own-side variants. `pr` is the PR #108 --ready policy unchanged. The rain variants are diagnostics only
// (they change one public-information decision: our choice-locked Gholdengo facing Swampert).
function ownScript(variant, publicCase) {
  const pr = (request, bot, info) => cov.dualPolicy(true, true, true, publicCase, request, bot, info, true, true);
  if (variant === 'pr') return pr;
  if (POSTHOC[variant]) return POSTHOC[variant](pr);
  if (publicCase !== 'rain') return pr;
  const target = variant === 'lockedToMeow' ? 'Meowscarada' : 'Aerodactyl';
  return (request, bot, info) => {
    if (activeSpecies(request) === 'Gholdengo' && bot.foeActive.startsWith('Swampert') && info.lockReason === 'choice') {
      const choice = switchTo(request, info, target);
      if (choice) return choice;
    }
    return pr(request, bot, info);
  };
}

// ---- POST-HOC diagnostics (added AFTER the first run of the pre-registered branches above) ----
// formFix: the public log turns `Mimikyu` into `Mimikyu-Busted` (|detailschange|) once Disguise breaks, so the PR's
// `foe === 'Mimikyu'` rules (dualPolicy / aero ownPolicy) stop firing. Present the base name to the PR policy.
// Only this one alias; Garchomp-Mega-Z is mono-Dragon/Levitate, so its `foe === 'Garchomp'` misses are not
// treated as defects here.
const aliasBot = bot => bot.foeActive === 'Mimikyu-Busted'
  ? new Proxy(bot, { get: (target, key) => key === 'foeActive' ? 'Mimikyu' : Reflect.get(target, key) }) : bot;
const formFix = pr => (request, bot, info) => pr(request, aliasBot(bot), info);
const POSTHOC = {
  formFix,
  // Meowscarada facing Garchomp (any form) uses Triple Axel instead of the base heuristic choice.
  meowAxelChomp: pr => (request, bot, info) =>
    activeSpecies(request) === 'Meowscarada' && bot.foeActive.startsWith('Garchomp')
      ? move(request, 'tripleaxel') ?? pr(request, bot, info) : pr(request, bot, info),
  // Choice-locked Gholdengo facing Archaludon keeps attacking instead of pivoting Aerodactyl into Electro Shot.
  archNoAero: pr => (request, bot, info) =>
    activeSpecies(request) === 'Gholdengo' && bot.foeActive === 'Archaludon' && info.lockReason === 'choice'
      ? null : pr(request, bot, info),
};
const POSTHOC_RUNS = [
  { branch: 'scarfChompLead', variants: ['meowAxelChomp'] },
  { branch: 'gyaraChompThenMimikyu', variants: ['formFix'] },
  { branch: 'pelipperToArch', variants: ['archNoAero'] },
  { branch: 'pelipperSwampertThenArch', variants: ['archNoAero'] },
];

// Rain public-six selection diagnostic: one alternative three fixed for the WHOLE public six (all rain branches,
// PR and audit), our policy unchanged. Diagnostic only; not a recommendation without more tests.
const RAIN_SELECTIONS = {
  pr: null, // readyPlans.rain
  skeledirgeBack: ['Gholdengo', 'Meowscarada', 'Skeledirge'],
  primarinaLead: ['Primarina', 'Meowscarada', 'Gholdengo'],
};
async function rainSelections(sim, trials) {
  const team = cov.rosters().energy;
  const c = cov.opponents(true, true, true).find(entry => entry.id === 'rain');
  const branches = [...c.branches.map(b => ({ id: `pr:${b.id}`, three: b.three, rival: () => cov.policy(b) })),
    ...BRANCHES.filter(b => b.scenario === 'rain')];
  const out = {};
  for (const [name, three] of Object.entries(RAIN_SELECTIONS)) {
    const ownThree = three || cov.readyPlans.rain;
    out[name] = { ownThree, rows: {} };
    for (const [bi, b] of branches.entries()) {
      let wins = 0;
      for (let si = 0; si < trials; si++) {
        const seed = hashSeed(66900000 + bi * 1000 + si);
        const result = await battle(sim, structuredClone(team), structuredClone(c.team), seed, {
          ownThree, foeThree: b.three, reverse: si % 2 === 1, script: b.rival(), rivalImmuneAware: true,
          ownOptions: { script: ownScript('pr', 'rain') },
        });
        if (result.errors) throw new Error(`Invalid battle rain/${b.id}`);
        wins += result.won;
      }
      out[name].rows[b.id] = wins;
    }
    console.log(`rainSelection ${name} ${ownThree.join('>')}`, JSON.stringify(out[name].rows));
  }
  return out;
}

// Identity + formFix over the PR's own 68 branches, same seed formula as m8-pokenavi-coverage-20261106.js main().
async function prMatrix(sim, variants, offset, trials) {
  const team = cov.rosters().energy;
  const cases = cov.opponents(true, true, true);
  const totals = Object.fromEntries(variants.map(v => [v, 0]));
  const rows = [];
  for (const [ci, c] of cases.entries()) {
    const publicCase = c.id === 'charX' ? 'sun' : c.id;
    for (const [bi, b] of c.branches.entries()) {
      const foe = c.team.map(member => {
        const set = b.sets?.find(entry => entry.species === member.species) || member;
        const item = b.itemOverrides?.[member.species] || (b.three[0] === member.species && b.item) || set.item;
        return { ...set, item };
      });
      const wins = {};
      for (const variant of variants) {
        wins[variant] = 0;
        for (let si = 0; si < trials; si++) {
          const seed = hashSeed(64610000 + offset + ci * 1000 + bi * 40 + si);
          const result = await battle(sim, structuredClone(team), structuredClone(foe), seed, {
            ownThree: cov.readyPlans[c.id], foeThree: b.three, reverse: si % 2 === 1, script: cov.policy(b),
            rivalImmuneAware: true, ownOptions: { script: ownScript(variant, publicCase) },
          });
          if (result.errors) throw new Error(`Invalid battle ${c.id}/${b.id}`);
          wins[variant] += result.won;
        }
        totals[variant] += wins[variant];
      }
      rows.push({ scenario: c.id, branch: b.id, wins });
    }
  }
  return { offset, trials, totals, rows };
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
    const posthoc = process.argv.includes('--posthoc') ? POSTHOC_RUNS.filter(run => run.branch === b.id).flatMap(run => run.variants) : [];
    const variants = [...(b.scenario === 'rain' ? ['pr', 'lockedToMeow', 'lockedToAero'] : ['pr']), ...posthoc];
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
      rows.push({ scenario: b.scenario, branch: b.id, rivalThree: b.three, ownThree, variant,
        posthoc: Boolean(POSTHOC[variant]), wins, trials, games });
      console.log(`${b.scenario}/${b.id} [${variant}] ${wins}/${trials}`);
    }
  }
  const matrices = [];
  if (process.argv.includes('--posthoc')) {
    for (const offset of [700000, 900000]) {
      const matrix = await prMatrix(sim, ['pr', 'formFix'], offset, 10);
      for (const row of matrix.rows) if (row.wins.pr !== row.wins.formFix) console.log(`  matrix ${offset} ${row.scenario}/${row.branch}`, JSON.stringify(row.wins));
      console.log(`matrix offset ${offset}`, JSON.stringify(matrix.totals));
      matrices.push(matrix);
    }
  }
  const rain = process.argv.includes('--posthoc') ? await rainSelections(sim, trials) : null;
  mkdirSync('output', { recursive: true });
  writeFileSync('output/m8-pokenavi-claude-audit-20261106.json', JSON.stringify({ engine, pr108: '284574592e9e59dc9b8831b1e3c78ab5e483f215', team, rows, matrices, rain }, null, 2));
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { BRANCHES, ownScript, rival, aliasBot, POSTHOC, POSTHOC_RUNS, prMatrix, RAIN_SELECTIONS, rainSelections };
