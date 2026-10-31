'use strict';
// PR #70 request (PR #69 review 5712337767): v3 per-stint history, tag tiers,
// lock reasons, rival switch facts and the opt-in turn-AI Encore guard.
// Synthetic logs plus full pinned-Showdown games.
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
const {misplaysV2}=require('../misplay-tags-v2');
const {misplaysV3,anyTag,requestInfo,VOLUNTARY,VOLUNTARY_PR69,REVIEW_TAGS,FACT_TAGS}=require('../misplay-tags-v3');
const {battle,bench,nameOf}=require('../encore-lead-audit');
const {script,facts}=require('../encore-turn-p0-audit');
const {caseList}=require('../legal-search-v2-compare');
const {reportedLive}=require('../reported-live-roster-20261027');
const {hashSeed}=require('../lab');
const L=(...x)=>x.join('\n');
const dex=sim.Dex.mod('champions');
const A=caseList().find(c=>c.id==='A_golisopod');
const SD=t=>['|turn|'+t,'|move|p2a: Golisopod|Swords Dance|p2a: Golisopod'];

test('P0-1 synthetic (ChatGPT repro): SD, switch out, return, SD, SD is not setupSpam in v3',()=>{
  const log=L(...SD(1),'|turn|2','|switch|p2a: Garchomp|Garchomp, L50|185/185','|turn|3','|switch|p2a: Golisopod|Golisopod, L50|182/182',...SD(4),...SD(5));
  assert.equal(misplaysV3(log).p2.setupSpam,0);
  assert.equal(misplaysV3(log,{stintReset:false}).p2.setupSpam,1,'PR #69 behaviour reproducible');
  assert.equal(misplaysV2(log).p2.setupSpam,1,'v2 unchanged');
  // drag ends the stint too; a 3rd SD in the new stint is setupSpam again
  const drag=L(...SD(1),...SD(2),'|turn|3','|drag|p2a: Golisopod|Golisopod, L50|182/182',...SD(4),...SD(5),...SD(6));
  assert.equal(misplaysV3(drag).p2.setupSpam,1);
});
test('P0-2 tiers: encoreStay / lockedStay are review, not voluntary misplays; PR #69 aggregate still available',()=>{
  assert.deepEqual(REVIEW_TAGS,['encoreStay','lockedStay']);
  for(const t of REVIEW_TAGS){assert.equal(VOLUNTARY.includes(t),false);assert.equal(VOLUNTARY_PR69.includes(t),true);}
  for(const t of FACT_TAGS)assert.equal(VOLUNTARY.includes(t)||VOLUNTARY_PR69.includes(t),false);
  assert.equal(anyTag({encoreStay:1}),false);assert.equal(anyTag({encoreStay:1},VOLUNTARY_PR69),true);
});
test('lockReason: Choice item without Encore is choice; one move without Encore or Choice is other',()=>{
  const mk=item=>({active:[{moves:[{move:'Earthquake',disabled:false},{move:'Rock Slide',disabled:true}]}],side:{pokemon:[{active:true,condition:'100/100',item},{active:false,condition:'9/10'}]}});
  assert.equal(requestInfo(mk('choicescarf'),'p1',2).lockReason,'choice');
  assert.equal(requestInfo(mk('choicescarf'),'p1',2,{encored:true}).lockReason,'encore');
  assert.equal(requestInfo(mk('leftovers'),'p1',2).lockReason,'other');
});
test('real Battle: Taunt one-move lock is "other", Choice Scarf lock is "choice", never "encore"',async()=>{
  const I=caseList().find(c=>c.id==='Real_indeedee_sash'),H=caseList().find(c=>c.id==='HOLD_sun_balance');
  const taunt=(req,bot,info)=>{if(info.turn!==1)return null;const i=req.active[0].moves.findIndex(m=>m.move==='Taunt');return 'move '+(i+1);};
  const r=await battle(sim,structuredClone(I.team),structuredClone(H.team),hashSeed(7400000),
    {ownThree:['Gengar','Garchomp','Indeedee'],foeThree:['Toxapex','Skarmory','Eelektross'],reverse:false,script:null,ownOptions:{script:taunt}});
  assert.match(r.log,/\|-start\|p2a: Toxapex\|move: Taunt/);
  const tox=r.reqLog.find(x=>x.side==='p2'&&x.turn===2);
  assert.deepEqual([tox.locked,tox.lockedMove,tox.lockReason],[true,'Chilling Water','other']);
  assert.ok(r.reqLog.some(x=>x.side==='p1'&&x.lockReason==='choice'));
  assert.equal(r.reqLog.some(x=>x.lockReason==='encore'),false);
});
test('P0-1 real Battle: Golisopod SD, switch out, return, SD, SD -> v3 setupSpam 0 (PR #69 v3 and v2: 1)',async()=>{
  const plan={1:'Swords Dance',2:'Mimikyu',3:'Golisopod',4:'Swords Dance',5:'Swords Dance'};
  const s=(req,bot,info)=>{const p=plan[info.turn];if(!p)return null;const act=req.active[0];
    if(p==='Swords Dance'){const i=act.moves.findIndex(m=>m.move===p&&!m.disabled);return i>=0?'move '+(i+1)+(act.canMegaEvo?' mega':''):null;}
    const x=bench(req).find(y=>nameOf(y.p.details).startsWith(p));return x?'switch '+(x.i+1):null;};
  const r=await battle(sim,reportedLive(),structuredClone(A.team),hashSeed(7400000),{ownThree:['Metagross','Garchomp','Primarina'],foeThree:A.forcedA,reverse:false,script:s});
  const seq=r.log.split('\n').filter(l=>/^\|(move|switch)\|p2a/.test(l)).slice(0,5).map(l=>l.split('|').slice(1,4).join('|'));
  assert.deepEqual(seq.map(x=>x.split('|')[0]+'|'+x.split('|')[2].split(',')[0]),
    ['switch|Golisopod','move|Swords Dance','switch|Mimikyu','switch|Golisopod-Mega','move|Swords Dance']);
  assert.equal(misplaysV3(r.log).p2.setupSpam,0);
  assert.equal(misplaysV3(r.log,{stintReset:false}).p2.setupSpam,1);
  assert.equal(misplaysV2(r.log).p2.setupSpam,1);
});
test('P0-3 real Battle: PR #69 unconditional T1 switch to Garchomp dies to Moonblast; ratSwitch picks Mimikyu',async()=>{
  const run=(t1,enc)=>battle(sim,reportedLive(),structuredClone(A.team),hashSeed(7400000),
    {ownThree:['Primarina','Metagross','Garchomp'],foeThree:A.forcedA,reverse:false,script:script({t1,t2:'ai',enc},dex)});
  const g=await run('toGarchomp','ratSwitch');
  assert.match(g.log,/\|switch\|p2a: Garchomp[^\n]*\n(?:[^\n]*\n)*?\|move\|p1a: Primarina\|Moonblast\|p2a: Garchomp[\s\S]*?\|faint\|p2a: Garchomp/);
  assert.equal(facts(g.log,'p1','p2').rivalSwitchInFaintSameTurn,1);
  const m=await run('ratSwitch','ratSwitch');
  assert.match(m.log,/\|turn\|1\n(?:[^\n]*\n)*?\|switch\|p2a: Mimikyu/);
  assert.equal(facts(m.log,'p1','p2').rivalSwitchInFaintSameTurn,0);
});
test('P0-4 real Battle: encoreGuard stops Encore into an Encored foe; old AI does it (same seed)',async()=>{
  const run=ownOptions=>battle(sim,reportedLive(),structuredClone(A.team),hashSeed(7400000),
    {ownThree:['Primarina','Metagross','Garchomp'],foeThree:A.forcedA,reverse:false,script:script({t1:'ai',t2:'ai',enc:'stay'},dex),ownOptions});
  const o=await run({}),g=await run({encoreGuard:true});
  const fo=facts(o.log,'p1','p2'),fg=facts(g.log,'p1','p2');
  assert.ok(fo.ownEncoreIntoEncored>0&&fo.ownEncoreFail>0,'old turn AI re-uses Encore');
  assert.equal(fg.ownEncoreIntoEncored,0);assert.equal(fg.ownEncoreFail,0);
  assert.match(g.log,/\|-start\|p2a: Golisopod\|Encore/,'guard still uses Encore when it can work');
  // guard never picks Encore into a foe that has not moved since it came in
  const ga=await battle(sim,reportedLive(),structuredClone(A.team),hashSeed(7400000),
    {ownThree:['Primarina','Metagross','Garchomp'],foeThree:A.forcedA,reverse:false,script:script({t1:'ratSwitch',t2:'ratSwitch',enc:'ratSwitch'},dex),ownOptions:{encoreGuard:true}});
  const T=[];let t=0,fresh=false;
  for(const l of ga.log.split('\n')){const a=l.split('|');if(a[1]==='turn'){t=+a[2];continue;}
    if(a[1]==='switch'&&a[2].startsWith('p2a'))fresh=t;// switched in during turn t
    if(a[1]==='move'&&a[2].startsWith('p2a'))fresh=false;
    if(a[1]==='move'&&a[2]==='p1a: Primarina'&&a[3]==='Encore')T.push({t,fresh});}
  assert.ok(T.every(x=>x.fresh===false||x.fresh===x.t),'Encore only into a fresh switch-in of the SAME turn (simultaneous choice)');
});
test('baseline Bot without encoreGuard is unchanged (PR #69 ai/stay row replays)',async()=>{
  const saved=require('../reports/data/encore-lead-audit-20261030.json');
  const row=saved.rows.find(r=>r.lead==='primarinaLead'&&r.t1==='ai'&&r.enc==='stay'&&!r.reverse);
  const {rivalScript}=require('../encore-lead-audit');
  const seed=row.seed.split('-').map(Number);
  const r=await battle(sim,reportedLive(),structuredClone(A.team),seed,{ownThree:['Primarina','Metagross','Garchomp'],foeThree:A.forcedA,reverse:false,script:rivalScript('ai','stay',dex)});
  assert.equal(r.won,row.won);assert.equal(r.turns,row.turns);
});
