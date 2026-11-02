'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {assessPublicBranchRobustness}=require('../public-branch-robustness');
const rows=[
 {case:'public-six-A',opponentT1:'stay',alternatives:{
  x:{wins:4,losses:0},y:{wins:2,losses:2}}},
 {case:'public-six-A',opponentT1:'pivot',alternatives:{
  x:{wins:0,losses:4},y:{wins:2,losses:2}}},
 {case:'public-six-B',opponentT1:'stay',alternatives:{
  x:{wins:1,losses:3},y:{wins:0,losses:4}}},
 {case:'public-six-B',opponentT1:'pivot',alternatives:{
  x:{wins:3,losses:1},y:{wins:4,losses:0}}}
];
test('counterfactual evidence gate never hides a losing public-six branch in pooled wins',()=>{
 const out=assessPublicBranchRobustness(rows);
 assert.equal(out.byCandidate.x.cases['public-six-A'].branchSwing,4);
 assert.equal(out.byCandidate.x.cases['public-six-A'].worstWins,0);
 assert.equal(out.byCandidate.x.worstWinsAcrossCases,0);
 assert.equal(out.byCandidate.x.supportedAcrossAllTestedBranches,false);
 assert.equal(out.byCandidate.y.cases['public-six-A'].worstWins,2);
 assert.equal(out.byCandidate.y.cases['public-six-B'].worstWins,0);
 assert.equal(out.byCandidate.y.supportedAcrossAllTestedBranches,false);
 assert.equal(out.noOpponentPolicyWeights,true);
 assert.equal(out.noHumanWinRateClaim,true);
});
test('branch audit rejects one-policy, mismatched-candidate and duplicate-policy comparisons',()=>{
 assert.throws(()=>assessPublicBranchRobustness(rows.slice(0,1)),/two counterfactual/);
 assert.throws(()=>assessPublicBranchRobustness([rows[0],rows[0]]),/duplicate case/);
 const bad=structuredClone(rows);
 delete bad[1].alternatives.y;
 assert.throws(()=>assessPublicBranchRobustness(bad),/candidate set changed/);
});
