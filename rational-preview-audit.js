#!/usr/bin/env node
'use strict';
// Issue #4 reproduction: (A) the opponent's rational three/lead for the SAME
// public six under Charizard Y and X hypotheses, with reasons and counter-risk;
// (B) engine checks of the Tyranitar / Mega-Y interactions with hypothesis sets;
// (C) a SMALL forced-three battle set that reports Charizard-in and
// Charizard-out results separately. Heuristic AI only: not ladder win rates.
const fs=require('node:fs'),path=require('node:path');
const {load,check,prelim,normalize,game,hashSeed}=require('./lab');
const R=require('./preview-rational');
const {rankPreview}=require('./preview-policy');
const {matchup}=require('./lab');
const {opponents:threatSixes}=require('./threat-scenarios-20261014');
const {teams:cycle3}=require('./cycle3-teams');
const {reportedLive}=require('./reported-live-roster-20261027');
const A=require('./hybrid01-audit');
const OUT=path.join(__dirname,'output','rational-preview');
// HYPOTHESES, legal in M-C, not observed sets.
const CHARIZARD_X=A.set('Charizard','Charizardite X','Blaze','Jolly',{hp:2,atk:32,spe:32},
 ['Dragon Dance','Flare Blitz','Dragon Claw','Earthquake']);
const CHARIZARD_Y_FOCUS=A.set('Charizard','Charizardite Y','Blaze','Timid',{hp:2,spa:32,spe:32},
 ['Flamethrower','Solar Beam','Focus Blast','Roost']);
const withCharizard=(six,set)=>six.map(p=>p.species==='Charizard'?structuredClone(set):structuredClone(p));
const OWN=()=>({
 E:cycle3().E_ee_primarina_for_skeledirge,
 C:cycle3().C_rill_gholdengo_for_gengar,
 live:reportedLive()
});
const HYP=()=>({
 Y:threatSixes.sun_charizard_y,
 X:withCharizard(threatSixes.sun_charizard_y,CHARIZARD_X)
});
function args(argv){
 let perCondition=10;
 for(let i=0;i<argv.length;i++){
  if(argv[i]==='--per-condition')perCondition=Number(argv[++i]);
  else throw Error('Unknown option '+argv[i]);
 }
 if(!Number.isInteger(perCondition)||perCondition<0||perCondition>50)throw Error('per-condition 0..50');
 return {perCondition};
}
const names=(team,idx)=>idx.map(i=>team[i].species);
function previewSection(dex){
 const rows=[];
 for(const [ownName,own] of Object.entries(OWN()))for(const [h,opp] of Object.entries(HYP())){
  const six=own.map(p=>p.species);
  const ranked=R.rankRationalPreview(dex,opp,six);
  const dist=R.selectionDistribution(ranked);
  const cmp=R.compareInclusion(dex,opp,six,'Charizard',ranked);
  const old=rankPreview(dex,opp,six,matchup);
  const oldBest=old[0].score,oldPool=old.filter(x=>x.score>=oldBest-20).slice(0,8);
  const ow=oldPool.map(x=>Math.exp((x.score-oldBest)/8)),OW=ow.reduce((a,b)=>a+b,0);
  const oldP=oldPool.reduce((a,x,k)=>a+(x.three.some(i=>opp[i].species==='Charizard')?ow[k]/OW:0),0);
  const ourRanked=R.rankRationalPreview(dex,own,opp.map(p=>p.species));
  rows.push({own:ownName,hypothesis:h,
   opponentRational:dist.map(d=>({three:names(opp,d.candidate.three),p:+d.p.toFixed(3),
     mega:d.candidate.mega==null?null:opp[d.candidate.mega].species,
     leads:d.leads.map(l=>({lead:opp[l.i].species,p:+l.p.toFixed(3)}))})),
   pCharizardRational:+R.probabilityIncluding(ranked,opp,'Charizard').toFixed(3),
   pCharizardHistoricalStochastic:+oldP.toFixed(3),
   comparison:cmp,
   ourRational:R.selectionDistribution(ourRanked).slice(0,4).map(d=>({three:names(own,d.candidate.three),p:+d.p.toFixed(3),
     mega:d.candidate.mega==null?null:own[d.candidate.mega].species}))
  });
 }
 return rows;
}
// Engine checks, N seeds each, critical hits included (they are real outcomes).
function engineSection(sim,n=40){
 const live=reportedLive(),ttar=live.find(p=>p.species==='Tyranitar'),chomp=live.find(p=>p.species==='Garchomp');
 const cy=A.CHARIZARD_Y_HYPOTHESIS;
 const run=(p1,p2,turns,seed,pick1,pick2)=>A.engineBattle(sim,A.padTo6(p1,A.FILLER()),A.padTo6(p2,A.FILLER()),seed,turns,pick1,pick2);
 const seeds=Array.from({length:n},(_,i)=>[i+21,5,9,17]);
 const stat=(label,p1,p2,turns,judge)=>{
  let hits=0,ko=0,first=0,dmg=[];
  for(const s of seeds){
   const b=run(p1,p2,turns,s);
   const r=judge(b);hits+=Number(r.hit);ko+=Number(r.ko);first+=Number(r.first);if(r.dmg!=null)dmg.push(r.dmg);
  }
  dmg.sort((a,b)=>a-b);
  return {label,n,hit:hits,ko,first,damage:dmg.length?{min:+dmg[0].toFixed(3),max:+dmg[dmg.length-1].toFixed(3)}:null};
 };
 const hpLost=(b,ident)=>{
  const l=b.log.find(x=>x.startsWith('|-damage|'+ident+'|')&&!x.includes('[from]'));
  if(!l)return null;const hp=l.split('|')[3];if(hp.startsWith('0 fnt'))return 1;
  const [h,m]=hp.split(' ')[0].split('/').map(Number);return 1-h/m;
 };
 const judge=(attacker,defender,move)=>b=>{
  const mv=b.log.filter(l=>l.startsWith('|move|'));
  const used=b.log.findIndex(l=>l.startsWith('|move|'+attacker)&&l.includes('|'+move+'|'));
  const miss=used>=0&&b.log.slice(used+1,used+4).some(l=>l.startsWith('|-miss|'));
  return {hit:used>=0&&!miss,ko:b.log.some(l=>l.startsWith('|faint|'+defender)),
   first:Boolean(mv[0]?.startsWith('|move|'+attacker)),dmg:used>=0&&!miss?hpLost(b,defender):null};
 };
 const noChople={...ttar,item:'Leftovers'};
 const bulkyY=A.set('Charizard','Charizardite Y','Blaze','Modest',{hp:32,spa:32,spd:2},
  ['Flamethrower','Solar Beam','Focus Blast','Roost']);
 return [
  // Tyranitar leads; Charizard Mega Evolves and fires Focus Blast (Chople halves Fighting).
  stat('Mega-Y Focus Blast vs live Tyranitar (Chople), Ttar lead',ttar,CHARIZARD_Y_FOCUS,[['move 2','move 3 mega']],judge('p2a: Charizard','p1a: Tyranitar','Focus Blast')),
  stat('Mega-Y Focus Blast vs Tyranitar holding Leftovers (comparison)',noChople,CHARIZARD_Y_FOCUS,[['move 2','move 3 mega']],judge('p2a: Charizard','p1a: Tyranitar','Focus Blast')),
  stat('Mega-Y sun Solar Beam vs live Tyranitar, Ttar lead',ttar,cy,[['move 2','move 2 mega']],judge('p2a: Charizard','p1a: Tyranitar','Solar Beam')),
  stat('live Tyranitar Stone Edge vs Mega-Y (after Mega-Y Roost)',ttar,cy,[['move 1','move 4 mega']],judge('p1a: Tyranitar','p2a: Charizard','Stone Edge')),
  stat('Scarf Garchomp Rock Slide vs Mega-Y (H2 Timid)',chomp,cy,[['move 3','move 4 mega']],judge('p1a: Garchomp','p2a: Charizard','Rock Slide')),
  stat('Scarf Garchomp Rock Slide vs Mega-Y (H32 Modest)',chomp,bulkyY,[['move 3','move 4 mega']],judge('p1a: Garchomp','p2a: Charizard','Rock Slide')),
  stat('Scarf Garchomp Rock Slide vs Mega-X (Fire/Dragon)',chomp,CHARIZARD_X,[['move 3','move 1 mega']],judge('p1a: Garchomp','p2a: Charizard','Rock Slide'))
 ];
}
async function battleSection(sim,dex,perCondition){
 const rows=[];
 if(!perCondition)return rows;
 for(const [ownName,own] of Object.entries(OWN()))for(const [h,opp] of Object.entries(HYP())){
  const six=own.map(p=>p.species);
  const ranked=R.rankRationalPreview(dex,opp,six);
  const has=c=>c.three.some(i=>opp[i].species==='Charizard');
  for(const [cond,cand] of [['charizard_in',ranked.find(has)],['charizard_out',ranked.find(c=>!has(c))]]){
   const lead=cand.leads[0].i;
   const forced=[lead,...cand.three.filter(i=>i!==lead)].map(i=>opp[i].species);
   for(const ourPolicy of ['strategic','rational']){
    let wins=0,sun=0,megaY=0;const picks={};
    for(let i=0;i<perCondition;i++){
     const seed=hashSeed(5300000+i),reverse=Boolean(i%2);
     const g=await game(sim,reverse?opp:own,reverse?own:opp,seed,false,null,reverse,{
      previewPolicy:'stochastic',candidatePreviewPolicy:ourPolicy,opponentPreviewPolicy:'rational',
      candidateDecisionPolicy:'v3',opponentDecisionPolicy:'v2',megaAware:true,opponentForced:forced});
     if(g.trace.errors.length)throw Error('Illegal action '+JSON.stringify(g.trace.errors));
     const win=reverse?g.winner==='opponent':g.winner==='candidate';
     wins+=Number(win);sun+=Number(g.sunObserved);megaY+=Number(g.megaCharizardObserved);
     const mine=g.trace.selections.find(s=>s.side===(reverse?'p2':'p1')).chosen.join('/');
     picks[mine]=(picks[mine]||0)+1;
    }
    rows.push({own:ownName,hypothesis:h,condition:cond,opponentForced:forced,ourPolicy,
     wins,games:perCondition,sunObserved:sun,megaCharizardYObserved:megaY,ourPicks:picks});
   }
  }
 }
 return rows;
}
async function main(){
 const cfg=args(process.argv.slice(2));
 const sim=load();check(sim);
 const dex=sim.Dex.mod('champions'),validator=sim.TeamValidator.get('gen9championsbssregmc');
 for(const [k,t] of Object.entries({...OWN(),sunY:HYP().Y,sunX:HYP().X})){
  prelim(t,k);const e=validator.validateTeam(normalize(t));if(e?.length)throw Error(k+': '+e.join('; '));
 }
 const e=validator.validateSet(normalize([CHARIZARD_Y_FOCUS])[0],{});if(e?.length)throw Error(e.join('; '));
 const result={
  engine:process.env.RESEARCH_SHOWDOWN_COMMIT||'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',
  disclaimer:'Opposing sets are hypotheses. Heuristic AI vs heuristic AI; not ladder win rates.',
  preview:previewSection(dex),engineChecks:engineSection(sim),
  battles:await battleSection(sim,dex,cfg.perCondition)
 };
 fs.mkdirSync(OUT,{recursive:true});
 fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify(result,null,2));
 for(const r of result.preview)
  console.log(`PREVIEW own=${r.own} hyp=${r.hypothesis} P(Charizard) rational=${r.pCharizardRational} historical=${r.pCharizardHistoricalStochastic} margin=${r.comparison.margin} with=${r.comparison.with.three.join('/')} without=${r.comparison.without.three.join('/')}`);
 for(const c of result.engineChecks)
  console.log(`ENGINE ${c.label}: moved first ${c.first}/${c.n}, hit ${c.hit}/${c.n}, KO ${c.ko}/${c.n}, damage ${JSON.stringify(c.damage)}`);
 for(const b of result.battles)
  console.log(`BATTLE own=${b.own} hyp=${b.hypothesis} ${b.condition} forced=${b.opponentForced.join('/')} our=${b.ourPolicy} wins=${b.wins}/${b.games} sun=${b.sunObserved} megaY=${b.megaCharizardYObserved}`);
}
if(require.main===module)main().catch(e=>{console.error(e.stack||String(e));process.exitCode=1;});
module.exports={args,CHARIZARD_X,CHARIZARD_Y_FOCUS,OWN,HYP};
