'use strict';
// Claude independent audit of PR #121 @6cc16846374db1a05b17c27fee74102335a6f53c (Issue #122, trigger PR #123).
// Our side: PR's build/select/play for goodraFinal and charRain (selection fixed per PUBLIC six only).
// Rival: PR's pre-registered long-rain branches + charX branches, plus ONE new probe written before running.
// Independent seed base (not used by PR #121). Heuristic AI vs scripted rival on pinned Showdown — not a ladder win rate.
//   SHOWDOWN_DIR=... node claude-m8-charizard-y-audit-20261106.js
const { execFileSync } = require('node:child_process');
const { mkdirSync, writeFileSync } = require('node:fs');
const { load, hashSeed } = require('./lab');
const { validate, PIN } = require('./m8-open8-battle-study-20261105');
const { battle, earlyLines } = require('./encore-lead-audit');
const rw = require('./m8-pokenavi-rework-20261106');
const audit = require('./m8-pokenavi-claude-audit-20261106');

const SEED_BASE = Number(process.env.CLAUDE_AUDIT_BASE ?? 69420000);
const TRIALS = Number(process.env.CLAUDE_AUDIT_TRIALS ?? 8);
const IDS = ['goodraFinal', 'charRain'];
const WANT = {
  rain: ['long-pelipperUturn', 'long-waveCrashThenArch', 'long-pelipperToSwampertRepeat'],
  rainPivot: ['long-waveCrashThenArch'],
  charX: ['B', 'A'],
};
const nameOf = d => d.split(',')[0];
const active = req => nameOf(req.side.pokemon.find(m => m.active).details);
function swTo(req, info, sp) {
  if (!info.canSwitch) return null;
  const i = req.side.pokemon.findIndex(m => !m.active && !m.condition.endsWith(' fnt') && nameOf(m.details).startsWith(sp));
  return i < 0 ? null : `switch ${i + 1}`;
}
// NEW probe (pre-registered): long rain, T1 Pelipper->Swampert; the first time Swampert faces an
// UNMEGA'd Charizard (public: species shown), switch Swampert->Pelipper to re-set rain and absorb the mega Solar Beam.
// Thereafter default AI. Uses only rival request + our visible active species.
function probeSwampertToPelipperOnCharizard() {
  let done = false;
  return (req, bot, info) => {
    if (info.turn === 1) return swTo(req, info, 'Swampert');
    if (!done && active(req).startsWith('Swampert') && bot.foeActive === 'Charizard') {
      const c = swTo(req, info, 'Pelipper');
      if (c) done = true;
      return c;
    }
    return null;
  };
}

function analyse(log, own) {
  const foe = own === 'p1' ? 'p2' : 'p1';
  const lines = log.split('\n');
  const o = { weather: [], ownSwitches: 0, waveCrash: 0, swampertMega: false, faints: [], charizardMega: false,
    solarBeamInSun: 0, swampertKOdBeforeMoving: null, turns: 0 };
  let w = 'none', swampertActed = false, swampertIn = false;
  for (const l of lines) {
    const a = l.split('|');
    if (a[1] === 'turn') o.turns = Number(a[2]);
    if (a[1] === '-weather' && !l.includes('[upkeep]')) { w = a[2]; o.weather.push(`T${o.turns}:${a[2]}`); }
    if (a[1] === 'switch' && a[2].startsWith(own) ) o.ownSwitches++;
    if (a[1] === 'switch' && a[2].startsWith(foe) && a[3].startsWith('Swampert')) swampertIn = true;
    if (a[1] === 'move' && a[2].startsWith(foe) && /Swampert/.test(a[2])) swampertActed = true;
    if (a[1] === 'move' && a[2].startsWith(foe) && a[3] === 'Wave Crash') o.waveCrash++;
    if (a[1] === 'move' && a[2].startsWith(own) && a[3] === 'Solar Beam' && w === 'SunnyDay') o.solarBeamInSun++;
    if (a[1] === '-mega' && a[2].startsWith(foe) && /Swampert/.test(a[2])) o.swampertMega = true;
    if (a[1] === '-mega' && a[2].startsWith(own) && /Charizard/.test(a[2])) o.charizardMega = true;
    if (a[1] === 'faint') {
      o.faints.push(`T${o.turns}:${a[2].startsWith(own) ? 'OWN' : 'RIVAL'}:${a[2].split(': ')[1]}`);
      if (a[2].startsWith(foe) && /Swampert/.test(a[2]) && o.swampertKOdBeforeMoving === null) o.swampertKOdBeforeMoving = !swampertActed;
    }
  }
  o.swampertIn = swampertIn;
  o.swampertActed = swampertActed;
  return o;
}

async function main() {
  const engine = execFileSync('git', ['-C', process.env.SHOWDOWN_DIR, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (engine !== PIN) throw new Error(`Unexpected engine ${engine}`);
  const sim = load();
  const teams = Object.fromEntries(IDS.map(id => [id, rw.build(id)]));
  for (const [id, t] of Object.entries(teams)) validate(sim, t, id);
  const fx = rw.fixtures(audit, true, true, true);
  // Preview identity: charX and sun public six must be identical and selections common.
  const sun = fx.find(c => c.id === 'sun'), cx = fx.find(c => c.id === 'charX');
  const key = c => c.team.map(m => m.species).sort().join('/');
  const preview = { sunKey: key(sun), charXKey: key(cx), same: key(sun) === key(cx),
    selections: Object.fromEntries(IDS.map(id => [id, { sun: rw.select(id, 'sun'), charX: rw.select(id, 'charX') }])) };
  console.log('preview', JSON.stringify(preview));
  const rows = [];
  for (const [ci, c] of fx.entries()) {
    const want = WANT[c.id]; if (!want) continue;
    const branches = c.branches.filter(b => want.includes(b.id));
    if (c.id === 'rain') {
      const base = c.branches.find(b => b.id === 'long-pelipperToSwampertRepeat');
      branches.push({ ...base, id: 'claude-long-swampertToPelipperOnCharizard', makePolicy: probeSwampertToPelipperOnCharizard });
    }
    for (const [bi, b] of branches.entries()) {
      const enemy = c.team.map(m => {
        const set = b.sets?.find(s => s.species === m.species) ?? m;
        return { ...set, item: b.itemOverrides?.[m.species] ?? (b.three[0] === m.species ? b.item : undefined) ?? set.item };
      });
      validate(sim, enemy, `${c.id}/${b.id}`);
      const res = {};
      for (const id of IDS) {
        const three = rw.select(id, c.id);
        res[id] = [];
        for (let si = 0; si < TRIALS; si++) {
          const seed = hashSeed(SEED_BASE + ci * 1000 + bi * 40 + si);
          const r = await battle(sim, structuredClone(teams[id]), structuredClone(enemy), seed, {
            ownThree: three, foeThree: b.three, reverse: si % 2 === 1, script: b.makePolicy([]), rivalImmuneAware: true,
            ownOptions: { script: rw.play.bind(null, id, c.id === 'charX' ? 'sun' : c.id) },
          });
          if (r.errors || r.foe.join('/') !== b.three.join('/')) throw new Error(`Invalid battle ${c.id}/${b.id}/${id}`);
          res[id].push({ seed: SEED_BASE + ci * 1000 + bi * 40 + si, won: r.won, ...analyse(r.log, r.ownSide), early: earlyLines(r.log, r.ownSide, 5) });
        }
      }
      const wins = Object.fromEntries(IDS.map(id => [id, res[id].filter(g => g.won).length]));
      console.log(c.id, b.id, JSON.stringify(wins));
      rows.push({ scenario: c.id, branch: b.id, rivalThree: b.three, choices: Object.fromEntries(IDS.map(id => [id, rw.select(id, c.id)])), wins, games: res });
    }
  }
  mkdirSync('output', { recursive: true });
  writeFileSync(`output/claude-m8-charizard-y-audit-${SEED_BASE}.json`, JSON.stringify({ engine, trials: TRIALS, seedBase: SEED_BASE, prCommit: '6cc16846374db1a05b17c27fee74102335a6f53c', preview, rows }, null, 2));
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { probeSwampertToPelipperOnCharizard, analyse };
