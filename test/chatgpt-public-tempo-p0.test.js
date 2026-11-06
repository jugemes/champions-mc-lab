'use strict';
// #104 pre-registration: PR comment #6552923890 BEFORE implementation/results.
// U1/U2 are synthetic unseen SIX-combinations, NOT ranked encounter statistics.
// Compare preview-only, turn-only and joint opt-ins against baseline, without
// leaking the rival's selected three or private moves into candidate decisions.
const test=require('node:test');
const assert=require('node:assert/strict');
const {Bot,load,normalize,prelim,hashSeed}=require('../lab');
const {reportedLive}=require('../reported-live-roster-20261027');
const {archetypes}=require('../fixtures');
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
const copy=structuredClone;
const {rain,stall,setup}=archetypes;
const cases=[
 {id:'DEV_rain',team:[rain[0],rain[1],rain[2],stall[1],stall[4],stall[5]],
  A:['Pelipper','Swampert','Archaludon'],B:['Umbreon','Skarmory','Gholdengo'],
  t1:{kind:'switch',to:'Swampert'}},
 {id:'DEV_setup',team:[setup[0],setup[1],setup[2],stall[0],stall[2],setup[3]],
  A:['Salamence','Volcarona','Dragonite'],B:['Toxapex','Corviknight','Gholdengo'],
  t1:{kind:'move',move:'Dragon Dance'}},
 {id:'U1_priority_weather_stall',team:[rain[5],setup[2],stall[0],stall[1],rain[4],rain[0]],
  A:['Rillaboom','Dragonite','Toxapex'],B:['Pelipper','Gholdengo','Umbreon'],
  t1:{kind:'move',move:'Grassy Glide'}},
 {id:'U2_setup_mega_stall',team:[setup[1],rain[1],stall[4],rain[4],setup[2],setup[4]],
  A:['Volcarona','Swampert','Skarmory'],B:['Dragonite','Gholdengo','Skeledirge'],
  t1:{kind:'move',move:'Quiver Dance'}}
];
const policies={
 baseline:['legacy','baseline'],
 previewOnly:['publicTempo','baseline'],
 turnOnly:['legacy','publicTempo'],
 both:['publicTempo','publicTempo']
};
function chosen(trace,side){return trace.selections.find(x=>x.side===side);}
function t12(trace,side){return trace.choices.filter(x=>x.side===side&&[1,2].includes(x.turn)).map(x=>[x.turn,x.choice]);}
async function play(sim,own,foe,seed,reverse,c,foeForced,policy,script){
 const streams=sim.getPlayerStreams(new sim.BattleStream({noCatch:true}));
 const dex=sim.Dex.mod('champions'),trace={choices:[],selections:[],errors:[]};
 const ownSide=reverse?'p2':'p1',foeSide=reverse?'p1':'p2';
 const [p1,p2]=reverse?[foe,own]:[own,foe];
 const mk=(stream,team,side)=>new Bot(stream,dex,team,side,trace,
   side===ownSide?null:foeForced,null,{
    previewPolicy:side===ownSide?policy[0]:'legacy',
    decisionPolicy:side===ownSide?policy[1]:'baseline',seed
   });
 const b1=mk(streams.p1,p1,'p1'),b2=mk(streams.p2,p2,'p2');
 if(script){
  const bot=foeSide==='p1'?b1:b2,original=bot.decide.bind(bot);
  bot.decide=function(req){
   if(req.teamPreview||req.forceSwitch||this.turn!==1)return original(req);
   if(script.kind==='switch'){
    const i=req.side.pokemon.findIndex(p=>!p.active&&
      String(p.details||'').split(',')[0]===script.to&&
      !String(p.condition||'').endsWith(' fnt'));
    if(i<0)throw Error('Script switch unavailable '+script.to);
    return 'switch '+(i+1);
   }
   const i=(req.active?.[0]?.moves||[]).findIndex(m=>
     String(m.id||m.move).toLowerCase().replace(/[^a-z]/g,'')===
     script.move.toLowerCase().replace(/[^a-z]/g,'')&&!m.disabled&&m.pp>0);
   if(i<0)throw Error('Script move unavailable '+script.move);
   return 'move '+(i+1)+(req.active[0].canMegaEvo?' mega':'');
  };
 }
 let winner='';const chunks=[];
 const observer=(async()=>{for await(const msg of streams.omniscient){
  chunks.push(msg);
  for(const line of msg.split('\n'))if(line.startsWith('|win|'))winner=line.slice(5);
 }})();
 const r1=b1.run(),r2=b2.run();
 await streams.omniscient.write('>start '+JSON.stringify({formatid:'gen9championsbssregmc',seed})+
  '\n>player p1 '+JSON.stringify({name:'p1',team:normalize(p1)})+
  '\n>player p2 '+JSON.stringify({name:'p2',team:normalize(p2)}));
 await Promise.all([observer,r1,r2]);
 assert.ok(winner,'completed battle');
 const log=chunks.join('\n');
 if(script){
  const event=script.kind==='switch'?'switch':'move';
  const expected=script.kind==='switch'?script.to:script.move;
  const turn2=log.indexOf('|turn|2');
  const t1=turn2<0?log:log.slice(0,turn2);
  assert.ok(t1.split('\n').some(line=>{
   const a=line.split('|');
   return a[1]===event&&a[2]?.startsWith(foeSide+'a:')&&a[3]?.includes(expected);
  }),c.id+' rival scripted action must execute: '+expected);
 }
 const selection=chosen(trace,ownSide);
 assert.ok(selection&&selection.chosen.length===3);
 return {won:winner===ownSide,selection:selection.chosen,lead:selection.lead,
  choices:t12(trace,ownSide),errors:trace.errors.length,
  tempo:trace.tempo?.filter(x=>x.side===ownSide&&x.turn<=2).map(x=>({
   turn:x.turn,foe:x.foe,baseline:x.baseline,candidate:x.candidate
  }))||[]};
}
test('predeclared U1/U2 and DEV synthetic sixes are legal M-C with distinct items',{skip},()=>{
 const sim=load(),validator=sim.TeamValidator.get('gen9championsbssregmc');
 for(const c of cases){
  prelim(c.team,c.id);
  assert.ok(!validator.validateTeam(normalize(c.team))?.length,c.id);
  for(const trio of [c.A,c.B])for(const species of trio)
   assert.ok(c.team.some(p=>p.species===species),c.id+' '+species);
 }
});
test('publicTempo preview depends on public species, not six ordering or rival selected three',{skip},()=>{
 const sim=load(),dex=sim.Dex.mod('champions'),own=reportedLive();
 const {chooseTempoPreview}=require('../public-tempo');
 for(const c of cases){
  const six=c.team.map(p=>p.species);
  const a=chooseTempoPreview(dex,own,six).selection;
  const b=chooseTempoPreview(dex,own,[...six].reverse()).selection;
  assert.deepEqual(a,b,c.id+' preview cannot use rival hidden trio');
 }
});
test('publicTempo preview/turn/joint opt-ins: pinned full Battle, two seeds, side reversal, scripted rival branch',{skip},async t=>{
 const sim=load(),own=reportedLive(),rows=[];
 for(const [ci,c] of cases.entries()){
  const rec={id:c.id,publicSix:c.team.map(p=>p.species),scriptA:c.t1,arms:{}};
  for(const key of Object.keys(policies))rec.arms[key]={wins:0,errors:0,byBranch:{A:0,B:0},samples:[]};
  for(const [branch,foeForced] of [['A',c.A],['B',c.B]])
   for(let n=0;n<2;n++)for(const reverse of [false,true]){
    const seed=hashSeed(10412000+ci*100+n);
    const games={};
    for(const [key,policy] of Object.entries(policies)){
     const g=await play(sim,copy(own),copy(c.team),seed,reverse,c,foeForced,policy,branch==='A'?c.t1:null);
     games[key]=g;
     const r=rec.arms[key];
     r.wins+=Number(g.won);r.errors+=g.errors;r.byBranch[branch]+=Number(g.won);
     if(r.samples.length<2)r.samples.push({branch,seed,reverse,won:g.won,
       three:g.selection,lead:g.lead,t12:g.choices,tempo:g.tempo});
    }
    // Full ablation: preview-only may change three/lead; turn-only must not.
    assert.deepEqual(games.turnOnly.selection,games.baseline.selection,
      c.id+' turn-only cannot change preview');
    assert.deepEqual(games.both.selection,games.previewOnly.selection,
      c.id+' turn policy cannot change preview');
   }
  for(const [key,r] of Object.entries(rec.arms))
   assert.equal(r.errors,0,c.id+' '+key+' legal choices');
  rows.push(rec);
 }
 const totals={};
 for(const key of Object.keys(policies))
  totals[key]=rows.reduce((s,r)=>s+r.arms[key].wins,0);
 t.diagnostic('PUBLIC TEMPO FOUR ARM TOTALS '+JSON.stringify(totals));
 t.diagnostic('PUBLIC TEMPO FOUR ARM CASES '+JSON.stringify(rows));
});
