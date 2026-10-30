'use strict';
// PR #84 request item 2: PR #83 decideEarly keys a T2 observation by
// six / own 3+lead / rival T1 action class / both actives only. Two positions
// with different PUBLIC HP, status, hazards, weather, boosts, Choice/Encore
// lock or legal moves get the same rule. This adds a public-condition
// signature (cond) to the key; a table built with it returns 'uncovered' for an
// unseen condition instead of reusing a rule learned under another one.
// Everything in cond is visible to OUR player at the decision point (own
// request + public battle log). No rival three, set, item list, move list,
// branch, hypothesis or future event: unknown fields throw (as PR #83).
// Opt-in research module, NOT adopted. Heuristic AI vs AI, NOT a ladder win rate.
const M=require('./pr82-switch-utility-t1t2');
const OBS_KEYS_V3=new Set([...M.OBS_KEYS,'cond']);
const COND_KEYS=new Set(['ownHP','ownStatus','ownBoosts','ownEncored','ownHazards','foeHP','foeStatus','foeBoosts','foeEncored','foeHazards','weather','terrain']);
// HP to public buckets (percent HP is public for both sides).
const hpB=h=>h==null?'?':h>=0.995?'F':h>=0.5?'H':h>=0.25?'L':'C';
const sig=o=>Object.entries(o||{}).filter(([,v])=>v).map(([k,v])=>k+(v>0&&typeof v==='number'?'+'+v:v)).sort().join(',');
function condSig(c){
  if(!c)return 'nocond';
  for(const k of Object.keys(c))if(!COND_KEYS.has(k))throw Error('decideEarlyV3: non-public cond field "'+k+'"');
  return ['o:'+hpB(c.ownHP)+(c.ownStatus||'')+'/'+sig(c.ownBoosts)+(c.ownEncored?'/E':'')+'/h:'+sig(c.ownHazards),
    'f:'+hpB(c.foeHP)+(c.foeStatus||'')+'/'+sig(c.foeBoosts)+(c.foeEncored?'/E':'')+'/h:'+sig(c.foeHazards),
    'w:'+(c.weather||'')+'/t:'+(c.terrain||'')].join('|');
}
// legal labels are part of the key: Choice lock, Encore, Disable, PP-out and
// trapping all show up as a different legal set in the request.
function obsKeyV3(o){
  const legal=(o.legal||[]).slice().sort().join(',');
  return M.obsKey({...o,rivalT1Lead:o.rivalT1?.lead,rivalT1:o.rivalT1?.action})+'#'+condSig(o.cond)+'#L:'+legal;
}
function decideEarlyV3(table,obs){
  for(const k of Object.keys(obs))if(!OBS_KEYS_V3.has(k))throw Error('decideEarlyV3: non-public field "'+k+'"');
  const {cond,...rest}=obs;
  condSig(cond);                       // validates cond fields
  if(obs.forced)return {status:'forced',action:null,reason:'forced replacement / forced exit: not a pre-action choice; base AI'};
  if(obs.turn!==1&&obs.turn!==2)return {status:'uncovered',action:null,reason:'only T1/T2 are tabled'};
  M.decideEarly({rules:{}},rest);       // PR #83 public-field / shape checks
  const key=obsKeyV3(obs),rule=table?.rules?.[key];
  if(!rule)return {status:'uncovered',action:null,key,reason:'no tabled observation under this public condition (HP/status/boosts/hazards/weather/lock/legal set)'};
  if(rule.status==='base')return {status:'base',action:null,key,reason:rule.reason,evidence:rule.evidence};
  if(rule.status!=='rule')return {status:'uncovered',action:null,key,reason:rule.reason,evidence:rule.evidence};
  if(!(obs.legal||[]).includes(rule.action))return {status:'uncovered',action:null,key,reason:'tabled action '+rule.action+' not legal now'};
  return {status:'rule',action:rule.action,key,reason:rule.reason,evidence:rule.evidence};
}
// Public condition from OUR bot (lab.js Bot fields fed by the public log) and
// OUR request. Rival HP is the public percentage; own HP from our request.
function condFromBot(req,bot){
  const me=req.side.pokemon.find(p=>p.active),m=String(me?.condition||'').match(/^(\d+)\/(\d+)(?: (\w+))?/);
  return {ownHP:m?Number(m[1])/Number(m[2]):0,ownStatus:m?.[3]||'',ownBoosts:{...bot.boosts},ownEncored:!!bot.ownEncored,ownHazards:{...bot.ownHazards},
    foeHP:bot.foeHP,foeStatus:bot.foePublicStatus||'',foeBoosts:{...bot.foeBoosts},foeEncored:!!bot.foeEncored,foeHazards:{...bot.hazards},
    weather:bot.weather||'',terrain:bot.terrain||''};
}
module.exports={OBS_KEYS_V3,COND_KEYS,condSig,obsKeyV3,decideEarlyV3,condFromBot,hpB};
