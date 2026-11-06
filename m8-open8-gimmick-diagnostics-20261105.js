'use strict';
// Supplementary diagnosis, NOT a new holdout: these fixtures were used in
// prior research, but were not included in OPEN8's 15-six fitting table.
const fs=require('node:fs');
const {load,chooseThree,hashSeed}=require('./lab');
const {candidates,validate}=require('./m8-open8-battle-study-20261105');
const {battle,earlyLines}=require('./encore-lead-audit');
const {unseenSixesPR88}=require('./holdout-20261031-pr88');
const {unseenSixesPR96}=require('./holdout-20261031-pr96');
const {teams}=require('./holdout-20261030-claude');
const {groups}=require('./environment-m7-teams');
const clone=x=>structuredClone(x);
function scenarios(){
 const h88=unseenSixesPR88(),h96=unseenSixesPR96(),e=teams().claude_realE_sun;
 // Reuse species identities from the archived fixtures. Their historical
 // novelty tests scan later source for new species literals; these are
 // explicitly reused development cases, never a new unseen holdout.
 const make=(id,team,move,indices)=>({id,team,move,
  threes:indices.map(ids=>ids.map(i=>team[i].species))});
 return [
  make('snowVeil',h96.N5_kangaskhan.hypotheses.a,'Aurora Veil',[[2,0,1],[2,4,5]]),
  make('trickRoom',h88.F2_feraligatr.hypotheses.a,'Trick Room',[[2,0,5],[2,3,1]]),
  make('screens',h88.F3_glimmora.hypotheses.a,'Reflect',[[2,0,1],[2,3,5]]),
  make('realE_sun_lastRespects',e.team,null,[[2,3,1],[5,2,4]]),
  make('megaGoli_lastRespects',groups[5].team,null,[[0,3,1],[4,2,1]])
 ];
}
function script(move){return (req,bot,info)=>{
 if(info.turn!==1||!move)return null;
 const i=req.active?.[0]?.moves.findIndex(m=>!m.disabled&&m.move===move);
 return i>=0?'move '+(i+1):null;
};}
async function main({all=candidates(),out='output/m8-open8-gimmick-diagnostics-20261105.json'}={}){
 const sim=load(),dex=sim.Dex.mod('champions'),rows=[];
 const cases=scenarios();
 for(const [k,t] of Object.entries(all))validate(sim,t,k);
 for(const c of cases)validate(sim,c.team,c.id);
 for(const [name,team] of Object.entries(all))for(const [ci,c] of cases.entries()){
  // A baseline for an unmapped public six; never use actual enemy 3/sets.
  const selection=chooseThree(dex,team,c.team.map(p=>p.species)).map(i=>team[i-1].species);
  for(const [bi,three] of c.threes.entries()){
   const obs=[];
   for(let si=0;si<2;si++)for(const reverse of [false,true]){
    const seed=hashSeed(48084400+ci*1000+bi*100+si);
    const r=await battle(sim,clone(team),clone(c.team),seed,{
     ownThree:selection,foeThree:three,reverse,script:script(c.move),rivalImmuneAware:true,choiceAudit:true});
    if(r.errors)throw Error('choice errors '+name+'/'+c.id);
    obs.push({seed,reverse,won:r.won,turns:r.turns,
     mechanismAttempted:c.move?r.log.includes('|'+c.move):null,
     mechanismObserved:c.move?new RegExp('\\|-(?:sidestart|fieldstart)\\|[^\\n]*'+c.move).test(r.log):null,
     lastRespectsUsed:r.log.includes('|Last Respects|'),
     early:earlyLines(r.log,r.ownSide,10),choices:r.choiceTrace.filter(x=>x.turn<=3)});
   }
   rows.push({candidate:name,scenario:c.id,selection,enemyThree:three,wins:obs.filter(x=>x.won).length,n:4,obs});
  }
 }
 const result={protocol:'OPEN8 supplementary fixed baseline diagnostics v1',
  note:'Registered after primary study started; no primary selections changed. Known old fixtures, NOT unseen holdout; scripted setup is a mechanism fixture, NOT rational play proof. Shed Tail/Baton Pass remain untested. All are constructed hypotheses, not actual opponents observed in full.',
  games:rows.reduce((n,r)=>n+r.n,0),rows};
 fs.mkdirSync('output',{recursive:true});
 fs.writeFileSync(out,JSON.stringify(result,null,2));
 console.log(JSON.stringify(rows.map(({candidate,scenario,selection,enemyThree,wins,n,obs})=>({candidate,scenario,selection,enemyThree,wins,n,mechanism:obs.filter(x=>x.mechanismObserved).length,lastRespects:obs.filter(x=>x.lastRespectsUsed).length}))));
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={scenarios,script,main};
