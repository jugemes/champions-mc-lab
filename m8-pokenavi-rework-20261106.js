'use strict';

const { execFileSync } = require('node:child_process');
const { mkdirSync, writeFileSync } = require('node:fs');
const { load, hashSeed } = require('./lab');
const { validate, PIN } = require('./m8-open8-battle-study-20261105');
const { battle, earlyLines } = require('./encore-lead-audit');
const coverage = require('./m8-pokenavi-coverage-20261106');
const { unseenSixesPR94 } = require('./holdout-20261031-pr94');

const GOODRA = unseenSixesPR94().N4_houndoom.hypotheses.a.find(member => member.species.startsWith('Goodra')).species;
const PRIMARINA = 'Primarina';
const GHOLDENGO = 'Gholdengo';
const GOLISOPOD = 'Golisopod';
const SKELEDIRGE = 'Skeledirge';
const MEOWSCARADA = 'Meowscarada';

function build(id) {
  return coverage.rosters().energy.map(member => {
    if (id !== 'goodra' || member.species !== PRIMARINA) return member;
    return { species: GOODRA, item: 'Air Balloon', ability: 'Sap Sipper', nature: 'Modest',
      evs: { hp: 32, spa: 32, spd: 2 }, moves: ['Ice Beam', 'Earthquake', 'Flash Cannon', 'Thunderbolt'] };
  });
}

function select(id, publicCase) {
  const plan = coverage.readyPlans[publicCase];
  if (id === 'original') return plan;
  if (publicCase === 'mixed') return id === 'goodra'
    ? [GOLISOPOD, GOODRA, MEOWSCARADA] : [GOLISOPOD, PRIMARINA, SKELEDIRGE];
  if (id === 'goodra' && publicCase === 'sand') return [MEOWSCARADA, GOLISOPOD, SKELEDIRGE];
  return id === 'goodra' ? plan.map(species => species === PRIMARINA ? GOODRA : species) : plan;
}

const speciesOf = member => member.details.split(',')[0];

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

function play(id, publicCase, request, bot, info) {
  const fallback = () => coverage.dualPolicy(true, true, true, publicCase, request, bot, info, true, true);
  if (id === 'original') return fallback();
  const own = speciesOf(request.side.pokemon.find(member => member.active));
  const foe = bot.foeActive;
  const attack = (move, mega) => pickMove(request, move, mega);
  const switchTo = species => pivot(request, info, species);
  const partner = id === 'goodra' ? GOODRA : PRIMARINA;

  if (['rain', 'rainPivot'].includes(publicCase) && own === GHOLDENGO) {
    if (foe === 'Pelipper') return attack('shadowball') ?? attack('thunderbolt');
    if (foe === 'Archaludon') return attack('shadowball') ?? switchTo('Aerodactyl');
  }
  if (publicCase === 'mixed') {
    if (own.startsWith(GOLISOPOD) && foe.startsWith('Garchomp')) return switchTo(partner) ?? attack('leechlife', true);
    if (own.startsWith(GOLISOPOD) && foe.startsWith('Dragonite')) {
      if (id === 'goodra' && info.turn === 1) return attack('suckerpunch', true);
      return switchTo(partner) ?? attack('suckerpunch', true);
    }
    if (own === SKELEDIRGE && foe.startsWith('Dragonite')) return attack('shadowball');
    if (own === MEOWSCARADA && foe.startsWith('Garchomp')) return switchTo(partner) ?? attack('tripleaxel');
    if (own === partner) {
      if (foe.startsWith('Metagross')) return switchTo(GOLISOPOD) ?? attack(id === 'goodra' ? 'earthquake' : 'sparklingaria');
      if (foe.startsWith('Sneasler')) return switchTo(SKELEDIRGE) ?? switchTo(GOLISOPOD);
      if (id === 'adjusted' && /^(Garchomp|Dragonite|Greninja)/.test(foe)) return attack('moonblast');
    }
  }
  if (publicCase === 'gyarados') {
    if (foe.startsWith('Mimikyu')) {
      if (own === PRIMARINA && foe === 'Mimikyu-Busted' && !bot.foeStatus) return attack('encore');
      if (own === PRIMARINA || own === GHOLDENGO) return switchTo(SKELEDIRGE) ?? attack('makeitrain') ?? attack('moonblast');
      if (own === SKELEDIRGE) return attack(bot.foeStatus ? 'shadowball' : 'willowisp');
    }
    if (own === GHOLDENGO && foe.startsWith('Garchomp')) return attack('makeitrain') ?? switchTo(partner);
    if (own === PRIMARINA && foe.startsWith('Garchomp')) return attack('moonblast');
  }
  if (id === 'goodra') {
    if (publicCase === 'sun' && own.startsWith('Aerodactyl') && foe === 'Garchomp' && info.turn === 1) {
      return switchTo(GOODRA) ?? attack('icefang', true);
    }
    if (own === GOODRA) {
      if (/^(Garchomp|Dragonite|Salamence)/.test(foe)) return attack('icebeam');
      if (foe.startsWith('Mimikyu') || foe === 'Baxcalibur') return attack('flashcannon');
      if (['Gyarados', 'Corviknight', 'Charizard-Mega-Y'].includes(foe)) return attack('thunderbolt');
      if (foe === GHOLDENGO && bot.foeItem === 'Air Balloon') return switchTo(GHOLDENGO) ?? attack('thunderbolt');
      if (['Archaludon', 'Gholdengo', 'Charizard-Mega-X'].includes(foe)) return attack('earthquake');
    }
  }
  return fallback();
}

function doublePivot(events) {
  let secondDone = false;
  return (request, bot, info) => {
    if (info.turn === 1) return pivot(request, info, 'Garchomp');
    const own = speciesOf(request.side.pokemon.find(member => member.active));
    if (secondDone || !own.startsWith('Garchomp') || ![PRIMARINA, GOODRA].includes(bot.foeActive)) return null;
    const choice = pivot(request, info, 'Mimikyu');
    if (choice) {
      secondDone = true;
      events.push({ turn: info.turn, facing: bot.foeActive, switchTo: 'Mimikyu' });
    }
    return choice;
  };
}

function fixtures(audit) {
  const publicCases = coverage.opponents(true, true, true);
  return publicCases.map(c => ({ ...c, branches: [
    ...c.branches.map(b => ({ ...b, makePolicy: () => coverage.policy(b) })),
    ...audit.BRANCHES.filter(b => b.scenario === c.id).map(b => ({
      ...b, makePolicy: b.id === 'gyaraChompThenMimikyu' ? doublePivot : b.rival,
    })),
    ...extraBranches(c.id, audit.rival),
  ] }));
}

function extraBranches(id, rival) {
  if (id === 'mixed') return [
    { id: 'scarfChompRockSlide', three: ['Garchomp', 'Dragonite', 'Metagross'], makePolicy: () =>
      (request, bot, info) => info.turn === 1 ? pickMove(request, 'rockslide') : null },
  ];
  if (id === 'rain') return [
    { id: 'pelipperToFastArch', three: ['Pelipper', 'Archaludon', 'Swampert'],
      sets: [{ species: 'Archaludon', item: 'Sitrus Berry', ability: 'Stamina', nature: 'Modest',
        evs: { hp: 2, spa: 32, spe: 32 }, moves: ['Electro Shot', 'Draco Meteor', 'Flash Cannon', 'Aura Sphere'] }],
      makePolicy: rival.switchT1('Archaludon') },
  ];
  return [];
}

function foeTeam(c, b) {
  return c.team.map(member => {
    const set = b.sets?.find(candidate => candidate.species === member.species) ?? member;
    const item = b.itemOverrides?.[member.species] ?? (b.three[0] === member.species ? b.item : undefined) ?? set.item;
    return { ...set, item };
  });
}

async function run(audit, { trials = 8, seedBase = 67130000, ids = ['original', 'adjusted', 'goodra'], only } = {}) {
  if (!Number.isInteger(trials) || trials < 1 || trials > 40 || !Number.isSafeInteger(seedBase)) {
    throw new Error('Expected 1–40 trials per branch and an integer seed base');
  }
  const engine = execFileSync('git', ['-C', process.env.SHOWDOWN_DIR, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (engine !== PIN) throw new Error(`Unexpected engine ${engine}`);
  const sim = load();
  const teams = Object.fromEntries(ids.map(id => [id, build(id)]));
  for (const [id, team] of Object.entries(teams)) validate(sim, team, id);
  const rows = [];
  const observed = new Map();
  for (const [ci, c] of fixtures(audit).entries()) {
    if (only && !only.includes(c.id)) continue;
    const choices = Object.fromEntries(ids.map(id => [id, select(id, c.id)]));
    const key = c.team.map(member => member.species).sort().join('/');
    if (observed.has(key) && observed.get(key) !== JSON.stringify(choices)) throw new Error(`Preview drift: ${key}`);
    observed.set(key, JSON.stringify(choices));
    for (const [id, three] of Object.entries(choices)) {
      if (new Set(three).size !== 3 || !three.every(species => teams[id].some(member => member.species === species))) {
        throw new Error(`Invalid selection ${c.id}/${id}`);
      }
    }
    for (const [bi, b] of c.branches.entries()) {
      const enemy = foeTeam(c, b);
      validate(sim, enemy, `${c.id}/${b.id}`);
      const observations = {};
      for (const [id, team] of Object.entries(teams)) {
        const games = [];
        for (let si = 0; si < trials; si++) {
          const seed = hashSeed(seedBase + ci * 1000 + bi * 40 + si);
          const scriptedPivots = [];
          const r = await battle(sim, structuredClone(team), structuredClone(enemy), seed, {
            ownThree: choices[id], foeThree: b.three, reverse: si % 2 === 1,
            script: b.makePolicy(scriptedPivots), rivalImmuneAware: true,
            ownOptions: { script: play.bind(null, id, c.id === 'charX' ? 'sun' : c.id) },
          });
          if (r.errors || r.foe.join('/') !== b.three.join('/')) throw new Error(`Invalid battle ${c.id}/${b.id}`);
          games.push({ won: r.won, scriptedPivots, early: earlyLines(r.log, r.ownSide, 7) });
        }
        observations[id] = games;
      }
      const wins = Object.fromEntries(ids.map(id => [id, observations[id].filter(r => r.won).length]));
      rows.push({ scenario: c.id, branch: b.id, rivalThree: b.three, choices, wins, observations });
      console.log(c.id, b.id, JSON.stringify(wins));
    }
  }
  mkdirSync('output', { recursive: true });
  writeFileSync(`output/m8-pokenavi-rework-${seedBase}.json`, JSON.stringify({ engine, trials, seedBase, teams, rows }, null, 2));
}

if (require.main === module) run(require('./m8-pokenavi-claude-audit-20261106'), {
  trials: Number(process.env.M8_REWORK_TRIALS ?? 8), seedBase: Number(process.env.M8_REWORK_BASE ?? 67130000),
  ids: process.env.M8_REWORK_VARIANTS?.split(','), only: process.env.M8_REWORK_CASES?.split(','),
}).catch(error => { console.error(error); process.exitCode = 1; });

module.exports = { build, select, play, fixtures, run };
