'use strict';
// Claude independent audit of PR #102 opt-in `publicMoveMemory`.
// Only PUBLIC protocol lines are fed to the Bot; nothing here reads a hidden
// set, the rival's preview pick or an unrevealed move.
const test=require('node:test');
const assert=require('node:assert/strict');
const {load,Bot,hashSeed}=require('../lab');
const streamOf=content=>({async *[Symbol.asyncIterator](){yield content;}});
const pinned={skip:!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR not set'};
async function observe(lines,options={}){
  const {reportedLive}=require('../reported-live-roster-20261027');
  const dex=load().Dex.mod('champions');
  const b=new Bot(streamOf(lines.join('\n')),dex,reportedLive(),'p1',
    {choices:[],selections:[],errors:[]},null,null,{publicMegaAbility:true,...options});
  await b.run();
  return b;
}
const illusionThenMega=[
  // Zoroark enters disguised as Golisopod and attacks under that name.
  '|switch|p2a: Golisopod|Golisopod, L50, M|137/137',
  '|move|p2a: Golisopod|Flamethrower|p1a: Tyranitar',
  '|move|p2a: Golisopod|Night Daze|p1a: Tyranitar',
  // A public Illusion break: the moves above were Zoroark's.
  '|replace|p2a: Zoroark|Zoroark, L50, M',
  '|-end|p2a: Zoroark|Illusion',
  '|move|p2a: Zoroark|Sludge Bomb|p1a: Tyranitar',
  '|faint|p2a: Zoroark',
  // The real Golisopod enters and Mega Evolves.
  '|switch|p2a: Golisopod|Golisopod, L50, M|182/182',
  '|move|p2a: Golisopod|Sucker Punch|p1a: Tyranitar',
  '|detailschange|p2a: Golisopod|Golisopod-Mega, L50, M',
  '|-mega|p2a: Golisopod|Golisopod|Golisopite',
];

test('opt-in memory: an Illusion break moves the stint moves to Zoroark and never into the real Mega',pinned,async()=>{
  const on=await observe(illusionThenMega,{publicMoveMemory:true});
  assert.equal(on.foeActive,'Golisopod-Mega');
  assert.deepEqual(on.seenMoves['Golisopod-Mega'],['Sucker Punch']);
  assert.deepEqual(on.seenMoves.Golisopod,['Sucker Punch']);
  assert.deepEqual(on.seenMoves.Zoroark,['Flamethrower','Night Daze','Sludge Bomb']);
  // Legacy (default) behaviour is intentionally unchanged for saved results:
  // the disguise pollution stays on the base key, Mega key stays empty.
  const off=await observe(illusionThenMega);
  assert.deepEqual(off.seenMoves.Golisopod,['Flamethrower','Night Daze','Sucker Punch']);
  assert.equal(off.seenMoves['Golisopod-Mega'],undefined);
});

test('opt-in memory: a move the real mon revealed earlier survives a later Illusion break',pinned,async()=>{
  const b=await observe([
    '|switch|p2a: Golisopod|Golisopod, L50, M|182/182',
    '|move|p2a: Golisopod|Sucker Punch|p1a: Tyranitar',
    '|switch|p2a: Garchomp|Garchomp, L50, M|185/185',
    '|switch|p2a: Golisopod|Golisopod, L50, M|137/137',
    '|move|p2a: Golisopod|Night Daze|p1a: Tyranitar',
    '|replace|p2a: Zoroark|Zoroark, L50, M',
  ],{publicMoveMemory:true});
  assert.deepEqual(b.seenMoves.Golisopod,['Sucker Punch']);
  assert.deepEqual(b.seenMoves.Zoroark,['Night Daze']);
  assert.equal(b.foeActive,'Zoroark');
});

test('opt-in memory: Mega-Y transfer leaves the Mega-X key untouched and keys are not aliased',pinned,async()=>{
  const b=await observe([
    '|switch|p2a: Charizard|Charizard, L50, M|153/153',
    '|move|p2a: Charizard|Air Slash|p1a: Tyranitar',
    '|detailschange|p2a: Charizard|Charizard-Mega-Y, L50, M',
    '|move|p2a: Charizard|Solar Beam|p1a: Tyranitar',
  ],{publicMoveMemory:true});
  assert.deepEqual(b.seenMoves['Charizard-Mega-Y'],['Air Slash','Solar Beam']);
  assert.deepEqual(b.seenMoves.Charizard,['Air Slash','Solar Beam']);
  assert.equal(b.seenMoves['Charizard-Mega-X'],undefined);
  assert.notEqual(b.seenMoves.Charizard,b.seenMoves['Charizard-Mega-Y'],'no shared array alias');
  b.seenMoves.Charizard.push('probe');
  assert.ok(!b.seenMoves['Charizard-Mega-Y'].includes('probe'));
});

test('pinned real Battle: Zoroark disguised as Golisopod does not leak Flamethrower/Night Daze into Golisopod-Mega',pinned,async t=>{
  const sim=load();
  const {battle}=require('../encore-lead-audit');
  const {caseList}=require('../legal-search-v2-compare');
  const {reportedLive}=require('../reported-live-roster-20261027');
  // Public six = case A with Gholdengo replaced by a legal Illusion Zoroark.
  const foe=structuredClone(caseList().find(c=>c.id==='A_golisopod').team);
  foe[5]={species:'Zoroark',item:'Focus Sash',ability:'Illusion',nature:'Timid',
    moves:['Night Daze','Flamethrower','Sludge Bomb','Nasty Plot'],evs:{hp:2,spa:32,spe:32}};
  const v=new sim.TeamValidator('gen9championsbssregmc');
  assert.equal(v.validateTeam(foe.map(x=>({...x,name:x.species,level:50}))),null,'Champions-legal rival six');
  const slot=(req,n)=>req.active[0].moves.findIndex(m=>m.move===n)+1;
  // Audit fixture, not a claim about human play.
  const rival=(req,bot,info)=>{
    const act=req.side.pokemon.find(p=>p.active).details;
    if(!act.startsWith('Zoroark'))return null;
    if(info.turn===1)return 'move '+slot(req,'Flamethrower');
    if(info.turn===2)return 'move '+slot(req,'Night Daze');
    return null;
  };
  const ours=(req,bot,info)=>info.turn===1?'move '+slot(req,'Stealth Rock'):null;
  const seen={};
  const orig=Bot.prototype.decide;
  Bot.prototype.decide=function(req){
    if(this.side==='p1'&&req.active&&/Golisopod-Mega/.test(this.foeActive))
      (seen[this.publicMoveMemory]??=[]).push([...(this.seenMoves[this.foeActive]||[])]);
    return orig.call(this,req);
  };
  try{
    for(const mem of [false,true]){
      const g=await battle(sim,reportedLive(),structuredClone(foe),hashSeed(10300101),{
        ownThree:['Tyranitar','Metagross','Primarina'],foeThree:['Zoroark','Garchomp','Golisopod'],
        reverse:false,script:rival,ownOptions:{publicMoveMemory:mem,script:ours}});
      assert.equal(g.errors,0);
      if(mem){
        const log=g.log;
        if(!/\|replace\|p2a: Zoroark/.test(log)||!/\|detailschange\|p2a: Golisopod\|Golisopod-Mega/.test(log)){
          t.skip('battle did not reach Illusion break + Mega');return;
        }
      }
    }
  }finally{Bot.prototype.decide=orig;}
  assert.ok(seen.true?.length,'our Bot decided at least once against Golisopod-Mega');
  for(const list of seen.true){
    assert.ok(!list.includes('Flamethrower')&&!list.includes('Night Daze'),
      'Zoroark moves must not appear on Golisopod-Mega: '+JSON.stringify(list));
  }
});
