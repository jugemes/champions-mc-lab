'use strict';
/** Experimental read-only parser/probe for poke-engine's BSS MCTS output.
 * Does not alter the existing lab AI, choose unseen opponent threes, or assert
 * that poke-engine matches the pinned Pokémon Champions Showdown rules.
 */
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const normalize = x => String(x).toLowerCase().replace(/[^a-z0-9]/g, '');

function previewChoices(ownSix) {
  if (!Array.isArray(ownSix) || ownSix.length !== 6 ||
      ownSix.some(x => typeof x !== 'string' || !normalize(x)) ||
      new Set(ownSix.map(normalize)).size !== 6) {
    throw Error('ownSix must have exactly six distinct species/form identifiers');
  }
  const result = [];
  for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++)
    for (let k = j + 1; k < 6; k++) {
      for (const lead of [i, j, k]) {
        const bench = [i, j, k].filter(x => x !== lead);
        result.push({lead: normalize(ownSix[lead]), bench: bench.map(x => normalize(ownSix[x])),
          key: [normalize(ownSix[lead]), ...bench.map(x => normalize(ownSix[x])).sort()].join(',')});
      }
    }
  return result;
}

function parseMctsOutput(output) {
  if (typeof output !== 'string') throw Error('MCTS stdout must be a string');
  const line = output.split(/\r?\n/).find(x => /^side one:\s*/i.test(x.trim()));
  if (!line) throw Error('Missing poke-engine MCTS "side one:" result');
  const totalMatch = output.match(/Total Iterations:\s*(\d+)/i);
  const totalIterations = totalMatch ? Number(totalMatch[1]) : null;
  const numeric = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?';
  const rx = new RegExp('^(.+),(' + numeric + '),(\\d+)$');
  const entries = line.replace(/^\s*side one:\s*/i, '').split('|').filter(Boolean).map(chunk => {
    const m = chunk.trim().match(rx);
    if (!m) throw Error('Invalid poke-engine MCTS entry: ' + chunk.slice(0, 100));
    const visits = Number(m[3]), totalScore = Number(m[2]);
    if (!Number.isSafeInteger(visits) || visits < 0 || !Number.isFinite(totalScore)) {
      throw Error('Invalid MCTS count/score');
    }
    return {action: m[1].trim(), visits, totalScore,
      meanScore: visits ? totalScore / visits : null};
  });
  if (!entries.length || new Set(entries.map(x => x.action.toLowerCase())).size !== entries.length) {
    throw Error('Missing or duplicate MCTS actions');
  }
  return {totalIterations, entries};
}

function inspectPreview(output, ownSix, {requireAll60 = true} = {}) {
  const allowed = previewChoices(ownSix);
  const byKey = new Map(allowed.map(x => [x.key, x]));
  const parsed = parseMctsOutput(output);
  const choices = parsed.entries.map(entry => {
    const parts = entry.action.split(',').map(normalize);
    if (parts.length !== 3 || new Set(parts).size !== 3) {
      throw Error('Non-preview MCTS action: ' + entry.action);
    }
    const canonical = [parts[0], ...parts.slice(1).sort()].join(',');
    const legal = byKey.get(canonical);
    if (!legal) throw Error("Not one of the user's 60 public-six selections: " + entry.action);
    return {...entry, lead: legal.lead, bench: legal.bench};
  });
  if (new Set(choices.map(x => [x.lead, ...x.bench.slice().sort()].join(','))).size !== choices.length) {
    throw Error('Duplicate selection after bench-order canonicalization');
  }
  if (requireAll60 && choices.length !== 60) {
    throw Error('Incomplete BSS preview: ' + choices.length + '/60 candidate actions');
  }
  choices.sort((a, b) => b.visits - a.visits || b.totalScore - a.totalScore ||
    a.action.localeCompare(b.action));
  return {status: 'UNVALIDATED_ENGINE_CANDIDATE', totalIterations: parsed.totalIterations,
    candidateCount: choices.length, ranked: choices,
    notice: 'Visits are not probabilities of winning. Enemy sets are hypothetical; no M-C oracle agreement or human win rate established.'};
}

function runExperimentalProbe({binary, stateString, ownSix, scenarioProvenance,
  timeMs = 300, iterations = 0}) {
  if (scenarioProvenance !== 'public-six-hypothesis') {
    throw Error('Refuse hidden team/set source: use public-six-hypothesis, never actual unseen opponent sets');
  }
  if (typeof binary !== 'string' || !path.isAbsolute(binary)) {
    throw Error('Pass a trusted absolute local poke-engine binary path');
  }
  if (typeof stateString !== 'string' || !stateString.trim()) {
    throw Error('State serialization must be supplied by a separate audited Showdown-to-poke-engine mapper');
  }
  if (!Number.isInteger(timeMs) || timeMs < 50 || timeMs > 5000 ||
      !Number.isInteger(iterations) || iterations < 0 || iterations > 1_000_000) {
    throw Error('Outside bounded MCTS budget');
  }
  const args = ['monte-carlo-tree-search', '--state', stateString,
    '--time-to-search-ms', String(timeMs), '--iterations', String(iterations), '--threads', '1'];
  const result = spawnSync(binary, args, {encoding: 'utf8', timeout: timeMs + 4000,
    maxBuffer: 8 * 1024 * 1024, shell: false});
  if (result.error || result.status !== 0) {
    throw Error('poke-engine failed; status=' + result.status + '; ' +
      (result.error?.message || String(result.stderr || '').slice(0, 300)));
  }
  return inspectPreview(result.stdout, ownSix);
}

module.exports = {previewChoices, parseMctsOutput, inspectPreview, runExperimentalProbe};
