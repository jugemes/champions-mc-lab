'use strict';

// Claude limited re-audit of PR #114 @ 0e4aa7f3 (Issue #115).
// Pre-registered BEFORE running (committed first, results added afterwards):
//   R1 rival action (new, fixed): mixed public six, Dragonite lead with a common
//      physical Dragon Dance set (replaces the special set only in this branch);
//      T1 Mega + Dragon Dance. Tests the rework's turn-1 Mega Golisopod Sucker Punch.
//   P1 own policy (same six, no new breeding): rain/rainPivot, Gholdengo facing
//      Swampert in any form -> switch to Meowscarada (otherwise unchanged).
//   P2 own selection (same six): steelBunker public six -> Gholdengo lead
//      [Gholdengo, Skeledirge, Aerodactyl] instead of Skeledirge lead.
// Each condition is capped at 8 trials. No new opponents beyond R1, no tuning loop.
// P1/P2 are probes, not recommendations; they use only public information
// (revealed species / public six), never the rival's hidden three or items.

const { execFileSync } = require('node:child_process');
const { mkdirSync, writeFileSync } = require('node:fs');
const { load, hashSeed } = require('./lab');
const { validate, PIN } = require('./m8-open8-battle-study-20261105');
const { battle, earlyLines } = require('./encore-lead-audit');
const rework = require('./m8-pokenavi-rework-20261106');
const audit = require('./m8-pokenavi-claude-audit-20261106');

const speciesOf = member => member.details.split(',')[0];

function selectProbe(id, publicCase) {
  if (id === 'goodraP' && publicCase === 'steelBunker') return ['Gholdengo', 'Skeledirge', 'Aerodactyl'];
  return rework.select('goodra', publicCase);
}

function playProbe(id, publicCase, request, bot, info) {
  if (id === 'goodraP' && ['rain', 'rainPivot'].includes(publicCase) && info.canSwitch) {
    const own = speciesOf(request.side.pokemon.find(member => member.active));
    if (own === 'Gholdengo' && bot.foeActive.startsWith('Swampert')) {
      const index = request.side.pokemon.findIndex(member => !member.active &&
        !member.condition.endsWith(' fnt') && speciesOf(member) === 'Meowscarada');
      if (index >= 0) return `switch ${index + 1}`;
    }
  }
  return rework.play('goodra', publicCase, request, bot, info);
}

const DD_DRAGONITE = { species: 'Dragonite', item: 'Dragoninite', ability: 'Multiscale', nature: 'Adamant',
  evs: { hp: 2, atk: 32, spe: 32 }, moves: ['Dragon Dance', 'Extreme Speed', 'Earthquake', 'Fire Punch'] };

function pick(request, move, mega) {
  const active = request.active[0];
  const index = active.moves.findIndex(entry => entry.id === move && !entry.disabled);
  return index < 0 ? null : `move ${index + 1}${mega && active.canMegaEvo ? ' mega' : ''}`;
}

function cases() {
  const all = rework.fixtures(audit);
  const keep = { mixed: ['scarfChompLead', 'dniteMegaESpeedT1'], rain: null, rainPivot: null, steelBunker: null };
  const out = [];
  for (const c of all) {
    if (!(c.id in keep)) continue;
    const branches = c.branches.filter(b => !keep[c.id] || keep[c.id].includes(b.id));
    if (c.id === 'mixed') branches.push({ id: 'R1_dniteDDT1', three: ['Dragonite', 'Greninja', 'Sneasler'],
      sets: [DD_DRAGONITE], makePolicy: () => (request, bot, info) => info.turn === 1 ? pick(request, 'dragondance', true) : null });
    out.push({ ...c, branches });
  }
  return out;
}

function foeTeam(c, b) {
  return c.team.map(member => {
    const set = b.sets?.find(candidate => candidate.species === member.species) ?? member;
    const item = b.itemOverrides?.[member.species] ?? (b.three[0] === member.species ? b.item : undefined) ?? set.item;
    return { ...set, item };
  });
}

async function run({ trials = 8, seedBase = 71160000 } = {}) {
  if (trials > 8) throw new Error('Issue #115 caps each condition at 8 trials');
  const engine = execFileSync('git', ['-C', process.env.SHOWDOWN_DIR, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (engine !== PIN) throw new Error(`Unexpected engine ${engine}`);
  const sim = load();
  const team = rework.build('goodra');
  validate(sim, team, 'goodra');
  const rows = [];
  for (const [ci, c] of cases().entries()) {
    for (const [bi, b] of c.branches.entries()) {
      const enemy = foeTeam(c, b);
      validate(sim, enemy, `${c.id}/${b.id}`);
      const result = {};
      for (const id of ['goodra', 'goodraP']) {
        const three = selectProbe(id, c.id);
        const games = [];
        for (let si = 0; si < trials; si++) {
          const seed = hashSeed(seedBase + ci * 1000 + bi * 40 + si);
          const r = await battle(sim, structuredClone(team), structuredClone(enemy), seed, {
            ownThree: three, foeThree: b.three, reverse: si % 2 === 1,
            script: b.makePolicy([]), rivalImmuneAware: true,
            ownOptions: { script: playProbe.bind(null, id, c.id) },
          });
          if (r.errors || r.foe.join('/') !== b.three.join('/')) throw new Error(`Invalid battle ${c.id}/${b.id}`);
          games.push({ won: r.won, early: earlyLines(r.log, r.ownSide, 8) });
        }
        result[id] = { three, wins: games.filter(g => g.won).length, games };
      }
      rows.push({ scenario: c.id, branch: b.id, rivalThree: b.three, result });
      console.log(c.id, b.id, JSON.stringify({ goodra: result.goodra.wins, goodraP: result.goodraP.wins }));
    }
  }
  mkdirSync('output', { recursive: true });
  writeFileSync(`output/claude-m8-goodra-recheck-${seedBase}.json`, JSON.stringify({ engine, trials, seedBase, rows }, null, 2));
  return rows;
}

if (require.main === module) run({ trials: Number(process.env.TRIALS ?? 8), seedBase: Number(process.env.SEED_BASE ?? 71160000) })
  .catch(error => { console.error(error); process.exitCode = 1; });

module.exports = { selectProbe, playProbe, cases, run, DD_DRAGONITE };
