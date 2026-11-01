'use strict';
// PR #104 comment #6553780822: predeclared, selection-vs-lead diagnostic.
// NOT a new policy, unseen holdout, usage-rate estimate or ladder win rate.
const test=require('node:test');
const assert=require('node:assert/strict');
const {Bot,load,normalize,prelim,hashSeed}=require('../lab');
const {reportedLive}=require('../reported-live-roster-20261027');
const {archetypes}=require('../fixtures');
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
const {rain,stall,setup}=archetypes;
const cases=[
 {id:'DEV_rain',team:[rain[0],rain[1],rain[2],stall[1],stall[4],stall[5]],
  rival:['Pelipper','Swampert','Archaludon'],
  scripts:[{kind:'switch',to:'Swampert'},{kind:'move',move:'Hurricane'}],
  arms:{
   legacy:null,
   leadOnly:['Primarina','Rotom-Wash','Garchomp'],
   threeOnly:['Rotom-Wash','Garchomp','Hydreigon'],
   threeAndLead:['Hydreigon','Garchomp','Rotom-Wash']
  }},
 {id:'U2_used_setup_stall',team:[setup[1],rain[1],stall[4],rain[4],setup[2],setup[4]],
  rival:['Dragonite','Gholdengo','Skeledirge'],
  scripts:[{kind:'move',move:'Dragon Dance'},{kind:'move',move:'Extreme Speed'}],
  arms:{
   legacy:null,
   leadOnly:['Garchomp','Tyranitar','Rotom-Wash'],
   threeOnly:['Tyranitar','Hydreigon','Primarina'],
   threeAndLead:['Hydreigon','Tyranitar','Primarina']
  }}
];
const canon=s=>String(s||'').toLowerCase().replace(/[^a-z]/g,'');
async function battle(sim,own,foe,seed,reverse,forcedOwn,forcedFoe,script){
 const streams=sim.getPlayerStreams(new sim.BattleStream({noCatch:true}));
 const dex=sim.Dex.mod('champions'),trace={choices:[],selections:[],errors:[]};
 const ownSide=reverse?'p2':'p1',foeSide=reverse?'p1':'p2';
 const [p1,p2]=reverse?[foe,own]:[own,foe];
 const b1=new Bot(streams.p1,dex,p1,'p1',trace,reverse?forcedFoe:forcedOwn,null,{seed});
 const b2=new Bot(streams.p2,dex,p2,'p2',trace,reverse?forcedOwn:forcedFoe,null,{seed});
 const opponent=foeSide==='p1'?b1:b2,original=opponent.decide.bind(opponent);
 let scriptIssued=false;
 opponent.decide=function(req){
  if(req.teamPreview||req.forceSwitch||this.turn!==1)return original(req);
  scriptIssued=true;
  if(script.kind==='switch'){
   const i=req.side.pokemon.findIndex(p=>!p.active&&
     String(p.details||'').split(',')[0]===script.to&&
     !String(p.condition||'').endsWith(' fnt'));
   assert.ok(i>=0,'rival switch is available');
   return 'switch '+(i+1);
  }
  const i=(req.active?.[0]?.moves||[]).findIndex(m=>
    canon(m.id||m.move)===canon(script.move)&&!m.disabled&&m.pp>0);
  assert.ok(i>=0,'rival move is available: '+script.move);
  return 'move '+(i+1)+(req.active[0].canMegaEvo?' mega':'');
 };
 let winner='',log='';
 const observer=(async()=>{for await(const msg of streams.omniscient){
  log+=msg;
  for(const line of msg.split('\n'))if(line.startsWith('|win|'))winner=line.slice(5);
 }})();
 const run1=b1.run(),run2=b2.run();
 await streams.omniscient.write('>start '+JSON.stringify({formatid:'gen9championsbssregmc',seed})+
   '\n>player p1 '+JSON.stringify({name:'p1',team:normalize(p1)})+
   '\n>player p2 '+JSON.stringify({name:'p2',team:normalize(p2)}));
 await Promise.all([observer,run1,run2]);
 assert.ok(winner,'full Battle must complete');
 const t1=log.split('|turn|2')[0];
 const didScript=t1.split('\n').some(line=>{
  const parts=line.split('|');
  if(script.kind==='switch')return parts[1]==='switch'&&parts[2]?.startsWith(foeSide+'a:')&&
    parts[3]?.startsWith(script.to);
  return parts[1]==='move'&&parts[2]?.startsWith(foeSide+'a:')&&
    canon(parts[3])===canon(script.move);
 });
 // A faster opposing KO or a visible flinch can prevent the chosen rival
 // action from executing. This is legitimate counterplay, not a bad fixture.
 const preventedKO=t1.split('\n').some(x=>x.startsWith('|faint|'+foeSide+'a:'));
 const preventedCant=t1.split('\n').some(x=>x.startsWith('|cant|'+foeSide+'a:'));
 assert.ok(scriptIssued,'rival T1 scripted choice must be issued');
 assert.ok(didScript||preventedKO||preventedCant,
   'rival T1 must execute or be visibly prevented '+JSON.stringify(script));
 const selection=trace.selections.find(x=>x.side===ownSide);
 assert.ok(selection&&selection.chosen.length===3,'own selected three recorded');
 const early=trace.choices.filter(x=>x.side===ownSide&&x.turn>=1&&x.turn<=2)
   .map(x=>[x.turn,x.choice]);
 const rivalEarly=trace.choices.filter(x=>x.side===foeSide&&x.turn>=1&&x.turn<=2)
   .map(x=>[x.turn,x.choice]);
 // Same seed/sets/policies as the already completed run; instrument the
 // public battle log to audit whether the opponent actually punished T1/T2.
 const battleEarly=[];let turn=0;
 for(const line of log.split('\n')){
  if(line.startsWith('|turn|'))turn=Number(line.split('|')[2])||turn;
  if(turn>3)break;
  if(/^\|(move|switch|faint|cant|-damage|-boost|-unboost|-immune|-supereffective)\|/.test(line))
   battleEarly.push('T'+turn+':'+line.slice(0,170));
 }
 return {won:winner===ownSide,three:selection.chosen,lead:selection.lead,
  early,rivalEarly,battleEarly,rivalT1Executed:didScript,
  rivalT1Prevented:!didScript?(preventedKO?'KO':'cant'):null,
  errors:trace.errors.length};
}
test('predeclared selection diagnostic: both rival sixes and reported M-7 legal',{skip},()=>{
 const sim=load(),v=sim.TeamValidator.get('gen9championsbssregmc');
 const own=reportedLive();prelim(own,'reportedLive');
 assert.ok(!v.validateTeam(normalize(own))?.length);
 for(const c of cases){
  prelim(c.team,c.id);
  assert.ok(!v.validateTeam(normalize(c.team))?.length,c.id);
  for(const s of c.rival)assert.ok(c.team.some(x=>x.species===s));
  for(const pick of Object.values(c.arms).filter(Boolean)){
   assert.equal(new Set(pick).size,3);
   for(const s of pick)assert.ok(own.some(x=>x.species===s),s);
  }
 }
});
test('predeclared selection-vs-lead ablation: two rival T1 branches, pinned full Battle',{skip},async t=>{
 const sim=load(),own=reportedLive(),summary=[];
 for(const [ci,c] of cases.entries()){
  const rec={id:c.id,publicSix:c.team.map(x=>x.species),rival:c.rival,branches:[]};
  for(const [si,script] of c.scripts.entries()){
   const branch={script,arms:{}};
   for(const key of Object.keys(c.arms))branch.arms[key]={wins:0,errors:0,samples:[]};
   for(let n=0;n<2;n++)for(const reverse of [false,true]){
    const seed=hashSeed(10414000+ci*100+si*20+n);
    const games={};
    for(const [key,pick] of Object.entries(c.arms)){
     const g=await battle(sim,structuredClone(own),structuredClone(c.team),
       seed,reverse,pick,c.rival,script);
     games[key]=g;
     const a=branch.arms[key];a.wins+=Number(g.won);a.errors+=g.errors;
     if(a.samples.length<2)a.samples.push({seed,reverse,...g});
    }
    const base=games.legacy;
    // The lead-only intervention must preserve the legacy three-member set.
    assert.deepEqual([...games.leadOnly.three].sort(),[...base.three].sort(),
      c.id+' lead-only changes lead but not members');
    assert.notEqual(games.leadOnly.lead,base.lead,
      c.id+' lead-only must actually change lead');
    assert.equal(games.threeOnly.lead,base.lead,
      c.id+' three-only keeps baseline lead');
    assert.notDeepEqual([...games.threeOnly.three].sort(),[...base.three].sort(),
      c.id+' three-only must actually change selected members');
    assert.notEqual(games.threeAndLead.lead,games.threeOnly.lead,
      c.id+' threeAndLead must actually change lead');
    assert.deepEqual([...games.threeOnly.three].sort(),[...games.threeAndLead.three].sort(),
      c.id+' threeAndLead must use the same three as threeOnly');
   }
   for(const [key,a] of Object.entries(branch.arms))
    assert.equal(a.errors,0,c.id+' '+key+' valid choices');
   rec.branches.push(branch);
  }
  summary.push(rec);
 }
 t.diagnostic('SELECTION BOTTLENECK P0 '+JSON.stringify(summary));
});

test('cross-branch regression on different rival three (not an unseen holdout)',{skip},async t=>{
 const sim=load(),own=reportedLive(),rows=[];
 const stress=[
  {c:cases[0],rival:['Umbreon','Skarmory','Gholdengo'],
   scripts:[{kind:'move',move:'Yawn'},{kind:'move',move:'Foul Play'}]},
  {c:cases[1],rival:['Volcarona','Swampert','Skarmory'],
   scripts:[{kind:'move',move:'Quiver Dance'},{kind:'move',move:'Bug Buzz'}]}
 ];
 for(const [ci,entry] of stress.entries()){
  const {c,rival,scripts}=entry;
  const rec={id:c.id,rival,branches:[]};
  for(const [si,script] of scripts.entries()){
   const branch={script,arms:{}};
   for(const key of Object.keys(c.arms))branch.arms[key]={wins:0,errors:0,samples:[]};
   for(let n=0;n<2;n++)for(const reverse of [false,true]){
    const seed=hashSeed(10415000+ci*100+si*20+n);
    for(const [key,pick] of Object.entries(c.arms)){
     const g=await battle(sim,structuredClone(own),structuredClone(c.team),
       seed,reverse,pick,rival,script);
     const a=branch.arms[key];a.wins+=Number(g.won);a.errors+=g.errors;
     if(a.samples.length<1)a.samples.push({seed,reverse,...g});
    }
   }
   for(const [key,a] of Object.entries(branch.arms))
    assert.equal(a.errors,0,c.id+' regression '+key+' valid choices');
   rec.branches.push(branch);
  }
  rows.push(rec);
 }
 t.diagnostic('SELECTION CROSS BRANCH REGRESSION '+JSON.stringify(rows));
});
