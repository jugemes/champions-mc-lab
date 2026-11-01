'use strict';
// 2026-11-01 09 JST: DEV-only T1 tempo counterfactuals, NOT a policy or holdout.
// Compare executing a public-information alternative with legacy's actual T1
// decision; keep both public sixes, selected three, seed and side identical.
// The alternative is deliberately *not* chosen using hidden opposing sets.
const test=require('node:test');
const assert=require('node:assert/strict');
const {Bot,load,normalize,prelim,hashSeed}=require('../lab');
const {reportedLive}=require('../reported-live-roster-20261027');
const {archetypes}=require('../fixtures');
const {caseList,misplays}=require('../legal-search-compare');
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
const copy=x=>structuredClone(x);
const {rain,stall,setup}=archetypes;
const cases=()=>{
 const c=caseList().find(x=>x.id==='C_charizardY');
 assert.ok(c,'C known regression must exist');
 return [
  {id:'H1_rain_switch',team:[rain[0],rain[1],rain[2],stall[1],stall[4],stall[5]].map(copy),
   ours:['Rotom-Wash','Primarina','Garchomp'],
   A:['Pelipper','Swampert','Archaludon'],B:['Umbreon','Skarmory','Gholdengo'],
   publicTrigger:{own:'Rotom-Wash',foe:'Pelipper',move:'Hydro Pump'}},
  {id:'H2_setup_tempo',team:[setup[0],setup[1],setup[2],stall[0],stall[2],setup[3]].map(copy),
   ours:['Garchomp','Tyranitar','Rotom-Wash'],
   A:['Salamence','Volcarona','Dragonite'],B:['Toxapex','Corviknight','Gholdengo'],
   publicTrigger:{own:'Garchomp',foe:'Salamence',move:'Rock Slide'}},
  {id:'C_sun_tempo',team:copy(c.team),
   ours:['Hydreigon','Tyranitar','Metagross'],A:c.forcedA,B:c.forcedB,
   publicTrigger:{own:'Hydreigon',foe:'Charizard',move:'Dark Pulse'}}
 ];
};
const flagged=m=>Object.values(m||{}).some(Boolean);
function ownActive(req){
 const p=req.side?.pokemon?.find(x=>x.active);
 return String(p?.details||'').split(',')[0];
}
async function play(sim,own,foe,seed,reverse,scenario,foeForced,intervene){
 const streams=sim.getPlayerStreams(new sim.BattleStream({noCatch:true}));
 const dex=sim.Dex.mod('champions'),trace={choices:[],selections:[],errors:[]};
 const ownSide=reverse?'p2':'p1',foeSide=reverse?'p1':'p2';
 const [p1,p2]=reverse?[foe,own]:[own,foe];
 const mk=(stream,team,side)=>new Bot(stream,dex,team,side,trace,
   side===ownSide?scenario.ours:foeForced,null,{previewPolicy:'legacy',seed});
 const b1=mk(streams.p1,p1,'p1'),b2=mk(streams.p2,p2,'p2');
 const ownBot=ownSide==='p1'?b1:b2;
 if(intervene){
  const base=ownBot.decide.bind(ownBot);
  ownBot.decide=function(req){
   const oldSwitches=this.switches,choice=base(req);
   if(req.teamPreview||req.forceSwitch||this.turn!==1)return choice;
   if(ownActive(req)!==scenario.publicTrigger.own
       ||this.foeActive!==scenario.publicTrigger.foe)return choice;
   const moves=req.active?.[0]?.moves||[];
   const idx=moves.findIndex(m=>String(m.id||m.move).toLowerCase().replace(/[^a-z]/g,'')
       ===scenario.publicTrigger.move.toLowerCase().replace(/[^a-z]/g,'')
       &&!m.disabled&&m.pp>0);
   if(idx<0)return choice;
   // Base decide() may have incremented its private voluntary-switch counter.
   // Undo that bookkeeping when we instead take a legal move.
   this.switches=oldSwitches;
   return 'move '+(idx+1);
  };
 }
 let winner='',turns=0;const chunks=[];
 const watch=(async()=>{for await(const msg of streams.omniscient){
  chunks.push(msg);
  for(const line of msg.split('\n')){
   if(line.startsWith('|win|'))winner=line.slice(5);
   if(line.startsWith('|turn|'))turns=Number(line.slice(6));
  }
 }})();
 const r1=b1.run(),r2=b2.run();
 await streams.omniscient.write('>start '+JSON.stringify({formatid:'gen9championsbssregmc',seed})+
   '\n>player p1 '+JSON.stringify({name:'p1',team:normalize(p1)})+
   '\n>player p2 '+JSON.stringify({name:'p2',team:normalize(p2)}));
 await Promise.all([watch,r1,r2]);
 assert.ok(winner,'completed full Battle');
 const log=chunks.join('\n'),mis=misplays(log);
 const t1=trace.choices.find(x=>x.side===ownSide&&x.turn===1)?.choice||'';
 return {won:winner===ownSide,turns,errors:trace.errors.length,
   t1,foeMisplay:flagged(mis[foeSide]),ownMisplay:flagged(mis[ownSide]),
   log};
}
test('DEV T1 tempo counterfactual: same seed/side/three, rational switch and setup branches',{skip},async t=>{
 const sim=load(),own=reportedLive(),validator=sim.TeamValidator.get('gen9championsbssregmc');
 for(const [ci,c] of cases().entries()){
  prelim(c.team,c.id);
  assert.ok(!validator.validateTeam(normalize(c.team))?.length,c.id);
  const publicSix=c.team.map(p=>p.species);
  assert.equal(publicSix.length,6);
  for(const chosen of [c.ours,c.A,c.B])for(const species of chosen)
   assert.ok((chosen===c.ours?own:c.team).some(p=>p.species===species),c.id+': '+species);
  const result={id:c.id,publicSix,own:c.ours,alternative:c.publicTrigger,
   A:{old:0,alternative:0,improved:0,worsened:0,changedT1:0,errors:0,foeMisplayWinsOld:0,foeMisplayWinsAlternative:0,samples:[]},
   B:{old:0,alternative:0,improved:0,worsened:0,changedT1:0,errors:0,foeMisplayWinsOld:0,foeMisplayWinsAlternative:0,samples:[]}};
  for(const [branch,forced] of [['A',c.A],['B',c.B]]){
   for(let n=0;n<2;n++)for(const reverse of [false,true]){
    const seed=hashSeed(10409000+ci*100+n);
    const a=await play(sim,copy(own),copy(c.team),seed,reverse,c,forced,false);
    const b=await play(sim,copy(own),copy(c.team),seed,reverse,c,forced,true);
    const r=result[branch];
    r.old+=Number(a.won);r.alternative+=Number(b.won);
    r.improved+=Number(!a.won&&b.won);r.worsened+=Number(a.won&&!b.won);
    r.changedT1+=Number(a.t1!==b.t1);
    r.errors+=a.errors+b.errors;
    r.foeMisplayWinsOld+=Number(a.won&&a.foeMisplay);
    r.foeMisplayWinsAlternative+=Number(b.won&&b.foeMisplay);
    if(r.samples.length<2)r.samples.push({seed,reverse,oldWon:a.won,newWon:b.won,
     oldT1:a.t1,newT1:b.t1,oldTurns:a.turns,newTurns:b.turns});
   }
   assert.equal(result[branch].errors,0,'no illegal choices '+c.id+' '+branch);
  }
  assert.ok(result.A.changedT1>0,'must actually test a changed T1 in A: '+c.id);
  assert.equal(result.B.changedT1,0,'nontrigger B branch must not be altered: '+c.id);
  t.diagnostic('T1 TEMPO COUNTERFACTUAL '+JSON.stringify(result));
 }
});
