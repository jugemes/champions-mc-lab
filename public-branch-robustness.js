'use strict';
// Research-only adversarial-branch evidence gate. This is NOT an opponent
// probability model, a minimax player, or proof that scripted rivals are human.
// Compare each fixed own 3+lead against EVERY preregistered opposing T1 policy
// inside the SAME public-six scenario. Do not average away a catastrophic
// counter-branch, and do not pool different public sixes as usage frequencies.
function assessPublicBranchRobustness(rows) {
  if (!Array.isArray(rows) || !rows.length) throw Error('nonempty full-Battle rows required');
  const byCase = new Map();
  for (const row of rows) {
    if (!row || typeof row.case !== 'string' || typeof row.opponentT1 !== 'string' ||
        !row.alternatives || typeof row.alternatives !== 'object')
      throw Error('case, opponentT1 and alternatives required');
    const modes = byCase.get(row.case) || new Map();
    if (modes.has(row.opponentT1)) throw Error('duplicate case/mode');
    modes.set(row.opponentT1, row.alternatives);
    byCase.set(row.case, modes);
  }
  const candidateNames = Object.keys(rows[0].alternatives).sort();
  if (!candidateNames.length) throw Error('at least one candidate required');
  const byCandidate = {};
  for (const name of candidateNames) {
    const cases = {};
    for (const [id, modes] of byCase) {
      if (modes.size < 2) throw Error('at least two counterfactual policies per public six');
      const branches = {};
      for (const [mode, alternatives] of modes) {
        if (Object.keys(alternatives).sort().join('|') !== candidateNames.join('|'))
          throw Error('candidate set changed between counterfactual branches');
        const result = alternatives[name];
        if (!result || !Number.isInteger(result.wins) ||
            !Number.isInteger(result.losses) || result.wins < 0 || result.losses < 0 ||
            result.wins + result.losses === 0)
          throw Error('invalid full-Battle win/loss cell');
        branches[mode] = {wins: result.wins, games: result.wins + result.losses};
      }
      const values = Object.values(branches);
      cases[id] = {
        branches,
        worstWins: Math.min(...values.map(x=>x.wins)),
        bestWins: Math.max(...values.map(x=>x.wins)),
        // A swing is a diagnostic warning, not evidence that the policy
        // with the better outcome is more realistic or more frequent.
        branchSwing: Math.max(...values.map(x=>x.wins)) -
          Math.min(...values.map(x=>x.wins)),
        allPoliciesWonAtLeastOnce: values.every(x=>x.wins>0)
      };
    }
    byCandidate[name] = {
      cases,
      // A zero is NOT a proof of universal inferiority; it prevents using
      // this suite as evidence of a robust, transferable selection.
      worstWinsAcrossCases: Math.min(...Object.values(cases).map(x=>x.worstWins)),
      supportedAcrossAllTestedBranches:
        Object.values(cases).every(x=>x.allPoliciesWonAtLeastOnce)
    };
  }
  return {
    evidence:'fixed full-Battle counterfactuals only; opponent rationality unverified',
    noOpponentPolicyWeights:true,
    noHumanWinRateClaim:true,
    byCandidate
  };
}
module.exports = {assessPublicBranchRobustness};
