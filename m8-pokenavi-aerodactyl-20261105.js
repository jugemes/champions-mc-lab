'use strict';

const { execFileSync } = require('node:child_process');
const { mkdirSync, writeFileSync } = require('node:fs');
const { load, hashSeed } = require('./lab');
const { cases, validate, PIN } = require('./m8-open8-battle-study-20261105');
const { battle, earlyLines } = require('./encore-lead-audit');
const { planFor, opponents } = require('./m8-pokenavi-rebuild-20261105');
const { scenarios: oldDiagnostics } = require('./m8-open8-gimmick-diagnostics-20261105');
const { unseenSixesPR96 } = require('./holdout-20261031-pr96');

// Reuse the form identity from the archived N6 fixture.
const hisuianSamurott = unseenSixesPR96().N6_altaria.hypotheses.a[1];

function team() {
  return planFor('followup').candidates.grass.map(member => {
    if (member.species === 'Salamence') return {
      species: 'Aerodactyl', item: 'Aerodactylite', ability: 'Unnerve', nature: 'Adamant',
      evs: { hp: 32, atk: 32, spe: 2 }, moves: ['Rock Blast', 'Ice Fang', 'Earthquake', 'Taunt'],
    };
    if (member.species === 'Mimikyu') return {
      species: hisuianSamurott.species, item: 'Sitrus Berry', ability: 'Sharpness', nature: 'Adamant',
      evs: { hp: 32, atk: 32, spd: 2 }, moves: ['Ceaseless Edge', 'Razor Shell', 'Sucker Punch', 'Sacred Sword'],
    };
    return member;
  });
}

const sunPreview = ['Aerodactyl', 'Primarina', 'Gholdengo'];
// The first member is the lead. Identical visible sixes must use one plan.
const preview = {
  sun: sunPreview,
  rain: ['Gholdengo', 'Garchomp', 'Rillaboom'],
  mence: ['Primarina', 'Gholdengo', 'Aerodactyl'],
  megaGolisopod: ['Garchomp', 'Aerodactyl', 'Gholdengo'],
  psychic: ['Gholdengo', 'Aerodactyl', 'Primarina'],
  charX: sunPreview,
  lucarioZ: ['Garchomp', 'Aerodactyl', 'Primarina'],
  stall: ['Gholdengo', 'Rillaboom', 'Primarina'],
  steelBunker: ['Garchomp', 'Gholdengo', 'Aerodactyl'],
  lastRespects: ['Garchomp', hisuianSamurott.species, 'Gholdengo'],
  realE_sun_lastRespects: ['Aerodactyl', 'Gholdengo', hisuianSamurott.species],
  shedTail: ['Aerodactyl', 'Primarina', 'Gholdengo'],
  batonPass: ['Aerodactyl', 'Garchomp', hisuianSamurott.species],
  gyarados: ['Primarina', hisuianSamurott.species, 'Gholdengo'],
  volcarona: ['Garchomp', 'Aerodactyl', hisuianSamurott.species],
  hazardShift: ['Gholdengo', 'Rillaboom', 'Aerodactyl'],
  multiMega: [hisuianSamurott.species, 'Aerodactyl', 'Gholdengo'],
  rainPivot: ['Gholdengo', 'Garchomp', 'Rillaboom'],
  mixedElectric: ['Garchomp', 'Aerodactyl', 'Gholdengo'],
  snowVeil: ['Gholdengo', 'Aerodactyl', hisuianSamurott.species],
  trickRoom: ['Gholdengo', 'Primarina', hisuianSamurott.species],
  screens: ['Gholdengo', 'Primarina', 'Garchomp'],
};

const speciesOf = member => member.details.split(',')[0];

function move(request, id, mega = false) {
  const active = request.active[0];
  const index = active.moves.findIndex(entry => entry.id === id && !entry.disabled);
  return index < 0 ? null : `move ${index + 1}${mega && active.canMegaEvo ? ' mega' : ''}`;
}

function switchTo(request, info, species) {
  if (!info.canSwitch) return null;
  const index = request.side.pokemon.findIndex(member => !member.active &&
    !member.condition.endsWith(' fnt') && speciesOf(member).startsWith(species));
  return index < 0 ? null : `switch ${index + 1}`;
}

function ownPolicy(publicCase, request, bot, info) {
  const own = speciesOf(request.side.pokemon.find(member => member.active));
  const foe = bot.foeActive;
  if (own.startsWith('Aerodactyl')) {
    if (publicCase === 'sun' && info.turn === 1) {
      if (foe === 'Charizard') return move(request, 'taunt', true);
      if (foe === 'Garchomp') return switchTo(request, info, 'Primarina') ?? move(request, 'icefang', true);
    }
    if (foe === 'Charizard-Mega-X') return move(request, 'earthquake', true);
    if (foe.startsWith('Charizard') || ['Mimikyu', 'Baxcalibur'].includes(foe)) return move(request, 'rockblast', true);
    if (foe === 'Garchomp') return move(request, 'icefang', true);
    if (['Primarina', 'Corviknight'].includes(foe)) return switchTo(request, info, 'Gholdengo');
    if (foe === 'Orthworm') {
      if (info.turn === 1) return move(request, 'taunt', true);
      return switchTo(request, info, 'Gholdengo') ?? move(request, 'rockblast', true);
    }
    if (foe === 'Scolipede' && info.turn === 1) return move(request, 'taunt', true);
  }
  if (own === 'Gholdengo') {
    if (foe.startsWith('Swampert')) return switchTo(request, info, 'Rillaboom');
    if (info.lockReason === 'choice') {
      if (['Garchomp', 'Dragonite', 'Baxcalibur'].includes(foe)) return switchTo(request, info, 'Aerodactyl');
      if (foe === 'Gholdengo') return switchTo(request, info, 'Samurott');
    }
  }
  if (own === 'Garchomp' && (foe === 'Garchomp' || (foe === 'Gholdengo' && bot.foeItem === 'Air Balloon'))) {
    return move(request, 'scaleshot');
  }
  if (own.startsWith('Samurott') && foe === 'Gholdengo') return move(request, 'ceaselessedge');
  if (foe.startsWith('Basculegion')) {
    if (own.startsWith('Samurott')) return move(request, 'suckerpunch');
    return switchTo(request, info, 'Samurott');
  }
  return null;
}

const rivalPolicies = {
  pivot: (request, bot, info) => info.turn === 1 ? switchTo(request, info, 'Mimikyu') : null,
  rock: (request, bot, info) => info.turn === 1 ? move(request, 'rockslide') : null,
  fairy: (request, bot, info) => info.turn === 1 ? move(request, 'playrough') : null,
  ghost: (request, bot, info) => info.turn === 1 ? move(request, 'shadowclaw') : null,
  last: (request, bot) => bot.foeActive && speciesOf(request.side.pokemon.find(member => member.active)).startsWith('Basculegion')
    ? move(request, 'lastrespects') : null,
  wave: request => speciesOf(request.side.pokemon.find(member => member.active)).startsWith('Basculegion')
    ? move(request, 'wavecrash') : null,
  shed: (request, bot, info) => info.turn === 1 ? move(request, 'shedtail') : null,
  baton: (request, bot, info) => info.turn === 1 ? move(request, 'protect') : info.turn === 2 ? move(request, 'batonpass') : null,
};

function scenarios() {
  const standard = cases().filter(entry => Object.hasOwn(preview, entry.id));
  const sun = standard.find(entry => entry.id === 'sun');
  const [leadY, , leadGarchomp, leadMimikyu] = sun.branches;
  sun.branches.push(
    { ...leadY, id: 'Y_pivot_Mimikyu', policy: 'pivot' },
    { ...leadGarchomp, id: 'Garchomp_Rock_Slide', policy: 'rock' },
    { ...leadMimikyu, id: 'Mimikyu_Play_Rough', policy: 'fairy' },
    { ...leadMimikyu, id: 'Mimikyu_Shadow_Claw', policy: 'ghost' },
  );
  const last = opponents().find(entry => entry.id === 'lastRespects');
  last.branches = last.branches.map(branch => ({ ...branch, policy: 'last' }));
  last.branches.push({ ...last.branches[0], id: 'leadMegaWaveCrash', policy: 'wave' });
  const real = oldDiagnostics().find(entry => entry.id === 'realE_sun_lastRespects');
  const toBranch = (three, index) => ({ id: `reported_${index}`, three, policy: 'last' });
  const withPasser = passer => sun.team.map(member => member.species === 'Primarina' ? passer : member);
  const orthworm = {
    species: 'Orthworm', item: 'Sitrus Berry', ability: 'Earth Eater', nature: 'Impish',
    evs: { hp: 32, def: 32, spd: 2 }, moves: ['Shed Tail', 'Iron Head', 'Body Press', 'Stealth Rock'],
  };
  const scolipede = {
    species: 'Scolipede', item: 'Mental Herb', ability: 'Speed Boost', nature: 'Jolly',
    evs: { hp: 32, def: 2, spe: 32 }, moves: ['Protect', 'Iron Defense', 'Baton Pass', 'Megahorn'],
  };
  const extra = oldDiagnostics().filter(entry => entry.move).map(entry => {
    const branches = entry.threes.map((three, index) => ({ id: `setup_${index}`, three, openingMove: entry.move }));
    if (['snowVeil', 'trickRoom'].includes(entry.id)) {
      for (const branch of branches) {
        branch.itemOverrides = { [branch.three[0]]: 'Focus Sash' };
        const currentSash = entry.team.find(member => member.item === 'Focus Sash');
        if (currentSash) branch.itemOverrides[currentSash.species] = 'Miracle Seed';
      }
    }
    return { id: entry.id, team: entry.team, branches };
  });
  return [...standard, ...extra, last, { id: real.id, team: real.team, branches: real.threes.map(toBranch) }, {
    id: 'shedTail', team: withPasser(orthworm), branches: [
      { id: 'sitrus', three: ['Orthworm', 'Garchomp', 'Mimikyu'], policy: 'shed' },
      { id: 'herb', item: 'Mental Herb', three: ['Orthworm', 'Garchomp', 'Mimikyu'], policy: 'shed' },
    ],
  }, {
    id: 'batonPass', team: withPasser(scolipede), branches: [
      { id: 'speedToGarchomp', three: ['Scolipede', 'Garchomp', 'Mimikyu'], policy: 'baton' },
      { id: 'charizardInBack', three: ['Scolipede', 'Charizard', 'Gholdengo'], policy: 'baton' },
    ],
  }];
}

function observe(result) {
  const actions = result.log.split('\n').filter(line => line.startsWith('|move|') || line.startsWith('|faint|'));
  let enemyFaints = 0;
  const lastRespectsFaints = [];
  for (const line of actions) {
    if (line.startsWith(`|faint|${result.foeSide}`)) enemyFaints++;
    if (line.startsWith(`|move|${result.foeSide}`) && line.includes('|Last Respects|')) lastRespectsFaints.push(enemyFaints);
  }
  return {
    won: result.won, turns: result.turns, actualFoe: result.foe,
    early: earlyLines(result.log, result.ownSide, 8),
    decisions: result.choiceTrace.filter(choice => choice.turn <= 3),
    sun: result.log.includes('|-weather|SunnyDay'), rain: result.log.includes('|-weather|RainDance'),
    shedSubstitute: result.log.split('\n').some(line => line.startsWith(`|-start|${result.foeSide}`) && line.includes('|Substitute') && line.includes('Shed Tail')),
    batonReceivers: result.log.split('\n')
      .filter(line => line.startsWith(`|switch|${result.foeSide}`) && line.includes('Baton Pass'))
      .map(line => line.split('|')[3].split(',')[0]),
    lastRespectsFaints,
    field: result.log.split('\n').filter(line => /^\|-(side|field)start\|/.test(line)),
  };
}

function rivalPolicy(branch) {
  if (branch.openingMove) {
    const id = branch.openingMove.toLowerCase().replace(/[^a-z]/g, '');
    return (request, bot, info) => info.turn === 1 ? move(request, id) : null;
  }
  if (branch.policy === 'switch') return (request, bot, info) => info.turn === 1 ? switchTo(request, info, 'Garchomp') : null;
  return rivalPolicies[branch.policy];
}

async function main() {
  const engine = execFileSync('git', ['-C', process.env.SHOWDOWN_DIR, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (engine !== PIN) throw new Error(`Unexpected engine revision ${engine}`);
  const sim = load();
  const own = team();
  validate(sim, own, 'PokeNavi Aerodactyl');
  const rows = [];
  const all = scenarios();
  const seen = new Map();
  for (const [scenarioIndex, scenario] of all.entries()) {
    const three = preview[scenario.id];
    if (new Set(three).size !== 3 || !three.every(species => own.some(member => member.species === species))) {
      throw new Error(`Invalid preview for ${scenario.id}`);
    }
    const publicKey = scenario.team.map(member => member.species).sort().join('/');
    const prior = seen.get(publicKey);
    if (prior && three.join('/') !== prior.three.join('/')) throw new Error(`Inconsistent preview for ${publicKey}`);
    if (!prior) seen.set(publicKey, { id: scenario.id, three });
    const script = ownPolicy.bind(null, seen.get(publicKey).id);

    for (const [branchIndex, branch] of scenario.branches.entries()) {
      const rival = structuredClone(scenario.team);
      if (branch.item) rival.find(member => member.species === branch.three[0]).item = branch.item;
      for (const member of rival) {
        if (branch.itemOverrides?.[member.species]) member.item = branch.itemOverrides[member.species];
      }
      validate(sim, rival, `${scenario.id}/${branch.id}`);
      const observations = [];
      for (let seedIndex = 0; seedIndex < 10; seedIndex++) {
        const seed = hashSeed(63310100 + scenarioIndex * 1000 + branchIndex * 100 + seedIndex);
        const reverse = seedIndex % 2 === 1;
        const result = await battle(sim, structuredClone(own), structuredClone(rival), seed, {
          ownThree: three, foeThree: branch.three, reverse,
          ownOptions: { script }, script: rivalPolicy(branch),
          rivalImmuneAware: true, choiceAudit: true,
        });
        if (result.errors || result.foe.join('/') !== branch.three.join('/')) {
          throw new Error(`Battle diverged from the protocol in ${scenario.id}/${branch.id}`);
        }
        observations.push({ seed, reverse, ...observe(result) });
      }
      const wins = observations.filter(result => result.won).length;
      rows.push({ scenario: scenario.id, branch, three, wins, observations });
      console.log(`${scenario.id}/${branch.id} ${wins}/${observations.length}`);
    }
  }
  mkdirSync('output', { recursive: true });
  writeFileSync('output/m8-pokenavi-aero-verified-20261105.json', JSON.stringify({ engine, own, scenarios: all, rows }, null, 2));
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { team, preview, scenarios, rivalPolicy, ownPolicy };
