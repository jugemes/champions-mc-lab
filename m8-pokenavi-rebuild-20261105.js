'use strict';

const { writeFileSync, mkdirSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const { load, hashSeed } = require('./lab');
const { cases, validate, runOne, PIN } = require('./m8-open8-battle-study-20261105');
const { groups } = require('./environment-m7-teams');
const { battle, earlyLines } = require('./encore-lead-audit');

// PokeNavi's suggestions 1 and 3, generated on November 5 with the anchor blank.
// Fix one preview selection for each public six before looking at branch results.
const set = (species, item, ability, nature, evs, ...moves) =>
  ({ species, item, ability, nature, evs, moves });

function teams() {
  return {
    navi1: [
      set('Garchomp', 'Choice Scarf', 'Rough Skin', 'Jolly', { hp: 2, atk: 32, spe: 32 }, 'Rock Tomb', 'Outrage', 'Earthquake', 'Poison Jab'),
      set('Mimikyu', 'Life Orb', 'Disguise', 'Adamant', { hp: 2, atk: 32, spe: 32 }, 'Shadow Sneak', 'Play Rough', 'Swords Dance', 'Shadow Claw'),
      set('Hippowdon', 'Sitrus Berry', 'Sand Stream', 'Careful', { hp: 32, def: 32, spd: 2 }, 'Yawn', 'Earthquake', 'Whirlwind', 'Stealth Rock'),
      set('Primarina', 'Air Balloon', 'Torrent', 'Modest', { hp: 32, def: 32, spd: 2 }, 'Surf', 'Encore', 'Flip Turn', 'Moonblast'),
      set('Golisopod', 'Golisopite', 'Emergency Exit', 'Adamant', { hp: 32, atk: 32, spd: 2 }, 'Leech Life', 'Swords Dance', 'Sucker Punch', 'Drill Run'),
      set('Charizard', 'Charizardite Y', 'Blaze', 'Bold', { hp: 32, def: 32, spa: 2 }, 'Dragon Pulse', 'Weather Ball', 'Overheat', 'Solar Beam'),
    ],
    navi3: [
      set('Garchomp', 'Focus Sash', 'Rough Skin', 'Adamant', { hp: 2, atk: 32, spe: 32 }, 'Rock Slide', 'Earthquake', 'Swords Dance', 'Scale Shot'),
      set('Gholdengo', 'Choice Scarf', 'Good as Gold', 'Modest', { hp: 2, spa: 32, spe: 32 }, 'Thunderbolt', 'Make It Rain', 'Shadow Ball', 'Power Gem'),
      set('Golisopod', 'Golisopite', 'Emergency Exit', 'Adamant', { hp: 32, atk: 32, spd: 2 }, 'Leech Life', 'Swords Dance', 'Sucker Punch', 'Iron Head'),
      set('Primarina', 'Leftovers', 'Torrent', 'Modest', { hp: 32, def: 32, spd: 2 }, 'Sparkling Aria', 'Substitute', 'Calm Mind', 'Moonblast'),
      set('Salamence', 'Salamencite', 'Intimidate', 'Naive', { atk: 16, spa: 18, spe: 32 }, 'Earthquake', 'Double-Edge', 'Fire Blast', 'Draco Meteor'),
      set('Mimikyu', 'Life Orb', 'Disguise', 'Adamant', { hp: 2, atk: 32, spe: 32 }, 'Shadow Sneak', 'Play Rough', 'Swords Dance', 'Wood Hammer'),
    ],
  };
}

// The first entry is the lead. Branch contents are never passed to this lookup.
const preview = {
  sun: { navi1: ['Garchomp', 'Primarina', 'Mimikyu'], navi3: ['Garchomp', 'Gholdengo', 'Primarina'] },
  rain: { navi1: ['Primarina', 'Hippowdon', 'Golisopod'], navi3: ['Gholdengo', 'Primarina', 'Mimikyu'] },
  megaGolisopod: { navi1: ['Charizard', 'Garchomp', 'Primarina'], navi3: ['Garchomp', 'Salamence', 'Gholdengo'] },
  lastRespects: { navi1: ['Garchomp', 'Golisopod', 'Primarina'], navi3: ['Garchomp', 'Golisopod', 'Primarina'] },
  psychic: { navi1: ['Garchomp', 'Charizard', 'Primarina'], navi3: ['Gholdengo', 'Salamence', 'Primarina'] },
  mence: { navi1: ['Garchomp', 'Primarina', 'Mimikyu'], navi3: ['Primarina', 'Garchomp', 'Mimikyu'] },
  charX: { navi1: ['Garchomp', 'Primarina', 'Mimikyu'], navi3: ['Garchomp', 'Primarina', 'Mimikyu'] },
};

function opponents() {
  const standard = cases().filter(entry => Object.hasOwn(preview, entry.id));
  const lastRespects = groups[5];
  return [...standard, {
    id: 'lastRespects', team: lastRespects.team,
    branches: [
      { id: 'leadMega', three: lastRespects.forcedA, policy: 'ai' },
      { id: 'leadMimikyu', three: [lastRespects.forcedA[2], lastRespects.forcedA[0], lastRespects.forcedA[1]], policy: 'ai' },
    ],
  }];
}

// Follow-up after the first comparison. Both arms use the same public lead
// rule. Rain and the Basculegion matchup each use one fixed three per team.
const followupPreview = {
  sun: { navi3: preview.sun.navi3, grass: preview.sun.navi3 },
  rain: { navi3: ['Gholdengo', 'Garchomp', 'Mimikyu'], grass: ['Gholdengo', 'Garchomp', 'Rillaboom'] },
  lastRespects: { navi3: preview.lastRespects.navi3, grass: ['Garchomp', 'Mimikyu', 'Primarina'] },
};

function followupTeams() {
  const { navi3 } = teams();
  const grass = navi3.map(member => member.species === 'Golisopod'
    ? set('Rillaboom', 'Miracle Seed', 'Grassy Surge', 'Adamant', { hp: 32, atk: 32, spd: 2 }, 'Grassy Glide', 'High Horsepower', 'Knock Off', 'U-turn')
    : member);
  return { navi3, grass };
}

function speedTeam() {
  const { grass } = followupTeams();
  return grass.map(member => {
    if (member.species === 'Garchomp') {
      return set('Starmie', 'Choice Scarf', 'Natural Cure', 'Timid', { hp: 2, spa: 32, spe: 32 }, 'Ice Beam', 'Power Gem', 'Hydro Pump', 'Grass Knot');
    }
    if (member.species === 'Gholdengo') return { ...member, item: 'Air Balloon' };
    return member;
  });
}

function planFor(mode) {
  const { grass } = followupTeams();
  switch (mode) {
    case 'rebuild': return { candidates: teams(), plans: preview, seedBase: 52005100 };
    case 'followup': return { candidates: followupTeams(), plans: followupPreview, seedBase: 52005300 };
    case 'speed': return {
      candidates: { grass, speed: speedTeam() }, seedBase: 52008100,
      plans: {
        sun: { grass: followupPreview.sun.grass, speed: ['Starmie', 'Gholdengo', 'Primarina'] },
        rain: { grass: followupPreview.rain.grass, speed: ['Gholdengo', 'Starmie', 'Rillaboom'] },
      },
    };
    case 'sun-lead': return {
      candidates: { menceLead: grass, primarinaLead: grass }, seedBase: 52009100,
      plans: { sun: {
        menceLead: ['Salamence', 'Primarina', 'Gholdengo'],
        primarinaLead: ['Primarina', 'Salamence', 'Gholdengo'],
      } },
    };
    default: throw new Error(`Unknown study mode ${mode}`);
  }
}

function publicSwitch(request, bot, info) {
  if (!info.canSwitch) return null;
  const party = request.side.pokemon;
  const active = party.find(member => member.active)?.details.split(',')[0];
  let target;
  if (info.turn === 1 && ['Garchomp', 'Salamence'].includes(active) && bot.foeActive === 'Garchomp') target = 'Primarina';
  if (active === 'Gholdengo' && bot.foeActive.startsWith('Swampert')) target = 'Rillaboom';
  if (!target) return null;
  const index = party.findIndex(member => !member.active && !member.condition.endsWith(' fnt') && member.details.split(',')[0] === target);
  return index < 0 ? null : `switch ${index + 1}`;
}

async function runFollowup(sim, team, scenario, three, branch, seed, reverse) {
  const result = await battle(sim, structuredClone(team), structuredClone(scenario.team), seed, {
    ownThree: three, foeThree: branch.three, reverse,
    ownOptions: { script: publicSwitch }, rivalImmuneAware: true, choiceAudit: true,
  });
  if (result.errors) throw new Error(`Choice errors in ${scenario.id}/${branch.id}`);
  return {
    won: result.won, turns: result.turns, actualFoe: result.foe,
    early: earlyLines(result.log, result.ownSide, 8),
    choices: result.choiceTrace.filter(choice => choice.turn <= 3),
    observedSun: result.log.includes('|-weather|SunnyDay'),
    observedRain: result.log.includes('|-weather|RainDance'),
    observedLastRespects: result.log.includes('|Last Respects|'),
  };
}

async function main(mode = 'rebuild') {
  const engine = execFileSync('git', ['-C', process.env.SHOWDOWN_DIR, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (engine !== PIN) throw new Error(`Unexpected Showdown revision ${engine}`);
  const sim = load();
  const followup = mode !== 'rebuild';
  const { candidates, plans, seedBase } = planFor(mode);
  const scenarios = opponents().filter(scenario => Object.hasOwn(plans, scenario.id));
  for (const [name, team] of Object.entries(candidates)) validate(sim, team, name);
  for (const scenario of scenarios) validate(sim, scenario.team, scenario.id);

  const results = [];
  for (const [caseIndex, scenario] of scenarios.entries()) {
    for (const [branchIndex, branch] of scenario.branches.entries()) {
      for (const [name, team] of Object.entries(candidates)) {
        const three = plans[scenario.id][name];
        if (new Set(three).size !== 3 || !three.every(species => team.some(member => member.species === species))) {
          throw new Error(`Invalid preview ${name}/${scenario.id}`);
        }
        const observations = [];
        for (const seedIndex of followup ? [0, 1, 2] : [0, 1]) {
          const seed = hashSeed(seedBase + caseIndex * 100 + branchIndex * 10 + seedIndex);
          const reverse = seedIndex === 1;
          const result = followup
            ? await runFollowup(sim, team, scenario, three, branch, seed, reverse)
            : await runOne(sim, team, scenario, { three, lead: three[0] }, branch, seed, reverse);
          observations.push({ seed, reverse, ...result });
        }
        const wins = observations.filter(observation => observation.won).length;
        results.push({ scenario: scenario.id, branch: branch.id, name, three, wins, observations });
        console.log(`${scenario.id}/${branch.id} ${name} ${wins}/${observations.length}`);
      }
    }
  }
  mkdirSync('output', { recursive: true });
  writeFileSync(`output/m8-pokenavi-${mode}-20261105.json`, JSON.stringify({ engine, candidates, scenarios, results }, null, 2));
}

if (require.main === module) {
  const mode = process.argv[2]?.replace(/^--/, '') ?? 'rebuild';
  main(mode).catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { teams, preview, opponents, planFor };
