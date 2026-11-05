'use strict';
// OPEN7 research primitive: fixed three from public six, evaluated against
// multiple plausible opposing three. Pure deterministic proxy; NOT Battle.
function combinations(a,n=3){const out=[];function rec(start,chosen){if(chosen.length===n){out.push(chosen.slice());return;}for(let i=start;i<=a.length-(n-chosen.length);i++){chosen.push(a[i]);rec(i+1,chosen);chosen.pop();}}rec(0,[]);return out;}
function evaluateThree(ids,opposingThree,matrix){
  // A score for each opposing member is its best answer *within the SAME
  // three chosen teammates*. No unselected fourth-to-sixth rescue allowed.
  const perOpponent=opposingThree.map(k=>Math.max(...ids.map(i=>matrix[i][k])));
  return {minimum:Math.min(...perOpponent),mean:perOpponent.reduce((a,b)=>a+b,0)/perOpponent.length,perOpponent};
}
function choosePublicThree(sixIds,publicSix,opponentBranches,matrix){
  if(sixIds.length!==6||new Set(sixIds).size!==6)throw Error('Expected six distinct team indices');
  if(publicSix.length!==6)throw Error('Expected six public opponent indices');
  if(!opponentBranches.length)throw Error('No registered opponent hypotheses');
  if(new Set(publicSix).size!==6)throw Error('Public six must be distinct');
  if(new Set(sixIds).size!==6)throw Error('Own six must be distinct');
  const visible=new Set(publicSix);
  for(const branch of opponentBranches){
    if(branch.length!==3||new Set(branch).size!==3||branch.some(k=>!visible.has(k)))throw Error('Opponent branch must be three of the public six');
  }
  // Fail closed: missing/nonfinite proxy values otherwise silently rank a
  // candidate via NaN and yield an arbitrary 'best' team.
  for(const i of sixIds)for(const k of visible){
    if(!Number.isFinite(matrix?.[i]?.[k]))throw Error('Missing or nonfinite matchup score');
  }
  const scored=combinations(sixIds).map(ids=>{
    const branches=opponentBranches.map(b=>evaluateThree(ids,b,matrix));
    const worst=Math.min(...branches.map(b=>b.minimum));
    const avg=branches.reduce((n,b)=>n+b.mean,0)/branches.length;
    return {ids,worst,avg,branches};
  });
  scored.sort((a,b)=>b.worst-a.worst||b.avg-a.avg||a.ids.join(',').localeCompare(b.ids.join(',')));
  return {selected:scored[0],ranked:scored,limitations:[
    'Proxy only; not actual turn-based 3v3, damage, switching or speed',
    'The minimum of independent 1v1 best answers ignores opponent synergy, order and teammate attrition; branches with the same union are indistinguishable',
    'Opponent branches must be declared from the public six before results',
    'Do not pass the hidden actual opposing three to selection in live Battle'
  ]};
}
module.exports={combinations,evaluateThree,choosePublicThree};
