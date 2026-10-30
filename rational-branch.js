#!/usr/bin/env node
'use strict';
// Counterfactual branch test on the pinned Showdown engine.
// Replays a rational-cases battle with its original seed up to the start of
// `turn` (same teams, same selections, same choices => identical state; the
// prefix log is checked), forces the candidate's choice at that turn, then
// `>reseed`s the battle PRNG with K continuation seeds so both branches face
// the SAME set of future random streams. Win rate per branch estimates the
// value of that single decision under the continuation policies; it is a
// property of these AI policies and these hypothesised sets, NOT a ladder rate.
const {load,hashSeed,normalize}=require('./lab');
const {CASES,SCRIPTS,ScriptedBot}=require('./rational-cases');
const FORMAT='gen9championsbssregmc';
class BranchBot extends ScriptedBot{
  decide(req){
    const b=this.branch;
    if(b&&!b.done&&!req.teamPreview&&!req.forceSwitch&&req.active&&this.turn===b.turn){
      b.done=true;b.prefix=b.logs.join('\n');
      this.omni.write('>reseed '+b.contSeed.join(','));
      this.decisionPolicy=b.contPolicy;this.rationalV2=b.contPolicy==='rational2';
      return b.choice;
    }
    return super.decide(req);
  }
}
async function runBranch(sim,name,{seed,reverse=false,turn,choice,contSeed,before='baseline',contPolicy='baseline',script}){
  const c=CASES[name],dex=sim.Dex.mod('champions');
  const own=c.own(),opp=c.opp;
  const streams=sim.getPlayerStreams(new sim.BattleStream({noCatch:true}));
  const trace={choices:[],selections:[],errors:[]};
  const cs=reverse?'p2':'p1',os=reverse?'p1':'p2';
  const logs=[];
  const cand=new BranchBot(streams[cs],dex,own,cs,trace,c.ownPick,null,{decisionPolicy:before,seed});
  cand.omni=streams.omniscient;cand.branch={turn,choice,contSeed,contPolicy,logs,done:false};
  const foe=new ScriptedBot(streams[os],dex,opp,os,trace,c.oppPick,null,{decisionPolicy:'baseline',seed});
  foe.script=script===null?null:SCRIPTS[c.script]||null;
  let winner='',turns=0;
  const obs=(async()=>{for await(const msg of streams.omniscient){logs.push(msg);for(const l of msg.split('\n')){
    if(l.startsWith('|win|'))winner=l.slice(5);if(l.startsWith('|turn|'))turns=Number(l.slice(6));}}})();
  const r1=cand.run(),r2=foe.run();
  const teams={[cs]:own,[os]:opp},names={[cs]:'candidate',[os]:'opponent'};
  await streams.omniscient.write('>start '+JSON.stringify({formatid:FORMAT,seed})+'\n>player p1 '+JSON.stringify({name:names.p1,team:normalize(teams.p1)})+'\n>player p2 '+JSON.stringify({name:names.p2,team:normalize(teams.p2)}));
  await Promise.all([obs,r1,r2]);
  if(!cand.branch.done)throw Error('branch turn '+turn+' never reached');
  // Survivors' HP at the end, from the candidate's point of view.
  return {win:winner==='candidate',turns,errors:trace.errors.length,prefix:cand.branch.prefix,log:logs.join('\n')};
}
// Battle-state lines only (drops timestamps / request noise) for prefix equality.
const stateLines=s=>s.split('\n').filter(l=>/^\|(switch|move|-damage|-heal|turn|faint|-mega|detailschange|-boost|-status)\|/.test(l)).join('\n');
async function compareBranches(sim,name,{seed,reverse,turn,choices,k=100,before='baseline',contPolicy='baseline',seedBase=540000,script}){
  const out={case:name,seed:seed.join('-'),side:reverse?'p2':'p1',turn,k,before,contPolicy,script:script===null?'unscripted':'scripted',branches:{}};
  let ref=null;
  for(const choice of choices){
    let w=0,len=0;const vec=[];
    for(let i=0;i<k;i++){
      const r=await runBranch(sim,name,{seed,reverse,turn,choice,contSeed:hashSeed(seedBase+i),before,contPolicy,script});
      const p=stateLines(r.prefix);
      if(ref===null)ref=p;else if(p!==ref)throw Error('prefix diverged before the branch turn');
      w+=Number(r.win);len+=r.turns;vec.push(Number(r.win));
    }
    out.branches[choice]={wins:w,games:k,meanTurns:+(len/k).toFixed(1),vec:vec.join('')};
  }
  // Paired discordance vs the first choice (same continuation seed).
  const [a,...rest]=choices;
  out.paired=Object.fromEntries(rest.map(b=>{const x=out.branches[a].vec,y=out.branches[b].vec;let ab=0,ba=0;
    for(let i=0;i<k;i++){if(x[i]==='1'&&y[i]==='0')ab++;if(x[i]==='0'&&y[i]==='1')ba++;}
    return [a+' vs '+b,{onlyFirstWins:ab,onlySecondWins:ba}];}));
  out.prefixTail=ref.split('\n').slice(-12);
  return out;
}
async function main(){
  const sim=load();
  const k=Number(process.argv[2]||100);
  const seed='52522-48513-31438-37827'.split('-').map(Number);
  const res=[];
  for(const script of [undefined,null])for(const contPolicy of ['baseline','rational','rational2']){
    const r=await compareBranches(sim,'B_helmet_roost',{seed,reverse:true,turn:3,choices:['move 4','switch 3','switch 2'],k,contPolicy,script});
    res.push(r);console.log(r.script,'continuation',contPolicy,JSON.stringify(Object.fromEntries(Object.entries(r.branches).map(([c,b])=>[c,b.wins+'/'+b.games]))),JSON.stringify(r.paired));
  }
  console.log(res[0].prefixTail.join('\n'));
  if(process.argv[3])require('node:fs').writeFileSync(process.argv[3],JSON.stringify(res,null,1));
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={runBranch,compareBranches,stateLines};
