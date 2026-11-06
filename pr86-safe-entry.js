'use strict';
// PR #86 request P0-1 (ChatGPT review #5720466858 of PR #85): the PR #85 V3
// T1/T2 entry lifted in-sample cells (human1 0.556 -> 0.681) but was WORSE than
// the base AI on rival 3+lead cells it had not seen (0.793 -> 0.753, 8 worse /
// 2 better / 12 equal). This module decides WHEN a tabled rule may override
// the base AI. Everything not passing the gate returns to the base AI, and the
// reason ('uncovered', 'forced', 'abstain:<gate>') is reported.
// Gates use only (a) the frozen offline table and its frozen TRAIN games and
// (b) the public observation at the decision point. No rival three, set, item,
// move list, branch, hypothesis or future event reaches safeDecide (the V3
// observation/cond checks still throw on any non-public field).
//   v3        PR #85 behaviour: every tabled rule fires
//   t2only    only T2 rules (a T1 rule commits before the rival's T1 action
//             reveals anything about its back two)
//   loco      leave-one-cell-out: a rule fires only if it was trained on >= 2
//             (hypothesis, rival 3+lead) cells, buildTable without each cell
//             still returns the same rule, AND on that held-out cell the
//             rule's mean is >= the base AI's mean
//   loco_t2   loco AND T2 only
//   abstain   never deviate (= base AI; the reference)
// Selection rule (declared before any DEV/FINAL game): on DEV, among gates
// whose 22-hypothesis mean over RATIONAL games is >= abstain's and whose
// count of hypotheses worse than abstain by > 0.05 is <= the count better by
// > 0.05, pick the highest mean (ties -> fewer deviations). None -> abstain.
// RATIONAL games: rival branch != 'utility' (PR #81 first-utility-move branch
// can play a useless move) and no rival T1/T2 utility move labelled
// 'irrational' by utilityAudit. FINAL is then run once and reported as is.
// Heuristic AI vs heuristic AI. NOT a ladder win rate.
const M=require('./pr82-switch-utility-t1t2');
const C=require('./pr84-public-cond-entry');
const GATES=['abstain','v3','t2only','loco','loco_t2'];
const groupOf=cond=>cond.split('|').slice(0,2).join('|');   // hyp|cell:foe (drop branch)
// games: [{key,label,cond,won}] exactly as fed to M.buildTable for the V3 table.
function locoKeys(games,table,params={}){
  const byKey={};for(const g of games)(byKey[g.key]||(byKey[g.key]=[])).push(g);
  const pass=new Set(),detail={};
  for(const [key,rule] of Object.entries(table.rules)){
    if(rule.status!=='rule')continue;
    const G=byKey[key]||[],groups=[...new Set(G.map(g=>groupOf(g.cond)))];
    const why=[];
    if(groups.length<2)why.push('trained on '+groups.length+' cell');
    for(const grp of groups){
      if(why.length)break;
      const rest=G.filter(g=>groupOf(g.cond)!==grp),held=G.filter(g=>groupOf(g.cond)===grp);
      const r=M.buildTable(rest,params).rules[key];
      if(!r||r.status!=='rule'||r.action!==rule.action){why.push('without '+grp+': '+(r?r.status+(r.action?' '+r.action:''):'none'));break;}
      const mOf=l=>{const x=held.filter(g=>g.label===l);return x.length?x.reduce((s,g)=>s+g.won,0)/x.length:null;};
      const a=mOf(rule.action),b=mOf('=base');
      if(a==null||b==null||a<b){why.push('held-out '+grp+': rule '+(a==null?'-':a.toFixed(2))+' < base '+(b==null?'-':b.toFixed(2)));break;}
    }
    detail[key]=why.length?why[0]:'pass ('+groups.length+' cells)';
    if(!why.length)pass.add(key);
  }
  return {pass,detail};
}
function allowed(gate,turn,key,loco){
  if(gate==='abstain')return false;
  if(gate==='v3')return true;
  if(gate==='t2only')return turn===2;
  if(gate==='loco')return loco.has(key);
  if(gate==='loco_t2')return turn===2&&loco.has(key);
  throw Error('unknown gate '+gate);
}
// Public-only executable decision. obs = V3 observation (decideEarlyV3 checks).
function safeDecide(table,obs,{gate,loco=new Set()}){
  if(!GATES.includes(gate))throw Error('unknown gate '+gate);
  const d=C.decideEarlyV3(table,obs);
  if(d.status!=='rule')return d;
  if(!allowed(gate,obs.turn,d.key,loco))return {status:'abstain',action:null,key:d.key,reason:'abstain:'+gate+' (tabled '+d.action+')',tabled:d.action};
  return d;
}
module.exports={GATES,locoKeys,safeDecide,groupOf};
