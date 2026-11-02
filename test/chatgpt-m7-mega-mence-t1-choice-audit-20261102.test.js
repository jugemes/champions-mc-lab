'use strict';
// 2026-11-02: independent human-action counterfactual for the already-used U-L
// synthetic public six. NOT a new holdout, ladder result, or adopted lead.
// The opponent's exact legal set is a testing hypothesis only; it is not
// supplied to any preview/decision policy as observed opponent information.
// Goal: separate a bad T1 move from an inherently losing three-mon selection.
// T1 only: no claim about surviving the opponent's T2 or backline continuity.
const test=require('node:test');
const assert=require('node:assert/strict');
const {load,normalize,hashSeed}=require('../lab');
const {reportedLive}=require('../reported-live-roster-20261027');
const {archetypes}=require('../fixtures');
const {engineBattle}=require('../hybrid01-audit');
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
const clone=x=>structuredClone(x);
const find=(team,s)=>clone(team.find(x=>x.species===s));
const own=reportedLive();
const foe=[
  find(archetypes.setup,'Salamence'),
  find(archetypes.setup,'Volcarona'),
  find(archetypes.setup,'Gholdengo'),
  find(archetypes.stall,'Toxapex'),
  find(archetypes.stall,'Skarmory'),
  find(archetypes.setup,'Rillaboom')
];
// All are the reported M-7 moves, not newly trained moves. Indexes are
// validated below so a future roster edit cannot silently corrupt the test.
const candidates=[
 {species:'Metagross',moves:[['Meteor Mash',1],['Psychic Fangs',2],['Bullet Punch',3],['Thunder Punch',4]],mega:true},
 {species:'Rotom-Wash',moves:[['Thunderbolt',3],['Will-O-Wisp',4]]},
 {species:'Garchomp',moves:[['Dragon Claw',2],['Rock Slide',3]]},
 {species:'Primarina',moves:[['Moonblast',1],['Encore',4]]},
 {species:'Tyranitar',moves:[['Stone Edge',1],['Ice Punch',3]]},
 {species:'Hydreigon',moves:[['Draco Meteor',1]]}
];
const rivalChoices=[
 {id:'mega-dragon-dance',choice:'move 1 mega'},
 {id:'mega-double-edge',choice:'move 2 mega'}
];
function oneTurn(sim,c,move,enemy,seed,reverse){
 const lead=find(own,c.species);
 const ours=[lead,...clone(own.filter(p=>p.species!==c.species))];
 const side=reverse?'p2':'p1',opp=reverse?'p1':'p2';
 const choice='move '+move[1]+(c.mega?' mega':'');
 const b=reverse?
   engineBattle(sim,clone(foe),ours,seed,[[enemy.choice,choice]]):
   engineBattle(sim,ours,clone(foe),seed,[[choice,enemy.choice]]);
 const us=b.sides[reverse?1:0].active[0];
 const them=b.sides[reverse?0:1].active[0];
 const errors=b.log.filter(l=>l.startsWith('|error|'));
 assert.deepEqual(errors,[],'legal choice and Showdown execution');
 assert.ok(us&&them,'one-turn active state exists');
 const events=b.log.filter(l=>l.startsWith('|move|'));
 const acted=events.some(l=>l.startsWith('|move|'+side+'a:'));
 const enemyActed=events.some(l=>l.startsWith('|move|'+opp+'a:'));
 const missed=b.log.some(l=>l.startsWith('|-miss|'+side+'a:'));
 const mega=b.log.some(l=>l.startsWith('|-mega|'+opp+'a:')) ||
   b.log.some(l=>l.includes('Salamence-Mega'));
 return {acted,enemyActed,missed,mega,
  ownFainted:!!us.fainted,enemyFainted:!!them.fainted,
  ownHP:+(us.hp/us.maxhp).toFixed(4),
  enemyHP:+(them.hp/them.maxhp).toFixed(4),
  enemyStatus:them.status||'none',
  enemyAtkStage:them.boosts.atk,enemySpeedStage:them.boosts.spe,
  enemyForm:them.species.name,
  executedMoves:events.map(l=>l.split('|').slice(2,4).join(':'))};
}
test('U-L Salamence T1 alternative actions use only legal M-7 moves and a legal six',{skip},()=>{
 const sim=load(),v=sim.TeamValidator.get('gen9championsbssregmc');
 assert.ok(!v.validateTeam(normalize(own))?.length,'reported M-7');
 assert.ok(!v.validateTeam(normalize(foe))?.length,'legal U-L hypothesis');
 assert.equal(new Set(foe.map(p=>p.species)).size,6);
 for(const c of candidates){
  const p=own.find(x=>x.species===c.species);
  assert.ok(p,'M-7 member '+c.species);
  for(const [name,slot] of c.moves)assert.equal(p.moves[slot-1],name,c.species+' '+slot);
 }
 assert.deepEqual(foe[0].moves.slice(0,2),['Dragon Dance','Double-Edge']);
});
test('U-L Mega Salamence: compare actually executed T1 alternatives vs setup AND immediate attack',{skip},t=>{
 const sim=load(),rows=[];
 for(const c of candidates)for(const move of c.moves)for(const enemy of rivalChoices){
  const obs=[];
  for(let s=0;s<2;s++)for(const reverse of [false,true]){
   obs.push(oneTurn(sim,c,move,enemy,hashSeed(11026200+s),reverse));
  }
  rows.push({lead:c.species,move:move[0],enemyT1:enemy.id,
   sample:obs.length,ourActions:obs.filter(o=>o.acted).length,
   enemyActions:obs.filter(o=>o.enemyActed).length,
   ownFainted:obs.filter(o=>o.ownFainted).length,
   enemyFainted:obs.filter(o=>o.enemyFainted).length,
   misses:obs.filter(o=>o.missed).length,
   enemyBurns:obs.filter(o=>o.enemyStatus==='brn').length,
   enemyHpRange:[Math.min(...obs.map(o=>o.enemyHP)),Math.max(...obs.map(o=>o.enemyHP))],
   ownHpRange:[Math.min(...obs.map(o=>o.ownHP)),Math.max(...obs.map(o=>o.ownHP))],
   forms:[...new Set(obs.map(o=>o.enemyForm))],
   enemyAtkStages:[...new Set(obs.map(o=>o.enemyAtkStage))],
   enemySpeedStages:[...new Set(obs.map(o=>o.enemySpeedStage))],
   executedSample:obs[0].executedMoves});
 }
 assert.equal(rows.length,26);
 assert.ok(rows.every(r=>r.sample===4));
 t.diagnostic('M7_SALAMENCE_T1_HUMAN_ACTION_COUNTERFACTUAL '+JSON.stringify({
  usedPublicSix:'U-L predeclared PR104 #6568257097',
  newHoldout:false,opponentHumanRationalityCertified:false,
  noOpponentHiddenInfoUsedByPreview:true,
  testOnlyLegalSetHypothesis:true,
  note:'T1 engine outcomes only. T2/backline and alternative opponent three remain unresolved.',
  fullOneTurnEngineTrials:104,rows
 }));
});
