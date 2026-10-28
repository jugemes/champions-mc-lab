'use strict';
// Hybrid-01 (Issue #2) minimal reproductions.
// - Plain tests: facts of the pinned Showdown engine / M-C validator, and
//   reproducibility guards. They must pass.
// - {todo} tests: what a rational evaluator SHOULD do. They currently fail and
//   document a known AI defect without turning CI red. Remove `todo` when fixed.
// Opposing sets are hypotheses (see hybrid01-audit.js), never observed sets.
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {provisional}=require('../provisional-rank-roster-20261018');
const {reportedLive,DIFF_FROM_PROVISIONAL}=require('../reported-live-roster-20261027');
const {prelim,normalize,matchup,game,hashSeed,Bot}=require('../lab');
const {estimateDamage,incomingRisk}=require('../damage');
const {publicThreat}=require('../threat');
const {rankPreview}=require('../preview-policy');
const {opponents:threatSixes}=require('../threat-scenarios-20261014');
const {teams:cycle3}=require('../cycle3-teams');
const A=require('../hybrid01-audit');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
const dex=sim.Dex.mod('champions');
const validator=sim.TeamValidator.get('gen9championsbssregmc');
const legal=s=>{const p=validator.validateSet(normalize([s])[0],{});return !p||!p.length;};
const seeds=n=>Array.from({length:n},(_,i)=>[i+1,7,11,13]);
const firstDamage=(b,ident)=>{
 const l=b.log.find(x=>x.startsWith('|-damage|'+ident+'|'));
 if(!l)return null;const hp=l.split('|')[3];
 if(hp.startsWith('0 fnt'))return null; // KO: only a lower bound, not used for range checks
 const [h,m]=hp.split(' ')[0].split('/').map(Number);
 return 1-h/m;
};

// ---------- Metagross: provisional code vs reported live set ----------
test('provisional roster still has Zen Headbutt (historical runs stay reproducible)',()=>{
 const m=provisional().find(p=>p.species==='Metagross');
 assert.deepEqual(m.moves,['Meteor Mash','Zen Headbutt','Bullet Punch','Thunder Punch']);
});
test('reported live six (defined independently) differs from provisional ONLY by Zen Headbutt -> Psychic Fangs and is M-C legal',()=>{
 const source=require('node:fs').readFileSync(path.join(__dirname,'..','reported-live-roster-20261027.js'),'utf8');
 assert.ok(!/require\([^)]*provisional/.test(source),'live roster must not be derived from the provisional file');
 const live=reportedLive(),old=provisional();
 assert.deepEqual(live.map(p=>p.species),old.map(p=>p.species));
 const diffs=[];
 for(let i=0;i<6;i++){
  for(const k of ['item','ability','nature'])
   if(live[i][k]!==old[i][k])diffs.push({species:live[i].species,field:k,provisional:old[i][k],reported:live[i][k]});
  for(const k of ['hp','atk','def','spa','spd','spe'])
   if((live[i].evs[k]||0)!==(old[i].evs[k]||0))diffs.push({species:live[i].species,field:'evs.'+k});
  const gone=old[i].moves.filter(m=>!live[i].moves.includes(m)),added=live[i].moves.filter(m=>!old[i].moves.includes(m));
  gone.forEach((m,j)=>diffs.push({species:live[i].species,field:'moves',provisional:m,reported:added[j]}));
 }
 assert.deepEqual(diffs,DIFF_FROM_PROVISIONAL.map(({source,...d})=>d));
 assert.ok(live[0].moves.includes('Psychic Fangs')&&!live[0].moves.includes('Zen Headbutt'));
 prelim(live,'reported_live_20261027');
 const issues=validator.validateTeam(normalize(live));
 assert.ok(!issues?.length,JSON.stringify(issues));
});
test('Zen Headbutt and Psychic Fangs differ in the pinned Champions data the AI reads',()=>{
 const z=dex.moves.get('Zen Headbutt'),f=dex.moves.get('Psychic Fangs');
 assert.deepEqual([z.basePower,z.accuracy,z.secondary?.chance],[80,90,20]);
 assert.deepEqual([f.basePower,f.accuracy,Boolean(f.secondary)],[85,100,false]);
 assert.ok(z.flags.contact&&f.flags.contact,'both contact: Tough Claws applies to both');
 // The heuristic sees a different expected value, so selection can change.
 const old=provisional()[0],live=reportedLive()[0];
 assert.ok(matchup(dex,live,'Gengar','Psychic Fangs')>matchup(dex,old,'Gengar','Zen Headbutt')*1.15);
 const six=['Indeedee','Hippowdon','Garchomp','Umbreon','Gengar','Gyarados'];
 const score=t=>rankPreview(dex,t,six,matchup).find(c=>c.three.join()==='0,1,5').score;
 assert.ok(score(reportedLive())>score(provisional()),'real pick Metagross/Hydreigon/Rotom-W is rescored');
});

// ---------- Case B: Indeedee vs reported Hydreigon ----------
test('M-C allows the Indeedee hypotheses (legal does not mean the opponent used them)',()=>{
 for(const s of Object.values(A.INDEEDEE_HYPOTHESES))assert.ok(legal(s),s.item);
 assert.ok(!legal(A.set('Indeedee-F','Choice Scarf','Psychic Surge','Modest',{hp:2,spa:32,spe:32},
  ['Dazzling Gleam','Expanding Force','Mystical Fire','Trick'])),'Indeedee-F lacks Expanding Force');
});
test('engine: max-speed Timid Hydreigon (165) outspeeds unboosted Indeedee; Scarf Indeedee (241) moves first and Dazzling Gleam KOs',()=>{
 const hyd=reportedLive().find(p=>p.species==='Hydreigon');
 const run=(ind,seed)=>A.engineBattle(sim,A.padTo6(hyd,A.FILLER()),A.padTo6(ind,A.FILLER()),seed,[['move 2','move 1']]);
 const b=run(A.INDEEDEE_HYPOTHESES.scarf_timid_c32,[1,2,3,4]);
 assert.equal(b.p1.active[0].getStat('spe'),165);
 for(const seed of seeds(12)){
  const s=run(A.INDEEDEE_HYPOTHESES.scarf_timid_c32,seed);
  const moves=s.log.filter(l=>l.startsWith('|move|'));
  assert.match(moves[0],/^\|move\|p2a: Indeedee\|Dazzling Gleam/);
  assert.ok(s.log.some(l=>l.startsWith('|faint|p1a: Hydreigon')));
  const n=run(A.INDEEDEE_HYPOTHESES.sash_timid_c32,seed);
  assert.match(n.log.filter(l=>l.startsWith('|move|'))[0],/^\|move\|p1a: Hydreigon/);
 }
});
test('Hydreigon is 4x weak to Fairy, which STAB-only preview/threat never sees',()=>{
 assert.equal(dex.getEffectiveness('Fairy',dex.species.get('Hydreigon').types),2);
 // Indeedee's public STABs are Psychic (Hydreigon immune) and Normal (neutral).
 assert.ok(publicThreat(dex,'Hydreigon','Indeedee')<publicThreat(dex,'Hydreigon','Gengar'));
});
test('AI should treat a legal, common Fairy coverage move as a possible KO before it is revealed',{todo:'P0: coverage prior per species'},()=>{
 const hyd=reportedLive().find(p=>p.species==='Hydreigon');
 assert.ok(incomingRisk(dex,hyd,'Indeedee',{})>=1,'currently 0.57: AI thinks Hydreigon survives');
});
test('AI should have a speed-order model (Scarf possibility) before choosing a lead',{todo:'P0: speed band per public species'},()=>{
 const damage=require('../damage');
 assert.equal(typeof damage.speedBand,'function','no speed concept exists in damage/threat/preview/decision');
});

// ---------- Mega Charizard Y ----------
test('M-C allows Charizardite Y with Flamethrower / Solar Beam (hypothesis set)',()=>{
 assert.ok(legal(A.CHARIZARD_Y_HYPOTHESIS));
});
test('engine: Drought sun replaces Tyranitar lead sand on the Mega turn and Solar Beam fires without charging',()=>{
 const ttar=provisional().find(p=>p.species==='Tyranitar');
 const b=A.engineBattle(sim,A.padTo6(ttar,A.FILLER()),A.padTo6(A.CHARIZARD_Y_HYPOTHESIS,A.FILLER()),[5,6,7,8],
  [['move 3','move 2 mega']]);
 const L=b.log.join('\n');
 const sand=L.indexOf('|-weather|Sandstorm|[from] ability: Sand Stream');
 const sun=L.indexOf('|-weather|SunnyDay|[from] ability: Drought');
 const beam=L.indexOf('|move|p2a: Charizard|Solar Beam');
 assert.ok(sand>=0&&sun>sand&&beam>sun,'order sand -> Mega Drought -> Solar Beam');
 // Showdown logs -prepare then -anim in the SAME turn under sun: damage lands before turn 2.
 const hit=L.indexOf('|-damage|p1a: Tyranitar',beam),turn2=L.indexOf('|turn|2');
 assert.ok(hit>beam&&(turn2<0||hit<turn2),'Solar Beam hits on the Mega turn');
});
test('engine: switching Tyranitar in after Mega-Y restores sand',()=>{
 const pri=provisional().find(p=>p.species==='Primarina');
 const team=A.padTo6(pri,A.FILLER());
 const tIndex=team.findIndex(p=>p.species==='Tyranitar');
 assert.ok(tIndex>0);
 // Bring Primarina + Tyranitar + one more; Tyranitar is the 2nd slot in battle.
 const b=A.engineBattle(sim,team,A.padTo6(A.CHARIZARD_Y_HYPOTHESIS,A.FILLER()),[9,9,9,9],
  [['move 1','move 4 mega'],['switch 2','move 1']],'1'+(tIndex+1)+'2');
 const L=b.log.join('\n');
 const sun=L.indexOf('|-weather|SunnyDay|[from] ability: Drought');
 assert.ok(sun>=0&&L.indexOf('|-weather|Sandstorm|[from] ability: Sand Stream',sun)>sun);
});
// Issue #4 replaced the original "select >= 90%" expectation: a selection
// rate is not a target. What must hold is that the cut no longer comes from
// scoring the own Mega-Y holder as base Charizard without Drought.
test('rational preview no longer cuts its own Mega-Y holder because of base-form undervaluation',()=>{
 const R=require('../preview-rational');
 const sun=threatSixes.sun_charizard_y,E=cycle3().E_ee_primarina_for_skeledirge.map(p=>p.species);
 const old=rankPreview(dex,sun,E,matchup);
 const has=c=>c.three.some(i=>sun[i].species==='Charizard');
 assert.ok(old.find(has).score<old.find(c=>!has(c)).score,'historical policy: Charizard trio loses');
 const cmp=R.compareInclusion(dex,sun,E,'Charizard');
 assert.ok(cmp.margin>0);
 assert.equal(cmp.with.mega.form,'Charizard-Mega-Y');
 assert.equal(cmp.with.weather.setter[sun.findIndex(p=>p.species==='Charizard')],'sunnyday');
});
test('on the Mega turn the move evaluator sees Mega-Y stats and Drought (megaAware bots)',()=>{
 const cz=A.CHARIZARD_Y_HYPOTHESIS,team=A.padTo6(cz,A.FILLER());
 const current={details:'Charizard, L50, M',active:true,condition:'155/155'};
 const view=o=>new Bot(null,dex,team,'p1',{choices:[],selections:[],errors:[]},null,null,o)
  .activeView(current,{canMegaEvo:true});
 const v=view({megaAware:true});
 const asLabSeesIt=estimateDamage(dex,v.my,'Rillaboom','Flamethrower',{weather:v.weather});
 const actual=estimateDamage(dex,{...cz,species:'Charizard-Mega-Y'},'Rillaboom','Flamethrower',{weather:'SunnyDay'});
 assert.ok(asLabSeesIt.mid>=actual.mid*0.9);
 // Default bots keep the historical (pre-Mega) view for reproducibility.
 const h=view({});
 assert.equal(h.my.species,'Charizard');
 assert.equal(h.weather,'');
});

// ---------- Gyarados (C case) ----------
test('M-C allows Sitrus Intimidate Dragon Dance Gyarados (hypothesis) and engine applies Intimidate to Garchomp',()=>{
 assert.ok(legal(A.GYARADOS_SITRUS_HYPOTHESIS));
 const chomp=provisional().find(p=>p.species==='Garchomp');
 const b=A.engineBattle(sim,A.padTo6(chomp,A.FILLER()),A.padTo6(A.GYARADOS_SITRUS_HYPOTHESIS,A.FILLER()),[3,3,3,3],[]);
 assert.ok(b.log.some(l=>/^\|-unboost\|p1a: Garchomp\|atk\|1/.test(l)));
});
test('in-battle bot reads Intimidate from public messages',async()=>{
 const t=provisional();
 const bot=new Bot(['|switch|p1a: Garchomp|Garchomp, L50, M|185/185\n|-unboost|p1a: Garchomp|atk|1'],
  dex,t,'p1',{choices:[],selections:[],errors:[]});
 await bot.run();
 assert.equal(bot.boosts.atk,-1);
});

// ---------- Public-ability immunities ----------
test('engine: Rotom-Wash (only legal ability Levitate) is immune to Earthquake',()=>{
 assert.deepEqual(Object.values(dex.species.get('Rotom-Wash').abilities),['Levitate']);
 const chomp=provisional().find(p=>p.species==='Garchomp');
 const rotom=provisional().find(p=>p.species==='Rotom-Wash');
 const b=A.engineBattle(sim,A.padTo6(chomp,A.FILLER()),A.padTo6(rotom,A.FILLER()),[4,4,4,4],[['move 1','move 4']]);
 assert.ok(b.log.some(l=>l.startsWith('|-immune|p2a: Rotom')));
});
test('preview/threat/damage should apply a single-option public ability (Levitate)',{todo:'P0: public ability inference'},()=>{
 const chomp=provisional().find(p=>p.species==='Garchomp');
 assert.equal(matchup(dex,chomp,'Rotom-Wash','Earthquake'),0,'currently 364: rated super effective');
 assert.ok(estimateDamage(dex,chomp,'Rotom-Wash','Earthquake',{}).immune);
 assert.ok(publicThreat(dex,'Rotom-Wash','Garchomp')<150,'currently 243 from Ground STAB');
});

// ---------- damage.js against the engine ----------
function measured(attacker,defender,choice,n=24){
 const out=[];
 for(const seed of seeds(n)){
  const b=A.engineBattle(sim,A.padTo6(attacker,A.FILLER()),A.padTo6(defender,A.FILLER()),seed,[[choice,'move 1']]);
  if(b.log.some(l=>l.startsWith('|-crit|')))continue;
  const d=firstDamage(b,'p2a: '+defender.species);if(d!=null)out.push(d);
 }
 return out;
}
const splash=(species,nature,evs)=>A.set(species,'Leftovers','',nature,evs,['Splash']);
test('damage.js range contains the engine result in a plain case (stat formula check)',()=>{
 const pri=provisional().find(p=>p.species==='Primarina');
 const foe=splash('Hippowdon','Impish',{hp:32,def:32,spd:2});foe.ability='Sand Stream';
 const est=estimateDamage(dex,pri,'Hippowdon','Moonblast');
 const got=measured(pri,foe,'move 1');
 assert.ok(got.length>10);
 for(const d of got)assert.ok(d>=est.min-0.01&&d<=est.max+0.01,d+' not in '+est.min+'..'+est.max);
});
test('damage.js should include Tough Claws on Mega Metagross contact moves',{todo:'P1: attacker modifiers'},()=>{
 const meta=reportedLive().find(p=>p.species==='Metagross');
 const foe=splash('Hippowdon','Lonely',{hp:0,atk:32,spe:32,spd:2});foe.ability='Sand Stream';
 const est=estimateDamage(dex,{...meta,species:'Metagross-Mega',ability:'Tough Claws'},'Hippowdon','Meteor Mash');
 const got=measured(meta,foe,'move 1 mega').filter(d=>d>0);
 assert.ok(got.length>5);
 for(const d of got)assert.ok(d<=est.max+0.01,'engine '+d.toFixed(3)+' > AI max '+est.max.toFixed(3));
});
test('damage.js should apply the sandstorm Sp. Def boost to Rock types',{todo:'P1: weather defence'},()=>{
 const pri=provisional().find(p=>p.species==='Primarina');
 const a=estimateDamage(dex,pri,'Tyranitar','Moonblast',{});
 const b=estimateDamage(dex,pri,'Tyranitar','Moonblast',{weather:'Sandstorm'});
 assert.ok(b.mid<a.mid*0.75);
});

// ---------- Hidden information ----------
test('opponent preview does not depend on our hidden moves/items (end-to-end through Showdown)',async()=>{
 const ours=reportedLive();
 const disguised=ours.map(p=>({...structuredClone(p)}));
 disguised[1].moves=['Draco Meteor','Dark Pulse','Flamethrower','Earth Power'];
 const foe=cycle3().E_ee_primarina_for_skeledirge;
 const opt={previewPolicy:'strategic',decisionPolicy:'v2'};
 for(const i of [0,1,2]){
  const seed=hashSeed(9100+i);
  const a=await game(sim,ours,foe,seed,false,null,false,opt);
  const b=await game(sim,disguised,foe,seed,false,null,false,opt);
  const pick=g=>JSON.stringify(g.trace.selections.find(s=>s.side==='p2'));
  assert.equal(pick(a),pick(b));
 }
});

// ---------- Legality beyond `npm run check` ----------
// `npm run check` validates only fixtures.js (variants + archetypes). This
// covers every other named roster the reports and audits rely on.
test('every named roster used by audits and reports is M-C legal',()=>{
 const pools={
  provisional_20261018:provisional(),reported_live_20261027:reportedLive(),
  ...cycle3(),...threatSixes,...require('../preview-opponents').opponents,
  ...require('../recommended-teams').currentTeams()
 };
 assert.ok(Object.keys(pools).length>=29);
 for(const [name,team] of Object.entries(pools)){
  prelim(team,name);
  const issues=validator.validateTeam(normalize(team));
  assert.ok(!issues?.length,name+': '+JSON.stringify(issues));
 }
});
