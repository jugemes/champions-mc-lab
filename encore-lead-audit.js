#!/usr/bin/env node
'use strict';
// PR #68 request: Encore-forced setup tags and lead-only difference, audited
// in full pinned-Showdown games (not synthetic logs).
//   Case A public six (Golisopod/Garchomp/Primarina/Mimikyu/Hippowdon/
//   Gholdengo), our reportedLive() six, rival three fixed to forcedA
//   (Golisopod/Garchomp/Mimikyu, lead Golisopod). Our three fixed to
//   Primarina/Metagross/Garchomp; only the LEAD differs (Primarina vs
//   Garchomp). Same seeds and side reversal for both leads.
// Rival branches (explicit, both scripted only on the rival side):
//   T1: ai | attack (best damaging move by BP x STAB x type) | setup (Swords
//       Dance) | switch (to Garchomp; Mimikyu if Garchomp is out)
//   on every Encore-locked decision: stay (AI, i.e. forced move) |
//       toGarchomp | toMimikyu (falls back to any legal bench mon)
// Our side: baseline turn AI. The rival's preview/hidden sets never reach our
// side; this is a counterfactual over full games only. Heuristic AI vs
// heuristic AI: NOT a ladder win rate. A win where the rival stayed in an
// Encored Swords Dance with a switch available is NOT a line against humans.
//   SHOWDOWN_DIR=... OUT=output/encore-lead-audit.json node encore-lead-audit.js
const fs=require('node:fs');
const path=require('node:path');
const {Bot,normalize,hashSeed,load}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {caseList}=require('./legal-search-v2-compare');
const {misplaysV2,anyTag:anyTagV2}=require('./misplay-tags-v2');
const {misplaysV3,anyTag:anyTagV3,requestInfo}=require('./misplay-tags-v3');
const FORMAT='gen9championsbssregmc';
const SHOWDOWN='3a766f2cfb5e51c1e428cfe87d0dba91a8f01640';
// Same seed construction as legal-search-v2-compare (case A gi=0), so the
// 'ai/stay' cell reproduces the saved PR #67 forcedA rows.
const SEED_BASES=[7400000,7500000,7600000];
const SEEDS=()=>SEED_BASES.flatMap(b=>[0,1].map(s=>hashSeed(b+0*1000+s*10)));
const LEADS={primarinaLead:['Primarina','Metagross','Garchomp'],garchompLead:['Garchomp','Metagross','Primarina']};
const T1=['ai','attack','setup','switch'];
const ENC=['stay','toGarchomp','toMimikyu'];

const nameOf=d=>d.split(',')[0];
const bench=req=>req.side.pokemon.map((p,i)=>({p,i})).filter(x=>!x.p.active&&!/ fnt$/.test(x.p.condition));
class AuditBot extends Bot{
  constructor(...args){const opts=args[7]||{};super(...args);this.script=opts.script||null;this.reqLog=opts.reqLog||null;}
  decide(req){
    // Bot.run has already read |turn|N when the move request for turn N arrives.
    const info=requestInfo(req,this.side,this.turn);
    if(info&&this.reqLog)this.reqLog.push(info);
    const base=()=>super.decide(req);
    if(!this.script||!info||this.errors>0)return base();
    const c=this.script(req,this,info);
    return c||base();
  }
}
function switchTo(req,species){
  const b=bench(req);const x=b.find(y=>nameOf(y.p.details).startsWith(species))||b[0];
  return x?'switch '+(x.i+1):null;
}
function rivalScript(t1,enc,dex){
  return (req,bot,info)=>{
    const act=req.active[0];const mega=act.canMegaEvo?' mega':'';
    // Encore lock = a one-move request on a mon that holds no Choice item
    // (rival's own knowledge; Struggle is excluded in requestInfo).
    const set=bot.getSet(req.side.pokemon.find(p=>p.active));
    if(info.locked&&!/^Choice /.test(set.item||'')){
      if(enc==='stay'||!info.canSwitch)return null;
      return switchTo(req,enc==='toGarchomp'?'Garchomp':'Mimikyu');
    }
    if(info.turn!==1||t1==='ai')return null;
    const moves=act.moves.map((m,i)=>({m,i,mv:dex.moves.get(m.id)})).filter(x=>!x.m.disabled);
    if(t1==='setup'){const s=moves.find(x=>x.mv.name==='Swords Dance');return s?'move '+(s.i+1)+mega:null;}
    if(t1==='switch'){const cur=nameOf(req.side.pokemon.find(p=>p.active).details);return switchTo(req,cur.startsWith('Garchomp')?'Mimikyu':'Garchomp');}
    // attack
    const me=dex.species.get(nameOf(req.side.pokemon.find(p=>p.active).details));
    const foe=dex.species.get(bot.foeActive||'Primarina');
    const val=x=>{const mv=x.mv;if(mv.category==='Status')return -1;
      if(!dex.getImmunity(mv.type,foe))return 0;
      return mv.basePower*(me.types.includes(mv.type)?1.5:1)*2**dex.getEffectiveness(mv.type,foe);};
    const best=moves.sort((a,b)=>val(b)-val(a))[0];
    return best&&val(best)>0?'move '+(best.i+1)+mega:null;
  };
}
async function battle(sim,own,foe,seed,{ownThree,foeThree,reverse,script}){
  const streams=sim.getPlayerStreams(new sim.BattleStream({noCatch:true}));
  const dex=sim.Dex.mod('champions');
  const trace={choices:[],selections:[],errors:[]};const reqLog=[];
  const [p1,p2]=reverse?[foe,own]:[own,foe];
  const ownSide=reverse?'p2':'p1',foeSide=reverse?'p1':'p2';
  const bots={};
  const mk=(stream,team,side)=>bots[side]=new AuditBot(stream,dex,team,side,trace,side===ownSide?ownThree:foeThree,null,
    {previewPolicy:'legacy',seed,reqLog,script:side===foeSide?script:null});
  mk(streams.p1,p1,'p1');mk(streams.p2,p2,'p2');
  let winner='',turns=0;const log=[];
  const watch=(async()=>{for await(const msg of streams.omniscient){log.push(msg);
    for(const line of msg.split('\n')){if(line.startsWith('|win|'))winner=line.slice(5);if(line.startsWith('|turn|'))turns=Number(line.slice(6));}}})();
  const r1=bots.p1.run(),r2=bots.p2.run();
  await streams.omniscient.write('>start '+JSON.stringify({formatid:FORMAT,seed})+
    '\n>player p1 '+JSON.stringify({name:'p1',team:normalize(p1)})+'\n>player p2 '+JSON.stringify({name:'p2',team:normalize(p2)}));
  await Promise.all([watch,r1,r2]);
  if(!winner)throw Error('no winner '+JSON.stringify(trace.errors));
  const sel=s=>trace.selections.find(x=>x.side===s);
  return {won:winner===ownSide,turns,errors:trace.errors.length,log:log.join('\n'),ownSide,foeSide,reqLog,foe:sel(foeSide).chosen};
}
// Encore facts observed in the log, for the rival side.
function encoreFacts(log,foeSide,reqLog){
  const f={encoreStarts:0,encoreEnds:0,switchOutOfEncore:0,forcedSD:0,forcedSDwithSwitch:0,firstEncoreTurn:null};
  let turn=0,enc=null;const req={};for(const r of reqLog)if(r.side===foeSide)req[r.turn]=r;
  for(const line of log.split('\n')){
    const a=line.split('|');
    if(a[1]==='turn'){turn=Number(a[2]);continue;}
    if(!a[2]||a[2].slice(0,2)!==foeSide)continue;
    if(a[1]==='-start'&&/Encore$/.test(a[3]||'')){f.encoreStarts++;enc=a[2].slice(5);if(f.firstEncoreTurn===null)f.firstEncoreTurn=turn;}
    else if(a[1]==='-end'&&/Encore$/.test(a[3]||'')){f.encoreEnds++;enc=null;}
    else if(a[1]==='switch'||a[1]==='drag'){if(enc)f.switchOutOfEncore++;enc=null;}
    else if(a[1]==='faint'){enc=null;}
    else if(a[1]==='move'&&enc===a[2].slice(5)&&a[3]==='Swords Dance'){f.forcedSD++;if(req[turn]&&req[turn].canSwitch)f.forcedSDwithSwitch++;}
  }
  return f;
}
function earlyLines(log,ownSide,maxTurn=4){
  const out=[];let turn=0;
  for(const line of log.split('\n')){
    if(line.startsWith('|turn|')){turn=Number(line.slice(6));if(turn>maxTurn)break;out.push('T'+turn);continue;}
    const a=line.split('|');
    if(['move','switch','drag','faint','-mega','-start','-end','-activate'].includes(a[1])&&!(a[1]==='-start'&&!/Encore/.test(a[3]||'')))
      out.push(a.slice(1,4).join('|').replace(new RegExp(ownSide+'a: ','g'),'OWN:').replace(/p[12]a: /g,'RIVAL:'));
  }
  return out;
}
const nz=o=>Object.fromEntries(Object.entries(o).filter(([,v])=>v));
async function main(){
  const sim=load();const dex=sim.Dex.mod('champions');
  const A=caseList().find(c=>c.id==='A_golisopod');
  const own=reportedLive();
  const rows=[];
  for(const [lead,three] of Object.entries(LEADS))for(const t1 of T1)for(const enc of ENC)for(const seed of SEEDS())for(const reverse of [false,true]){
    const r=await battle(sim,structuredClone(own),structuredClone(A.team),seed,{ownThree:three,foeThree:A.forcedA,reverse,script:rivalScript(t1,enc,dex)});
    if(r.errors)throw Error('choice errors '+lead+' '+t1+' '+enc);
    const v2=misplaysV2(r.log),v3=misplaysV3(r.log,{requests:r.reqLog});
    const f=encoreFacts(r.log,r.foeSide,r.reqLog);
    rows.push({lead,three:three.join('/'),t1,enc,seed:seed.join('-'),reverse,won:r.won,turns:r.turns,
      foeV2:nz(v2[r.foeSide]),foeV3:nz(v3[r.foeSide]),ownV3:nz(v3[r.ownSide]),
      foeTaggedV2:anyTagV2(v2[r.foeSide]),foeTaggedV3:anyTagV3(v3[r.foeSide]),ownTaggedV3:anyTagV3(v3[r.ownSide]),encore:f,
      early:earlyLines(r.log,r.ownSide)});
  }
  const cell={};
  for(const r of rows){
    const k=[r.lead,r.t1,r.enc].join('|');
    const c=cell[k]||(cell[k]={lead:r.lead,t1:r.t1,enc:r.enc,w:0,n:0,cleanV2:[0,0],cleanV3:[0,0],encored:0,forcedSD:0,forcedSDwithSwitch:0,
      switchOutOfEncore:0,v2SetupSpamGames:0,v3SetupSpamGames:0,v3ForcedGames:0,v3EncoreStayGames:0,ownTagged:0});
    c.w+=r.won;c.n++;
    if(!r.foeTaggedV2){c.cleanV2[0]+=r.won;c.cleanV2[1]++;}
    if(!r.foeTaggedV3){c.cleanV3[0]+=r.won;c.cleanV3[1]++;}
    c.encored+=r.encore.encoreStarts>0;c.forcedSD+=r.encore.forcedSD;c.forcedSDwithSwitch+=r.encore.forcedSDwithSwitch;c.switchOutOfEncore+=r.encore.switchOutOfEncore;
    c.v2SetupSpamGames+=(r.foeV2.setupSpam||0)>0;c.v3SetupSpamGames+=(r.foeV3.setupSpam||0)>0;
    c.v3ForcedGames+=(r.foeV3.setupForcedEncore||0)>0;c.v3EncoreStayGames+=(r.foeV3.encoreStay||0)>0;c.ownTagged+=r.ownTaggedV3;
  }
  for(const c of Object.values(cell))
    console.log(c.lead.padEnd(14),c.t1.padEnd(7),c.enc.padEnd(11),'win',c.w+'/'+c.n,'cleanV2',c.cleanV2.join('/'),'cleanV3',c.cleanV3.join('/'),
      'encored',c.encored,'forcedSD',c.forcedSD,'(switchable',c.forcedSDwithSwitch+')','switchOut',c.switchOutOfEncore,
      'v2spam',c.v2SetupSpamGames,'v3spam',c.v3SetupSpamGames,'v3forced',c.v3ForcedGames,'v3stay',c.v3EncoreStayGames,'ownTag',c.ownTagged);
  const out={showdown:SHOWDOWN,format:FORMAT,own:'reportedLive()',case:'A_golisopod',rivalThree:A.forcedA,leads:LEADS,
    seeds:SEEDS().map(s=>s.join('-')),branches:{t1:T1,encore:ENC},
    note:'Full pinned-Showdown games, rival branches scripted on the rival side only. Heuristic AI vs heuristic AI, NOT a ladder win rate. v2 tags kept for comparison; v3 separates Encore-forced repeats.',
    cells:Object.values(cell),rows};
  const file=process.env.OUT||path.join(__dirname,'output','encore-lead-audit.json');
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify(out,null,1));
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={battle,rivalScript,encoreFacts,AuditBot};
