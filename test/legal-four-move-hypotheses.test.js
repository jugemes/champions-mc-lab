'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
const dex=sim.Dex.mod('champions');
const {shortlist,legalFourMoveHypotheses}=require('../legal-four-move-hypotheses');

test('opponent move hypotheses use only public learnset and retain exact four moves',()=>{
  const v=new sim.TeamValidator('gen9championsbssregmc');
  const cases=[
    {species:'Golisopod-Mega',item:'Golisopite',ability:'Emergency Exit'},
    {species:'Garchomp',item:'Choice Scarf',ability:'Rough Skin'},
    {species:'Corviknight',item:'Rocky Helmet',ability:'Pressure'},
  ];
  for(const c of cases){
    const out=legalFourMoveHypotheses(dex,v,c.species,{item:c.item,ability:c.ability,maxCandidates:12});
    assert.equal(out.source,'public-showdown-learnset',c.species);
    assert.ok(out.sets.length>0,'Must generate TeamValidator-legal four-move set for '+c.species+'; '+JSON.stringify(out.rejected));
    for(const s of out.sets){
      assert.equal(s.moves.length,4);
      assert.equal(new Set(s.moves.map(x=>dex.moves.get(x).id)).size,4);
      assert.equal(s.validated,true);
      assert.ok(s.moves.every(m=>out.pool.includes(dex.moves.get(m).id)),'No made-up STAB '+JSON.stringify(s.moves));
      const verify={...s,nature:'Adamant',level:50,
        evs:{hp:2,atk:32,def:0,spa:0,spd:0,spe:32}};
      delete verify.score;delete verify.validated;
      assert.equal(v.validateSet(structuredClone(verify),{}),null,
        'Each output must independently validate in M-C: '+JSON.stringify(s));
    }
  }
});
test('a hypothetical Mega Golisopod cannot have priority/setup/recovery in more than four slots',()=>{
  const v=new sim.TeamValidator('gen9championsbssregmc');
  const a=legalFourMoveHypotheses(dex,v,'Golisopod-Mega',
    {item:'Golisopite',ability:'Emergency Exit',maxCandidates:20});
  const suffix=dex.species.get('Golisopod').name;
  assert.equal(a.species,suffix);
  assert.ok(a.sets.every(s=>s.moves.length===4));
  const pool=new Set(a.pool);
  if(pool.has('suckerpunch'))assert.ok(a.sets.some(s=>s.moves.includes('Sucker Punch')),
    'Public Sucker Punch possibility should be represented in some legal quartet');
});
test('input is an open species/form name, not private opponent set data',()=>{
  const v=new sim.TeamValidator('gen9championsbssregmc');
  assert.throws(()=>legalFourMoveHypotheses(dex,v,
    {species:'Golisopod',moves:['Swords Dance','Sucker Punch'],item:'Golisopite'}),/Unknown species/);
  const a=shortlist(dex,'Golisopod-Mega');
  const b=shortlist(dex,'Golisopod-Mega');
  assert.deepEqual(a,b,'Every public species generates stable candidates');
});

test('public Indeedee has a special-invested Timid/Modest possibility (never forced Adamant)',()=>{
  const v=new sim.TeamValidator('gen9championsbssregmc');
  const result=legalFourMoveHypotheses(dex,v,'Indeedee',{item:'Focus Sash',maxCandidates:24});
  assert.ok(result.sets.length>0,JSON.stringify(result.rejected));
  assert.ok(result.sets.some(s=>s.evs.spa===32&&['Timid','Modest'].includes(s.nature)),
    'public six cannot rule out the special-attacking Indeedee from real battle counterexample');
  assert.ok(result.sets.every(s=>s.moves.length===4&&s.validated===true));
});
test('coverage tracking exposes omitted public moves and keeps full AP profile',()=>{
  const v=new sim.TeamValidator('gen9championsbssregmc');
  const result=legalFourMoveHypotheses(dex,v,'Garchomp',{item:'Choice Scarf',ability:'Rough Skin',maxCandidates:24});
  const seen=new Set(result.sets.flatMap(s=>s.moves.map(m=>dex.moves.get(m).id)));
  assert.deepEqual(result.unrepresentedMoves,result.pool.filter(id=>!seen.has(id)));
  assert.ok(result.sets.every(s=>
    s.level===50&&s.nature&&s.evs&&
    Object.values(s.evs).reduce((sum,n)=>sum+n,0)===66),
    'validated full candidate must retain its AP and nature for reproducible Battle');
});

test('a validated legal four-move rival hypothesis can actually enter fixed Showdown Battle',async()=>{
  const {variants}=require('../fixtures');
  const {reportedLive}=require('../reported-live-roster-20261027');
  const {game,hashSeed,normalize}=require('../lab');
  const foe=structuredClone(variants.C_master);
  const index=foe.findIndex(p=>p.species==='Golisopod');
  assert.ok(index>=0,'public Golisopod fixture must exist');
  const old=foe[index],v=new sim.TeamValidator('gen9championsbssregmc');
  const variants=legalFourMoveHypotheses(dex,v,'Golisopod-Mega',{
    item:old.item,ability:old.ability,maxCandidates:12,
  });
  assert.ok(variants.sets.length>0,JSON.stringify(variants.rejected));
  foe[index]={...old,...variants.sets[0],species:'Golisopod'};
  const teamProblems=v.validateTeam(sim.Teams.unpack(normalize(foe)));
  assert.equal(teamProblems,null,'the whole public-six fixture must pass M-C team + item clause');
  const result=await game(sim,reportedLive(),foe,hashSeed(202610301),false,null,false,
    {candidatePreviewPolicy:'legacy',opponentPreviewPolicy:'legacy'});
  assert.deepEqual(result.trace.errors,[],'the four-slot hypothesis must run in real pinned Showdown');
  assert.ok(result.trace.selections.some(s=>s.side==='p1'));
  assert.ok(result.trace.selections.some(s=>s.side==='p2'));
});
