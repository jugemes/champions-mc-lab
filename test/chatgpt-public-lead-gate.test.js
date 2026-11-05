'use strict';
// Predeclared 2026-11-01 07 JST holdout: PR #104 comment #6549741047.
// These mixed public sixes are constructed legality hypotheses, not observed
// rank encounters. Do not tune the lead gate after reading holdout outcomes.
const test=require('node:test');
const assert=require('node:assert/strict');
const {load,normalize,prelim,chooseThree,matchup,hashSeed}=require('../lab');
const {reportedLive}=require('../reported-live-roster-20261027');
const {archetypes}=require('../fixtures');
const {caseList}=require('../legal-search-v2-compare');
const {battle}=require('../legal-search-compare');
const {chooseLeadGate}=require('../public-lead-gate');
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
const {rain,stall,setup}=archetypes;
const copy=x=>structuredClone(x);
const HOLD=[
 {id:'H1_rain_stall',team:[rain[0],rain[1],rain[2],stall[1],stall[4],stall[5]].map(copy),
  forcedA:['Pelipper','Swampert','Archaludon'],forcedB:['Umbreon','Skarmory','Gholdengo']},
 {id:'H2_setup_stall',team:[setup[0],setup[1],setup[2],stall[0],stall[2],setup[3]].map(copy),
  forcedA:['Salamence','Volcarona','Dragonite'],forcedB:['Toxapex','Corviknight','Gholdengo']},
 {id:'H3_rain_priority_stall',team:[rain[0],setup[2],rain[5],setup[4],stall[0],rain[4]].map(copy),
  forcedA:['Pelipper','Dragonite','Rillaboom'],forcedB:['Toxapex','Skeledirge','Gholdengo']},
];
function cases(){
 const known=caseList();
 return [...HOLD,...['Real_indeedee_scarf','C_charizardY'].map(id=>{
   const c=known.find(x=>x.id===id);
   assert.ok(c,'existing named regression '+id);
   return {id,team:copy(c.team),forcedA:c.forcedA,forcedB:c.forcedB};
 })];
}
const flagged=m=>Object.values(m||{}).some(Boolean);
const early=(log,ownSide)=>{
 let turn=0;const out=[];
 for(const line of log.split('\n')){
  if(line.startsWith('|turn|'))turn=Number(line.split('|')[2]);
  if(turn>2)break;
  const a=line.split('|');
  if(['move','switch','-mega','faint'].includes(a[1]))
    out.push('T'+turn+':'+(a[2]||'')+':'+(a[3]||''));
 }
 return out.slice(0,10);
};
test('predeclared mixed public six holdout uses coherent legal M-C teams',{skip},()=>{
 const sim=load(),validator=sim.TeamValidator.get('gen9championsbssregmc');
 for(const c of cases()){
   prelim(c.team,c.id);
   assert.equal(new Set(c.team.map(p=>p.species)).size,6,c.id);
   assert.ok(!validator.validateTeam(normalize(c.team))?.length,c.id);
   for(const trio of [c.forcedA,c.forcedB]){
     assert.equal(trio.length,3);
     for(const name of trio)assert.ok(c.team.some(p=>p.species===name),c.id+': '+name);
   }
 }
});
test('public-six-only lead gate vs legacy: pinned full Battle, independent seed, side reversal',{skip},async t=>{
 const sim=load(),dex=sim.Dex.mod('champions'),own=reportedLive(),rows=[];
 for(const [index,c] of cases().entries()){
   const publicSix=c.team.map(p=>p.species);
   const old=chooseThree(dex,own,publicSix).map(i=>own[i-1].species);
   const gate=chooseLeadGate(sim,own,publicSix,matchup);
   const fresh=gate.selection;
   assert.deepEqual(chooseLeadGate(sim,own,[...publicSix].reverse(),matchup).selection,fresh,
     'public six order cannot reveal the rival selected three: '+c.id);
   assert.deepEqual([...fresh].sort(),[...old].sort(),'only lead may change: '+c.id);
   assert.equal(new Set(fresh).size,3);
   const rec={id:c.id,publicSix,old,fresh,changedLead:gate.changedLead,
     summary:gate.summary,oldWins:0,newWins:0,improved:0,worsened:0,
     foeMisplayWinsOld:0,foeMisplayWinsNew:0,errors:0,samples:[]};
   for(const [branch,foeForced] of [['A',c.forcedA],['B',c.forcedB]]){
     for(let n=0;n<2;n++)for(const reverse of [false,true]){
       const seed=hashSeed(10403000+index*100+n);
       const args={foeForced,reverse};
       const a=await battle(sim,copy(own),copy(c.team),seed,{...args,ownForced:old});
       const b=await battle(sim,copy(own),copy(c.team),seed,{...args,ownForced:fresh});
       rec.oldWins+=Number(a.won);rec.newWins+=Number(b.won);
       rec.improved+=Number(!a.won&&b.won);rec.worsened+=Number(a.won&&!b.won);
       rec.foeMisplayWinsOld+=Number(a.won&&flagged(a.foeMisplay));
       rec.foeMisplayWinsNew+=Number(b.won&&flagged(b.foeMisplay));
       rec.errors+=a.errors+b.errors;
       if(rec.samples.length<2&&(a.won!==b.won||n===0&&reverse===false))
         rec.samples.push({branch,seed,reverse,oldWon:a.won,newWon:b.won,
           foe:a.foe,oldEarly:early(a.log,a.ownSide),newEarly:early(b.log,b.ownSide)});
     }
   }
   assert.equal(rec.errors,0,'Showdown choices legal: '+c.id);
   rows.push(rec);
 }
 const totals=rows.reduce((a,r)=>{for(const k of ['oldWins','newWins','improved','worsened','errors'])
   a[k]=(a[k]||0)+r[k];a.changedLeads=(a.changedLeads||0)+Number(r.changedLead);return a;},{});
 t.diagnostic('PUBLIC LEAD GATE PAIRED TOTALS '+JSON.stringify(totals));
 t.diagnostic('PUBLIC LEAD GATE PER CASE '+JSON.stringify(rows));
});
