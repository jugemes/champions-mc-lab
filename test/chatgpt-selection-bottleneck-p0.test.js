'use strict';
// PR #104 comment #6553780822: predeclared, selection-vs-lead diagnostic.
// NOT a new policy, unseen holdout, usage-rate estimate or ladder win rate.
const test=require('node:test');
const assert=require('node:assert/strict');
const {Bot,load,normalize,prelim,hashSeed}=require('../lab');
const {reportedLive}=require('../reported-live-roster-20261027');
const {archetypes}=require('../fixtures');
const {immuneAware100}=require('../pr100-legal');
const {publicImmune98}=require('../pr98-timing');
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
async function battle(sim,own,foe,seed,reverse,forcedOwn,forcedFoe,script,{immuneAwareRival=false,ownPreviewPolicy='legacy'}={}){
 const streams=sim.getPlayerStreams(new sim.BattleStream({noCatch:true}));
 const dex=sim.Dex.mod('champions'),trace={choices:[],selections:[],errors:[]};
 const ownSide=reverse?'p2':'p1',foeSide=reverse?'p1':'p2';
 const [p1,p2]=reverse?[foe,own]:[own,foe];
 const b1=new Bot(streams.p1,dex,p1,'p1',trace,reverse?forcedFoe:forcedOwn,null,{seed,previewPolicy:reverse?'legacy':ownPreviewPolicy});
 const b2=new Bot(streams.p2,dex,p2,'p2',trace,reverse?forcedOwn:forcedFoe,null,{seed,previewPolicy:reverse?ownPreviewPolicy:'legacy'});
 const opponent=foeSide==='p1'?b1:b2,original=opponent.decide.bind(opponent);
 // Research-only opponent model: refuse attacks into immunities publicly
 // knowable at decision time. Never inspect hidden sets/selected three.
 const maskLog={};
 const immuneDecision=immuneAwareRival?immuneAware100(null,dex,maskLog):null;
 let scriptIssued=false;
 opponent.decide=function(req){
  if(req.teamPreview||req.forceSwitch||this.turn!==1){
   if(immuneDecision&&!req.teamPreview&&!req.forceSwitch){
    const corrected=immuneDecision(req,this,{turn:this.turn});
    if(corrected)return corrected;
   }
   return original(req);
  }
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
  errors:trace.errors.length,knownImmuneHits:publicImmune98(log,foeSide,dex).known.length,
  immuneAvoided:maskLog.masked?.length||0,
  immuneMaskEvidence:(maskLog.masked||[]).slice(0,6)};
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

test('known-public-immunity-aware rival: same fixed trios/leads across two archetypes and opposite rival selections',{skip},async t=>{
 const sim=load(),own=reportedLive(),report=[],rollup={naive:0,immuneAware:0,avoided:0,errors:0};
 // Predeclared rival trios and legal first-turn stress actions from the
 // earlier selection-bottleneck tests; no post-hoc choice of the winning trio.
 const branches=[
  {entry:cases[0],rival:cases[0].rival,scripts:cases[0].scripts},
  {entry:cases[0],rival:['Umbreon','Skarmory','Gholdengo'],
   scripts:[{kind:'move',move:'Yawn'},{kind:'move',move:'Foul Play'}]},
  {entry:cases[1],rival:cases[1].rival,scripts:cases[1].scripts},
  {entry:cases[1],rival:['Volcarona','Swampert','Skarmory'],
   scripts:[{kind:'move',move:'Quiver Dance'},{kind:'move',move:'Bug Buzz'}]}
 ];
 for(const [bi,b] of branches.entries())for(const [si,script] of b.scripts.entries()){
  const row={id:b.entry.id,rival:b.rival,script,
   arms:Object.fromEntries(Object.keys(b.entry.arms).map(k=>[k,{
    naiveWins:0,awareWins:0,gains:0,losses:0,avoided:0,
    naiveKnownImmune:0,awareKnownImmune:0,errors:0,
    examples:[]
   }]))};
  for(let n=0;n<2;n++)for(const reverse of [false,true]){
   const seed=hashSeed(10416000+bi*100+si*20+n);
   for(const [key,pick] of Object.entries(b.entry.arms)){
    const naive=await battle(sim,structuredClone(own),structuredClone(b.entry.team),
      seed,reverse,pick,b.rival,script);
    const aware=await battle(sim,structuredClone(own),structuredClone(b.entry.team),
      seed,reverse,pick,b.rival,script,{immuneAwareRival:true});
    assert.deepEqual(naive.three,aware.three,'same own three and lead');
    assert.equal(naive.lead,aware.lead);
    assert.deepEqual(naive.rivalEarly[0],aware.rivalEarly[0],
      'same T1 script selected: opponent rationality changes only subsequent decisions');
    const x=row.arms[key];
    x.naiveWins+=+naive.won;x.awareWins+=+aware.won;
    x.gains+=+(!naive.won&&aware.won);x.losses+=+(naive.won&&!aware.won);
    x.avoided+=aware.immuneAvoided;
    x.naiveKnownImmune+=naive.knownImmuneHits;
    x.awareKnownImmune+=aware.knownImmuneHits;
    x.errors+=naive.errors+aware.errors;
    if(x.examples.length<2)x.examples.push({seed,reverse,
      naive:{won:naive.won,early:naive.early,rivalEarly:naive.rivalEarly},
      aware:{won:aware.won,early:aware.early,rivalEarly:aware.rivalEarly},
      masked:aware.immuneMaskEvidence});
   }
  }
  report.push(row);
 }
 for(const row of report)for(const x of Object.values(row.arms)){
  assert.equal(x.errors,0,'both rival policies issue legal actions');
  rollup.naive+=x.naiveWins;rollup.immuneAware+=x.awareWins;
  rollup.avoided+=x.avoided;rollup.errors+=x.errors;
 }
 // The mask actually triggers in these predeclared cases. A zero would mean
 // this experiment is not testing the known-invulnerability problem.
 assert.ok(rollup.avoided>0,'the rational rival must avoid some known immune attacks');
 t.diagnostic('IMMUNITY-AWARE RIVAL SELECTION AUDIT '+JSON.stringify({rollup,report}));
});

 
// Pre-registered BEFORE any result inspection: PR #104 comment #6554645200.
// True unseen PUBLIC SIX combinations (not unseen species); old policies are
// frozen and evaluated without any holdout-specific rule or parameter tuning.
const HOLDOUT_PREDECLARED_20261101=[
  {id:'H-A-weather-setup-priority-stall',
   team:[rain[0],setup[1],rain[3],rain[4],stall[0],rain[5]],
   branches:[
     {rival:['Pelipper','Dragonite','Gholdengo'],script:{kind:'move',move:'Hurricane'}},
     {rival:['Volcarona','Toxapex','Rillaboom'],script:{kind:'move',move:'Quiver Dance'}}
   ]},
  {id:'H-B-mega-scarf-pivot-stall',
   team:[setup[0],rain[2],stall[4],stall[3],require('../fixtures').variants.A_rillaboom[0],rain[5]],
   branches:[
     {rival:['Salamence','Archaludon','Skarmory'],script:{kind:'move',move:'Dragon Dance'}},
     {rival:['Starmie','Slowbro','Rillaboom'],script:{kind:'move',move:'Ice Beam'}}
   ]}
];
test('predeclared unseen public-six holdout: legal 66P, unique items, coherent rival trios',{skip},()=>{
 const sim=load(),validator=sim.TeamValidator.get('gen9championsbssregmc');
 for(const c of HOLDOUT_PREDECLARED_20261101){
   prelim(c.team,c.id);
   assert.ok(!validator.validateTeam(normalize(c.team))?.length,c.id);
   assert.equal(new Set(c.team.map(x=>x.species)).size,6);
   assert.equal(new Set(c.team.map(x=>x.item)).size,6);
   for(const b of c.branches){
     assert.equal(b.rival.length,3);
     for(const name of b.rival)assert.ok(c.team.some(x=>x.species===name),name);
     const lead=c.team.find(x=>x.species===b.rival[0]);
     assert.ok(lead.moves.some(x=>canon(x)===canon(b.script.move)),b.script.move);
   }
 }
});
test('predeclared unseen public-six holdout: 3 frozen generic preview policies vs immunity-aware rival',{skip},async t=>{
 const sim=load(),own=reportedLive(),policies=['legacy','publicCoverage','publicTempo'],rows=[];
 for(const [ci,c] of HOLDOUT_PREDECLARED_20261101.entries()){
   const rec={id:c.id,publicSix:c.team.map(x=>x.species),branches:[]};
   for(const [bi,b] of c.branches.entries()){
     const br={rival:b.rival,script:b.script,policies:{}};
     for(const policy of policies)br.policies[policy]={wins:0,errors:0,knownImmuneHits:0,immuneAvoided:0,results:[]};
     for(let n=0;n<2;n++)for(const reverse of [false,true]){
       const seed=hashSeed(10417000+ci*100+bi*20+n);
       for(const policy of policies){
         const g=await battle(sim,structuredClone(own),structuredClone(c.team),
           seed,reverse,null,b.rival,b.script,{immuneAwareRival:true,ownPreviewPolicy:policy});
         const a=br.policies[policy];
         a.wins+=Number(g.won);a.errors+=g.errors;
         a.knownImmuneHits+=g.knownImmuneHits;a.immuneAvoided+=g.immuneAvoided;
         a.results.push({seed,reverse,won:g.won,three:g.three,lead:g.lead,
           ownT1T2:g.early,rivalT1T2:g.rivalEarly,
           rivalT1Executed:g.rivalT1Executed,rivalT1Prevented:g.rivalT1Prevented,
           // One trace per branch/policy is enough to audit actual execution.
           ...(n===0&&!reverse?{battleEarly:g.battleEarly}:{}),
           knownImmuneHits:g.knownImmuneHits});
         assert.equal(g.errors,0,c.id+' '+policy+' legal actions');
       }
     }
     rec.branches.push(br);
   }
   // Public-six preview must NOT depend on the secretly fixed rival three.
   // All three frozen policies are deterministic, so their selections must
   // match across the two different rival branches of the SAME public six.
   for(const policy of policies){
     const a=rec.branches[0].policies[policy].results[0];
     const b=rec.branches[1].policies[policy].results[0];
     assert.deepEqual(a.three,b.three,c.id+' '+policy+' leaked opposing chosen three');
     assert.equal(a.lead,b.lead,c.id+' '+policy+' leaked opposing lead');
   }
   rows.push(rec);
 }
 t.diagnostic('PREDECLARED UNSEEN PUBLIC SIX HOLDOUT '+JSON.stringify(rows));
});


// Predeclared BEFORE candidate implementation and outcome inspection:
// PR #104 comment #6555342021. These are unseen PUBLIC SIX combinations,
// not new species, ladder usage estimates or human-optimal opponent plays.
const PUBLIC_ROBUST_NEW_HOLDOUT=[
 {id:'H-C-weather-priority-pivot',
  team:[rain[0],rain[1],rain[3],stall[2],rain[4],stall[1]],
  branches:[
   {rival:['Pelipper','Swampert','Corviknight'],script:{kind:'move',move:'Hurricane'}},
   {rival:['Dragonite','Gholdengo','Umbreon'],script:{kind:'move',move:'Extreme Speed'}},
   {rival:['Gholdengo','Umbreon','Swampert'],script:{kind:'move',move:'Make It Rain'}}
  ]},
 {id:'H-D-mega-scarf-setup-stall',
  team:[setup[1],setup[0],require('../fixtures').variants.A_rillaboom[0],
    stall[0],rain[2],rain[5]],
  branches:[
   {rival:['Starmie','Salamence','Archaludon'],script:{kind:'move',move:'Ice Beam'}},
   {rival:['Rillaboom','Volcarona','Toxapex'],script:{kind:'move',move:'Grassy Glide'}},
   {rival:['Salamence','Volcarona','Starmie'],script:{kind:'move',move:'Double-Edge'}}
  ]}
];
test('publicRobust predeclared new holdout: legal teams, species-order invariant, no hidden trio input',{skip},t=>{
 const sim=load(),validator=sim.TeamValidator.get('gen9championsbssregmc');
 const {choosePublicRobustPreview}=require('../public-robust-preview');
 const {matchup}=require('../lab'),own=reportedLive();
 for(const c of PUBLIC_ROBUST_NEW_HOLDOUT){
  prelim(c.team,c.id);
  assert.ok(!validator.validateTeam(normalize(c.team))?.length,c.id);
  assert.equal(new Set(c.team.map(x=>x.item)).size,6,c.id+' unique items');
  const six=c.team.map(x=>x.species);
  const preview=choosePublicRobustPreview(sim,own,six,matchup);
  const forward=preview.selection;
  const backward=choosePublicRobustPreview(sim,own,six.slice().reverse(),matchup).selection;
  t.diagnostic('PUBLIC ROBUST PREVIEW SCORE '+JSON.stringify({id:c.id,selection:forward.map(i=>own[i-1].species),top:preview.top}));
  assert.deepEqual(forward,backward,c.id+' order-invariant public-six selection');
  assert.equal(new Set(forward).size,3);
  for(const b of c.branches){
   assert.equal(b.rival.length,3);
   for(const name of b.rival)assert.ok(c.team.some(p=>p.species===name),name);
   assert.ok(c.team.find(p=>p.species===b.rival[0]).moves.some(m=>
     canon(m)===canon(b.script.move)),b.script.move+' must be legal T1');
  }
 }
});
test('PUBLIC ROBUST NEW HOLDOUT: paired legacy vs robust with immunity-aware rival and T1/T2 logs',{skip},async t=>{
 const sim=load(),own=reportedLive(),policies=['legacy','publicRobust'],rows=[];
 for(const [ci,c] of PUBLIC_ROBUST_NEW_HOLDOUT.entries()){
  const rec={id:c.id,publicSix:c.team.map(p=>p.species),branches:[]};
  for(const [bi,b] of c.branches.entries()){
   const br={rival:b.rival,script:b.script,policies:{}};
   for(const policy of policies)br.policies[policy]={wins:0,errors:0,knownImmuneHits:0,
     immuneAvoided:0,results:[]};
   for(let n=0;n<2;n++)for(const reverse of [false,true]){
    const seed=hashSeed(10418000+ci*100+bi*20+n);
    for(const policy of policies){
     const g=await battle(sim,structuredClone(own),structuredClone(c.team),
       seed,reverse,null,b.rival,b.script,
       {immuneAwareRival:true,ownPreviewPolicy:policy});
     const a=br.policies[policy];
     a.wins+=Number(g.won);a.errors+=g.errors;
     a.knownImmuneHits+=g.knownImmuneHits;a.immuneAvoided+=g.immuneAvoided;
     a.results.push({seed,reverse,won:g.won,three:g.three,lead:g.lead,
       ownT1T2:g.early,rivalT1T2:g.rivalEarly,
       rivalT1Executed:g.rivalT1Executed,rivalT1Prevented:g.rivalT1Prevented,
       knownImmuneHits:g.knownImmuneHits,
       ...(n===0&&!reverse?{battleEarly:g.battleEarly}:{}),
     });
     assert.equal(g.errors,0,c.id+' '+policy+' choice errors');
    }
   }
   rec.branches.push(br);
  }
  for(const policy of policies){
   const first=rec.branches[0].policies[policy].results[0];
   for(const br of rec.branches.slice(1)){
    const other=br.policies[policy].results[0];
    assert.deepEqual(first.three,other.three,c.id+' '+policy+' cannot see rival hidden three');
    assert.equal(first.lead,other.lead,c.id+' '+policy+' cannot see rival lead');
   }
  }
  rows.push(rec);
 }
 t.diagnostic('PUBLIC ROBUST NEW HOLDOUT '+JSON.stringify(rows));
});
