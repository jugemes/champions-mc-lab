'use strict';
// Cross-archetype research opt-in: own confirmed Life Orb/Choice item and
// post-Mega Tough Claws. Do not confuse a legal damage correction with ladder
// win-rate improvement. All paired Battles use the pinned real M-C simulator.
const test=require('node:test');
const assert=require('node:assert/strict');
const {load,Bot,hashSeed}=require('../lab');
const {estimateDamage}=require('../damage');
const {reportedLive}=require('../reported-live-roster-20261027');
const {caseList}=require('../legal-search-v2-compare');
const {battle}=require('../encore-lead-audit');
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
const approx=(actual,base,scale)=>assert.ok(
  Math.abs(actual/base-scale)<0.015,`expected ${scale}, received ${actual/base}`);

test('known M-7 Life Orb modifies actual own damage ranges; after Knock Off never restores item',{skip},()=>{
  const dex=load().Dex.mod('champions');
  const hydr=reportedLive().find(x=>x.species==='Hydreigon');
  assert.equal(hydr.item,'Life Orb');
  const before=estimateDamage(dex,hydr,'Gholdengo','Dark Pulse');
  const boosted=estimateDamage(dex,hydr,'Gholdengo','Dark Pulse',{knownOwnOffense:true,attackerItem:'Life Orb'});
  const knocked=estimateDamage(dex,hydr,'Gholdengo','Dark Pulse',{knownOwnOffense:true,attackerItem:''});
  assert.ok(before.min>0&&before.max>0);
  approx(boosted.mid,before.mid,1.3);
  assert.equal(knocked.mid,before.mid,'explicitly empty current item must not inherit old Life Orb');
});

test('known post-Mega Tough Claws applies to contact only; pre-Mega ability remains Clear Body',{skip},()=>{
  const dex=load().Dex.mod('champions');
  const base=reportedLive().find(x=>x.species==='Metagross');
  const mega={...base,species:'Metagross-Mega'};
  assert.equal(dex.species.get('Metagross-Mega').abilities['0'],'Tough Claws');
  const normal=estimateDamage(dex,mega,'Primarina','Psychic Fangs');
  const claws=estimateDamage(dex,mega,'Primarina','Psychic Fangs',{
    knownOwnOffense:true,attackerAbility:'Tough Claws'});
  const original=estimateDamage(dex,base,'Primarina','Psychic Fangs',{
    knownOwnOffense:true,attackerAbility:'Clear Body'});
  approx(claws.mid,normal.mid,1.3);
  assert.ok(original.mid>0);
  const noContact=estimateDamage(dex,mega,'Corviknight','Flash Cannon',{
    knownOwnOffense:true,attackerAbility:'Tough Claws'});
  const control=estimateDamage(dex,mega,'Corviknight','Flash Cannon');
  assert.equal(noContact.mid,control.mid);
  const bot=new Bot(null,dex,reportedLive(),'p1',{choices:[],selections:[],errors:[]},null,null,{knownOwnOffense:true});
  const identified=bot.ownOffenseInfo({ability:'Clear Body',item:'Metagrossite'},mega);
  assert.equal(identified.attackerAbility,'Tough Claws','Mega visible form overrides stale pre-Mega ability');
});

const actions=(log,side)=>{
  let turn=0;const out=[];
  for(const l of log.split('\n')){
    const a=l.split('|');
    if(a[1]==='turn')turn=+a[2];
    if(a[2]?.startsWith(side+'a:')&&['move','switch','detailschange','-mega'].includes(a[1]))
      out.push([turn,a[1],a[3]]);
  }
  return out;
};

test('real pinned Showdown paired regression across four different rival archetypes', {skip}, async t=>{
  const sim=load(),own=reportedLive();
  const plans=[
    {id:'A_golisopod',three:['Hydreigon','Metagross','Primarina']},
    {id:'C_charizardY',three:['Hydreigon','Tyranitar','Rotom-Wash']},
    {id:'C_charizardX',three:['Metagross','Primarina','Garchomp']},
    {id:'Real_indeedee_scarf',three:['Metagross','Hydreigon','Rotom-Wash']},
  ];
  const result={};
  for(const p of plans){
    const c=caseList().find(x=>x.id===p.id);
    assert.ok(c&&c.forcedA,'legal fixed opponent case '+p.id);
    const summary={pairs:0,moveOrSwitchChanges:0,winFlips:0,newWins:0,oldWins:0,errors:0,examples:[]};
    for(const rev of [false,true]){
      const seed=hashSeed(10401000+c.gi);
      const opts={ownThree:p.three,foeThree:c.forcedA,reverse:rev,script:null};
      const run=flag=>battle(sim,structuredClone(own),structuredClone(c.team),seed,{
        ...opts,ownOptions:{knownOwnOffense:flag,decisionPolicy:'v3',publicMegaAbility:true,publicCondition:true}
      });
      const old=await run(false),fresh=await run(true);
      summary.pairs++;summary.errors+=old.errors+fresh.errors;
      summary.oldWins+=+old.won;summary.newWins+=+fresh.won;
      summary.winFlips+=+(old.won!==fresh.won);
      const lhs=actions(old.log,old.ownSide),rhs=actions(fresh.log,fresh.ownSide);
      const changed=JSON.stringify(lhs)!==JSON.stringify(rhs);
      summary.moveOrSwitchChanges+=+changed;
      if(changed)summary.examples.push({seed,reverse:rev,old:lhs.slice(0,6),fresh:rhs.slice(0,6)});
      assert.equal(old.errors+fresh.errors,0,'Showdown must accept all commands in '+p.id);
    }
    result[p.id]=summary;
  }
  t.diagnostic('CROSS-ARCHETYPE KNOWN OFFENSE PAIRED '+JSON.stringify(result));
});
