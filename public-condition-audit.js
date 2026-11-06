#!/usr/bin/env node
'use strict';
// PR #76 P0-A (ChatGPT review of PR #75): the Bot read a public condition with
// split('/'), so "80/100 par" gave [80,NaN] and foeHP was not updated after a
// statused foe was hit or healed; a statused switch-in set foePublicStatus but
// left foeStatus ''. publicCondition / ownCondition (lab.js, opt-in) parse it
// once with parseCondition.
// This audit plays full pinned-Showdown games and, at EVERY move/switch
// request of BOTH bots, compares the Bot's internal values with the engine:
//   foeHP      vs the public HP of the foe active (Showdown getHealth: ceil %)
//   foeStatus  vs the foe active's status
//   own ratio  vs our active's exact hp/maxhp
// Same seeds, both sides (reverse), legacy vs fixed. The fixed run must match
// the engine everywhere; the legacy mismatches are the reproduced bug. The
// decision effect is reported as the choice sequence difference, same seed
// and side. Preview: legacy chooseThree on both sides (public six only).
// Heuristic AI vs heuristic AI, NOT a ladder win rate.
//   SHOWDOWN_DIR=... OUT=reports/data/public-condition-audit-20261031.json node public-condition-audit.js
const fs=require('node:fs');
const path=require('node:path');
const {load,Bot,normalize,hashSeed,parseCondition}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {caseList}=require('./legal-search-v2-compare');
const {nameOf}=require('./encore-lead-audit');
const FORMAT='gen9championsbssregmc';
const SHOWDOWN='3a766f2cfb5e51c1e428cfe87d0dba91a8f01640';
const CASES=['A_golisopod','B_lucarioZ','C_charizardY','Real_indeedee_scarf','NEW_realE_sun','HOLD_psychic_offense'];
const MODES={legacy:{},fixed:{publicCondition:true,ownCondition:true}};
// Public HP as the foe sees it (sim/pokemon.ts getHealth, champions mod:
// floor of the percentage, at least 1).
const publicHP=p=>p.hp<=0?0:(Math.floor(100*p.hp/p.maxhp)||1)/100;

class ProbeBot extends Bot{
  constructor(...args){super(...args);this.probe=args[7].probe;this.battle=args[7].battle;this.script=args[7].scripts?.[this.side]||null;
    // Options apply to one side only when sideOptions is given (rival unchanged).
    const so=args[7].sideOptions?.[this.side];if(so){this.publicCondition=Boolean(so.publicCondition);this.ownCondition=Boolean(so.ownCondition);}}
  decide(req){
    if(!req.teamPreview&&!req.wait&&this.foeActive){
      const b=this.battle(),own=b.sides[this.side==='p1'?0:1].active[0],foe=b.sides[this.side==='p1'?1:0].active[0];
      const cur=req.side.pokemon.find(p=>p.active);
      const [h,m]=String(cur?.condition).split('/').map(Number);
      const ratio=this.ownCondition?(parseCondition(cur?.condition).hp??1):m>0?h/m:1;
      if(foe&&!foe.fainted)this.probe.push({side:this.side,turn:this.turn,force:Boolean(req.forceSwitch),
        foe:foe.species.name,botHP:+this.foeHP.toFixed(3),trueHP:publicHP(foe),botStatus:this.foeStatus,botPublicStatus:this.foePublicStatus,trueStatus:foe.status||'',
        ownStatus:own?.status||'',botRatio:+ratio.toFixed(3),trueRatio:own?+(own.hp/own.maxhp).toFixed(3):null});
    }
    const c=!req.teamPreview&&!req.wait&&!req.forceSwitch&&this.errors===0&&this.script?this.script(req,this):null;
    return c||super.decide(req);
  }
}
async function play(sim,one,two,seed,options,{forced={},scripts=null,sideOptions=null}={}){
  const bs=new sim.BattleStream({noCatch:true}),streams=sim.getPlayerStreams(bs);
  const dex=sim.Dex.mod('champions'),trace={choices:[],selections:[],errors:[]},probe=[];
  const opt={...options,seed,probe,battle:()=>bs.battle,scripts,sideOptions};
  const b1=new ProbeBot(streams.p1,dex,one,'p1',trace,forced.p1||null,null,opt),b2=new ProbeBot(streams.p2,dex,two,'p2',trace,forced.p2||null,null,opt);
  let winner='',turns=0;const log=[];
  const watch=(async()=>{for await(const msg of streams.omniscient){log.push(msg);
    for(const l of msg.split('\n')){if(l.startsWith('|win|'))winner=l.slice(5);if(l.startsWith('|turn|'))turns=Number(l.slice(6));}}})();
  const r=[b1.run(),b2.run()];
  await streams.omniscient.write('>start '+JSON.stringify({formatid:FORMAT,seed})+'\n>player p1 '+JSON.stringify({name:'p1',team:normalize(one)})+'\n>player p2 '+JSON.stringify({name:'p2',team:normalize(two)}));
  await Promise.all([watch,...r]);
  if(!winner)throw Error('no winner '+JSON.stringify(trace.errors));
  return {winner:winner==='p1'?'p1':'p2',turns,trace,probe,log:log.join('\n')};
}
const hpOk=x=>Math.abs(x.botHP-x.trueHP)<=0.0005;
function tally(probe){
  const t={decisions:probe.length,foeStatused:0,hpMismatch:0,hpMismatchStatused:0,statusMismatch:0,publicStatusMismatch:0,
    ownStatused:0,ownRatioMismatch:0};
  for(const x of probe){
    if(x.trueStatus)t.foeStatused++;
    if(!hpOk(x)){t.hpMismatch++;if(x.trueStatus)t.hpMismatchStatused++;}
    if(x.botStatus!==x.trueStatus)t.statusMismatch++;
    if(x.botPublicStatus!==x.trueStatus)t.publicStatusMismatch++;
    if(x.ownStatus)t.ownStatused++;
    if(x.trueRatio!==null&&Math.abs(x.botRatio-x.trueRatio)>0.002)t.ownRatioMismatch++;
  }
  return t;
}
async function run({cases=CASES,seedN=3}={}){
  const sim=load(),own=reportedLive(),all=caseList(),games=[];
  for(const id of cases){
    const foe=all.find(c=>c.id===id).team;
    for(let s=0;s<seedN;s++)for(const reverse of [false,true]){
      const seed=hashSeed(7610000+CASES.indexOf(id)*100+s);
      const res={};
      for(const [mode,o] of Object.entries(MODES)){
        const [p1,p2]=reverse?[foe,own]:[own,foe];
        const g=await play(sim,structuredClone(p1),structuredClone(p2),seed,o);
        const ownSide=reverse?'p2':'p1';
        res[mode]={won:g.winner===ownSide,turns:g.turns,choices:g.trace.choices.map(c=>c.side+':'+c.turn+':'+c.choice),
          selections:g.trace.selections,tally:tally(g.probe),
          examples:g.probe.filter(x=>!hpOk(x)||x.botStatus!==x.trueStatus).slice(0,3)};
      }
      const a=res.legacy.choices,b=res.fixed.choices;let k=0;while(k<a.length&&k<b.length&&a[k]===b[k])k++;
      games.push({case:id,seed:seed.join('-'),reverse,legacy:res.legacy,fixed:res.fixed,
        sameChoices:k===a.length&&k===b.length,firstDivergence:k<Math.max(a.length,b.length)?{index:k,legacy:a[k]??null,fixed:b[k]??null}:null,
        winChanged:res.legacy.won!==res.fixed.won});
    }
  }
  const sum=mode=>{const t={};for(const g of games)for(const [k,v] of Object.entries(g[mode].tally))t[k]=(t[k]||0)+v;return t;};
  return {showdown:SHOWDOWN,format:FORMAT,own:'reportedLive (reported-live-roster-20261027.js)',modes:MODES,
    note:'Per-request engine truth vs Bot internals, both bots. Heuristic AI vs heuristic AI, NOT a ladder win rate.',
    totals:{legacy:sum('legacy'),fixed:sum('fixed')},
    decisionEffect:{games:games.length,sameChoices:games.filter(g=>g.sameChoices).length,winChanged:games.filter(g=>g.winChanged).length,
      ownWins:{legacy:games.filter(g=>g.legacy.won).length,fixed:games.filter(g=>g.fixed.won).length}},
    games:games.map(g=>({...g,legacy:{...g.legacy,choices:undefined},fixed:{...g.fixed,choices:undefined}}))};
}
// Status re-entry counterexample (decision level). Our forced lead Rotom-Wash
// (reported live set, Will-O-Wisp) vs the B_lucarioZ case six; the rival only
// switches its lead out on T2 and back on T3 (otherwise base AI). With legacy
// parsing a burned foe that comes back in reads foeStatus '' and
// policyStatusScore picks Will-O-Wisp again; the ENGINE answers |-fail|.
// Only our side gets the option; the rival bot is identical in both modes.
async function reentry({leads=['Archaludon','Corviknight','Garchomp','Primarina'],seedN=6}={}){
  const sim=load(),B=caseList().find(c=>c.id==='B_lucarioZ').team,rows=[];
  for(const lead of leads)for(let s=0;s<seedN;s++){
    const back=B.map(p=>p.species).filter(x=>x!==lead).slice(0,2),seed=hashSeed(7620000+s),row={lead,back,seed:seed.join('-')};
    const p2=(req,bot)=>{
      const cur=nameOf(req.side.pokemon.find(p=>p.active).details);
      const sw=n=>{const i=req.side.pokemon.findIndex(p=>!p.active&&nameOf(p.details).startsWith(n)&&!/ fnt$/.test(p.condition));return i<0?null:'switch '+(i+1);};
      if(bot.turn===2&&cur.startsWith(lead))return sw(back[0]);
      if(bot.turn===3&&!cur.startsWith(lead))return sw(lead);
      return null;
    };
    for(const [mode,o] of Object.entries(MODES)){
      const g=await play(sim,reportedLive(),structuredClone(B),seed,{},{forced:{p1:['Rotom-Wash','Metagross','Tyranitar'],p2:[lead,...back]},scripts:{p2},sideOptions:{p1:o,p2:{}}});
      if(g.trace.errors.length)throw Error('choice errors '+lead+' '+s);
      const L=g.log.split('\n').filter(l=>/^\|(move|-fail|-status|-curestatus|switch|drag|turn)\|/.test(l));
      let wow=0,fail=0;
      for(let i=0;i<L.length;i++)if(L[i].startsWith('|move|p1a: Rotom|Will-O-Wisp|')){wow++;if(/^\|-fail\|p2a: /.test(L[i+1]||''))fail++;}
      const own=g.probe.filter(x=>x.side==='p1');
      row[mode]={won:g.winner==='p1',turns:g.turns,willOWisp:wow,willOWispFailed:fail,
        firstFail:L.find((l,i)=>l.startsWith('|move|p1a: Rotom|Will-O-Wisp|')&&/^\|-fail\|/.test(L[i+1]||''))||null,
        tally:tally(own),statusExample:own.find(x=>x.botStatus!==x.trueStatus)||null};
    }
    rows.push(row);
  }
  const sum=(m,f)=>rows.reduce((n,r)=>n+Number(f(r[m])),0);
  return {setup:'own reportedLive, forced Rotom-Wash/Metagross/Tyranitar; rival B_lucarioZ forced lead+2, scripted T2 out / T3 back in only; option on our side only, probe = our bot',
    totals:Object.fromEntries(Object.keys(MODES).map(m=>[m,{games:rows.length,ownWins:sum(m,x=>x.won),willOWisp:sum(m,x=>x.willOWisp),willOWispFailed:sum(m,x=>x.willOWispFailed),
      gamesWithFailedWoW:sum(m,x=>x.willOWispFailed>0),decisions:sum(m,x=>x.tally.decisions),foeStatused:sum(m,x=>x.tally.foeStatused),
      statusMismatch:sum(m,x=>x.tally.statusMismatch),hpMismatch:sum(m,x=>x.tally.hpMismatch),ownRatioMismatch:sum(m,x=>x.tally.ownRatioMismatch)}])),
    winChanged:rows.filter(r=>r.legacy.won!==r.fixed.won).map(r=>[r.lead,r.seed,'legacy '+r.legacy.won,'fixed '+r.fixed.won]),rows};
}
async function main(){
  const res=await run({seedN:Number(process.env.SEEDN||3)});
  res.reentry=await reentry();
  console.log('reentry',JSON.stringify(res.reentry.totals),JSON.stringify(res.reentry.winChanged));
  console.log(JSON.stringify(res.totals),JSON.stringify(res.decisionEffect));
  for(const g of res.games)console.log(g.case.padEnd(22),g.seed,g.reverse?'R':'-','won L/F',+g.legacy.won,+g.fixed.won,'same',g.sameChoices,'div',JSON.stringify(g.firstDivergence),'L',JSON.stringify(g.legacy.tally));
  if(process.env.OUT){fs.mkdirSync(path.dirname(process.env.OUT),{recursive:true});fs.writeFileSync(process.env.OUT,JSON.stringify(res,null,1));}
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={run,play,tally,reentry,publicHP,MODES,CASES};
