'use strict';
// PR #96 request: P0-1 (T2 key vs public hazards), P0-2 (paired rational
// comparison, immune-aware rival). Minimal reproductions + pinned-Showdown
// battles.
const test=require('node:test'),assert=require('node:assert/strict');
const haveSD=!!process.env.SHOWDOWN_DIR;
const X=require('../pr96-paired');
const T=require('../pr94-t1t2');

const obs=(o={})=>({turn:2,rivalLead:'Charizard',rivalActive:'Charizard-Mega-Y',ownActive:'Rotom-Wash',ownHP:1,rivalHP:1,ownStatus:'',rivalStatus:'',
  weather:'sunnyday',terrain:'',trickRoom:false,ownBoosts:{},rivalBoosts:{},ownEncored:false,rivalEncored:false,ownHazards:{},rivalHazards:{},
  legal:['move:Hydro Pump','move:Volt Switch','switch:Garchomp'],...o});

test('P0-1 reproduced: pr94 keyOf ignores rival-side hazards; keyOf96 separates them',()=>{
  const states=[{},{stealthrock:1},{stealthrock:1,spikes:1},{stealthrock:1,spikes:2},{toxicspikes:1},{stickyweb:1}];
  const k94=new Set(states.map(h=>T.keyOf(obs({rivalHazards:h})))),k96=new Set(states.map(h=>X.keyOf96(obs({rivalHazards:h}))));
  assert.equal(k94.size,1,'pr94 collision (the reported P0)');
  assert.equal(k96.size,states.length);
  // own-side layers too
  assert.notEqual(X.keyOf96(obs({ownHazards:{spikes:1}})),X.keyOf96(obs({ownHazards:{spikes:2}})));
  // side is not confused
  assert.notEqual(X.keyOf96(obs({ownHazards:{stealthrock:1}})),X.keyOf96(obs({rivalHazards:{stealthrock:1}})));
});

test('keyOf96 keeps pr94 properties: visible Mega forme, minimality, non-public fields throw',()=>{
  assert.notEqual(X.keyOf96(obs({rivalActive:'Charizard-Mega-X'})),X.keyOf96(obs({rivalActive:'Charizard-Mega-Y'})));
  assert.equal(X.keyOf96(obs({ownHP:0.9})),X.keyOf96(obs({ownHP:0.6})));
  assert.equal(X.keyOf96(obs({legal:['switch:Garchomp','move:Volt Switch','move:Hydro Pump']})),X.keyOf96(obs()));
  assert.equal(X.keyOf96(obs({rivalHazards:{stealthrock:0}})),X.keyOf96(obs()),'zero layers = none');
  for(const f of ['rivalItem','rivalMoves','rivalThree','hypothesis','seed','branch','won'])assert.throws(()=>X.keyOf96(obs({[f]:'x'})),/non-public/);
  // T1 unchanged (no hazards exist before T1 actions)
  assert.equal(X.keyOf96(obs({turn:1})),T.keyOf(obs({turn:1})));
});

test('P0-2 reproduced: pr94 cellValues per-candidate filter vs pr96 paired values (ChatGPT synthetic case)',()=>{
  // one cell, ten shared jobs; candidate A 1W/9L where the 9 losses carry a public-immune tag, B 6W/4L.
  const cells=[{si:0}],jobs=[],res=[];
  for(let k=0;k<2;k++)for(let s=0;s<10;s++){jobs.push({k,ci:0,branch:'ai',seed:s,reverse:false});
    const won=k===0?(s===0?1:0):(s<6?1:0);res.push({won,masked:[],irrational:[],immune:k===0&&s>0?[{turn:1}]:[]});}
  // pr94 behaviour (rationalOnly per candidate) re-implemented from pr94-cover-preview cellValues
  const C=require('../pr94-cover-preview');
  const pr94=[0,1].map(k=>{const v=jobs.map((j,i)=>j.k===k&&C.rational94(j,res[i])?res[i].won:null).filter(x=>x!=null);return v.reduce((a,b)=>a+b,0)/v.length;});
  assert.deepEqual(pr94,[1,0.6],'pr94 ranks A over B on different samples');
  const p=X.cellValues96(2,cells,jobs,res);
  assert.deepEqual(p.values.map(v=>v[0]),[0.1,0.6],'paired: all games, same jobs');
  assert.equal(p.audit[0][0].immune,9);
  const s=X.cellValues96(2,cells,jobs,res,{intersection:true});
  assert.deepEqual(s.values.map(v=>v[0]),[1,1],'intersection drops the job for BOTH candidates');
  assert.equal(s.audit[1][0].dropped,9);
  // unpaired input is rejected (no silent fallback)
  assert.throws(()=>X.cellValues96(2,cells,jobs.slice(0,15),res.slice(0,15)),/unpaired/);
});

test('publicImmuneMoves: only immunities the rival can know',{skip:!haveSD&&'SHOWDOWN_DIR not set'},()=>{
  const {load}=require('../lab');const dex=load().Dex.mod('champions');
  const req=(moves,ability='guts',species='Heracross')=>({active:[{moves:moves.map(m=>({move:m,id:m.toLowerCase().replace(/[^a-z]/g,''),pp:8}))}],
    side:{pokemon:[{active:true,ability,condition:'100/100',details:species}]}});
  const im=(r,b)=>X.publicImmuneMoves(dex,r,{foeAbility:'',foeItem:'',...b}).map(x=>x.move);
  assert.deepEqual(im(req(['Earthquake','Close Combat']),{foeActive:'Rotom-Wash'}),['Earthquake'],'Levitate is Rotom-Wash only ability');
  assert.deepEqual(im(req(['Earthquake']),{foeActive:'Hydreigon'}),['Earthquake']);
  assert.deepEqual(im(req(['Earthquake'],'moldbreaker'),{foeActive:'Rotom-Wash'}),[],'own Mold Breaker');
  assert.deepEqual(im(req(['Earthquake']),{foeActive:'Garchomp'}),[],'Garchomp: no immunity');
  assert.deepEqual(im(req(['Thunderbolt']),{foeActive:'Garchomp'}),['Thunderbolt'],'type chart');
  assert.deepEqual(im(req(['Thunder Wave']),{foeActive:'Garchomp'}),['Thunder Wave'],'immunity-checked status move');
  assert.deepEqual(im(req(['Will-O-Wisp']),{foeActive:'Garchomp'}),[],'status move without type immunity check');
  assert.deepEqual(im(req(['Close Combat']),{foeActive:'Gengar'}),['Close Combat']);
  assert.deepEqual(im(req(['Close Combat'],'scrappy'),{foeActive:'Gengar'}),[],'own Scrappy');
  assert.deepEqual(im(req(['Double-Edge'],'pixilate'),{foeActive:'Gengar'}),[],'own Pixilate turns Normal into Fairy');
  assert.deepEqual(im(req(['Thousand Arrows']),{foeActive:'Rotom-Wash'}),[]);
  // two possible abilities: hidden -> not assumed; revealed -> public
  assert.deepEqual(im(req(['Thunderbolt']),{foeActive:'Gastrodon'}),['Thunderbolt'],'Water/Ground: type chart');
  assert.deepEqual(im(req(['Hydro Pump']),{foeActive:'Gastrodon'}),[],'2 abilities, hidden: Storm Drain not assumed');
  assert.deepEqual(im(req(['Hydro Pump']),{foeActive:'Gastrodon',foeAbility:'Storm Drain'}),['Hydro Pump'],'revealed ability');
  assert.deepEqual(im(req(['Earthquake']),{foeActive:'Garchomp',foeItem:'Air Balloon'}),['Earthquake'],'revealed Air Balloon');
  assert.deepEqual(im(req(['Weather Ball']),{foeActive:'Gengar'}),[],'state-dependent type never masked');
});

test('immune-aware rival on pinned Showdown: N2/a view2 cell, Rotom-Wash lead (PR #95 D1)',{skip:!haveSD&&'SHOWDOWN_DIR not set'},async()=>{
  const {hashSeed}=require('../lab');const H92=require('../holdout-20261031-pr92');
  const own=require('../reported-live-roster-20261027').reportedLive();
  const N2=H92.unseenSixesPR92().N2_heracross,ace=N2.ace,base=N2.hypotheses.a;
  const team=base.map(p=>p.species===ace?{...p,nature:'Jolly',moves:['Close Combat','Megahorn','Earthquake','Stone Edge']}:p);// selector template set
  const foe=[ace,base.find(p=>p.item==='Choice Scarf').species,base.find(p=>p.item==='Focus Sash').species];
  const jobs=[];for(const ia of [false,true])for(const br of ['ai','attack'])for(let s=0;s<4;s++)
    jobs.push({team:0,own:['Rotom-Wash','Hydreigon','Primarina'],foe,branch:br,seed:hashSeed(9550000+(br==='ai'?0:100)+s),reverse:s%2===1,plan:{},immuneAware:ia});
  const R=await X.runGames96(own,[team],jobs,{workers:2});
  const naive=R.filter((r,i)=>!jobs[i].immuneAware),aware=R.filter((r,i)=>jobs[i].immuneAware);
  assert.ok(naive.every(r=>r.immune.some(x=>x.turn===1&&x.move==='Earthquake')),'naive rival: T1 Earthquake into Levitate');
  assert.ok(aware.every(r=>!r.immune.some(x=>x.turn<=2)),'aware rival: no T1/T2 public-immune hit');
  assert.ok(aware.every(r=>r.masked.some(x=>x.turn===1&&x.move==='Earthquake'&&/levitate/.test(x.why))),'re-decision recorded');
  assert.ok(aware.some(r=>r.masked.some(x=>x.turn===1&&x.replacement!=='move:Close Combat'))||aware.some(r=>r.masked.some(x=>x.replacement==='move:Close Combat')),'replacement recorded');
  assert.ok(naive.filter(r=>r.won).length>aware.filter(r=>r.won).length,'the naive internal win was inflated by the irrational move');
});

test('P0-1 on pinned Showdown: our T1 Stealth Rock reaches the T2 key as rival-side hazard',{skip:!haveSD&&'SHOWDOWN_DIR not set'},async()=>{
  const {hashSeed}=require('../lab');const H92=require('../holdout-20261031-pr92');
  const own=require('../reported-live-roster-20261027').reportedLive();
  const t=H92.unseenSixesPR92().N2_heracross.hypotheses.b,foe=t.slice(1,4).map(p=>p.species);
  const jobs=[];for(const lab of ['move:Stealth Rock','move:Knock Off'])for(let s=0;s<4;s++)
    jobs.push({team:0,own:['Tyranitar','Garchomp','Rotom-Wash'],foe,branch:'attack',seed:hashSeed(9690000+s),reverse:s%2===1,plan:{force:{turn:1,label:lab}},keepLines:true});
  const R=await X.runGames96(own,[t],jobs,{workers:2});
  const sr=R.filter((r,i)=>jobs[i].plan.force.label==='move:Stealth Rock'&&r.used[1]==='move:Stealth Rock'&&r.keys[2]);
  const ko=R.filter((r,i)=>jobs[i].plan.force.label==='move:Knock Off'&&r.keys[2]);
  assert.ok(sr.length>=1,'Stealth Rock executed and T2 reached');
  for(const r of sr){assert.equal(r.obs[2].rivalHazards.stealthrock,1);assert.match(r.keys[2],/\|riv:stealthrock\|/);
    assert.ok(r.lines.some(l=>/\|-sidestart\|p[12]: .*Stealth Rock/.test(l)));}
  for(const r of ko)assert.match(r.keys[2],/\|riv:-\|/);
  // the pr94 key of the same observation has no rival-hazard field
  const o=obs({rivalHazards:sr[0].obs[2].rivalHazards});assert.equal(T.keyOf(o),T.keyOf(obs()));
});

test('publicImmune96: a rival move into a mon we switched in that turn is not irrational',{skip:!haveSD&&'SHOWDOWN_DIR not set'},()=>{
  const {load}=require('../lab');const dex=load().Dex.mod('champions');
  const log=['|switch|p1a: Garchomp|Garchomp, L50|100/100','|switch|p2a: Heracross|Heracross, L50|100/100','|turn|1',
    '|switch|p1a: Rotom|Rotom-Wash, L50|100/100','|move|p2a: Heracross|Earthquake|p1a: Rotom','|-immune|p1a: Rotom','|turn|2',
    '|move|p2a: Heracross|Earthquake|p1a: Rotom','|-immune|p1a: Rotom','|turn|3'].join('\n');
  const a=X.publicImmune96(log,'p2',dex),b=T.publicImmune(log,'p2',dex);
  assert.deepEqual(a.map(x=>x.turn),[2]);assert.deepEqual(b.map(x=>x.turn),[1,2]);
});
