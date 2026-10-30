'use strict';
// Turn-AI misplay tags v3 (PR #68 request, P0 found in PR #67 review).
// v2 (misplay-tags-v2.js, unchanged so saved numbers stay reproducible)
// counted "same mon, same setup move 3x in a row" as the rival's own
// setupSpam even when the 2nd/3rd use was FORCED by the other side's Encore.
// v3 tracks Encore from the public log (-start/-end Encore, switch-out,
// faint) and, when the harness passes the move requests, which moves were
// actually selectable and whether a switch was legal.
//   setupSpam            v2 rule, but only when the 3rd+ use was CHOSEN: Encore
//                        was not in force when the turn's moves were picked
//                        (an Encore landing mid-turn does not change the pick)
//   setupForcedEncore    3rd+ repeat picked while already locked by Encore
//   encoreStay           an Encore-locked SETUP move was picked although a switch
//                        was legal (needs requests; log-only = unknown, not counted)
//   encoreStayOther      same for a non-setup move; informational only (staying
//                        in an Encored attack can be correct)
//   encoreRepeat         Encore used twice in a row by the same mon
//   immuneRepeat         repeat into -immune that the mon CHOSE
//   resistRepeat         repeat into -resisted that the mon CHOSE
//   lockedRepeat         repeat into -immune/-resisted while locked to that
//                        move (Choice / Encore; needs requests) - the action
//                        was constrained, staying in is what may be wrong
//   lockedStay           lockedRepeat where a switch was legal
//   helmetFaint / switchLoop / chargeNoSun / weatherRedundant  as v2
// Tag absence is NOT evidence of rational play: a rival that stays in Encore
// with a switch available is tagged encoreStay; one that, e.g., attacks
// with the wrong move is not tagged at all.
const SETUP=new Set(['Swords Dance','Dragon Dance','Nasty Plot','Calm Mind','Quiver Dance','Bulk Up','Shell Smash']);
const WEATHER_MOVE={'Sunny Day':'SunnyDay','Rain Dance':'RainDance','Sandstorm':'Sandstorm','Snowscape':'Snowscape'};
const CONTACT_RECOIL=/\[from\] (item: Rocky Helmet|ability: Rough Skin|ability: Iron Barbs)/;
const PIVOT=new Set(['U-turn','Volt Switch','Flip Turn','Parting Shot','Teleport','Baton Pass','Chilly Reception','Shed Tail']);
const TAGS=['setupSpam','encoreRepeat','immuneRepeat','resistRepeat','helmetFaint','switchLoop','chargeNoSun','weatherRedundant'];
const INFO_TAGS=['setupForcedEncore','encoreStay','encoreStayOther','lockedRepeat','lockedStay'];
// "Voluntary" tags: things the side could have chosen otherwise. encoreStay
// and lockedStay are voluntary (switching was legal); the forced repeats are not.
const VOLUNTARY=[...TAGS,'encoreStay','lockedStay'];
const V1_TAGS=['setupSpam','encoreRepeat','immuneRepeat'];
const sideOf=id=>id.slice(0,2);
// requests: optional [{side,turn,locked:bool,lockedMove:string|null,canSwitch:bool}]
// for move decisions, as recorded by recordRequests() below.
function misplaysV3(log,{requests=null}={}){
  const out={p1:{},p2:{}};for(const s of ['p1','p2'])for(const t of [...TAGS,...INFO_TAGS])out[s][t]=0;
  const req={};if(requests)for(const r of requests)req[r.side+'|'+r.turn]=r;
  const last={p1:[],p2:[]};let pending=null,turn=0,weather='none';
  const encored={p1:null,p2:null};// active mon name under Encore, per side
  const encStart={p1:null,p2:null};// ...as it stood when this turn's moves were chosen
  const volTurn={p1:-9,p2:-9},fainted={p1:false,p2:false},moved={p1:false,p2:false},pivot={p1:false,p2:false};
  for(const line of log.split('\n')){
    const a=line.split('|');
    if(a[1]==='turn'){turn=Number(a[2]);encStart.p1=encored.p1;encStart.p2=encored.p2;fainted.p1=fainted.p2=false;moved.p1=moved.p2=false;pivot.p1=pivot.p2=false;pending=null;continue;}
    if(a[1]==='-weather'){weather=a[2];continue;}
    if(a[1]==='-start'&&/(^|: )Encore$/.test(a[3]||'')){encored[sideOf(a[2])]=a[2].slice(5);continue;}
    if(a[1]==='-end'&&/(^|: )Encore$/.test(a[3]||'')){if(encored[sideOf(a[2])]===a[2].slice(5))encored[sideOf(a[2])]=null;continue;}
    if(a[1]==='move'){
      const side=sideOf(a[2]),user=a[2].slice(5),move=a[3];
      // byEncore: the move was Encore's (locked at choice time, or replaced
      // by an Encore that landed earlier this turn). chosenUnderEncore: the
      // lock was already known when the side chose, so switching was an option.
      const byEncore=encored[side]===user,chosenUnderEncore=byEncore&&encStart[side]===user;
      const r=req[side+'|'+turn];
      const locked=chosenUnderEncore||Boolean(r&&r.locked&&r.lockedMove===move);
      const h=last[side];h.push({user,move,immune:false,resisted:false,locked,byEncore});
      const n=h.length;
      if(SETUP.has(move)&&n>=3&&h.slice(-3).every(x=>x.user===user&&x.move===move)){
        if(chosenUnderEncore)out[side].setupForcedEncore++;else out[side].setupSpam++;
      }
      if(chosenUnderEncore&&r&&r.canSwitch)out[side][SETUP.has(move)?'encoreStay':'encoreStayOther']++;
      if(move==='Encore'&&n>=2&&h[n-2].user===user&&h[n-2].move==='Encore')out[side].encoreRepeat++;
      if(WEATHER_MOVE[move]&&weather===WEATHER_MOVE[move]&&!line.includes('[still]'))out[side].weatherRedundant++;
      moved[side]=true;if(PIVOT.has(move))pivot[side]=true;
      pending={side,entry:h[n-1],r};
    } else if((a[1]==='-immune'||a[1]==='-resisted')&&pending){
      const key=a[1]==='-immune'?'immune':'resisted';
      if(pending.entry[key])continue;
      pending.entry[key]=true;
      const h=last[pending.side],n=h.length,e=h[n-1];
      if(n>=2&&h[n-2][key]&&h[n-2].user===e.user&&h[n-2].move===e.move){
        if(e.locked){out[pending.side].lockedRepeat++;if(pending.r&&pending.r.canSwitch)out[pending.side].lockedStay++;}
        else out[pending.side][key==='immune'?'immuneRepeat':'resistRepeat']++;
      }
    } else if(a[1]==='-prepare'&&/^Solar (Beam|Blade)$/.test(a[3]||'')&&!/^(SunnyDay|DesolateLand)$/.test(weather)){
      out[sideOf(a[2])].chargeNoSun++;
    } else if(a[1]==='-damage'&&/ fnt$/.test(a[3]||'')&&CONTACT_RECOIL.test(line)){
      out[sideOf(a[2])].helmetFaint++;
    } else if(a[1]==='faint'){
      const side=sideOf(a[2]);fainted[side]=true;if(encored[side]===a[2].slice(5))encored[side]=null;
    } else if(a[1]==='switch'||a[1]==='drag'){
      const side=sideOf(a[2]);encored[side]=null;// Encore ends on switch-out
      if(a[1]==='switch'&&turn>0&&!fainted[side]&&!pivot[side]&&!moved[side]){
        if(volTurn[side]===turn-1)out[side].switchLoop++;
        volTurn[side]=turn;
      }
      pending=null;
    }
  }
  return out;
}
const anyTag=(m,tags=VOLUNTARY)=>tags.some(t=>m[t]>0);
// Per-request summary used by misplaysV3: whether the active mon could pick
// only one move (Encore / Choice lock / Struggle) and whether a switch was legal.
function requestInfo(req,side,turn){
  if(!req.active||!req.active[0]||req.forceSwitch||req.teamPreview)return null;
  const act=req.active[0],enabled=act.moves.filter(m=>!m.disabled);
  const canSwitch=!act.trapped&&!act.maybeTrapped&&req.side.pokemon.some(p=>!p.active&&!/ fnt$/.test(p.condition));
  return {side,turn,locked:enabled.length===1&&act.moves.length>1,lockedMove:enabled.length===1?enabled[0].move:null,canSwitch};
}
module.exports={misplaysV3,anyTag,requestInfo,TAGS,INFO_TAGS,VOLUNTARY,V1_TAGS};
