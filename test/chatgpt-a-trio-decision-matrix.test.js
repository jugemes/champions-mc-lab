'use strict';
// ChatGPT's independent vertical A-case audit: PUBLIC six -> candidate trios
// and leads -> executed T1/T2 -> full pinned-Showdown outcomes.
// This is an exploratory, predeclared matrix, NOT a ranked-winrate estimate.
// Opponent branches are explicit conditional hypotheses, not human play claims.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load,hashSeed}=require('../lab');
const {battle,switchTo,earlyLines}=require('../encore-lead-audit');
const {caseList}=require('../legal-search-v2-compare');
const {reportedLive}=require('../reported-live-roster-20261027');
const {misplaysV3,anyTag}=require('../misplay-tags-v3');

const CANDIDATES={
  prim_garchomp:['Primarina','Metagross','Garchomp'],
  meta_garchomp:['Metagross','Primarina','Garchomp'],
  garchomp_lead:['Garchomp','Metagross','Primarina'],
  prim_rotom:['Primarina','Metagross','Rotom-Wash']
};
const OPPONENTS={
  A_seenThenMega:{group:'forcedA',script:'seenThenMega'},
  A_megaSetup:{group:'forcedA',script:'megaSetup'},
  A_setupEscape:{group:'forcedA',script:'megaSetupEscape'},
  A_megaAttack:{group:'forcedA',script:'megaAttack'},
  A_switch:{group:'forcedA',script:'switch'},
  B_balance:{group:'forcedB',script:'ai'}
};
const SEEDS=[hashSeed(10301001),hashSeed(10301002)];
const slot=(req,name)=>{
  const i=req.active?.[0]?.moves?.findIndex(m=>
    m.move===name&&!m.disabled&&m.pp>0)??-1;
  return i>=0?i+1:null;
};
function rivalScript(kind){
  if(kind==='ai')return null;
  return (req,bot,info)=>{
    if(req.teamPreview||req.forceSwitch||!req.active?.[0])return null;
    const active=req.side.pokemon.find(p=>p.active);
    const species=String(active?.details||'').split(',')[0];
    // A rational counter-switch hypothesis based on the PUBLIC opposing lead:
    // Garchomp threatens Metagross; Mimikyu can absorb one attack via Disguise.
    if(kind==='switch'&&info.turn===1)
      return switchTo(req,bot.foeActive.startsWith('Metagross')?'Garchomp':'Mimikyu');
    // Counterfactual response to the PUBLIC Encore lock. Staying and using
    // SD for 3 more turns is not automatically rational if a bench exists.
    if(kind==='megaSetupEscape'&&info.turn>=2&&bot.ownEncored)
      return switchTo(req,bot.foeActive.startsWith('Metagross')?'Garchomp':'Mimikyu');
    if(!species.startsWith('Golisopod'))return null;
    let desired='',mega=false;
    if(kind==='seenThenMega'){
      if(info.turn===1)desired='Sucker Punch'; // before Mega: public move
      if(info.turn===2){desired='Swords Dance';mega=true;}
    }else if(kind==='megaSetup'||kind==='megaSetupEscape'){
      if(info.turn===1){desired='Swords Dance';mega=true;}
      if(info.turn===2)desired='Leech Life';
    }else if(kind==='megaAttack'){
      // Predicted lead-sensitive attacking line, not an omniscient future move.
      if(info.turn===1){
        desired=bot.foeActive.startsWith('Primarina')?'Iron Head':
          bot.foeActive.startsWith('Metagross')?'Sucker Punch':'Leech Life';
        mega=true;
      }
      if(info.turn===2)desired='Leech Life';
    }
    const i=slot(req,desired);
    return i?'move '+i+(mega&&req.active[0].canMegaEvo?' mega':''):null;
  };
}
const key=(c,o,seed,reverse)=>[c,o,seed.join('-'),reverse?'R':'L'].join('|');
function firstTwo(log,ownSide){
  return earlyLines(log,ownSide,2).slice(0,16);
}
test('A six: paired full Battle matrix of 3+lead, rational alternatives and opt-in public move memory',{
  skip:!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR not set',
  timeout:240000
},async t=>{
  const sim=load(),caseA=caseList().find(x=>x.id==='A_golisopod');
  const own=reportedLive();
  assert.ok(caseA&&caseA.team.length===6);
  // Rival PUBLIC six stays the same; only selected three/lead and T1/T2 vary.
  const by={};const choices={};
  let total=0,errors=0,diffOutcome=0,clearWinnerDiff=0;
  for(const [candidate,ours] of Object.entries(CANDIDATES)){
    assert.equal(new Set(ours).size,3);
    for(const [opponent,scenario] of Object.entries(OPPONENTS)){
      const foeThree=caseA[scenario.group];
      assert.equal(foeThree.length,3);
      const stats={n:0,w0:0,w1:0,ownTag0:0,ownTag1:0,foeTag0:0,foeTag1:0,
        turns0:0,turns1:0,outcomeChanges:0,example:null,sample:null};
      for(const seed of SEEDS)for(const reverse of [false,true]){
        let previous=null;
        for(const memory of [false,true]){
          // Identical legal six, forced 3+lead, foe branch, seed, side:
          // the only difference is the publicMoveMemory flag.
          const game=await battle(sim,structuredClone(own),
            structuredClone(caseA.team),seed,{
              ownThree:ours,foeThree,reverse,
              script:rivalScript(scenario.script),
              ownOptions:{publicMoveMemory:memory,publicMegaAbility:true,
                publicCondition:true,ownCondition:true,encoreGuard:'speedSafe'}
            });
          errors+=game.errors;
          assert.equal(game.errors,0,key(candidate,opponent,seed,reverse));
          assert.deepEqual(game.foe,foeThree);
          const tag=misplaysV3(game.log,{requests:game.reqLog});
          const mine=tag[game.ownSide],rival=tag[game.foeSide];
          const suf=memory?'1':'0';
          stats['w'+suf]+=Number(game.won);
          stats['ownTag'+suf]+=Number(anyTag(mine));
          stats['foeTag'+suf]+=Number(anyTag(rival));
          stats['turns'+suf]+=game.turns;
          total++;
          const current={won:game.won,early:earlyLines(game.log,game.ownSide,4).slice(0,24),
            ownTags:mine,foeTags:rival,turns:game.turns};
          if(!stats.sample&&!memory&&!reverse&&seed===SEEDS[0])
            stats.sample={seed:seed.join('-'),won:game.won,early:current.early,ownTags:mine,foeTags:rival};
          if(previous){
            const changed=previous.won!==current.won;
            const earlyDiff=JSON.stringify(previous.early)!==JSON.stringify(current.early);
            if(changed){stats.outcomeChanges++;diffOutcome++;}
            if(changed&&!anyTag(rival)&&!anyTag(previous.foeTags))clearWinnerDiff++;
            if((changed||earlyDiff)&&!stats.example)stats.example={
              seed:seed.join('-'),reverse,old:previous,new:current
            };
          }
          previous=current;
        }
        stats.n++;
      }
      by[candidate+'|'+opponent]=stats;
    }
  }
  assert.equal(total,
    Object.keys(CANDIDATES).length*Object.keys(OPPONENTS).length*
    SEEDS.length*2*2);
  // t.diagnostic is retained in the real Actions logs; never invent results.
  t.diagnostic('A_TRIO_MATRIX_SUMMARY '+JSON.stringify({total,pairs:total/2,
    errors,diffOutcome,clearWinnerDiff,seedCount:SEEDS.length,
    publicSix:caseA.team.map(p=>p.species),candidates:CANDIDATES,
    opponentScenarios:OPPONENTS}));
  for(const [cell,stats] of Object.entries(by))
    t.diagnostic('A_TRIO_MATRIX_CELL '+JSON.stringify({cell,...stats}));
  // This test validates execution, not a chosen winner or causal advantage:
  // no statistical threshold is baked in after observing outcomes.
});

test('A Garchomp lead: a public-only T1 switch-to-Metagross counterfactual against all five rival branches',{
  skip:!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR not set',
  timeout:120000
},async t=>{
  const sim=load(),c=caseList().find(x=>x.id==='A_golisopod');
  const own=reportedLive(),three=CANDIDATES.garchomp_lead,rows=[];
  const publicOnlySwitch=(req,bot,info)=>{
    if(info.turn!==1||req.teamPreview||req.forceSwitch)return null;
    const active=req.side.pokemon.find(p=>p.active);
    if(!String(active?.details||'').startsWith('Garchomp'))return null;
    // This reads only the foe's currently disclosed active form. No hidden set,
    // no post-choice Mega or enemy selected trio.
    if(!bot.foeActive.startsWith('Golisopod'))return null;
    return switchTo(req,'Metagross');
  };
  for(const [opponent,scenario] of Object.entries(OPPONENTS)){
    const results={opponent,n:0,baselineWins:0,switchWins:0,
      oldOwnMisplays:0,newOwnMisplays:0,oldFoeMisplays:0,newFoeMisplays:0,
      improve:0,regress:0,example:null};
    for(const seed of SEEDS)for(const reverse of [false,true]){
      let old=null;
      for(const useSwitch of [false,true]){
        const game=await battle(sim,structuredClone(own),structuredClone(c.team),
          seed,{ownThree:three,foeThree:c[scenario.group],reverse,
            script:rivalScript(scenario.script),
            ownOptions:{publicMoveMemory:true,publicMegaAbility:true,
              publicCondition:true,ownCondition:true,encoreGuard:'speedSafe',
              script:useSwitch?publicOnlySwitch:null}
          });
        assert.equal(game.errors,0,opponent);
        const tags=misplaysV3(game.log,{requests:game.reqLog});
        const current={won:game.won,early:earlyLines(game.log,game.ownSide,4).slice(0,24),
          ownTags:tags[game.ownSide],foeTags:tags[game.foeSide]};
        if(!useSwitch){
          results.baselineWins+=Number(game.won);
          results.oldOwnMisplays+=Number(anyTag(current.ownTags));
          results.oldFoeMisplays+=Number(anyTag(current.foeTags));
          old=current;
        }else{
          results.switchWins+=Number(game.won);
          results.newOwnMisplays+=Number(anyTag(current.ownTags));
          results.newFoeMisplays+=Number(anyTag(current.foeTags));
          if(!old.won&&current.won)results.improve++;
          if(old.won&&!current.won)results.regress++;
          if(!results.example&&(
            old.won!==current.won||JSON.stringify(old.early)!==JSON.stringify(current.early)))
            results.example={seed:seed.join('-'),reverse,old,current};
        }
      }
      results.n++;
    }
    rows.push(results);
    t.diagnostic('A_T1_SWITCH_CELL '+JSON.stringify(results));
  }
  t.diagnostic('A_T1_SWITCH_SUMMARY '+JSON.stringify({rows,
    note:'Public-only T1 switch rule, not conditioned on foe hidden set/selection/move or outcome. Small scripted heuristic rival sample, NOT human win rate.'}));
});
