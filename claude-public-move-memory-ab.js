#!/usr/bin/env node
'use strict';
// Claude independent audit of PR #102 opt-in `publicMoveMemory`.
// Real pinned-Showdown Battles, paired A/B: the ONLY difference between the
// two games of a pair is our Bot's `publicMoveMemory` flag (false = saved
// legacy behaviour, true = opt-in). Same seed, same side, same both threes,
// same lead, same rival script, rival Bot options identical.
// Our side never sees the rival's preview pick, item or unrevealed moves; the
// rival three/lead are fixed by us from the rival's PUBLIC-six viewpoint.
// Rival scripts are FIXTURES (some intentionally delay Mega to create the
// pre-Mega reveal); they are not claims about human play.
// Heuristic AI vs heuristic AI. Not a ladder win rate.
//   SHOWDOWN_DIR=... OUT=reports/data/claude-pr102-memory-ab.json node claude-public-move-memory-ab.js
const fs=require('node:fs');
const path=require('node:path');
const {hashSeed,load,Bot}=require('./lab');
// Probe (read-only): what our Bot's seenMoves[foeActive] was at each of OUR
// decisions. Proves the flag was actually live in the paired game.
let PROBE=null,PROBE_SIDE=null;
const origDecide=Bot.prototype.decide;
Bot.prototype.decide=function(req){
  if(PROBE&&this.side===PROBE_SIDE&&req.active)
    PROBE.push({turn:this.turn,foe:this.foeActive,seen:[...(this.seenMoves[this.foeActive]||[])]});
  return origDecide.call(this,req);
};
const {battle}=require('./encore-lead-audit');
const {caseList}=require('./legal-search-v2-compare');
const {reportedLive}=require('./reported-live-roster-20261027');
const SHOWDOWN='3a766f2cfb5e51c1e428cfe87d0dba91a8f01640';
const SEEDS=()=>[10300001,10300011,10300021].map(hashSeed);
const nameOf=d=>String(d).split(',')[0];
const slot=(req,name)=>{
  const i=req.active?.[0]?.moves?.findIndex(m=>m.move===name&&!m.disabled&&m.pp>0)??-1;
  return i<0?null:i+1;
};
const benchTo=(req,species)=>{
  const b=req.side.pokemon.map((p,i)=>({p,i})).filter(x=>!x.p.active&&!/ fnt$/.test(x.p.condition));
  const x=b.find(y=>nameOf(y.p.details).startsWith(species))||b[0];
  return x?'switch '+(x.i+1):null;
};
const activeName=req=>nameOf(req.side.pokemon.find(p=>p.active)?.details||'');
// T1 reveal WITHOUT Mega, then the Bot decides (and Megas on its first move).
const delay=(mon,move)=>(req,bot,info)=>{
  if(info.turn!==1||!activeName(req).startsWith(mon))return null;
  const s=slot(req,move);return s?'move '+s:null;
};
// T1 reveal without Mega, T2 switch out, the mon later re-enters and Megas.
const scoutSwitch=(mon,move,to)=>(req,bot,info)=>{
  if(!activeName(req).startsWith(mon)||activeName(req).includes('-Mega'))return null;
  if(info.turn===1){const s=slot(req,move);return s?'move '+s:null;}
  if(info.turn===2&&info.canSwitch)return benchTo(req,to);
  return null;
};
// Rational-ish control: Mega on T1 with setup, T2 Bot choice.
const megaSetup=(mon,move)=>(req,bot,info)=>{
  if(info.turn!==1||!activeName(req).startsWith(mon))return null;
  const s=slot(req,move);return s?'move '+s+(req.active[0].canMegaEvo?' mega':''):null;
};
const zoroarkSix=()=>{
  // Case A public six with Gholdengo -> legal Illusion Zoroark (validated in test).
  const t=structuredClone(caseList().find(c=>c.id==='A_golisopod').team);
  t[5]={species:'Zoroark',item:'Focus Sash',ability:'Illusion',nature:'Timid',
    moves:['Night Daze','Flamethrower','Sludge Bomb','Nasty Plot'],evs:{hp:2,spa:32,spe:32}};
  return t;
};
const zoroarkT1T2=(req,bot,info)=>{
  const act=activeName(req);
  if(!act.startsWith('Zoroark')||info.turn>2)return null;
  const s=slot(req,info.turn===1?'Flamethrower':'Night Daze');return s?'move '+s:null;
};
const PLANS=[
  {case:'A_golisopod',mega:'Golisopod',
    rivalThrees:{golisoLead:['Golisopod','Garchomp','Mimikyu'],garchompLead:['Garchomp','Golisopod','Mimikyu']},
    ownThrees:[['Tyranitar','Metagross','Primarina'],['Primarina','Metagross','Garchomp'],['Metagross','Rotom-Wash','Garchomp']],
    scripts:{ai:null,megaSD_T1:megaSetup('Golisopod','Swords Dance'),
      delaySuckerPunch:delay('Golisopod','Sucker Punch'),delayIronHead:delay('Golisopod','Iron Head'),
      scoutSuckerPunchSwitch:scoutSwitch('Golisopod','Sucker Punch','Garchomp')}},
  {case:'A_zoroark',team:zoroarkSix,mega:'Golisopod',
    rivalThrees:{zoroLeadGolisoLast:['Zoroark','Garchomp','Golisopod']},
    ownThrees:[['Tyranitar','Metagross','Primarina'],['Metagross','Rotom-Wash','Garchomp']],
    scripts:{ai:null,zoroarkFlamethrowerNightDaze:zoroarkT1T2}},
  {case:'C_charizardY',mega:'Charizard',
    rivalThrees:{zardLead:['Charizard','Garchomp','Mimikyu']},
    ownThrees:[['Tyranitar','Rotom-Wash','Metagross'],['Rotom-Wash','Garchomp','Primarina']],
    scripts:{ai:null,delayAirSlash:delay('Charizard','Air Slash'),
      delayFlamethrower:delay('Charizard','Flamethrower')}},
  {case:'Real_indeedee_scarf',mega:'Garchomp',
    rivalThrees:{chompLead:['Garchomp','Indeedee','Gengar']},
    ownThrees:[['Metagross','Primarina','Rotom-Wash'],['Primarina','Metagross','Tyranitar']],
    scripts:{ai:null,delayFlamethrower:delay('Garchomp','Flamethrower'),
      scoutFlamethrowerSwitch:scoutSwitch('Garchomp','Flamethrower','Indeedee')}},
];
const CONFIGS={baseline:{},v3pub:{decisionPolicy:'v3',publicMegaAbility:true,publicCondition:true}};
function publicEvents(log,maxTurn=6){
  const out=[];let turn=0;
  for(const line of log.split('\n')){
    if(line.startsWith('|split|'))continue;
    if(line.startsWith('|turn|')){turn=Number(line.slice(6));if(turn>maxTurn)break;out.push('T'+turn);continue;}
    const a=line.split('|');
    if(['move','switch','drag','faint','detailschange','-mega'].includes(a[1]))out.push(a.slice(1,4).join('|'));
  }
  return out;
}
function revealedBeforeMega(log,foeSide,mon){
  // Public log only: did the mon use a move under its base form before Mega?
  let pre=[];
  for(const line of log.split('\n')){
    const a=line.split('|');
    if(a[1]==='detailschange'&&a[2]?.startsWith(foeSide+'a: '+mon))return pre;
    if(a[1]==='move'&&a[2]?.startsWith(foeSide+'a: '+mon))pre.push(a[3]);
  }
  return null;
}
async function main(){
  const sim=load();const own=reportedLive();const cases=caseList();
  const rows=[];
  for(const plan of PLANS){
    const c=plan.team?{team:plan.team()}:cases.find(x=>x.id===plan.case);
    for(const [cfgName,cfg] of Object.entries(CONFIGS))
    for(const [rtName,rt] of Object.entries(plan.rivalThrees))
    for(const ownThree of plan.ownThrees)
    for(const [scName,sc] of Object.entries(plan.scripts))
    for(const seed of SEEDS())for(const reverse of [false,true]){
      const run=async mem=>{PROBE=[];PROBE_SIDE=reverse?'p2':'p1';
        const g=await battle(sim,structuredClone(own),structuredClone(c.team),seed,{
          ownThree,foeThree:rt,reverse,script:sc,ownOptions:{...cfg,publicMoveMemory:mem}});
        g.probe=PROBE;PROBE=null;return g;};
      const off=await run(false),on=await run(true);
      const knowledgeDiff=on.probe.filter((p,i)=>JSON.stringify(p.seen)!==JSON.stringify(off.probe[i]?.seen))
        .map((p,i)=>({turn:p.turn,foe:p.foe,onSeen:p.seen}));
      off.ownChoices=ownActions(off.log,off.ownSide);on.ownChoices=ownActions(on.log,on.ownSide);
      const preMega=revealedBeforeMega(off.log,off.foeSide,plan.mega);
      rows.push({case:plan.case,config:cfgName,rivalThree:rtName,ownThree:ownThree.join('/'),script:scName,
        seed:seed.join('-'),reverse,preMegaReveal:preMega,
        engineErrors:off.errors+on.errors,
        offWon:off.won,onWon:on.won,offTurns:off.turns,onTurns:on.turns,
        firstDivergence:divergence(off.ownChoices,on.ownChoices),
        offChoices:off.ownChoices,onChoices:on.ownChoices,
        knowledgeDiffDecisions:knowledgeDiff,
        sameLog:strip(off.log)===strip(on.log),
        offEvents:strip(off.log)===strip(on.log)?undefined:publicEvents(off.log),
        onEvents:strip(off.log)===strip(on.log)?undefined:publicEvents(on.log)});
    }
  }
  return rows;
}
// Our executed actions from the public log, per turn: move (+ Mega) or
// switch, including forced replacements. Used for the paired comparison.
function ownActions(log,side){
  const out=[];let turn=0;
  for(const line of log.split('\n')){
    if(line.startsWith('|turn|')){turn=Number(line.slice(6));continue;}
    const a=line.split('|');
    if(!a[2]?.startsWith(side+'a: '))continue;
    if(a[1]==='move'&&!/\[from\]/.test(line))out.push('T'+turn+' move '+a[3]);
    else if(a[1]==='switch')out.push('T'+turn+' switch '+nameOf(a[3]));
    else if(a[1]==='-mega')out.push('T'+turn+' mega');
  }
  return out;
}
// Wall-clock |t:| lines are the only expected non-deterministic content.
const strip=log=>log.split('\n').filter(l=>!l.startsWith('|t:|')).join('\n');
function divergence(a,b){
  for(let i=0;i<Math.max(a.length,b.length);i++)
    if(JSON.stringify(a[i])!==JSON.stringify(b[i]))return {index:i,off:a[i]||null,on:b[i]||null};
  return null;
}
module.exports={PLANS,CONFIGS,main};
if(require.main===module)main().then(rows=>{
  const sum={};
  for(const r of rows){
    const k=[r.case,r.config,r.script].join(' ');
    const s=sum[k]||(sum[k]={pairs:0,preMegaReveal:0,knowledgeDiffPairs:0,choiceDiff:0,logDiff:0,outcomeFlip:0,onWins:0,offWins:0,errors:0});
    s.pairs++;if(r.preMegaReveal&&r.preMegaReveal.length)s.preMegaReveal++;
    if(r.knowledgeDiffDecisions.length)s.knowledgeDiffPairs++;if(r.firstDivergence)s.choiceDiff++;if(!r.sameLog)s.logDiff++;
    if(r.offWon!==r.onWon)s.outcomeFlip++;s.onWins+=r.onWon;s.offWins+=r.offWon;s.errors+=r.engineErrors;
  }
  console.table(sum);
  const out=process.env.OUT;
  if(out){fs.mkdirSync(path.dirname(out),{recursive:true});
    fs.writeFileSync(out,JSON.stringify({showdown:SHOWDOWN,format:'gen9championsbssregmc',
      note:'Paired A/B: only our publicMoveMemory differs. Heuristic AI vs AI, not a ladder win rate.',
      summary:sum,rows},null,1));}
}).catch(e=>{console.error(e);process.exit(1);});
