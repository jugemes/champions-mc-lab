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
const {moveUtility}=require('../damage');
const {publicImmuneMoves100}=require('../pr100-legal');
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
async function battle(sim,own,foe,seed,reverse,forcedOwn,forcedFoe,script,{immuneAwareRival=false,ownPreviewPolicy='legacy',ownDecisionPolicy='baseline',rivalT2=null,rivalAttackPressure=false}={}){
 const streams=sim.getPlayerStreams(new sim.BattleStream({noCatch:true}));
 const dex=sim.Dex.mod('champions'),trace={choices:[],selections:[],errors:[]};
 const ownSide=reverse?'p2':'p1',foeSide=reverse?'p1':'p2';
 const [p1,p2]=reverse?[foe,own]:[own,foe];
 const b1=new Bot(streams.p1,dex,p1,'p1',trace,reverse?forcedFoe:forcedOwn,null,{seed,previewPolicy:reverse?'legacy':ownPreviewPolicy,decisionPolicy:reverse?'baseline':ownDecisionPolicy});
 const b2=new Bot(streams.p2,dex,p2,'p2',trace,reverse?forcedOwn:forcedFoe,null,{seed,previewPolicy:reverse?ownPreviewPolicy:'legacy',decisionPolicy:reverse?ownDecisionPolicy:'baseline'});
 const opponent=foeSide==='p1'?b1:b2,original=opponent.decide.bind(opponent);
 // Research-only opponent model: refuse attacks into immunities publicly
 // knowable at decision time. Never inspect hidden sets/selected three.
 const maskLog={};
 const immuneDecision=immuneAwareRival?immuneAware100(null,dex,maskLog):null;
 let scriptIssued=false;
 opponent.decide=function(req){
  // Research-only explicitly fixed rational T2 attack/pivot branch. It is
  // injected on the rival side only; never passed to our preview or turn AI.
  if(rivalT2&&this.turn===2&&!req.teamPreview&&!req.forceSwitch){
   if(rivalT2.kind==='switch'){
    const i=req.side.pokemon.findIndex(p=>!p.active&&
      String(p.details||'').split(',')[0]===rivalT2.to&&
      !String(p.condition||'').endsWith(' fnt'));
    assert.ok(i>=0,'predeclared rival T2 switch must be legal');
    this.trace.rivalT2Forced??=[];
    this.trace.rivalT2Forced.push({side:this.side,turn:this.turn,to:rivalT2.to});
    return 'switch '+(i+1);
   }
   const i=(req.active?.[0]?.moves||[]).findIndex(m=>
     canon(m.id||m.move)===canon(rivalT2.move)&&!m.disabled&&m.pp>0);
   assert.ok(i>=0,'predeclared rival T2 move must be legal');
   return 'move '+(i+1)+(req.active[0].canMegaEvo?' mega':'');
  }
  // Research-only opponent attack-pressure stress. Never presented as an
  // optimal human rival: this isolates wins from unpunished setup/passivity.
  // Uses rival's OWN legal request, and only the PUBLIC opposing active species.
  // It cannot see the opposing selected bench, items or unrevealed moves.
  if(rivalAttackPressure&&this.turn>=2&&!req.teamPreview&&!req.forceSwitch){
   const current=req.side.pokemon.find(p=>p.active);
   const mask=new Set(publicImmuneMoves100(dex,req,this).map(x=>x.i));
   if(current&&this.foeActive){
    const mine=this.getSet(current);
    const moves=req.active?.[0]?.moves||[];
    const legal=moves.map((m,i)=>({m,i})).filter(({m,i})=>
      !mask.has(i)&&!m.disabled&&m.pp>0&&
      dex.moves.get(m.id||m.move).category!=='Status');
    const ranked=legal.map(({m,i})=>({i,move:m.move,
      score:moveUtility(dex,mine,this.foeActive,m.id||m.move,
        {foeHP:this.foeHP,foeAbility:this.foeAbility,foeItem:this.foeItem,
         weather:this.weather,terrain:this.terrain})}))
      .filter(x=>Number.isFinite(x.score)&&x.score>0)
      .sort((a,b)=>b.score-a.score||a.i-b.i);
    if(ranked.length){
     const choice='move '+(ranked[0].i+1)+(req.active[0].canMegaEvo?' mega':'');
     this.trace.rivalPressure??=[];
     this.trace.rivalPressure.push({side:this.side,turn:this.turn,
       observedFoe:this.foeActive,move:ranked[0].move,choice});
     return choice;
    }
   }
  }
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
  immuneMaskEvidence:(maskLog.masked||[]).slice(0,6),
  rivalPressure:(trace.rivalPressure||[]).filter(x=>x.side===foeSide),
  rivalT2Forced:(trace.rivalT2Forced||[]).filter(x=>x.side===foeSide)};
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


// PREDECLARED prior to implementation/outcomes: PR #104 comment #6556025434.
// New PUBLIC SIX combinations H-E/H-F, never used to tune either preview policy.
// Four-arm ablation isolates selection changes from T1/T2 public-action gating.
const PUBLIC_ACTION_NEW_HOLDOUT=[
 {id:'H-E-weather-mega-status-pivot',
  team:[rain[0],setup[0],stall[0],rain[4],stall[3],rain[5]],
  branches:[
   {rival:['Pelipper','Gholdengo','Slowbro'],script:{kind:'move',move:'Hurricane'}},
   {rival:['Gholdengo','Toxapex','Salamence'],script:{kind:'move',move:'Make It Rain'}},
   {rival:['Salamence','Rillaboom','Toxapex'],script:{kind:'move',move:'Double-Edge'}}
  ]},
 {id:'H-F-mega-rain-setup-priority',
  team:[rain[1],setup[1],rain[3],stall[4],rain[2],rain[5]],
  branches:[
   {rival:['Swampert','Volcarona','Skarmory'],script:{kind:'move',move:'Liquidation'}},
   {rival:['Dragonite','Archaludon','Rillaboom'],script:{kind:'move',move:'Extreme Speed'}},
   {rival:['Volcarona','Swampert','Skarmory'],script:{kind:'move',move:'Fiery Dance'}}
  ]}
];
test('public action gate: only public-certain ability and opposing targeted status',{skip},()=>{
 const sim=load(),dex=sim.Dex.mod('champions');
 const {publicCertainAbility,blockedPublicTargetStatus}=require('../public-action-gate');
 assert.equal(publicCertainAbility(dex,'Gholdengo'),'goodasgold');
 assert.equal(blockedPublicTargetStatus(dex,'Gholdengo','Will-O-Wisp'),true);
 assert.equal(blockedPublicTargetStatus(dex,'Gholdengo','Encore'),true);
 assert.equal(blockedPublicTargetStatus(dex,'Gholdengo','Stealth Rock'),false);
 assert.equal(blockedPublicTargetStatus(dex,'Gholdengo','Dark Pulse'),false);
 assert.equal(blockedPublicTargetStatus(dex,'Gholdengo','Will-O-Wisp',{ownAbility:'Mold Breaker'}),false);
 assert.equal(blockedPublicTargetStatus(dex,'Gholdengo','Will-O-Wisp',{revealedAbility:'Levitate'}),false);
 assert.equal(blockedPublicTargetStatus(dex,'Salamence','Will-O-Wisp'),false);
 // Non-targeted status moves must remain available, even against Good as Gold.
 assert.equal(blockedPublicTargetStatus(dex,'Gholdengo','Swords Dance'),false);
 assert.equal(blockedPublicTargetStatus(dex,'Gholdengo','Rain Dance'),false);
});
test('predeclared H-E/H-F public action feasibility: legal teams and hidden-three invariance',{skip},()=>{
 const sim=load(),v=sim.TeamValidator.get('gen9championsbssregmc');
 const {choosePublicRobustPreview}=require('../public-robust-preview');
 const {matchup}=require('../lab'),own=reportedLive();
 for(const c of PUBLIC_ACTION_NEW_HOLDOUT){
  prelim(c.team,c.id);assert.ok(!v.validateTeam(normalize(c.team))?.length,c.id);
  assert.equal(new Set(c.team.map(x=>x.item)).size,6);
  assert.equal(new Set(c.team.map(x=>x.species)).size,6);
  const six=c.team.map(x=>x.species);
  const forward=choosePublicRobustPreview(sim,own,six,matchup).selection;
  const reverse=choosePublicRobustPreview(sim,own,six.slice().reverse(),matchup).selection;
  assert.deepEqual(forward,reverse,c.id+' public-six order');
  for(const b of c.branches){
   assert.equal(b.rival.length,3);
   for(const name of b.rival)assert.ok(c.team.some(x=>x.species===name),name);
   assert.ok(c.team.find(x=>x.species===b.rival[0]).moves.some(x=>
     canon(x)===canon(b.script.move)),b.script.move+' legal T1');
  }
 }
});
test('H-E/H-F predeclared: 2x2 selection/action ablation vs immune-aware rival',{skip},async t=>{
 const sim=load(),own=reportedLive(),rows=[];
 const arms=[
  {id:'legacy',preview:'legacy',decision:'baseline'},
  {id:'legacyAction',preview:'legacy',decision:'publicAction'},
  {id:'robust',preview:'publicRobust',decision:'baseline'},
  {id:'robustAction',preview:'publicRobust',decision:'publicAction'}
 ];
 for(const [ci,c] of PUBLIC_ACTION_NEW_HOLDOUT.entries()){
  const rec={id:c.id,publicSix:c.team.map(p=>p.species),branches:[]};
  for(const [bi,b] of c.branches.entries()){
   const br={rival:b.rival,script:b.script,arms:{}};
   for(const arm of arms)br.arms[arm.id]={wins:0,errors:0,knownImmuneHits:0,results:[]};
   for(let n=0;n<2;n++)for(const reverse of [false,true]){
    const seed=hashSeed(10419000+ci*100+bi*20+n);
    for(const arm of arms){
     const g=await battle(sim,structuredClone(own),structuredClone(c.team),
       seed,reverse,null,b.rival,b.script,{immuneAwareRival:true,
         ownPreviewPolicy:arm.preview,ownDecisionPolicy:arm.decision});
     const a=br.arms[arm.id];
     a.wins+=+g.won;a.errors+=g.errors;a.knownImmuneHits+=g.knownImmuneHits;
     a.results.push({seed,reverse,won:g.won,three:g.three,lead:g.lead,
       ownT1T2:g.early,rivalT1T2:g.rivalEarly,
       rivalT1Executed:g.rivalT1Executed,rivalT1Prevented:g.rivalT1Prevented,
       knownImmuneHits:g.knownImmuneHits,
       ...(n===0&&!reverse?{battleEarly:g.battleEarly}:{}),
     });
     assert.equal(g.errors,0,c.id+' '+arm.id+' legal choices');
     assert.equal(g.knownImmuneHits,0,c.id+' '+arm.id+' enemy publicly known immune attack');
    }
   }
   rec.branches.push(br);
  }
  for(const arm of arms){
   const first=rec.branches[0].arms[arm.id].results[0];
   for(const b of rec.branches.slice(1)){
    const other=b.arms[arm.id].results[0];
    assert.deepEqual(first.three,other.three,c.id+' hidden enemy trio leaked');
    assert.equal(first.lead,other.lead,c.id+' hidden enemy lead leaked');
   }
  }
  rows.push(rec);
 }
 t.diagnostic('PUBLIC ACTION PREDECLARED H-E/H-F '+JSON.stringify(rows));
});


// Development-only mechanism check, NOT a new holdout or candidate-adoption test.
// H-C was previously evaluated and exposed a Rotom-Wash Will-O-Wisp failure.
test('public action mechanism on already-used H-C Gholdengo branch: pinned paired full Battle',{skip},async t=>{
 const sim=load(),own=reportedLive(),c=PUBLIC_ROBUST_NEW_HOLDOUT[0],b=c.branches[2],rows=[];
 for(let n=0;n<2;n++)for(const reverse of [false,true]){
  const seed=hashSeed(10419100+n);
  const old=await battle(sim,structuredClone(own),structuredClone(c.team),
    seed,reverse,null,b.rival,b.script,{immuneAwareRival:true,
      ownPreviewPolicy:'publicRobust',ownDecisionPolicy:'baseline'});
  const guarded=await battle(sim,structuredClone(own),structuredClone(c.team),
    seed,reverse,null,b.rival,b.script,{immuneAwareRival:true,
      ownPreviewPolicy:'publicRobust',ownDecisionPolicy:'publicAction'});
  assert.deepEqual(old.three,guarded.three);
  assert.equal(old.lead,guarded.lead);
  assert.equal(old.errors+guarded.errors,0);
  rows.push({seed,reverse,old:{won:old.won,early:old.early},
    guarded:{won:guarded.won,early:guarded.early},
    ...(n===0&&!reverse?{oldBattleEarly:old.battleEarly,guardedBattleEarly:guarded.battleEarly}:{})});
 }
 t.diagnostic('PUBLIC ACTION H-C DEVELOPMENT MECHANISM '+JSON.stringify(rows));
});


// Development-only rational opponent T2 counterplay, predeclared in
// PR #104 comment #6556109658. H-C is ALREADY USED, not unseen holdout.
test('H-C known public immunity gate vs rational T2 attack and pivot branches',{skip},async t=>{
 const sim=load(),own=reportedLive(),c=PUBLIC_ROBUST_NEW_HOLDOUT[0],b=c.branches[2],rows=[];
 const t2s=[{kind:'move',move:'Make It Rain'},{kind:'switch',to:'Swampert'}];
 for(const [ti,rivalT2] of t2s.entries()){
  const rec={rivalT2,oldWins:0,guardedWins:0,results:[]};
  for(let n=0;n<2;n++)for(const reverse of [false,true]){
   const seed=hashSeed(10419200+ti*20+n);
   const old=await battle(sim,structuredClone(own),structuredClone(c.team),
     seed,reverse,null,b.rival,b.script,{immuneAwareRival:true,
       ownPreviewPolicy:'publicRobust',ownDecisionPolicy:'baseline',rivalT2});
   const guarded=await battle(sim,structuredClone(own),structuredClone(c.team),
     seed,reverse,null,b.rival,b.script,{immuneAwareRival:true,
       ownPreviewPolicy:'publicRobust',ownDecisionPolicy:'publicAction',rivalT2});
   assert.deepEqual(old.three,guarded.three);
   assert.equal(old.lead,guarded.lead);
   assert.equal(old.errors+guarded.errors,0);
   rec.oldWins+=+old.won;rec.guardedWins+=+guarded.won;
   rec.results.push({seed,reverse,old:{won:old.won,early:old.early},
     guarded:{won:guarded.won,early:guarded.early},
     ...(n===0&&!reverse?{oldBattleEarly:old.battleEarly,
       guardedBattleEarly:guarded.battleEarly}:{})});
  }
  rows.push(rec);
 }
 t.diagnostic('PUBLIC ACTION RATIONAL T2 H-C '+JSON.stringify(rows));
});


// PR #104 comment #6556713872: PREDECLARED six-arm selection feasibility
// diagnostic on ALREADY USED H-C/H-D. Not a new holdout, new policy, or
// estimate of human ladder performance. Baseline T1/T2 is identical for arms.
test('P0 selection feasibility frontier: six fixed 3+lead arms across both rival trios',{skip},async t=>{
 const sim=load(),own=reportedLive(),rows=[];
 const arms={
  legacy:{forced:null,preview:'legacy'},
  publicRobust:{forced:null,preview:'publicRobust'},
  fixedA:{forced:['Hydreigon','Tyranitar','Primarina'],preview:'legacy'},
  fixedB:{forced:['Hydreigon','Garchomp','Rotom-Wash'],preview:'legacy'},
  fixedC:{forced:['Tyranitar','Garchomp','Rotom-Wash'],preview:'legacy'},
  fixedD:{forced:['Metagross','Primarina','Rotom-Wash'],preview:'legacy'}
 };
 for(const [ci,c] of PUBLIC_ROBUST_NEW_HOLDOUT.entries()){
  const rec={id:c.id,publicSix:c.team.map(x=>x.species),branches:[]};
  const publicSixSelections={};
  for(const [bi,b] of c.branches.entries()){
   const row={rival:b.rival,script:b.script,arms:{}};
   for(const key of Object.keys(arms))row.arms[key]={
    wins:0,errors:0,knownImmuneHits:0,immuneAvoided:0,selection:null,samples:[]
   };
   for(let n=0;n<2;n++)for(const reverse of [false,true]){
    const seed=hashSeed(10419300+ci*100+bi*20+n);
    for(const [key,arm] of Object.entries(arms)){
     const g=await battle(sim,structuredClone(own),structuredClone(c.team),
      seed,reverse,arm.forced,b.rival,b.script,{
       immuneAwareRival:true,ownPreviewPolicy:arm.preview,
       ownDecisionPolicy:'baseline'
      });
     assert.equal(g.errors,0,c.id+' '+key+' legal choices');
     assert.equal(g.knownImmuneHits,0,c.id+' '+key+' rival known immunity');
     const x=row.arms[key];
     x.wins+=Number(g.won);x.errors+=g.errors;
     x.knownImmuneHits+=g.knownImmuneHits;
     x.immuneAvoided+=g.immuneAvoided;
     if(x.selection===null)x.selection={three:g.three,lead:g.lead};
     else assert.deepEqual({three:g.three,lead:g.lead},x.selection,
      'own 3+lead must depend on public six, not hidden rival trio or seed');
     if(n===0&&!reverse)x.samples.push({
      seed,reverse,won:g.won,ownT1T2:g.early,rivalT1T2:g.rivalEarly,
      rivalT1Executed:g.rivalT1Executed,
      rivalT1Prevented:g.rivalT1Prevented,battleEarly:g.battleEarly
     });
    }
   }
   for(const [key,x] of Object.entries(row.arms)){
    if(publicSixSelections[key])assert.deepEqual(x.selection,publicSixSelections[key],
     'hidden opponent trio must not change selection for same public six');
    else publicSixSelections[key]=x.selection;
   }
   rec.branches.push(row);
  }
  rows.push(rec);
 }
 const summary=Object.fromEntries(Object.keys(arms).map(key=>{
  const perSix=rows.map(c=>({
   id:c.id,wins:c.branches.reduce((s,b)=>s+b.arms[key].wins,0),
   branchWins:c.branches.map(b=>b.arms[key].wins),
   minBranchWins:Math.min(...c.branches.map(b=>b.arms[key].wins)),
   selection:c.branches[0].arms[key].selection
  }));
  return [key,{wins:perSix.reduce((s,x)=>s+x.wins,0),perSix}];
 }));
 t.diagnostic('P0 SELECTION FEASIBILITY FRONTIER '+JSON.stringify({summary,rows}));
});


// Predeclared in PR #104 comments #6557109139 / #6557111787 before code.
// Existing H-C/H-D are diagnostic, NOT a new public-six holdout. 72 paired
// conditions (144 full Battles), two independent seeds with side reversal.
test('P0 rival attack-pressure control: same own 3+lead and fixed T1, six opposing branches',{skip},async t=>{
 const sim=load(),own=reportedLive(),rows=[],arms={
  legacy:{forced:null,preview:'legacy'},
  fixedB:{forced:['Hydreigon','Garchomp','Rotom-Wash'],preview:'legacy'},
  fixedD:{forced:['Metagross','Primarina','Rotom-Wash'],preview:'legacy'}
 };
 let totalPairs=0,pressureActions=0,changedWins=0,changedT2=0;
 for(const [ci,c] of PUBLIC_ROBUST_NEW_HOLDOUT.entries()){
  const rec={id:c.id,branches:[]};
  for(const [bi,b] of c.branches.entries()){
   const br={rival:b.rival,script:b.script,arms:{}};
   for(const key of Object.keys(arms))
    br.arms[key]={baselineWins:0,pressureWins:0,changedWinners:0,
      pressureActions:0,changedT2:0,example:null};
   for(let n=0;n<2;n++)for(const reverse of [false,true]){
    const seed=hashSeed(10419400+ci*100+bi*20+n);
    for(const [key,arm] of Object.entries(arms)){
     const args=[sim,structuredClone(own),structuredClone(c.team),
       seed,reverse,arm.forced,b.rival,b.script];
     const options={immuneAwareRival:true,ownPreviewPolicy:arm.preview};
     const old=await battle(...args,options);
     const pressure=await battle(sim,structuredClone(own),structuredClone(c.team),
       seed,reverse,arm.forced,b.rival,b.script,
       {...options,rivalAttackPressure:true});
     assert.equal(old.errors+pressure.errors,0,'both rival policies legal');
     assert.equal(old.knownImmuneHits+pressure.knownImmuneHits,0,
       'no publicly known immunity attack from rival');
     assert.deepEqual(old.three,pressure.three,'same own public-six three');
     assert.equal(old.lead,pressure.lead,'same own lead');
     assert.deepEqual(old.rivalEarly[0],pressure.rivalEarly[0],
       'same predeclared rival T1 choice');
     assert.equal(old.rivalT1Executed,pressure.rivalT1Executed,
       'same executed or prevented rival T1');
     assert.equal(old.rivalT1Prevented,pressure.rivalT1Prevented,
       'same reason for any prevented rival T1');
     const a=br.arms[key];
     a.baselineWins+=+old.won;a.pressureWins+=+pressure.won;
     a.changedWinners+=+(old.won!==pressure.won);
     a.pressureActions+=pressure.rivalPressure.length;
     a.changedT2+=+(JSON.stringify(old.rivalEarly.find(x=>x[0]===2))!==
       JSON.stringify(pressure.rivalEarly.find(x=>x[0]===2)));
     if(n===0&&!reverse)a.example={
       ownThree:old.three,lead:old.lead,
       baseline:{won:old.won,ownT1T2:old.early,rivalT1T2:old.rivalEarly},
       pressure:{won:pressure.won,ownT1T2:pressure.early,
         rivalT1T2:pressure.rivalEarly,
         pressureActions:pressure.rivalPressure.slice(0,3)}
     };
     totalPairs++;pressureActions+=pressure.rivalPressure.length;
     changedWins+=+(old.won!==pressure.won);
     changedT2+=+(JSON.stringify(old.rivalEarly.find(x=>x[0]===2))!==
       JSON.stringify(pressure.rivalEarly.find(x=>x[0]===2)));
    }
   }
   rec.branches.push(br);
  }
  rows.push(rec);
 }
 assert.equal(totalPairs,72);
 assert.ok(pressureActions>0,'pressure option must execute on real turns');
 t.diagnostic('P0 RIVAL ATTACK PRESSURE '+JSON.stringify({
   totalPairs,fullBattles:totalPairs*2,pressureActions,changedWins,changedT2,
   rows
 }));
});


// Pre-registered on PR #104 comment #6557385628 BEFORE any implementation,
// run or result inspection. These are new public-six combinations, not new
// species or estimates of real-world usage. Do not tune the old B/D arms here.
const P0_PIVOT_HOLDOUT_20261101=[
 {id:'H-G-rain-setup-pivot',
  team:[rain[0],rain[1],setup[1],stall[0],rain[4],rain[3]],
  branches:[
   {rival:['Pelipper','Swampert','Gholdengo'],script:{kind:'move',move:'Hurricane'},pivot:'Swampert'},
   {rival:['Volcarona','Toxapex','Dragonite'],script:{kind:'move',move:'Quiver Dance'},pivot:'Toxapex'},
   {rival:['Gholdengo','Swampert','Dragonite'],script:{kind:'move',move:'Make It Rain'},pivot:'Swampert'}
  ]},
 {id:'H-H-mega-special-cycle',
  team:[setup[0],rain[2],stall[1],stall[3],rain[5],stall[4]],
  branches:[
   {rival:['Salamence','Archaludon','Umbreon'],script:{kind:'move',move:'Double-Edge'},pivot:'Umbreon'},
   {rival:['Rillaboom','Slowbro','Skarmory'],script:{kind:'move',move:'Grassy Glide'},pivot:'Slowbro'},
   {rival:['Archaludon','Skarmory','Umbreon'],script:{kind:'move',move:'Electro Shot'},pivot:'Skarmory'}
  ]}
];
const P0_HOLDOUT_ARMS={
 legacy:null,
 fixedB:['Hydreigon','Garchomp','Rotom-Wash'],
 fixedD:['Metagross','Primarina','Rotom-Wash']
};
test('P0 new H-G/H-H holdout: public six, items, 66P and scripted moves legal',{skip},()=>{
 const sim=load(),v=sim.TeamValidator.get('gen9championsbssregmc');
 for(const c of P0_PIVOT_HOLDOUT_20261101){
  prelim(c.team,c.id);
  assert.ok(!v.validateTeam(normalize(c.team))?.length,c.id);
  assert.equal(new Set(c.team.map(x=>x.species)).size,6,c.id+' unique species');
  assert.equal(new Set(c.team.map(x=>x.item)).size,6,c.id+' unique items');
  for(const b of c.branches){
   assert.equal(b.rival.length,3);
   assert.equal(new Set(b.rival).size,3);
   for(const name of b.rival)assert.ok(c.team.some(x=>x.species===name),name);
   assert.ok(b.rival.includes(b.pivot),'T2 pivot must be one of the selected three');
   assert.notEqual(b.pivot,b.rival[0],'T2 pivot cannot be the initial lead');
   const lead=c.team.find(x=>x.species===b.rival[0]);
   assert.ok(lead.moves.some(m=>canon(m)===canon(b.script.move)),
     c.id+' T1 must be legal: '+b.script.move);
  }
 }
});
test('P0 H-G/H-H unseen six: same-seed 3-arm immunity/attack/pivot stress in pinned full Battles',{skip},async t=>{
 const sim=load(),own=reportedLive(),rows=[];
 let total=0,errors=0,immuneHits=0,pivots=0;
 for(const [ci,c] of P0_PIVOT_HOLDOUT_20261101.entries()){
  const rec={id:c.id,publicSix:c.team.map(x=>x.species),branches:[]};
  for(const [bi,b] of c.branches.entries()){
   const br={rival:b.rival,t1:b.script,t2Pivot:b.pivot,arms:{}};
   for(const key of Object.keys(P0_HOLDOUT_ARMS))
    br.arms[key]={baseline:0,attack:0,pivot:0,pivotExecuted:0,
      errors:0,knownImmune:0,samples:[]};
   for(let n=0;n<2;n++)for(const reverse of [false,true]){
    const seed=hashSeed(10423000+ci*100+bi*20+n);
    for(const [key,pick] of Object.entries(P0_HOLDOUT_ARMS)){
     const results={};
     for(const mode of ['baseline','attack','pivot']){
      const opts={immuneAwareRival:true};
      if(mode==='attack')opts.rivalAttackPressure=true;
      if(mode==='pivot')opts.rivalT2={kind:'switch',to:b.pivot};
      const g=await battle(sim,structuredClone(own),structuredClone(c.team),
       seed,reverse,pick,b.rival,b.script,opts);
      total++;errors+=g.errors;immuneHits+=g.knownImmuneHits;
      results[mode]=g;
      const a=br.arms[key];a[mode]+=Number(g.won);
      a.errors+=g.errors;a.knownImmune+=g.knownImmuneHits;
      if(mode==='pivot'){
       const didPivot=g.rivalT2Forced.some(x=>x.turn===2&&x.to===b.pivot)&&
        g.rivalEarly.some(x=>x[0]===2&&String(x[1]).startsWith('switch '));
       a.pivotExecuted+=Number(didPivot);
       pivots+=Number(didPivot);
      }
     }
     for(const mode of ['attack','pivot']){
      assert.deepEqual(results.baseline.three,results[mode].three,
       'same own three in each rival-policy paired comparison');
      assert.equal(results.baseline.lead,results[mode].lead,
       'same own lead in each rival-policy paired comparison');
      assert.deepEqual(results.baseline.rivalEarly[0],results[mode].rivalEarly[0],
       'same opponent scripted T1');
     }
     const a=br.arms[key];
     if(n===0&&!reverse)a.samples.push({
      seed,three:results.baseline.three,lead:results.baseline.lead,
      baseline:{won:results.baseline.won,own:results.baseline.early,rival:results.baseline.rivalEarly},
      attack:{won:results.attack.won,own:results.attack.early,rival:results.attack.rivalEarly},
      pivot:{won:results.pivot.won,own:results.pivot.early,rival:results.pivot.rivalEarly,
       earlyLog:results.pivot.battleEarly}
     });
    }
   }
   rec.branches.push(br);
  }
  // No candidate sees which hidden three the opponent actually selected.
  for(const key of Object.keys(P0_HOLDOUT_ARMS)){
   const a=rec.branches[0].arms[key].samples[0].baseline;
   const selection=rec.branches[0].arms[key].samples[0];
   for(const b of rec.branches.slice(1)){
    const other=b.arms[key].samples[0];
    assert.deepEqual(other.three,selection.three,c.id+' '+key+' public-six invariance');
    assert.equal(other.lead,selection.lead,c.id+' '+key+' lead invariance');
   }
  }
  rows.push(rec);
 }
 assert.equal(total,216,'3 arms x 6 branches x 2 independent seeds x 2 sides x 3 rival policies');
 assert.equal(errors,0,'all full Battles have legal choices');
 assert.equal(immuneHits,0,'rival never attacks a publicly certain immunity');
 // A zero-pivot test cannot be presented as a test of rational T2 switching.
 assert.ok(pivots>0,'T2 switch stress must actually execute at least once');
 t.diagnostic('P0 NEW H-G/H-H PIVOT HOLDOUT '+JSON.stringify({
  fullBattles:total,independentSeedsPerBranch:2,sideReversals:2,
  errors,knownImmuneHits:immuneHits,pivotExecuted:pivots,rows}));
});
