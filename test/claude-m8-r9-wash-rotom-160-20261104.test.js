'use strict';
// Claude independent execution of PR #104 comment #6623251885 preregistration.
// R8 vs R9 (Rotom-Heat -> existing Rotom-Wash only), SAME ten public sixes and
// SAME two opponent 3s as test/m8-r8-ten-public-six-20261104.test.js, and the
// SAME seed formula, so R8 cells whose plan is unchanged reproduce the earlier
// 240-Battle R8 numbers. 2 builds * 10 public six * 2 foe 3 * 2 seeds * 2 sides
// = 160 full Battles. Own 3+lead fixed per public six before results.
const test=require('node:test'),assert=require('node:assert/strict');
const {load,normalize,prelim,hashSeed}=require('../lab');
const {build:r8}=require('../m8-r8-dual-setup-lucario');
const {build:r9,R8_PLANS,R9_PLANS}=require('../claude-m8-r9-audit');
const {groups}=require('../environment-m7-teams');
const {archetypes}=require('../fixtures');
const {battle,rivalScript}=require('../encore-lead-audit');
const copy=x=>structuredClone(x);
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
// Identical order/indices to the R8 ten-public-six test (seed formula uses ci/ei).
const foes=[
 {id:'sun',six:()=>groups[2].team,rival:[['Charizard','Garchomp','Mimikyu'],['Garchomp','Primarina','Gholdengo']]},
 {id:'rain',six:()=>archetypes.rain,rival:[['Pelipper','Swampert','Archaludon'],['Pelipper','Gholdengo','Rillaboom']]},
 {id:'mence',six:()=>groups[4].team,rival:[['Salamence','Garchomp','Mimikyu'],['Hippowdon','Primarina','Gholdengo']]},
 {id:'lucarioZ',six:()=>groups[1].team,rival:[['Lucario','Garchomp','Mimikyu'],['Corviknight','Primarina','Archaludon']]},
 {id:'gyarados',six:()=>groups[8].team,rival:[['Gyarados','Garchomp','Mimikyu'],['Mimikyu','Gholdengo','Corviknight']]},
 {id:'megaGolisopod',six:()=>groups[0].team,rival:[['Golisopod','Garchomp','Mimikyu'],['Hippowdon','Primarina','Gholdengo']]},
 {id:'psychic',six:()=>groups[10].team,rival:[['Indeedee','Gengar','Dragonite'],['Gholdengo','Volcarona','Rillaboom']]},
 {id:'volcarona',six:()=>groups[13].team,rival:[['Salamence','Volcarona','Dragonite'],['Gholdengo','Skeledirge','Rillaboom']]},
 {id:'stall',six:()=>groups[12].team,rival:[['Toxapex','Umbreon','Corviknight'],['Slowbro','Skarmory','Gholdengo']]},
 {id:'charX',six:()=>groups[3].team,rival:[['Charizard','Garchomp','Mimikyu'],['Primarina','Baxcalibur','Gholdengo']]}
];
const builds={R8:{team:r8,plans:R8_PLANS},R9:{team:r9,plans:R9_PLANS}};
const sp=s=>s.split(',')[0];
// Per-battle evidence from the omniscient log (post-battle only; never fed to
// selection). Actions T1/T2, leads, followers, voluntary switches, Mega, Rotom.
function facts(log,ownSide,choiceTrace){
 const foeSide=ownSide==='p1'?'p2':'p1',f={lead:{},T1:{own:[],foe:[]},T2:{own:[],foe:[]},
  ownIn:[],foeIn:[],mega:[],foeVoluntarySwitch:[],ownVoluntarySwitch:[],
  hydroPump:{used:0,miss:0},solarBeamOnRotom:[],rotomFaintTurn:null,faints:[]};
 let turn=0,last=null;
 for(const line of log.split('\n')){
  const a=line.split('|');
  if(a[1]==='turn'){turn=Number(a[2]);continue;}
  const who=a[2]?.slice(0,2),name=a[2]?.slice(5),mine=who===ownSide;
  if(a[1]==='switch'||a[1]==='drag'){
   const s=sp(a[3]);if(turn===0)f.lead[mine?'own':'foe']=s;
   const list=mine?f.ownIn:f.foeIn;if(!list.includes(s))list.push(s);
  }else if(a[1]==='move'){
   last={mine,move:a[3],user:name,target:a[4]?.slice(5),turn};
   const miss=a.slice(5).includes('[miss]');
   if(turn===1||turn===2)f['T'+turn][mine?'own':'foe'].push(name+':'+a[3]+(miss?'(miss)':''));
   if(mine&&a[3]==='Hydro Pump'){f.hydroPump.used++;if(miss)f.hydroPump.miss++;}
   if(!mine&&a[3]==='Solar Beam'&&/Rotom/.test(a[4]||''))f.solarBeamOnRotom.push({turn});
  }else if(a[1]==='-damage'&&last&&!last.mine&&last.move==='Solar Beam'&&mine&&/Rotom/.test(name||'')){
   const sb=f.solarBeamOnRotom.at(-1);if(sb&&sb.after==null)sb.after=a[3];
  }else if(a[1]==='-mega'||a[1]==='detailschange'&&/Mega/.test(a[3]||'')){
   if(a[1]==='-mega')f.mega.push((mine?'OWN:':'FOE:')+name+'@T'+turn);
  }else if(a[1]==='faint'){
   f.faints.push((mine?'OWN:':'FOE:')+name+'@T'+turn);
   if(mine&&/Rotom/.test(name))f.rotomFaintTurn=turn;
  }
 }
 for(const c of choiceTrace)if(c.requestKind==='normal'&&/^switch/.test(c.choice))
  (c.side===ownSide?f.ownVoluntarySwitch:f.foeVoluntarySwitch).push('T'+c.turn+'->'+c.chosenSpecies);
 return f;
}
test('R9 Wash Rotom legal, differs from R8 only by Rotom forme/Overheat->Hydro Pump; 66P cap; plans fixed from public six',{skip},()=>{
 const v=load().TeamValidator.get('gen9championsbssregmc');
 const A=r8(),B=r9();
 for(const [n,t] of [['R8',A],['R9',B]]){
  assert.equal(t.length,6);assert.doesNotThrow(()=>prelim(t,n));
  const e=v.validateTeam(normalize(t));assert.ok(!e?.length,n+JSON.stringify(e));
  for(const p of t){const ev=Object.values(p.evs||{});assert.ok(ev.reduce((x,y)=>x+y,0)<=66&&ev.every(x=>x<=32),n+p.species);}
 }
 const diff=A.map((p,i)=>JSON.stringify(p)===JSON.stringify(B[i])?null:[p,B[i]]).filter(Boolean);
 assert.equal(diff.length,1);
 const [h,w]=diff[0];
 assert.equal(h.species,'Rotom-Heat');assert.equal(w.species,'Rotom-Wash');
 assert.deepEqual({...h,species:0,moves:0},{...w,species:0,moves:0});
 assert.deepEqual(h.moves.map(m=>m==='Overheat'?'Hydro Pump':m),w.moves);
 for(const c of foes)for(const [k,b] of Object.entries(builds)){
  const t=b.plans[c.id],team=b.team();
  assert.equal(new Set(t).size,3,k+c.id);assert.ok(t.every(s=>team.some(p=>p.species===s)),k+c.id);
 }
 assert.deepEqual(R8_PLANS.sun,['Garchomp','Rotom-Heat','Lucario']);
 assert.deepEqual(R8_PLANS.charX,['Mimikyu','Garchomp','Lucario']);
});
test('Mega Charizard-Y sun Solar Beam on Rotom-Heat vs Rotom-Wash (pinned engine damage, 16 seeds)',{skip},async t=>{
 const sim=load(),zard=copy(groups[2].team.find(p=>p.species==='Charizard'));
 const out={};
 for(const [k,rot] of [['Heat',r8().find(p=>p.species==='Rotom-Heat')],['Wash',r9().find(p=>p.species==='Rotom-Wash')]]){
  const dmg=[];
  for(let s=0;s<16;s++){
   const b=new sim.Battle({formatid:'gen9championsbssregmc',seed:hashSeed(9100+s)});
   b.setPlayer('p1',{team:normalize([zard,copy(groups[2].team[1]),copy(groups[2].team[2])])});
   b.setPlayer('p2',{team:normalize([copy(rot),...r8().filter(p=>!/Rotom/.test(p.species)).slice(0,2)])});
   b.makeChoices('team 123','team 123');
   const hp0=b.p2.active[0].hp,max=b.p2.active[0].maxhp;
   b.makeChoices('move solarbeam mega','move voltswitch');
   if(b.p2.requestState==='switch')b.makeChoices('','switch 2');
   const r=b.p2.pokemon.find(p=>/Rotom/.test(p.species.name));
   assert.equal(b.field.weather,'sunnyday');
   dmg.push(Math.round(1000*(hp0-r.hp)/max)/10);
  }
  out[k]={min:Math.min(...dmg),max:Math.max(...dmg),koRate:dmg.filter(x=>x>=100).length+'/16'};
 }
 assert.ok(out.Wash.min>out.Heat.max,'Wash must take more');
 t.diagnostic('M8_R9_SOLARBEAM '+JSON.stringify(out));
});
test('R8 vs R9 ten preregistered public sixes x two foe 3s: 160 full Battles with T1/T2 evidence',{skip},async t=>{
 const sim=load(),rows=[];let games=0,errors=0;
 for(const [ci,c] of foes.entries())for(const [ei,foeThree] of c.rival.entries())
 for(const [name,b] of Object.entries(builds)){
  const team=b.team(),ourThree=b.plans[c.id],obs=[];
  for(let si=0;si<2;si++)for(const reverse of [false,true]){
   const seed=hashSeed(11050100+ci*1000+ei*100+si);
   const r=await battle(sim,copy(team),copy(c.six()),seed,{ownThree:ourThree,foeThree,reverse,script:null,rivalImmuneAware:true,choiceAudit:true});
   games++;errors+=r.errors;assert.equal(r.errors,0,c.id+'/'+name);
   assert.deepEqual([...r.foe].sort(),[...foeThree].sort(),'foe 3 executed as hypothesised');
   const f=facts(r.log,r.ownSide,r.choiceTrace);
   assert.equal(f.lead.own,ourThree[0].replace(/-.*/,'')==='Rotom'?f.lead.own:ourThree[0]);
   obs.push({si,reverse,won:r.won,turns:r.turns,...f});
  }
  rows.push({publicSix:c.id,foeThree,build:name,ownThree:ourThree,wins:obs.filter(x=>x.won).length,obs});
 }
 assert.equal(games,160);assert.equal(errors,0);assert.equal(rows.length,40);
 t.diagnostic('M8_R9_160 '+JSON.stringify({preregistered:'PR #104 comment #6623251885',games,errors,
  cells:rows.map(r=>({six:r.publicSix,foe:r.foeThree.join('/'),build:r.build,own:r.ownThree.join('/'),wins:r.wins+'/4'})),
  noOpponentHiddenTrioAtSelection:true,notHumanWinRate:true}));
 if(process.env.M8_R9_OUT)require('fs').writeFileSync(process.env.M8_R9_OUT,JSON.stringify(rows,null,1));
});
// POST-HOC supplement (NOT in the preregistration; added by Claude after seeing
// the 160 results). It tests whether the two R9 "improvements" survive a more
// rational opponent: (1) sun foe 3 A with Mega Charizard-Y held in the BACK
// instead of leading into the public Scarf-capable Garchomp; (2) gyarados foe 3
// A where Gyarados switches T1 to Mega Garchomp Z (both Rotom formes carry an
// Electric STAB, so this switch is rational from the public six alone).
// 2 builds * (2 sun orders + 1 gyara script) * 2 seeds * 2 sides = 24 Battles.
test('POST-HOC: R8 vs R9 under rational opponent Y-in-back and Gyarados T1 switch (24 Battles)',{skip},async t=>{
 const sim=load(),dex=sim.Dex.mod('champions'),rows=[];let games=0;
 const sc=[
  {id:'sunYback-GarchLead',ci:0,ei:0,foeThree:['Garchomp','Charizard','Mimikyu'],script:null},
  {id:'sunYback-MimiLead',ci:0,ei:0,foeThree:['Mimikyu','Charizard','Garchomp'],script:null},
  {id:'gyara-T1switchGarch',ci:4,ei:0,foeThree:['Gyarados','Garchomp','Mimikyu'],script:()=>rivalScript('switch','stay',dex)}];
 for(const s of sc)for(const [name,b] of Object.entries(builds)){
  const c=foes[s.ci],team=b.team(),ourThree=b.plans[c.id],obs=[];
  for(let si=0;si<2;si++)for(const reverse of [false,true]){
   const seed=hashSeed(11050100+s.ci*1000+s.ei*100+si);
   const r=await battle(sim,copy(team),copy(c.six()),seed,{ownThree:ourThree,foeThree:s.foeThree,reverse,script:s.script&&s.script(),rivalImmuneAware:true,choiceAudit:true});
   games++;assert.equal(r.errors,0,s.id+name);
   const f=facts(r.log,r.ownSide,r.choiceTrace);
   assert.equal(f.lead.foe,s.foeThree[0]);
   obs.push({si,reverse,won:r.won,turns:r.turns,...f});
  }
  rows.push({scenario:s.id,build:name,ownThree:ourThree,foeThree:s.foeThree,wins:obs.filter(x=>x.won).length,obs});
 }
 assert.equal(games,24);
 t.diagnostic('M8_R9_POSTHOC '+JSON.stringify(rows.map(r=>({s:r.scenario,build:r.build,wins:r.wins+'/4',
  solarBeamOnRotom:r.obs.map(o=>o.solarBeamOnRotom.map(x=>x.after).join('+')||'-')}))));
 if(process.env.M8_R9_OUT)require('fs').writeFileSync(process.env.M8_R9_OUT.replace(/\.json$/,'-posthoc.json'),JSON.stringify(rows,null,1));
});
// Cross-check: ChatGPT's concurrent independent module (commit 897ea4a) must
// build the identical six and the identical public-six plans as Claude's.
test('Cross-check: Claude R9 module == ChatGPT m8-r9-wash-rotom.js (team and plans)',{skip},()=>{
 const g=require('../m8-r9-wash-rotom');
 assert.deepEqual(g.build(),r9());
 assert.deepEqual(g.publicPlans,R9_PLANS);
 assert.deepEqual(g.pairedR8Plans,R8_PLANS);
});
