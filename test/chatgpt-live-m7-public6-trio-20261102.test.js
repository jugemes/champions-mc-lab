'use strict';
// Independent LLM-authored 3+lead alternatives for a real reported PUBLIC SIX.
// The real opponent's selected three and held item were NOT observed; these
// full legal sets are stress-test hypotheses, not reconstructed facts.
// This is NOT a live ladder win rate; the two opponent turn policies are
// imperfect controls and any "wins" require separate rationality review.
const test=require('node:test');
const assert=require('node:assert/strict');
const {load,hashSeed,matchup,normalize}=require('../lab');
const {reportedLive}=require('../reported-live-roster-20261027');
const {teams}=require('../holdout-20261030');
const {battle,earlyLines}=require('../encore-lead-audit');
const {executedEvents,eventSignature}=require('../public-execution-audit');
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
const own=reportedLive();
const ownCandidates={
  actual_reported:['Hydreigon','Metagross','Rotom-Wash'],
  same_three_rotom_lead:['Rotom-Wash','Metagross','Hydreigon'],
  strategic_rotom_meta_prima:['Rotom-Wash','Metagross','Primarina'],
  same_three_metagross_lead:['Metagross','Rotom-Wash','Primarina']
};
const opponentTrioCandidates=[
  ['Indeedee','Garchomp','Gengar'],
  ['Gyarados','Hippowdon','Umbreon'],
  ['Gengar','Indeedee','Garchomp']
];
const cases=[
  {id:'realB_indeedee_scarf_hypothesis',team:teams().realB_indeedee_scarf.team},
  {id:'realB_indeedee_sash_hypothesis',team:teams().realB_indeedee_sash.team}
];
function strongPublicAttack(req,bot,info){
  if(info.turn!==1||req.teamPreview||req.forceSwitch)return null;
  const act=req.active?.[0],active=req.side.pokemon.find(p=>p.active);
  if(!act||!active)return null;
  const self=bot.getSet(active),foe=bot.foeActive;
  const rows=act.moves.map((m,i)=>({m,i}))
    .filter(x=>!x.m.disabled&&x.m.pp>0&&
      bot.dex.moves.get(x.m.id||x.m.move).category!=='Status')
    .map(x=>({...x,score:matchup(bot.dex,self,foe,x.m.id||x.m.move)}));
  rows.sort((a,b)=>b.score-a.score||a.i-b.i);
  if(!rows.length)return null;
  return 'move '+(rows[0].i+1)+(act.canMegaEvo?' mega':'');
}
function countActions(log,ownSide){
  const foeSide=ownSide==='p1'?'p2':'p1';
  const ex=executedEvents(log,ownSide,foeSide);
  return {ownT1:eventSignature(ex.own,1),rivalT1:eventSignature(ex.rival,1),
    ownT2:eventSignature(ex.own,2),rivalT2:eventSignature(ex.rival,2)};
}
test('real reported six and all counterpart public-six hypotheses legal',{skip},()=>{
  const sim=load(),v=sim.TeamValidator.get('gen9championsbssregmc');
  assert.ok(!v.validateTeam(normalize(own))?.length);
  for(const c of cases){
    assert.ok(!v.validateTeam(normalize(c.team))?.length,c.id);
    assert.deepEqual(c.team.map(x=>x.species),
      ['Indeedee','Hippowdon','Garchomp','Umbreon','Gengar','Gyarados']);
    for(const t of opponentTrioCandidates){
      assert.equal(new Set(t).size,3);
      assert.ok(t.every(p=>c.team.some(x=>x.species===p)),c.id);
    }
  }
  for(const t of Object.values(ownCandidates)){
    assert.equal(new Set(t).size,3);
    assert.ok(t.every(x=>own.some(p=>p.species===x)));
  }
});
test('M-7 actual vs LLM selection candidates: full 3v3 battle under multiple opposing three/lead and T1 modes',{skip},async t=>{
  const sim=load(),cells=[],expected=2*3*2*4*2*2;
  let count=0;
  for(const [ci,c] of cases.entries())for(const [ri,rival] of opponentTrioCandidates.entries())
  for(const mode of ['autonomous','best-public-attack']){
    const record={case:c.id,rival3:rival,rivalT1:mode,
      note:'opponent T1 is heuristic and does not certify rational human play',
      candidates:{}};
    for(const [label,three] of Object.entries(ownCandidates)){
      const result={our3:three,wins:0,losses:0,errors:0,
        opponentMisplayNotCertified:true,t1Execution:[],sampleLoss:null};
      for(let s=0;s<2;s++)for(const reverse of [false,true]){
        const seed=hashSeed(11023000+ci*1000+ri*100+s);
        const r=await battle(sim,structuredClone(own),structuredClone(c.team),seed,{
          ownThree:three,foeThree:rival,reverse,
          script:mode==='best-public-attack'?strongPublicAttack:null
        });
        assert.equal(r.errors,0,'Showdown choices must be legal');
        result.wins+=+r.won;result.losses+=+(!r.won);count++;
        const actions=countActions(r.log,r.ownSide);
        result.t1Execution.push({seed,reverse,...actions});
        if(!r.won&&!result.sampleLoss)
          result.sampleLoss={seed,reverse,turns:r.turns,firstTurns:earlyLines(r.log,r.ownSide,3)};
      }
      assert.equal(result.wins+result.losses,4,'two independent seeds x both sides');
      record.candidates[label]=result;
    }
    cells.push(record);
  }
  assert.equal(count,expected);
  t.diagnostic('LLM_LIVE_M7_PUBLIC6_FULL_BATTLE '+JSON.stringify({
    scope:'same public B six, two already-studied legal opposing sets; NOT new holdout',
    opponentRationalityCertified:false,
    ourSelectionCandidates:'manually proposed before seeing this test results',
    totalGames:count,cells
  }));
});
