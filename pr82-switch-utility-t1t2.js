'use strict';
// PR #82 request (ChatGPT review #5719297548 of PR #81). Opt-in research
// module, NOT adopted. Kept OUT of public-six-general.js on purpose: editing
// that file (or anything it loads) changes the PR #81 policy identity and would
// make every saved general-v2 search fall back live. PR #81's checkRequested
// and 'utility' branch stay byte-identical for reproducibility; this file adds
//   1 checkRequestedV2  requested rival action vs engine log, with the switch
//                       TARGET resolved and compared (PR #81 accepted any other
//                       species), voluntary switch separated from post-faint
//                       replacement / drag / U-turn-type exits, and the engine
//                       outcome of an executed move (-fail/-immune/-miss/
//                       Protect) reported separately from "executed".
//   2 utilityRationality  rational | irrational | unknown for a rival utility
//                       move, from the PUBLIC state the rival saw before it
//                       moved (hazard already up, target already statused,
//                       type immunity, Encore before the target moved, recovery
//                       at near-full HP...). Engine failure of a move labelled
//                       rational (hidden ability, Substitute...) -> unknown.
//                       executed != effective != rational.
//   3 utilityRational   rival T1/T2 branch: the first utility move that is
//                       rational by (2) from the rival bot's public state (PR
//                       #81 'utility' took the first utility move, useful or not).
//   4 decideEarly       executable T1/T2 entry for OUR side. Input = public
//                       observations only (OBS_KEYS); any other field throws.
//                       Returns a table rule (deviate from the base AI), 'base'
//                       (base AI choice holds), 'uncovered' (no safe rule) or
//                       'forced' (post-KO replacement: not a pre-action choice).
// Heuristic AI vs heuristic AI. NOT a ladder win rate.

// Same move set as PR #81 public-six-general.js UTILITY.
const UTILITY=new Set(['recover','roost','slackoff','moonlight','synthesis','morningsun','wish','painsplit','shoreup','softboiled',
  'encore','taunt','stealthrock','spikes','toxicspikes','stickyweb','willowisp','thunderwave','toxic','yawn','trick','haze','leechseed','destinybond']);
const RECOVERY=new Set(['recover','roost','slackoff','moonlight','synthesis','morningsun','wish','shoreup','softboiled']);
const HAZARD_MAX={stealthrock:1,spikes:3,toxicspikes:2,stickyweb:1};
const STATUS_IMMUNE={willowisp:['Fire'],thunderwave:['Electric','Ground'],toxic:['Poison','Steel'],yawn:[]};
const canon=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const baseName=s=>String(s||'').split(',')[0].replace(/-Mega(-[XYZ])?$/,'');
const sameSpecies=(a,b)=>baseName(a)===baseName(b);

function splitTurns(log){
  const turns={};let t=0;
  for(const line of log.split('\n')){if(line.startsWith('|turn|')){t=Number(line.slice(6));continue;}(turns[t]||(turns[t]=[])).push(line);}
  return turns;
}
// Engine outcome of the move at L[i]: lines up to the next action.
function moveEffect(L,i){
  if(/\|\[notarget\]/.test(L[i]))return 'noTarget';
  for(let j=i+1;j<L.length;j++){
    const a=L[j].split('|');
    if(['move','switch','drag','upkeep','turn','cant'].includes(a[1])||L[j]==='|')break;
    if(a[1]==='-fail')return 'fail';
    if(a[1]==='-immune')return 'immune';
    if(a[1]==='-miss')return 'miss';
    if(a[1]==='-notarget')return 'noTarget';
    if(a[1]==='-activate'&&/(Protect|Detect|King's Shield|Spiky Shield|Baneful Bunker|Silk Trap|Burning Bulwark|Obstruct|Mat Block)$/.test(a[3]||''))return 'protected';
  }
  return 'effective';
}
// A voluntary switch is the side's first |switch| of the turn that comes before
// any |move| or |faint| of that side (switches resolve before moves; a U-turn /
// Volt Switch / Eject exit follows a move, a replacement follows a faint).
function voluntarySwitch(L,me){
  for(const l of L){
    if(l.startsWith('|move|'+me)||l.startsWith('|faint|'+me)||l.startsWith('|drag|'+me))return null;
    if(l.startsWith('|switch|'+me)&&!/\|\[from\]/.test(l))return l.split('|')[3];
  }
  return null;
}
// requested[k] = {turn, choice:'move N'|'switch N', move, active, target?}.
// target = species the request slot resolved to when the choice was made
// (rivalScriptV2 records it). For PR #81 saved records without target, pass
// opts.rival3 (the rival's selected order): only a TURN-1 slot is then
// resolvable (Showdown reorders side.pokemon on every switch), later -> 'unverifiable'.
function checkRequestedV2(log,foeSide,requested,opts={}){
  const turns=splitTurns(log),me=foeSide+'a: ';
  return requested.map(r=>{
    const L=turns[r.turn]||[];
    if(r.move){
      const i=L.findIndex(l=>l.startsWith('|move|'+me)&&l.split('|')[3]===r.move);
      if(i>=0)return {result:'executed',effect:moveEffect(L,i)};
      if(L.some(l=>l.startsWith('|faint|'+me)||l.startsWith('|cant|'+me)))return {result:'preempted',effect:null};
      const out=L.findIndex(l=>/^\|(switch|drag)\|/.test(l)&&l.startsWith('|'+l.split('|')[1]+'|'+me));
      if(out>=0&&!L.slice(0,out).some(l=>l.startsWith('|move|'+me)))return {result:'forcedOut',effect:null};
      return {result:'mismatch',effect:null};
    }
    const slot=Number(String(r.choice).split(' ')[1]);
    const target=r.target||(opts.rival3&&r.turn===1?opts.rival3[slot-1]:null);
    const actual=voluntarySwitch(L,me);
    if(actual){
      const a=baseName(actual);
      if(!target)return {result:'unverifiable',effect:null,actual:a};
      return {result:sameSpecies(actual,target)?'executed':'wrongTarget',effect:null,actual:a,target};
    }
    if(L.some(l=>l.startsWith('|faint|'+me)))return {result:'preempted',effect:null};
    if(L.some(l=>l.startsWith('|drag|'+me)))return {result:'dragged',effect:null};
    return {result:'mismatch',effect:null};
  });
}

// ---- public state replay (what both players saw), for rationality ----
function newSide(){return {active:null,hp:1,status:'',hazards:{},moved:false,lastMove:null};}
function condOf(c){
  const m=String(c||'').match(/^(\d+)\/(\d+)(?: (\w+))?/);
  if(String(c).endsWith(' fnt')||String(c).startsWith('0 '))return {hp:0,status:''};
  return m?{hp:Number(m[1])/Number(m[2]),status:m[3]||''}:null;
}
function replay(lines,st={p1:newSide(),p2:newSide()}){
  for(const l of lines){
    const a=l.split('|'),who=(a[2]||'').slice(0,2),s=st[who];
    if(!s)continue;
    if(a[1]==='switch'||a[1]==='drag'){s.active=baseName(a[3]);s.moved=false;s.lastMove=null;const c=condOf(a[4]);if(c){s.hp=c.hp;s.status=c.status;}}
    else if(a[1]==='detailschange')s.active=String(a[3]).split(',')[0];
    else if(a[1]==='-damage'||a[1]==='-heal'||a[1]==='-sethp'){const c=condOf(a[3]);if(c){s.hp=c.hp;s.status=c.status;}}
    else if(a[1]==='-status')s.status=a[3];
    else if(a[1]==='-curestatus')s.status='';
    else if(a[1]==='move'){s.moved=true;s.lastMove=a[3];}
    else if(a[1]==='-sidestart'){const k=canon(String(a[3]).replace(/^move: /,''));s.hazards[k]=(s.hazards[k]||0)+1;}
    else if(a[1]==='-sideend')delete s.hazards[canon(String(a[3]).replace(/^move: /,''))];
  }
  return st;
}
// Rationality from the public state before the move. state = {user:{hp},
// target:{species,types,status,hazards,moved,lastMoveCategory,hp}}.
function rationalityFromState(move,s){
  const id=canon(move),t=s.target||{},u=s.user||{};
  if(id in HAZARD_MAX)return (t.hazards?.[id]||0)>=HAZARD_MAX[id]?['irrational','hazard already at max']:['rational','hazard not yet up'];
  if(id in STATUS_IMMUNE){
    if(t.status)return ['irrational','target already '+t.status];
    const im=(t.types||[]).find(x=>STATUS_IMMUNE[id].includes(x));
    if(im)return ['irrational',im+'-type target is immune'];
    return ['rational','unstatused, not type-immune'];
  }
  if(id==='encore'){
    if(!t.moved)return ['irrational','target has not moved since entering (Encore fails)'];
    return t.lastMoveCategory==='Status'?['rational','target last used a status move']:['unknown','Encore on an attack'];
  }
  if(RECOVERY.has(id)){
    if(u.hp>=0.9)return ['irrational','user at '+Math.round(u.hp*100)+'% HP'];
    return u.hp<=0.6?['rational','user at '+Math.round(u.hp*100)+'% HP']:['unknown','user at '+Math.round(u.hp*100)+'% HP'];
  }
  if(id==='painsplit')return u.hp>=(t.hp??1)?['irrational','user HP >= target HP']:['rational','user HP < target HP'];
  if(id==='leechseed'&&(t.types||[]).includes('Grass'))return ['irrational','Grass-type target is immune'];
  return ['unknown','no public usefulness rule'];
}
// Every rival utility move in turns 1..maxTurn of a finished engine log,
// labelled from the public state just before it plus its engine outcome.
function utilityAudit(log,foeSide,dex,{maxTurn=2}={}){
  const own=foeSide==='p1'?'p2':'p1',out=[];
  const st={p1:newSide(),p2:newSide()};let turn=0;
  const lines=log.split('\n');
  for(let i=0;i<lines.length;i++){
    const l=lines[i];
    if(l.startsWith('|turn|')){turn=Number(l.slice(6));if(turn>maxTurn)break;continue;}
    const a=l.split('|');
    if(turn>=1&&a[1]==='move'&&a[2]?.startsWith(foeSide+'a: ')&&UTILITY.has(canon(a[3]))){
      const T=st[own],U=st[foeSide];
      const sp=dex.species.get(T.active||'');
      const state={user:{hp:U.hp},target:{species:T.active,types:sp.exists?sp.types:[],status:T.status,hazards:T.hazards,moved:T.moved,hp:T.hp,
        lastMoveCategory:T.lastMove?dex.moves.get(T.lastMove).category:null}};
      const [label,why]=rationalityFromState(a[3],state);
      let L=[],j=i;while(j<lines.length&&!lines[j].startsWith('|turn|'))L.push(lines[j++]);
      const effect=moveEffect(L,0);
      // A move the public state called useful that the engine still failed
      // (hidden ability, Substitute, Safeguard, Misty Terrain...) is not
      // counted as an irrational choice.
      const rational=label==='rational'&&effect!=='effective'?'unknown':label;
      out.push({turn,move:a[3],user:U.active,target:T.active,rational,why:label==='rational'&&effect!=='effective'?why+'; engine '+effect+' (hidden info)':why,effect});
    }
    replay([l],st);
  }
  return out;
}
// Branch 3: rival's first RATIONAL utility move from its bot's public state.
function utilityRational(bot,req){
  const a=req.active?.[0],cur=req.side.pokemon.find(p=>p.active);if(!a||!cur)return null;
  const dex=bot.dex,sp=dex.species.get(bot.foeActive||'');
  const c=condOf(cur.condition)||{hp:1};
  const state={user:{hp:c.hp},target:{species:bot.foeActive,types:sp.exists?sp.types:[],status:bot.foePublicStatus||bot.foeStatus||'',
    hazards:bot.hazards||{},moved:bot.foeLastMoveTurn>=0,hp:bot.foeHP??1,
    lastMoveCategory:bot.foeLastMoveTurn>=0&&bot.lastMove?dex.moves.get(bot.lastMove).category:null}};
  const i=a.moves.findIndex(m=>!m.disabled&&UTILITY.has(canon(m.id||m.move))&&rationalityFromState(m.move,state)[0]==='rational');
  return i<0?null:'move '+(i+1)+(a.canMegaEvo?' mega':'');
}
// Rival turn script = PR #81 rivalScript + 'utilityRational' + switch TARGET recorded.
function rivalScriptV2(branch,dex,requested){
  const {ratSwitch}=require('./encore-turn-p0-audit');
  const {BRANCHES}=require('./preview-legal-search');
  const R={...BRANCHES,utilityRational};
  return (req,bot,info)=>{
    if(info.lockReason==='encore'&&info.canSwitch)return ratSwitch(req,bot,dex,{encore:true});
    if(branch==='ai'||info.turn>2||branch==='switch'&&info.turn!==1||info.locked)return null;
    const c=R[branch](bot,req);
    if(c&&requested){
      const slot=/^switch /.test(c)?Number(c.split(' ')[1]):null;
      requested.push({turn:info.turn,branch,choice:c,active:bot.getSet(req.side.pokemon.find(p=>p.active)).species,
        move:/^move /.test(c)?req.active[0].moves[Number(c.split(' ')[1])-1].move:null,
        target:slot?baseName(req.side.pokemon[slot-1].details):null});
    }
    return c;
  };
}

// ---- 4 executable early-turn entry for our side ----
// Legal pre-action choices of a move request, in a fixed order: enabled moves
// (with Mega when available), then bench switches. Labels are public.
function legalActions(req){
  const a=req.active?.[0];if(!a||req.forceSwitch)return [];
  const out=[];
  a.moves.forEach((m,i)=>{if(!m.disabled)out.push({choice:'move '+(i+1)+(a.canMegaEvo?' mega':''),label:'move:'+m.move});});
  if(!a.trapped&&!a.maybeTrapped)req.side.pokemon.forEach((p,i)=>{if(!p.active&&!/ fnt$/.test(p.condition))out.push({choice:'switch '+(i+1),label:'switch:'+baseName(p.details)});});
  return out;
}
// Observation = only what we know at the decision point. No rival three,
// rival set/item/move list, test branch, hypothesis or future event.
const OBS_KEYS=new Set(['publicSix','ownThree','turn','rivalActive','rivalT1','ownActive','forced','legal']);
const sixKey=six=>six.slice().sort().join('|');
function obsKey(o){
  const base=sixKey(o.publicSix)+'#'+o.ownThree[0]+'>'+o.ownThree.slice(1).slice().sort().join('/')+'#T'+o.turn;
  if(o.turn===1)return base+'#'+baseName(o.rivalActive);
  return base+'#'+baseName(o.rivalT1Lead||'')+'#'+o.rivalT1+'#'+baseName(o.ownActive)+'#'+baseName(o.rivalActive);
}
function checkObs(obs){
  for(const k of Object.keys(obs))if(!OBS_KEYS.has(k))throw Error('decideEarly: non-public field "'+k+'"');
  if(!Array.isArray(obs.publicSix)||obs.publicSix.length!==6||obs.publicSix.some(x=>typeof x!=='string'))throw Error('decideEarly: publicSix must be six species names');
  if(!Array.isArray(obs.ownThree)||obs.ownThree.length!==3)throw Error('decideEarly: ownThree = our selected three, lead first');
}
// rivalT1 for a T2 observation: {lead, action} where action = 'move:X' |
// 'changed:Y' (rival active changed: switch or post-KO replacement) | 'none'.
function decideEarly(table,obs){
  checkObs(obs);
  if(obs.forced)return {status:'forced',action:null,reason:'forced replacement after a KO / forced switch: not a pre-action choice; base AI'};
  if(obs.turn!==1&&obs.turn!==2)return {status:'uncovered',action:null,reason:'only T1/T2 are tabled'};
  const key=obsKey({...obs,rivalT1Lead:obs.rivalT1?.lead,rivalT1:obs.rivalT1?.action});
  const rule=table?.rules?.[key];
  if(!rule)return {status:'uncovered',action:null,key,reason:'no tabled observation (unseen six, other 3+lead, or unseen T1 line)'};
  if(rule.status==='base')return {status:'base',action:null,key,reason:rule.reason,evidence:rule.evidence};
  if(rule.status!=='rule')return {status:'uncovered',action:null,key,reason:rule.reason,evidence:rule.evidence};
  if(obs.legal&&!obs.legal.includes(rule.action))return {status:'uncovered',action:null,key,reason:'tabled action '+rule.action+' not legal now'};
  return {status:'rule',action:rule.action,key,reason:rule.reason,evidence:rule.evidence};
}
// Offline table builder. games: [{key, label, cond, won}] where cond is the
// HIDDEN condition (rival three / hypothesis / branch) used only here, offline,
// to score an action by its worst condition; the table that comes out is keyed
// by public observations only. label '=base' = our unforced base turn AI.
// Base-first (a 6-way argmax on 4 games per condition overfits: PR #82 smoke
// run): the table deviates from the base AI only when an action beats the
// base by >= margin in worst-condition win rate with a mean no lower than the
// base's (first run used mean >= base+0.1 and left worst 1.00-vs-0.00 cases uncovered),
// with >= minN games and every condition tried. Otherwise 'base' (the base
// AI's own choice, worst-condition >= minWorst) or 'uncovered' (no safe rule:
// the base and every alternative lose some hidden condition), with reasons.
function buildTable(games,{minN=8,minWorst=0.25,margin=0.25,meanMargin=0}={}){
  const byKey={};
  for(const g of games){const k=byKey[g.key]||(byKey[g.key]={});const a=k[g.label]||(k[g.label]={});const c=a[g.cond]||(a[g.cond]=[0,0]);c[0]+=g.won;c[1]++;}
  const rules={};
  for(const [key,acts] of Object.entries(byKey)){
    const conds=new Set(Object.values(acts).flatMap(a=>Object.keys(a)));
    const score=Object.entries(acts).map(([label,cs])=>{
      const v=Object.values(cs),n=v.reduce((s,c)=>s+c[1],0),w=v.reduce((s,c)=>s+c[0],0);
      const per=Object.entries(cs).map(([c,[wi,ni]])=>[c,wi/ni]);
      const worst=per.length?Math.min(...per.map(x=>x[1])):0;
      return {label,n,mean:w/n,worst:Object.keys(cs).length<conds.size?0:worst,covered:Object.keys(cs).length+'/'+conds.size,
        worstConds:per.filter(x=>x[1]===worst).map(x=>x[0]).slice(0,3)};
    }).sort((a,b)=>b.worst-a.worst||b.mean-a.mean||(a.label<b.label?-1:1));
    const ev=s=>({action:s.label,n:s.n,mean:+s.mean.toFixed(3),worst:+s.worst.toFixed(3),covered:s.covered,worstConds:s.worstConds});
    const base=score.find(s=>s.label==='=base')||{label:'=base',n:0,mean:0,worst:0,covered:'0/'+conds.size,worstConds:[]};
    const alt=score.filter(s=>s.label!=='=base'&&s.n>=minN&&s.covered===conds.size+'/'+conds.size);
    const best=alt[0],evidence=[ev(base),...alt.slice(0,3).map(ev)];
    if(best&&best.worst>=minWorst&&best.worst>=base.worst+margin&&best.mean>=base.mean+meanMargin)
      rules[key]={status:'rule',action:best.label,reason:'beats base AI over '+conds.size+' hidden conditions: worst '+best.worst.toFixed(2)+' vs '+base.worst.toFixed(2)+', mean '+best.mean.toFixed(2)+' vs '+base.mean.toFixed(2),evidence};
    else if(base.n>=minN&&base.worst>=minWorst)
      rules[key]={status:'base',reason:'base AI choice holds worst '+base.worst.toFixed(2)+' over '+conds.size+' hidden conditions; no alternative beats it by the margin',evidence};
    else{
      const top=[base,...alt].sort((a,b)=>b.worst-a.worst||b.mean-a.mean)[0];
      rules[key]={status:'uncovered',reason:base.n<minN?'only '+base.n+' base games':'no safe rule: best worst-condition '+top.worst.toFixed(2)+' ('+top.label+') in '+top.worstConds.join(', '),evidence};
    }
  }
  return {rules,params:{minN,minWorst,margin,meanMargin}};
}
// Own executed pre-action choice at a turn, from the engine log (label form).
function executedOwn(log,ownSide,turn){
  const L=splitTurns(log)[turn]||[],me=ownSide+'a: ';
  const sw=voluntarySwitch(L,me);if(sw)return 'switch:'+baseName(sw);
  const m=L.find(l=>l.startsWith('|move|'+me));return m?'move:'+m.split('|')[3]:'none';
}
// ---- 5 live preview with a bounded, explained path (P0-5) ----
// valid saved PR #81 search -> its mixture (choosePublicSixGeneral). Otherwise,
// when the caller grants >= QUICK_SECONDS, a bounded quick search (QUICK
// params; 10-15 s on 4 workers in the PR #82 run) and its pure[0] pick, with
// the uncertainty stated; otherwise legacy chooseThree. PR #82 test seeds: the
// quick pick was NOT safer than legacy (rival cell x branch at 0 wins:
// 137/510 vs 119/510; general mixture 7/510), so neither path is a robust live
// coverage claim.
const QUICK={maxScenarios:2,n1:4,r2:1,branches:['ai'],expand:false,addOwn:0};
const QUICK_SECONDS=20;
async function livePreview({sim,own,publicSix,seed,saved=null,budgetSeconds=0,workers=4}){
  const G=require('./public-six-general');
  const t0=Date.now();
  const d=await G.choosePublicSixGeneral({sim,own,publicSix,seed,saved});
  if(d.status==='general')return {...d,path:'saved general mixture',seconds:+((Date.now()-t0)/1000).toFixed(2)};
  if(budgetSeconds>=QUICK_SECONDS){
    const s=await G.searchPublicSix({sim,own,publicSix,opts:{...QUICK,workers}});
    const pick=s.pure[0].pick.split(/[>/]/);
    return {status:'quick',path:'bounded quick search',pick,selection:pick.map(n=>own.findIndex(p=>p.species===n)+1),seconds:+((Date.now()-t0)/1000).toFixed(2),
      games:s.games.total,quickSecurity:s.security,cacheRejected:d.cacheRejected,
      uncertainty:'2 role-template scenarios, 1 refine rep, ai branch only, no expansion; PR #82 test: not safer than legacy (0-win cell x branch 137/510 vs 119/510)'};
  }
  return {...d,path:'legacy fallback (no valid search, budget '+budgetSeconds+'s < '+QUICK_SECONDS+'s)',seconds:+((Date.now()-t0)/1000).toFixed(2),
    uncertainty:'legacy chooseThree: security 0 on most PR #79-#82 hypotheses'};
}
module.exports={QUICK,QUICK_SECONDS,livePreview,UTILITY,checkRequestedV2,moveEffect,voluntarySwitch,replay,rationalityFromState,utilityAudit,utilityRational,rivalScriptV2,
  legalActions,decideEarly,buildTable,obsKey,OBS_KEYS,executedOwn,baseName,splitTurns};
