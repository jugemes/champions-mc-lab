'use strict';
// Engine-search turn AI: hidden-information boundary, public-state fidelity,
// game solver, and decisions whose correct answer is fixed by the rules.
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
const {normalize,hashSeed}=require('../lab');
const {reportedLive}=require('../reported-live-roster-20261027');
const {seededRandom}=require('../preview-policy');
const E=require('../engine-public-state');
const S=require('../engine-search-bot');
const {searchBattle}=require('../engine-search-battle');
const pool=S.rolePool(sim);
const row=(species,item,ability,nature,evs,moves)=>({species,item,ability,nature,evs,moves});
const OPP=()=>[
  row('Gengar','Expert Belt','Cursed Body','Timid',{hp:2,spa:32,spe:32},['Will-O-Wisp','Shadow Ball','Sludge Bomb','Focus Blast']),
  row('Garchomp','Choice Scarf','Rough Skin','Jolly',{hp:2,atk:32,spe:32},['Earthquake','Dragon Claw','Rock Slide','Poison Jab']),
  row('Rotom-Wash','Leftovers','Levitate','Bold',{hp:32,def:32,spd:2},['Hydro Pump','Volt Switch','Will-O-Wisp','Protect']),
  row('Umbreon','Leftovers','Synchronize','Bold',{hp:32,def:32,spd:2},['Foul Play','Moonlight','Yawn','Protect']),
  row('Hippowdon','Rocky Helmet','Sand Stream','Impish',{hp:32,def:32,spd:2},['Earthquake','Slack Off','Stealth Rock','Whirlwind']),
  row('Indeedee','Choice Scarf','Psychic Surge','Timid',{hp:2,spa:32,spe:32},['Dazzling Gleam','Expanding Force','Mystical Fire','Trick'])];
const PREVIEW=OPP().map(p=>p.species);
function battle(opp,ownPick,oppPick,seed=[9,9,9,9]){
  const b=new sim.Battle({formatid:'gen9championsbssregmc',seed});
  b.setPlayer('p1',{name:'a',team:normalize(reportedLive())});
  b.setPlayer('p2',{name:'b',team:normalize(opp)});
  b.choose('p1','team '+ownPick);b.choose('p2','team '+oppPick);
  return b;
}
const det=(b,s=1)=>E.determinize(sim,b,'p1',{preview:PREVIEW,pool,rng:seededRandom([s,2,3,4],'p1'),seed:[5,6,7,8]});
const FAST={...S.DEFAULTS,determinizations:2,seeds:1};
const decide=(b,cfg=FAST)=>S.chooseBySearch(sim,b,'p1',b.sides[0].activeRequest,
  {preview:PREVIEW,pool,cfg,rng:seededRandom([7,7,7,7],'p1')});
const moveName=(b,choice)=>{const m=choice.match(/^move (\d)/);
  return m?b.sides[0].activeRequest.active[0].moves[m[1]-1].move:choice;};
// Variant B differs from A ONLY in hidden data: the lead's unrevealed moves,
// item, stat points/nature, and which two Pokemon sit unrevealed in the back.
function hiddenVariant(){
  const o=OPP();
  o[0]={...o[0],item:'Shuca Berry',evs:{hp:32,def:2,spe:32},moves:['Will-O-Wisp','Hex','Thunderbolt','Destiny Bond']};
  return o;
}

test('hidden opponent data never reaches the search state (turn 0 and after a public turn)',()=>{
  for(const turns of [[],[['move 4','move 1']]]){
    const a=battle(OPP(),'615','123'),b=battle(hiddenVariant(),'615','145');
    for(const [x,y] of turns){a.choose('p1',x);a.choose('p2',y);b.choose('p1',x);b.choose('p2',y);}
    const pub=x=>E.publicLines(x.log).filter(l=>!l.startsWith('|t:|')).join('\n');
    assert.equal(pub(a),pub(b),'precondition: identical public information');
    const da=det(a),db=det(b);
    assert.equal(da.json,db.json);
    assert.deepEqual(da.fixes,db.fixes);
  }
});
test('search state carries no real log, input log (teams) or PRNG',()=>{
  const b=battle(OPP(),'615','123');
  const s=JSON.parse(det(b).json);
  assert.deepEqual([s.log,s.inputLog,s.messageLog],[[],[],[]]);
  assert.deepEqual(s.prng,[5,6,7,8]);
  assert.ok(!JSON.stringify(s).includes('Expert Belt'),'real unrevealed item must not appear');
});
test('revealed facts are kept: used move, HP %, Mega form, its ability and stats',()=>{
  const sun=require('../threat-scenarios-20261014').opponents.sun_charizard_y;
  const b=new sim.Battle({formatid:'gen9championsbssregmc',seed:[4,4,4,4]});
  b.setPlayer('p1',{name:'a',team:normalize(reportedLive())});
  b.setPlayer('p2',{name:'b',team:normalize(sun)});
  b.choose('p1','team 615');b.choose('p2','team 123');
  b.choose('p1','move 1');b.choose('p2','move 1 mega');
  const real=b.p2.active[0];
  assert.equal(real.species.name,'Charizard-Mega-Y');
  for(let s=1;s<=5;s++){
    const r=E.restore(sim,det(b,s));
    const p=r.p2.active[0];
    assert.equal(p.species.name,'Charizard-Mega-Y');
    assert.equal(p.ability,'drought');
    assert.ok(p.moveSlots.some(m=>m.id==='flamethrower'),'revealed move kept');
    assert.equal(p.baseStoredStats.spa,r.spreadModify(p.species.baseStats,p.set).spa);
    assert.ok(Math.abs(p.hp/p.maxhp-real.hp/real.maxhp)<0.011,'public HP % kept');
    assert.equal(p.canMegaEvo,null);
  }
});
test('regret matching solves small zero-sum games',()=>{
  const pennies=S.solve([[1,-1],[-1,1]],2000);
  assert.ok(Math.abs(pennies.x[0]-0.5)<0.05&&Math.abs(pennies.value)<0.05);
  const dominated=S.solve([[2,2],[0,1]],500);
  assert.ok(dominated.x[0]>0.95);
});
test('legal choices: attacks always with Mega when available, switches, forced switch only',()=>{
  const b=battle(OPP(),'123','123');
  const c=S.legalChoices(b.sides[0].activeRequest);
  assert.ok(c.includes('move 1 mega')&&c.includes('switch 2')&&c.includes('switch 3'));
  assert.ok(!c.includes('move 1'));
  const forced={side:{pokemon:[{active:true,condition:'0 fnt'},{active:false,condition:'50/100'},{active:false,condition:'0 fnt'}]},forceSwitch:[true]};
  assert.deepEqual(S.legalChoices(forced),['switch 2']);
});
test('rules-fixed decision: no Ground move into a Levitate Rotom-Wash',()=>{
  const b=battle(OPP(),'412','345');
  assert.notEqual(moveName(b,decide(b).choice),'Earthquake');
});
test('rules-fixed decision: no Bullet Punch into a grounded foe under Psychic Terrain',()=>{
  const b=battle(OPP(),'123','623');
  assert.ok(b.field.isTerrain('psychicterrain'));
  assert.notEqual(moveName(b,decide(b).choice),'Bullet Punch');
});
test('rules-fixed decision: priority KO on a faster last Pokemon',()=>{
  const b=battle(OPP(),'123','123');
  const own=b.p1.active[0],foe=b.p2.active[0];
  own.hp=Math.floor(own.maxhp*0.3);foe.hp=Math.floor(foe.maxhp*0.08);
  // Fainted Pokemon are public: they must have been on the field.
  for(const p of b.p2.pokemon.slice(1)){p.hp=0;p.fainted=true;p.previouslySwitchedIn=1;}
  b.p2.pokemonLeft=1;
  b.makeRequest('move');
  assert.equal(moveName(b,decide(b).choice),'Bullet Punch');
});
test('a full battle with the search AI on one side completes with no choice or search errors',async()=>{
  const r=await searchBattle(sim,{p1:reportedLive(),p2:OPP(),seed:hashSeed(31),pool,
    p1Opts:{search:true,forced:['Metagross','Garchomp','Rotom-Wash'],searchConfig:FAST},
    p2Opts:{search:false,forced:['Gengar','Garchomp','Indeedee']}});
  assert.equal(r.trace.errors.length,0);
  assert.ok(r.searchLog.p1.length>0);
  assert.deepEqual(r.searchLog.p1.filter(x=>x.error),[]);
});
