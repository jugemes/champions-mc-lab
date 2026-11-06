'use strict';

const { execFileSync } = require('node:child_process');
const { mkdirSync, writeFileSync } = require('node:fs');
const { load, hashSeed } = require('./lab');
const { validate, PIN } = require('./m8-open8-battle-study-20261105');
const { battle, earlyLines, switchTo } = require('./encore-lead-audit');
const aero = require('./m8-pokenavi-aerodactyl-20261105');
const { provisional } = require('./provisional-rank-roster-20261018');
const { holdoutSixPR80 } = require('./holdout-20261031-pr80');

const hisuianSamurott = aero.team().find(member => member.species.startsWith('Samurott')).species;
const set = (species, item, ability, nature, evs, moves) => ({ species, item, ability, nature, evs, moves });
const fastPhysical = { hp: 2, atk: 32, spe: 32 };
const fastSpecial = { hp: 2, spa: 32, spe: 32 };
const bulkyPhysical = { hp: 32, atk: 32, spd: 2 };
const mixedMeta = set('Metagross', 'Metagrossite', 'Clear Body', 'Adamant', fastPhysical,
  ['Bullet Punch', 'Psychic Fangs', 'Ice Punch', 'Earthquake']);
const gemSneasler = set('Sneasler', 'Normal Gem', 'Unburden', 'Adamant', { hp: 30, atk: 32, spe: 4 },
  ['Dire Claw', 'Close Combat', 'Fake Out', 'Acrobatics']);
const greninja = set('Greninja', 'Focus Sash', 'Protean', 'Timid', fastSpecial,
  ['Dark Pulse', 'Surf', 'Ice Beam', 'Sludge Wave']);
const dragonite = set('Dragonite', 'Dragoninite', 'Multiscale', 'Modest', fastSpecial,
  ['Draco Meteor', 'Extreme Speed', 'Flamethrower', 'Thunderbolt']);
const primarina = set('Primarina', 'Sitrus Berry', 'Torrent', 'Modest', { hp: 32, spa: 32, spe: 2 },
  ['Moonblast', 'Sparkling Aria', 'Aqua Jet', 'Encore']);
const meowscarada = set('Meowscarada', 'Choice Scarf', 'Protean', 'Jolly', fastPhysical,
  ['Flower Trick', 'Knock Off', 'Triple Axel', 'U-turn']);

function rosters() {
  const previous = aero.team();
  const stored = provisional();
  const tyranitar = { ...stored.find(member => member.species === 'Tyranitar'),
    moves: ['Rock Slide', 'Knock Off', 'Ice Punch', 'Stealth Rock'] };
  const skeledirge = set('Skeledirge', 'Leftovers', 'Unaware', 'Bold', { hp: 32, def: 32, spd: 2 },
    ['Torch Song', 'Shadow Ball', 'Will-O-Wisp', 'Slack Off']);
  const golisopod = set('Golisopod', 'Golisopite', 'Emergency Exit', 'Adamant', bulkyPhysical,
    ['First Impression', 'Leech Life', 'Sucker Punch', 'Iron Head']);
  const garchomp = previous.find(member => member.species === 'Garchomp');
  const rotom = { ...stored.find(member => member.species === 'Rotom-Wash'), item: 'Rocky Helmet' };
  const dual = ['Aerodactyl', 'Gholdengo'].map(species => previous.find(member => member.species === species));
  const balloonGholdengo = { ...dual[1], item: 'Air Balloon' };
  const sashMeowscarada = { ...meowscarada, item: 'Focus Sash' };
  const rillaboom = previous.find(member => member.species === 'Rillaboom');
  return { previous, goli: [golisopod, skeledirge, meowscarada, tyranitar, primarina, garchomp],
    dragon: [dragonite, skeledirge, meowscarada, tyranitar, primarina, rotom],
    dual: [...dual, golisopod, skeledirge, sashMeowscarada, primarina],
    scarf: [dual[0], balloonGholdengo, golisopod, skeledirge, meowscarada, primarina],
    grass: [...dual, golisopod, skeledirge, sashMeowscarada, rillaboom],
    energy: [...dual, golisopod, skeledirge, sashMeowscarada,
      { ...primarina, moves: ['Moonblast', 'Sparkling Aria', 'Energy Ball', 'Encore'] }] };
}

const plan = (goli, dragon, previous) => ({ goli, dragon, previous });
const sun = plan(['Garchomp', 'Primarina', 'Tyranitar'], ['Primarina', 'Tyranitar', 'Dragonite']);
const rain = plan(['Meowscarada', 'Garchomp', 'Golisopod'], ['Rotom-Wash', 'Meowscarada', 'Dragonite']);
const gyara = plan(['Meowscarada', 'Skeledirge', 'Primarina'], ['Rotom-Wash', 'Meowscarada', 'Primarina']);
const plans = {
  mixed: plan(['Golisopod', 'Meowscarada', 'Skeledirge'], ['Meowscarada', 'Skeledirge', 'Rotom-Wash'],
    ['Garchomp', 'Primarina', 'Gholdengo']),
  psychicSneasler: plan(['Meowscarada', 'Skeledirge', 'Garchomp'], ['Meowscarada', 'Skeledirge', 'Tyranitar'],
    ['Gholdengo', 'Garchomp', hisuianSamurott]),
  sun, charX: sun, rain, gyarados: gyara,
  megaGolisopod: plan(['Skeledirge', 'Meowscarada', 'Garchomp'], ['Skeledirge', 'Dragonite', 'Meowscarada']),
  lastRespects: plan(['Skeledirge', 'Meowscarada', 'Golisopod'], ['Skeledirge', 'Meowscarada', 'Dragonite']),
  realE_sun_lastRespects: plan(['Garchomp', 'Tyranitar', 'Meowscarada'], ['Tyranitar', 'Rotom-Wash', 'Meowscarada']),
  trickRoom: plan(['Golisopod', 'Skeledirge', 'Primarina'], ['Skeledirge', 'Primarina', 'Tyranitar']),
  shedTail: plan(['Skeledirge', 'Primarina', 'Garchomp'], ['Skeledirge', 'Primarina', 'Dragonite']),
  batonPass: plan(['Skeledirge', 'Primarina', 'Garchomp'], ['Skeledirge', 'Primarina', 'Dragonite']),
  snowVeil: plan(['Golisopod', 'Skeledirge', 'Tyranitar'], ['Tyranitar', 'Skeledirge', 'Dragonite']),
  screens: plan(['Golisopod', 'Skeledirge', 'Primarina'], ['Primarina', 'Skeledirge', 'Dragonite']),
};
const dualSun = ['Aerodactyl', 'Primarina', 'Gholdengo'];
const dualPlans = {
  mixed: ['Meowscarada', 'Golisopod', 'Skeledirge'],
  psychicSneasler: ['Meowscarada', 'Skeledirge', 'Gholdengo'],
  sun: dualSun, charX: dualSun,
  rain: ['Gholdengo', 'Meowscarada', 'Golisopod'],
  gyarados: ['Meowscarada', 'Primarina', 'Gholdengo'],
  megaGolisopod: ['Skeledirge', 'Meowscarada', 'Gholdengo'],
  lastRespects: ['Skeledirge', 'Meowscarada', 'Golisopod'],
  realE_sun_lastRespects: ['Aerodactyl', 'Meowscarada', 'Primarina'],
  trickRoom: ['Golisopod', 'Skeledirge', 'Primarina'],
  shedTail: ['Skeledirge', 'Primarina', 'Gholdengo'],
  batonPass: ['Aerodactyl', 'Skeledirge', 'Primarina'],
  snowVeil: ['Gholdengo', 'Golisopod', 'Skeledirge'],
  screens: ['Aerodactyl', 'Gholdengo', 'Skeledirge'],
};
const updatedPlans = {
  ...dualPlans,
  gyarados: ['Gholdengo', 'Meowscarada', 'Primarina'],
  lastRespects: ['Skeledirge', 'Meowscarada', 'Golisopod'],
  realE_sun_lastRespects: ['Aerodactyl', 'Meowscarada', 'Gholdengo'],
};
const weatherPlans = {
  ...updatedPlans,
  rain: ['Primarina', 'Meowscarada', 'Gholdengo'],
  gyarados: ['Gholdengo', 'Primarina', 'Skeledirge'],
  lastRespects: ['Meowscarada', 'Skeledirge', 'Golisopod'],
};
const grassPlans = {
  ...weatherPlans,
  sun: ['Aerodactyl', 'Skeledirge', 'Gholdengo'],
  charX: ['Aerodactyl', 'Skeledirge', 'Gholdengo'],
  rain: ['Gholdengo', 'Rillaboom', 'Golisopod'],
  gyarados: ['Gholdengo', 'Meowscarada', 'Skeledirge'],
  trickRoom: ['Golisopod', 'Skeledirge', 'Gholdengo'],
  shedTail: ['Skeledirge', 'Meowscarada', 'Gholdengo'],
  batonPass: ['Aerodactyl', 'Skeledirge', 'Gholdengo'],
};
const candidatePlans = {
  ...weatherPlans,
  rain: ['Gholdengo', 'Meowscarada', 'Aerodactyl'],
  rainPivot: ['Gholdengo', 'Meowscarada', 'Aerodactyl'],
  mence: ['Primarina', 'Gholdengo', 'Aerodactyl'],
  lucarioZ: ['Skeledirge', 'Primarina', 'Gholdengo'],
  volcarona: ['Aerodactyl', 'Skeledirge', 'Primarina'],
  stall: ['Gholdengo', 'Meowscarada', 'Skeledirge'],
  steelBunker: ['Skeledirge', 'Gholdengo', 'Aerodactyl'],
  hazardShift: ['Gholdengo', 'Meowscarada', 'Skeledirge'],
  multiMega: ['Meowscarada', 'Skeledirge', 'Aerodactyl'],
  mixedElectric: ['Meowscarada', 'Gholdengo', 'Primarina'],
};
const readyPlans = {
  ...candidatePlans,
  volcarona: ['Gholdengo', 'Aerodactyl', 'Skeledirge'],
  hazardShift: ['Gholdengo', 'Aerodactyl', 'Meowscarada'],
  mixedElectric: ['Meowscarada', 'Aerodactyl', 'Gholdengo'],
  sand: ['Primarina', 'Skeledirge', 'Meowscarada'],
};

const branch = (id, three, extra = {}) => ({ id, three, ...extra });

function opponents(extra = false, candidate = false, ready = false) {
  const existing = aero.scenarios();
  const psychic = existing.find(c => c.id === 'psychic');
  const gyarados = existing.find(c => c.id === 'gyarados');
  const mixed = { id: 'mixed', team: [mixedMeta, gemSneasler, greninja, dragonite,
    existing.find(c => c.id === 'sun').team.find(member => member.species === 'Garchomp'), primarina], branches: [
    branch('metaLead', ['Metagross', 'Garchomp', 'Primarina']),
    branch('metaIronDefense', ['Metagross', 'Garchomp', 'Primarina'], {
      sets: [{ ...mixedMeta, moves: ['Iron Defense', 'Body Press', 'Psychic Fangs', 'Earthquake'] }],
      openingMove: 'Iron Defense', mega: true }),
    branch('gemFakeOut', ['Sneasler', 'Greninja', 'Metagross'], { openingMove: 'Fake Out' }),
    branch('sashGreninja', ['Greninja', 'Dragonite', 'Sneasler']),
    branch('scarfGreninja', ['Greninja', 'Dragonite', 'Sneasler'], {
      itemOverrides: { Greninja: 'Choice Scarf', Garchomp: 'Focus Sash' } }),
    branch('specialDragonite', ['Dragonite', 'Greninja', 'Sneasler']),
  ] };
  const seedSneasler = { ...gemSneasler, item: 'Psychic Seed',
    moves: ['Dire Claw', 'Close Combat', 'Throat Chop', 'Swords Dance'] };
  const terrain = { id: 'psychicSneasler', team: psychic.team.map(member =>
    member.species === 'Dragonite' ? seedSneasler : member), branches: [
    branch('indeedeeLead', ['Indeedee', 'Sneasler', 'Gholdengo']),
    branch('pivotSneasler', ['Indeedee', 'Sneasler', 'Gholdengo'], { openingSwitch: 'Sneasler' }),
    branch('gholdengoLead', ['Gholdengo', 'Indeedee', 'Sneasler']),
  ] };
  gyarados.branches.push(branch('dance', gyarados.branches[0].three, { openingMove: 'Dragon Dance' }));
  if (extra) {
    const rain = existing.find(c => c.id === 'rain');
    rain.branches.push(branch('pelipperPivot', rain.branches[0].three, { openingSwitch: 'Swampert' }));
    mixed.branches.push(branch('dragonitePivot', ['Dragonite', 'Greninja', 'Sneasler'], { openingSwitch: 'Sneasler' }));
    mixed.branches.push(branch('metaQuake', ['Metagross', 'Garchomp', 'Primarina'], {
      openingMove: 'Earthquake', mega: true }));
  }
  if (candidate) {
    for (const id of ['rain', 'rainPivot']) {
      const rain = existing.find(c => c.id === id);
      rain.branches.push(branch('archLead', ['Archaludon', 'Pelipper', 'Swampert']));
    }
  }
  if (ready) {
    const { a, b } = holdoutSixPR80().HX_sand.hypotheses;
    existing.push({ id: 'sand', team: a, branches: [
      branch('hippoExcadrill', ['Hippowdon', 'Excadrill', 'Rotom-Heat']),
      branch('megaExcadrillLead', ['Excadrill', 'Hippowdon', 'Dragapult']),
      branch('sylveonLead', ['Sylveon', 'Rotom-Heat', 'Dragapult'], { sets: b }),
    ] });
  }
  const wanted = ready ? readyPlans : candidate ? candidatePlans : plans;
  return [mixed, terrain, ...existing.filter(c => c.id in wanted)];
}

function policy(foe) {
  if (!foe.mega && !foe.openingSwitch) return aero.rivalPolicy(foe);
  return (request, bot, info) => {
    if (info.turn !== 1) return null;
    if (foe.openingSwitch) return switchTo(request, foe.openingSwitch);
    const active = request.active[0];
    const index = active.moves.findIndex(move => move.move === foe.openingMove && !move.disabled);
    if (index < 0 || !active.canMegaEvo) throw new Error(`Unavailable opening: ${foe.id}`);
    return `move ${index + 1} mega`;
  };
}

function dualPolicy(updated, preserveSash, energy, publicCase, request, bot, info, candidate = false, ready = false) {
  const own = request.side.pokemon.find(member => member.active).details.split(',')[0];
  const foe = bot.foeActive;
  const move = (id, mega = false) => {
    const index = request.active[0].moves.findIndex(entry => entry.id === id && !entry.disabled);
    if (index < 0) return null;
    return `move ${index + 1}${mega && request.active[0].canMegaEvo ? ' mega' : ''}`;
  };
  const pivot = species => info.canSwitch && request.side.pokemon.some(member =>
    !member.active && !member.condition.endsWith(' fnt') && member.details.startsWith(`${species},`))
    ? switchTo(request, species) : null;
  if (candidate && ['rain', 'rainPivot'].includes(publicCase)) {
    if (own === 'Gholdengo' && foe === 'Pelipper') return move('thunderbolt');
    if (own === 'Gholdengo' && foe.startsWith('Swampert')) return move('shadowball') ?? move('thunderbolt');
    if (own === 'Gholdengo' && foe === 'Archaludon') return move('shadowball') ?? pivot('Aerodactyl');
    if (own.startsWith('Aerodactyl')) {
      if (['Pelipper', 'Volcarona', 'Starmie'].includes(foe)) return move('rockblast', true);
      if (foe.startsWith('Swampert') || ['Archaludon', 'Toxapex'].includes(foe)) return move('earthquake', true);
    }
  }
  if (ready && publicCase === 'mixedElectric' && own.startsWith('Aerodactyl') && ['Eelektross', 'Volcarona'].includes(foe)) {
    return move('rockblast', true);
  }
  if (own === 'Meowscarada') {
    if (foe.startsWith('Sneasler')) return pivot('Skeledirge');
    if (publicCase === 'mixed' && foe.startsWith('Metagross')) return pivot('Golisopod');
    if (foe.startsWith('Dragonite')) return move('tripleaxel');
    if (foe.startsWith('Greninja') || foe.startsWith('Swampert')) return move('flowertrick');
    if (preserveSash && foe === 'Mimikyu') return move('uturn');
  }
  if (own.startsWith('Golisopod') && foe.startsWith('Dragonite')) return pivot('Meowscarada');
  if (own === 'Skeledirge' && foe.startsWith('Sneasler')) {
    return bot.foeStatus === 'brn' ? move('shadowball') : move('willowisp');
  }
  if (own === 'Gholdengo' && foe.startsWith('Swampert') && !preserveSash) return pivot('Meowscarada');
  if (updated) {
    if (own === 'Skeledirge' && foe === 'Mimikyu' && !bot.foeStatus) return move('willowisp');
    if (own === 'Gholdengo' && foe === 'Garchomp' && info.lockReason === 'choice') return pivot('Meowscarada');
    if (own === 'Gholdengo' && foe === 'Gyarados') return move('thunderbolt');
    if (own.startsWith('Aerodactyl') && foe === 'Corviknight') return pivot('Gholdengo');
  }
  if (preserveSash && publicCase === 'rain') {
    if (energy && own === 'Primarina' && foe.startsWith('Swampert')) return move('energyball');
    if (own === 'Primarina') return move('moonblast');
    if (own === 'Gholdengo' && foe.startsWith('Swampert')) return move('shadowball');
  }
  if (energy) {
    if (ready && publicCase === 'gyarados' && own === 'Primarina' && foe === 'Mimikyu') {
      return pivot('Skeledirge') ?? move('moonblast');
    }
    if (own === 'Primarina' && foe === 'Gholdengo') return pivot('Gholdengo');
    if (publicCase === 'gyarados' && own === 'Gholdengo' && foe === 'Mimikyu' && !bot.foeStatus) {
      return pivot('Skeledirge') ?? move('makeitrain');
    }
  }
  return aero.ownPolicy(publicCase, request, bot, info);
}

async function main() {
  const engine = execFileSync('git', ['-C', process.env.SHOWDOWN_DIR, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (engine !== PIN) throw new Error(`Unexpected engine ${engine}`);
  const sim = load();
  const ready = process.argv.includes('--ready');
  const candidate = ready || process.argv.includes('--candidate');
  const energy = candidate || process.argv.includes('--energy');
  const weather = energy || process.argv.includes('--weather');
  const updated = weather || process.argv.includes('--final');
  const refine = updated || process.argv.includes('--refine');
  const allTeams = rosters();
  const ids = energy ? ['previous', 'energy'] : weather ? ['previous', 'dual', 'grass'] : updated ? ['previous', 'dual', 'scarf']
    : refine ? ['previous', 'dual'] : ['previous', 'goli', 'dragon'];
  const teams = Object.fromEntries(ids
    .map(id => [id, allTeams[id]]));
  const cases = opponents(updated, candidate, ready);
  const rows = [];
  const visiblePlans = new Map();
  const trials = Number(process.env.M8_COVERAGE_TRIALS || 4);
  const offset = Number(process.env.M8_COVERAGE_SEED_OFFSET || 0);
  for (const [id, team] of Object.entries(teams)) validate(sim, team, id);
  for (const [ci, c] of cases.entries()) {
    const previousChoice = c.id === 'sand' ? ['Primarina', 'Garchomp', 'Rillaboom'] : plans[c.id]?.previous || aero.preview[c.id];
    const choices = energy ? { previous: previousChoice, energy: (ready ? readyPlans : candidate ? candidatePlans : weatherPlans)[c.id] }
      : weather ? { previous: previousChoice, dual: weatherPlans[c.id], grass: grassPlans[c.id] }
      : updated ? { previous: previousChoice, dual: updatedPlans[c.id], scarf: updatedPlans[c.id] }
      : refine ? { previous: previousChoice, dual: dualPlans[c.id] } : { ...plans[c.id], previous: previousChoice };
    const key = c.team.map(member => member.species).sort().join('/');
    const previous = visiblePlans.get(key);
    if (previous && JSON.stringify(previous) !== JSON.stringify(choices)) throw new Error(`Preview drift: ${key}`);
    visiblePlans.set(key, choices);
    for (const [id, three] of Object.entries(choices)) {
      if (new Set(three).size !== 3 || !three.every(species => teams[id].some(member => member.species === species))) {
        throw new Error(`Invalid selection ${c.id}/${id}`);
      }
    }
    const publicCase = c.id === 'charX' ? 'sun' : c.id;
    for (const [bi, b] of c.branches.entries()) {
      const rival = c.team.map(member => {
        const set = b.sets?.find(candidate => candidate.species === member.species) || member;
        const item = b.itemOverrides?.[member.species] || (b.three[0] === member.species && b.item) || set.item;
        return { ...set, item };
      });
      validate(sim, rival, `${c.id}/${b.id}`);
      const observations = Object.fromEntries(Object.keys(teams).map(id => [id, []]));
      for (const [id, team] of Object.entries(teams)) for (let si = 0; si < trials; si++) {
        const seed = hashSeed(64610000 + offset + ci * 1000 + bi * 40 + si);
        const reverse = si % 2 === 1;
        const script = id === 'previous' ? aero.ownPolicy.bind(null, publicCase)
          : (request, bot, info) => dualPolicy(updated, weather && id !== 'grass', id === 'energy',
            publicCase, request, bot, info, candidate, ready);
        const result = await battle(sim, structuredClone(team), structuredClone(rival), seed, {
          ownThree: choices[id], foeThree: b.three, reverse, script: policy(b), rivalImmuneAware: true,
          ownOptions: refine ? { script } : {},
        });
        if (result.errors || result.foe.join('/') !== b.three.join('/')) throw new Error(`Invalid battle ${c.id}/${b.id}`);
        const field = result.log.split('\n').filter(line => /^\|-(mega|weather|fieldstart|enditem|sidestart)\|/.test(line));
        observations[id].push({ seed, reverse, won: result.won, field, early: earlyLines(result.log, result.ownSide, 5) });
      }
      const wins = Object.fromEntries(Object.entries(observations).map(([id, games]) => [id, games.filter(game => game.won).length]));
      rows.push({ scenario: c.id, branch: b, choices, wins, observations });
      console.log(c.id, b.id, JSON.stringify(wins));
    }
  }
  mkdirSync('output', { recursive: true });
  writeFileSync(`output/m8-pokenavi-coverage-${offset}.json`, JSON.stringify({ engine, teams, cases, trials, rows }, null, 2));
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { rosters, opponents, plans, dualPlans, candidatePlans, readyPlans, policy, dualPolicy };
