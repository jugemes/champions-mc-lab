#!/usr/bin/env node
// Reproduction copy for reports/claude-m7-live-counterplay-2026-10-30.md; run from the root of branch chatgpt/m7-rotom-form-comparison-20261028 @0addd61.
'use strict';
/**
 * Claude independent audit for CLAUDE-TASK PR #45 (Issue #20):
 * M-7 live six L, cases A (Golisopod), B (Lucario-Mega-Z), C (Charizard X/Y).
 *
 * Runs on top of branch chatgpt/m7-rotom-form-comparison-20261028 @0addd61
 * (needs lab.js, environment-m7-teams.js, engine-three-branch.js) with
 * SHOWDOWN_DIR = pinned 3a766f2cfb5e51c1e428cfe87d0dba91a8f01640.
 *
 * Part 1 (BOT): own trio and opposing trio are BOTH declared below from the
 *   two public sixes before any run. The opposing trio list is written from the
 *   opponent's point of view (our six is public to them). Heuristic Bots then
 *   play. Result = Bot diagnostic, NOT a ladder winrate.
 * Part 2 (SCRIPT): real Showdown Battle, explicit T1 (and T2 when both actives
 *   are unchanged) actions for both sides, 8 seeds. Shows mechanics/HP, not
 *   which action a human picks.
 */
const fs=require('node:fs');
const {game,load,hashSeed}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {groups}=require('./environment-m7-teams');
const {twoTurnBranch}=require('./engine-three-branch');
const sim=load(),own=reportedLive(),fingerprint=JSON.stringify(own);
const G=n=>structuredClone(groups.find(g=>g.name===n));
const SEEDS=[1,2,3,4,5,6,7,8];

// ---------- declared candidates (preview information only) ----------
const CASES=[
 {key:'A',groups:['01_M7_golisopod_balance'],
  ownTrios:{W:['Rotom-Wash','Metagross','Hydreigon'],P:['Primarina','Metagross','Hydreigon'],
   C:['Rotom-Wash','Metagross','Primarina'],R:['Rotom-Wash','Primarina','Hydreigon']},
  // opponent view of our public six: Hydreigon/Garchomp are hit by Mimikyu,
  // Primarina by Golisopod Iron Head / Gholdengo, Metagross by Gholdengo/Garchomp
  foeTrios:{A:['Golisopod','Garchomp','Mimikyu'],B:['Hippowdon','Primarina','Gholdengo'],
   X1:['Mimikyu','Golisopod','Gholdengo'],X2:['Garchomp','Golisopod','Primarina']}},
 {key:'B',groups:['02_M7_lucarioZ_offense'],
  ownTrios:{G:['Garchomp','Metagross','Primarina'],W:['Rotom-Wash','Metagross','Primarina'],
   H:['Garchomp','Metagross','Hydreigon'],Q:['Primarina','Garchomp','Rotom-Wash'],
   R2:['Garchomp','Rotom-Wash','Metagross'],R3:['Rotom-Wash','Garchomp','Metagross']},
  foeTrios:{A:['Lucario','Garchomp','Mimikyu'],B:['Corviknight','Primarina','Archaludon'],
   X1:['Mimikyu','Lucario','Corviknight'],X2:['Garchomp','Lucario','Primarina']}},
 {key:'C',groups:['03_M7_charizardY_offense','04_M7_charizardX_offense'],
  ownTrios:{T1:['Tyranitar','Garchomp','Metagross'],T2:['Tyranitar','Garchomp','Primarina'],
   K:['Garchomp','Tyranitar','Primarina'],M:['Primarina','Tyranitar','Garchomp']},
  foeTrios:{A:['Charizard','Garchomp','Mimikyu'],B:['Primarina','Baxcalibur','Gholdengo'],
   X1:['Garchomp','Charizard','Gholdengo'],X2:['Mimikyu','Charizard','Primarina']}}
];

async function part1(){
 const rows=[];
 for(const c of CASES)for(const gname of c.groups){
  const g=G(gname);
  for(const [ok,trio] of Object.entries(c.ownTrios))
   for(const [fk,foe] of Object.entries(c.foeTrios))
    for(const reversed of [false,true])for(const s of [1,2]){
     const seed=hashSeed(4500000+groups.findIndex(x=>x.name===gname)*1000+s*10+(reversed?5:0));
     const opts={candidatePreviewPolicy:'rational-top',opponentPreviewPolicy:'rational',
      candidateDecisionPolicy:'v3-public-immunity',opponentDecisionPolicy:'v3-public-immunity',
      megaAware:true,opponentForced:foe,candidateForced:trio};
     const m=await game(sim,reversed?g.team:own,reversed?own:g.team,seed,false,null,reversed,opts);
     if(m.trace.errors.length)throw Error(JSON.stringify(m.trace.errors));
     rows.push({case:c.key,group:gname,own:ok,foe:fk,reversed,seed,
      won:m.winner===(reversed?'opponent':'candidate'),turns:m.turns});
    }
 }
 if(JSON.stringify(own)!==fingerprint)throw Error('live six changed');
 return rows;
}

// ---------- scripted T1/T2 branches ----------
function withMove(team,species,from,to){
 const t=structuredClone(team),p=t.find(x=>x.species===species);
 p.moves=p.moves.map(m=>m===from?to:m);return t;
}
const golFI=withMove(G('01_M7_golisopod_balance').team,'Golisopod','Leech Life','First Impression');
const lucVW=withMove(G('02_M7_lucarioZ_offense').team,'Lucario','Flash Cannon','Vacuum Wave');
const T={
 A:G('01_M7_golisopod_balance').team,AFI:golFI,
 B:G('02_M7_lucarioZ_offense').team,BVW:lucVW,
 CY:G('03_M7_charizardY_offense').team,CX:G('04_M7_charizardX_offense').team
};
// [label, foeTeamKey, ownThree, foeThree, ownT1 list, foeT1 list (name or [name,mega]), optional T2 {own,foe,foeMega}]
const M=(n,mega)=>({n,mega});
const BR=[
 // A: Golisopod lead (FI variant so FI/Sucker/Iron Head/SD all exist)
 ['A-W lead Rotom vs Goli','AFI',['Rotom-Wash','Metagross','Hydreigon'],['Golisopod','Mimikyu','Garchomp'],
  ['Will-O-Wisp','Volt Switch','Hydro Pump','Thunderbolt'],
  [M('Iron Head',true),M('Iron Head',false),M('First Impression',true),M('First Impression',false),M('Sucker Punch',true),M('Swords Dance',true),M('switch:Mimikyu')],
  {own:'Hydro Pump',foe:'Iron Head'}],
 ['A-P lead Primarina vs Goli','AFI',['Primarina','Metagross','Hydreigon'],['Golisopod','Mimikyu','Garchomp'],
  ['Moonblast','Sparkling Aria','Encore','switch:Metagross'],
  [M('Iron Head',true),M('Iron Head',false),M('First Impression',true),M('Sucker Punch',true),M('Swords Dance',true),M('switch:Mimikyu')],
  {own:'Sparkling Aria',foe:'Iron Head'}],
 ['A-W lead Rotom vs Mimikyu','A',['Rotom-Wash','Metagross','Hydreigon'],['Mimikyu','Golisopod','Garchomp'],
  ['Will-O-Wisp','Hydro Pump','Volt Switch'],
  [M('Swords Dance'),M('Play Rough'),M('Shadow Claw'),M('switch:Golisopod')],
  {own:'Hydro Pump',foe:'Play Rough'}],
 ['A-W Rotom vs Mimikyu: switch to Metagross','A',['Rotom-Wash','Metagross','Hydreigon'],['Mimikyu','Golisopod','Garchomp'],
  ['switch:Metagross','switch:Hydreigon'],[M('Swords Dance'),M('Play Rough'),M('Shadow Claw'),M('switch:Golisopod')],null],
 ['A-W lead Rotom vs Garchomp','A',['Rotom-Wash','Metagross','Hydreigon'],['Garchomp','Golisopod','Mimikyu'],
  ['Hydro Pump','Will-O-Wisp','Volt Switch'],
  [M('Dragon Claw'),M('Rock Slide'),M('switch:Mimikyu')],null],
 ['A-W lead Rotom vs Hippowdon','A',['Rotom-Wash','Metagross','Hydreigon'],['Hippowdon','Primarina','Gholdengo'],
  ['Hydro Pump','Will-O-Wisp'],
  [M('Stealth Rock'),M('Yawn'),M('Earthquake'),M('switch:Primarina')],null],
 // B
 ['B-G lead Scarf Garchomp vs Lucario','BVW',['Garchomp','Metagross','Primarina'],['Lucario','Corviknight','Mimikyu'],
  ['Earthquake','Dragon Claw'],
  [M('Aura Sphere',true),M('Nasty Plot',true),M('Vacuum Wave',true),M('Dark Pulse',true),M('switch:Corviknight')],null],
 ['B-G lead Scarf Garchomp vs Corviknight','B',['Garchomp','Metagross','Primarina'],['Corviknight','Primarina','Archaludon'],
  ['Earthquake','Rock Slide','switch:Primarina','switch:Metagross'],
  [M('Iron Head'),M('Body Press'),M('U-turn'),M('Roost')],null],
 ['B-G lead Scarf Garchomp vs Mimikyu','B',['Garchomp','Metagross','Primarina'],['Mimikyu','Lucario','Corviknight'],
  ['Earthquake','Poison Jab','switch:Metagross'],
  [M('Swords Dance'),M('Play Rough'),M('switch:Corviknight')],null],
 ['B-G lead Scarf Garchomp vs Scarf Garchomp','B',['Garchomp','Metagross','Primarina'],['Garchomp','Lucario','Primarina'],
  ['Dragon Claw','Earthquake','switch:Primarina'],[M('Dragon Claw'),M('Earthquake'),M('switch:Primarina')],null],
 ['B-R2 Scarf Garchomp vs Corviknight: switch to Rotom','B',['Garchomp','Rotom-Wash','Metagross'],['Corviknight','Primarina','Archaludon'],
  ['switch:Rotom-Wash'],[M('Iron Head'),M('Body Press'),M('U-turn'),M('Roost')],null],
 ['B-R2 Scarf Garchomp vs Archaludon','B',['Garchomp','Rotom-Wash','Metagross'],['Archaludon','Corviknight','Primarina'],
  ['Earthquake','switch:Rotom-Wash'],[M('Draco Meteor'),M('Thunderbolt'),M('Stealth Rock'),M('switch:Corviknight')],null],
 ['B-W lead Rotom vs Lucario','BVW',['Rotom-Wash','Metagross','Primarina'],['Lucario','Corviknight','Mimikyu'],
  ['Hydro Pump','Thunderbolt','Will-O-Wisp','Volt Switch'],
  [M('Aura Sphere',true),M('Nasty Plot',true),M('Dark Pulse',true),M('switch:Corviknight')],
  {own:'Hydro Pump',foe:'Aura Sphere'}],
 ['B-W lead Rotom vs Corviknight','B',['Rotom-Wash','Metagross','Primarina'],['Corviknight','Primarina','Archaludon'],
  ['Thunderbolt','Volt Switch','Will-O-Wisp'],[M('Iron Head'),M('Body Press'),M('U-turn'),M('Roost')],
  {own:'Thunderbolt',foe:'Roost'}],
 // C
 ['C-T lead Tyranitar vs Charizard-Y','CY',['Tyranitar','Garchomp','Primarina'],['Charizard','Garchomp','Mimikyu'],
  ['Stone Edge','Stealth Rock','switch:Garchomp','switch:Primarina'],
  [M('Solar Beam',true),M('Flamethrower',true),M('Air Slash',true),M('Solar Beam',false),M('switch:Garchomp')],
  {own:'Stone Edge',foe:'Solar Beam'}],
 ['C-T lead Tyranitar vs Charizard-X','CX',['Tyranitar','Garchomp','Primarina'],['Charizard','Garchomp','Mimikyu'],
  ['Stone Edge','Stealth Rock','switch:Garchomp','switch:Primarina'],
  [M('Dragon Dance',true),M('Earthquake',true),M('Flare Blitz',true),M('Dragon Claw',true),M('switch:Garchomp')],
  {own:'Stone Edge',foe:'Earthquake'}],
 ['C-K lead Scarf Garchomp vs Charizard-Y','CY',['Garchomp','Tyranitar','Primarina'],['Charizard','Garchomp','Mimikyu'],
  ['Rock Slide','switch:Tyranitar'],[M('Solar Beam',true),M('Flamethrower',true),M('Air Slash',true),M('switch:Garchomp')],null],
 ['C-K lead Scarf Garchomp vs Charizard-X','CX',['Garchomp','Tyranitar','Primarina'],['Charizard','Garchomp','Mimikyu'],
  ['Rock Slide','Earthquake','Dragon Claw','switch:Tyranitar'],[M('Dragon Dance',true),M('Earthquake',true),M('Dragon Claw',true),M('switch:Garchomp')],null],
 ['C-K Scarf Garchomp Dragon Claw vs Charizard-Y','CY',['Garchomp','Tyranitar','Primarina'],['Charizard','Garchomp','Mimikyu'],
  ['Dragon Claw','Earthquake'],[M('Solar Beam',true),M('Flamethrower',true),M('Air Slash',true)],null],
 ['C-T lead Tyranitar vs Garchomp','CY',['Tyranitar','Garchomp','Primarina'],['Garchomp','Charizard','Mimikyu'],
  ['Ice Punch','Stealth Rock','switch:Primarina'],[M('Earthquake'),M('Dragon Claw'),M('switch:Charizard')],null],
 ['C-T lead Tyranitar vs Primarina','CY',['Tyranitar','Garchomp','Primarina'],['Primarina','Baxcalibur','Gholdengo'],
  ['Knock Off','Stealth Rock','switch:Garchomp'],[M('Moonblast'),M('Sparkling Aria'),M('Encore')],null],
 ['C-T lead Tyranitar vs Mimikyu','CY',['Tyranitar','Garchomp','Primarina'],['Mimikyu','Charizard','Primarina'],
  ['Knock Off','Stealth Rock','Stone Edge'],[M('Swords Dance'),M('Play Rough'),M('Shadow Claw')],null],
];
function hpOf(side,name){
 const p=side.pokemon.find(x=>x.species===name||x.species.startsWith(name+'-'));
 return p?(p.fainted?0:p.hp)+'/'+p.maxhp:'?';
}
function weatherOf(lines){
 let w='';for(const l of lines){const a=l.split('|');if(a[1]==='-weather')w=a[2]==='none'?'':a[2];}
 return w;
}
function range(xs){
 const nums=xs.map(x=>Number(String(x).split('/')[0])),max=String(xs[0]).split('/')[1];
 const lo=Math.min(...nums),hi=Math.max(...nums);
 return (lo===hi?lo:lo+'-'+hi)+'/'+max;
}
function part2(){
 const out=[];
 for(const [label,tk,ownThree,foeThree,ownT1s,foeT1s,t2] of BR){
  const foeSix=T[tk];
  for(const o of ownT1s)for(const f of foeT1s){
   const runs=[];
   for(const s of SEEDS){
    const r=twoTurnBranch(sim,own,foeSix,{ownThree,foeThree,
     first:{own:o,foe:f.n,foeMega:Boolean(f.mega)},
     second:t2&&!o.startsWith('switch:')&&!f.n.startsWith('switch:')?{own:t2.own,foe:t2.foe}:null,seed:[2026,10,30,s]});
    const ev=r.events.first,ev2=r.events.second;
    runs.push({
     ownActive:r.firstAfter.own.active,foeActive:r.firstAfter.assumedFoe.active,
     ownLead:hpOf(r.firstAfter.own,ownThree[0]),foeLead:hpOf(r.firstAfter.assumedFoe,foeThree[0]),
     ownIn:o.startsWith('switch:')?hpOf(r.firstAfter.own,o.slice(7)):'',
     foeIn:f.n.startsWith('switch:')?hpOf(r.firstAfter.assumedFoe,f.n.slice(7)):'',
     weather:weatherOf(ev),
     ee:ev.some(l=>l.includes('Emergency Exit')),
     st:ev.filter(l=>l.startsWith('|-status|')).map(l=>l.split('|').slice(2,4).join(':').replace(/ ?[ab]: /,'')),
     t2:r.second?.executed?{ownLead:hpOf(r.secondAfter.own,ownThree[0]),foeLead:hpOf(r.secondAfter.assumedFoe,foeThree[0]),weather:weatherOf(ev2)}:
       (r.second?{skip:r.second.notExecutedReason}:null),
     firstMover:(ev.find(l=>l.startsWith('|move|'))||'').split('|')[2]||''
    });
   }
   const by=k=>runs.map(x=>x[k]);
   const row={label,ownT1:o,foeT1:f.n+(f.mega?' +mega':''),
    ownActive:[...new Set(by('ownActive'))].join(','),foeActive:[...new Set(by('foeActive'))].join(','),
    ownLeadHP:range(by('ownLead')),foeLeadHP:range(by('foeLead')),
    ownLeadKO:runs.filter(x=>x.ownLead.startsWith('0/')).length,foeLeadKO:runs.filter(x=>x.foeLead.startsWith('0/')).length,
    ownInHP:o.startsWith('switch:')?range(by('ownIn')):'',foeInHP:f.n.startsWith('switch:')?range(by('foeIn')):'',
    weather:[...new Set(by('weather'))].join(',')||'-',
    status:Object.entries(runs.flatMap(x=>x.st).reduce((a,k)=>(a[k]=(a[k]||0)+1,a),{})).map(([k,v])=>k+'x'+v).join(',')||'-',emergencyExit:runs.filter(x=>x.ee).length,
    firstMover:[...new Set(by('firstMover'))].join(',')};
   if(t2&&!o.startsWith('switch:')&&!f.n.startsWith('switch:')){
    const ex=runs.filter(x=>x.t2&&!x.t2.skip);
    row.t2=t2.own+' vs '+t2.foe;
    row.t2Executed=ex.length;
    if(ex.length){row.t2OwnLead=range(ex.map(x=>x.t2.ownLead));row.t2FoeLead=range(ex.map(x=>x.t2.foeLead));
     row.t2OwnKO=ex.filter(x=>x.t2.ownLead.startsWith('0/')).length;row.t2FoeKO=ex.filter(x=>x.t2.foeLead.startsWith('0/')).length;}
    const sk=[...new Set(runs.filter(x=>x.t2?.skip).map(x=>x.t2.skip))];if(sk.length)row.t2Skip=sk.join(';');
   }
   out.push(row);
  }
 }
 return out;
}
(async()=>{
 const bot=await part1();
 const summary={};
 for(const r of bot){
  const k=r.case+'|'+r.group.slice(0,2)+'|'+r.own;
  summary[k]=summary[k]||{wins:0,n:0,byFoe:{}};
  summary[k].wins+=r.won;summary[k].n++;
  const f=summary[k].byFoe[r.foe]=summary[k].byFoe[r.foe]||[0,0];f[0]+=r.won;f[1]++;
 }
 const scripted=part2();
 fs.mkdirSync('output/claude-m7-live',{recursive:true});
 fs.writeFileSync('output/claude-m7-live/result.json',JSON.stringify({
  engineSHA:'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',format:'gen9championsbssregmc',
  caveat:'Part1 = heuristic Bot vs Bot with both trios pre-declared from public sixes; Part2 = scripted single/two-turn branches, 8 seeds. Neither is a ladder winrate.',
  botSummary:summary,botRows:bot,scripted},null,1));
 console.log('BOT');for(const [k,v] of Object.entries(summary))
  console.log(k,v.wins+'/'+v.n,Object.entries(v.byFoe).map(([f,[w,n]])=>f+':'+w+'/'+n).join(' '));
 console.log('SCRIPTED');for(const r of scripted)console.log(JSON.stringify(r));
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
