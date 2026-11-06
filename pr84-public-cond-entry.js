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
// PR #86 (ChatGPT review #5720466858 of PR #85, P1): COND_KEYS checked only
// the top level; sig() keyed ANY nested field, so ownBoosts:{hiddenHeldItem:..}
// entered the key. Every nested key and every value is now allow-listed and
// typed; anything else throws. Keys for valid input are byte-identical to PR #85.
const BOOST_KEYS=new Set(['atk','def','spa','spd','spe','accuracy','evasion']);
// Side conditions that Showdown announces with a public |-sidestart| (lab.js
// Bot stores every -sidestart id, screens and Tailwind included).
const SIDE_KEYS=new Set(['stealthrock','spikes','toxicspikes','stickyweb','gmaxsteelsurge','reflect','lightscreen','auroraveil','tailwind',
  'safeguard','mist','luckychant','quickguard','wideguard','craftyshield','matblock']);
const STATUS=new Set(['','brn','par','slp','frz','psn','tox']);
const WEATHER=new Set(['','sunnyday','raindance','sandstorm','hail','snowscape','snow','desolateland','primordialsea','deltastream']);
// lab.js stores every |-fieldstart|move: X| id in terrain (rooms included).
const FIELD=new Set(['','electricterrain','grassyterrain','mistyterrain','psychicterrain','trickroom','gravity','magicroom','wonderroom','mudsport','watersport']);
const bad=(f,v)=>{throw Error('decideEarlyV3: non-public cond value '+f+'='+JSON.stringify(v));};
function checkNested(f,o,keys,ok){
  if(o==null)return;
  if(typeof o!=='object'||Array.isArray(o))bad(f,o);
  for(const [k,v] of Object.entries(o)){if(!keys.has(k))throw Error('decideEarlyV3: non-public cond field "'+f+'.'+k+'"');if(!ok(v))bad(f+'.'+k,v);}
}
function checkCond(c){
  if(typeof c!=='object'||Array.isArray(c))bad('cond',c);
  for(const k of Object.keys(c))if(!COND_KEYS.has(k))throw Error('decideEarlyV3: non-public cond field "'+k+'"');
  for(const f of ['ownHP','foeHP'])if(c[f]!=null&&!(typeof c[f]==='number'&&c[f]>=0&&c[f]<=1))bad(f,c[f]);
  for(const f of ['ownStatus','foeStatus'])if(c[f]!=null&&!STATUS.has(c[f]))bad(f,c[f]);
  for(const f of ['ownEncored','foeEncored'])if(c[f]!=null&&typeof c[f]!=='boolean')bad(f,c[f]);
  if(c.weather!=null&&!WEATHER.has(c.weather))bad('weather',c.weather);
  if(c.terrain!=null&&!FIELD.has(c.terrain))bad('terrain',c.terrain);
  const boost=v=>Number.isInteger(v)&&v>=-6&&v<=6,layers=v=>Number.isInteger(v)&&v>=0&&v<=3;
  checkNested('ownBoosts',c.ownBoosts,BOOST_KEYS,boost);checkNested('foeBoosts',c.foeBoosts,BOOST_KEYS,boost);
  checkNested('ownHazards',c.ownHazards,SIDE_KEYS,layers);checkNested('foeHazards',c.foeHazards,SIDE_KEYS,layers);
}
function condSig(c){
  if(!c)return 'nocond';
  checkCond(c);
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
module.exports={OBS_KEYS_V3,COND_KEYS,BOOST_KEYS,SIDE_KEYS,checkCond,condSig,obsKeyV3,decideEarlyV3,condFromBot,hpB};
