'use strict';
// OPEN8 evidence gate: reject invented, missing or mismatched full-Battle evidence.
// A battle record is one seed + side + pre-registered branch + own three/lead.
const {chooseByBranchOutcomes}=require('./m8-open8-branch-outcome-minimax-20261105');
const canon=x=>x.slice().sort().join('|');
function evaluateEvidence({ownSix,publicSix,branches,manifest,records}) {
  if(!Array.isArray(manifest)||!manifest.length||!Array.isArray(records))throw Error('Manifest and records required');
  const ids=new Set(), keys=new Set(), seen=new Map(), branchIds=new Set(branches.map(b=>b.id));
  if(branchIds.size!==branches.length)throw Error('Duplicate branches');
  for(const m of manifest){
    if(!m||typeof m.id!=='string'||!m.id||ids.has(m.id)||!branchIds.has(m.branch)||
      !Array.isArray(m.three)||m.three.length!==3||new Set(m.three).size!==3||
      m.three.some(x=>!ownSix.includes(x))||!m.three.includes(m.lead)||
      !Number.isSafeInteger(m.seed)||m.seed<0||![0,1].includes(m.side))throw Error('Invalid manifest');
    ids.add(m.id);
    const key=JSON.stringify([canon(m.three),m.lead,m.branch,m.seed,m.side]);
    if(keys.has(key))throw Error('Duplicate registered condition');
    keys.add(key);
  }
  for(const r of records){
    if(!r||!ids.has(r.id)||seen.has(r.id)||typeof r.battleId!=='string'||!r.battleId||
      typeof r.engineCommit!=='string'||!/^[a-f0-9]{40}$/.test(r.engineCommit)||
      !['win','loss','tie'].includes(r.result)||typeof r.logDigest!=='string'||!/^[a-f0-9]{64}$/.test(r.logDigest))throw Error('Invalid battle evidence');
    const m=manifest.find(x=>x.id===r.id);
    if(r.branch!==m.branch||canon(r.three||[])!==canon(m.three)||r.lead!==m.lead||r.seed!==m.seed||r.side!==m.side)throw Error('Battle condition mismatch');
    seen.set(r.id,r);
  }
  const grouped=new Map();
  for(const m of manifest){
    const key=JSON.stringify([canon(m.three),m.lead,m.branch]);
    if(!grouped.has(key))grouped.set(key,{m:[],r:[]});
    const g=grouped.get(key);g.m.push(m);if(seen.has(m.id))g.r.push(seen.get(m.id));
  }
  const outcomes=[];
  for(const g of grouped.values()){
    if(g.m.length!==g.r.length)continue;
    const score=g.r.reduce((s,r)=>s+(r.result==='win'?1:r.result==='tie'?0.5:0),0)/g.r.length;
    outcomes.push({three:g.m[0].three,lead:g.m[0].lead,branch:g.m[0].branch,score});
  }
  const evaluated=chooseByBranchOutcomes({ownSix,publicSix,branches,outcomes});
  return {...evaluated,evidence:{registered:manifest.length,received:seen.size,missing:manifest.filter(m=>!seen.has(m.id)).map(m=>m.id),completeGroups:outcomes.length,totalGroups:grouped.size},limitations:[...evaluated.limitations,'Battle IDs, engine hashes and log digests are structurally checked, not cryptographically verified against CI artifacts','A registered manifest must be frozen before results; caller is responsible for provenance and rational opponent policy']};
}
module.exports={evaluateEvidence};
