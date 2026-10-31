'use strict';
// PR #74 P0-A: encoreGuard 'speed' false negatives (PR #73 review) reproduced
// in real pinned-Showdown champions Battles, and the 'speedSafe' fix.
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
const {Bot}=require('../lab');
const {CASES,runCase,rivalTeam}=require('../encore-speed-safe-audit');
const dex=sim.Dex.mod('champions');
const streamOf=text=>({async *[Symbol.asyncIterator](){yield text;}});
const feed=async(lines,options)=>{
  const b=new Bot(streamOf(lines.join('\n')),dex,[{species:'Primarina',moves:['Encore'],evs:{hp:32,spa:32,spe:2},nature:'Modest'}],'p1',{choices:[],selections:[],errors:[]},null,null,options);
  await b.run();return b;
};
const side=[{active:true,condition:'187/187',details:'Primarina, L50, M',item:'Sitrus Berry'}];

test('rival variants used by the P0-A probes are legal in gen9championsbssregmc',()=>{
  const v=new sim.TeamValidator('gen9championsbssregmc');
  for(const c of CASES)assert.equal(v.validateTeam(rivalTeam(c.rival)),null,c.id);
});
for(const c of CASES)test('real Battle P0-A '+c.id+': engine '+c.expect+'; speedSafe never allows a failing Encore',async()=>{
  for(const reverse of [false,true]){
    const r=await runCase(sim,c,reverse);
    assert.equal(r.engine,c.expect,c.id+' '+reverse+' '+r.turnLog.join(' / '));
    assert.ok(r.guards,'our Encore decision was probed');
    if(c.expect==='fail'){
      assert.equal(r.guards.speed,false,'PR #73 speed guard false negative reproduced');
      assert.equal(r.guards.speedSafe,true);
    }else assert.equal(r.guards.speedSafe,false,'speedSafe keeps the working Encore');
  }
});
test('speedSafe public-state blocks: failencore last move, confusion, Magic Bounce; default/v1/speed modes unchanged',async()=>{
  const fresh=['|switch|p2a: Rotom|Rotom-Wash, L50|157/157','|turn|1'];
  let b=await feed(fresh,{encoreGuard:'speedSafe'});
  assert.equal(b.encoreWouldFail(b.team[0],side),false,'fast Rotom-Wash, empty risk pool');
  b=await feed([...fresh,'|-start|p2a: Rotom|confusion'],{encoreGuard:'speedSafe'});
  assert.equal(b.encoreWouldFail(b.team[0],side),true,'confused foe may hit itself (no |move|)');
  b=await feed([...fresh,'|-start|p2a: Rotom|confusion','|-end|p2a: Rotom|confusion'],{encoreGuard:'speedSafe'});
  assert.equal(b.encoreWouldFail(b.team[0],side),false);
  b=await feed([...fresh,'|move|p2a: Rotom|Encore|p1a: Primarina','|turn|2'],{encoreGuard:'speedSafe'});
  assert.equal(b.encoreWouldFail(b.team[0],side),true,'last move Encore has failencore');
  b=await feed([...fresh,'|move|p2a: Rotom|Encore|p1a: Primarina','|turn|2'],{encoreGuard:'speed'});
  assert.equal(b.encoreWouldFail(b.team[0],side),false,'speed kept as in PR #73 for reproduction');
  b=await feed(['|switch|p2a: Hatterene|Hatterene, L50|150/150','|turn|1'],{encoreGuard:'speedSafe'});
  assert.equal(b.encoreWouldFail(b.team[0],side),true,'possible Magic Bounce');
  b=await feed(['|switch|p2a: Rotom|Rotom-Wash, L50|157/157 par','|turn|1'],{encoreGuard:'speedSafe'});
  assert.equal(b.foePublicStatus,'par');assert.equal(b.foeStatus,'','legacy foeStatus still cleared on switch');
  assert.equal(b.encoreWouldFail(b.team[0],side),true,'full paralysis possible');
  b=await feed(fresh,{});
  assert.equal(b.encoreGuard,false,'guard stays default off');
});
