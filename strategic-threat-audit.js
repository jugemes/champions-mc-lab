#!/usr/bin/env node
'use strict';
// Targeted REAL 6-show-3-pick evaluation of sunny Mega-Y and Psychic Terrain.
// No forced opposing three. Baseline stochastic and candidate strategic preview use identical teams,
// enemy sixes, seats and seeds. Both opposing policies are held fixed per pair.
const fs=require('node:fs'),path=require('node:path');
const {teams}=require('./cycle3-teams');
const {opponents}=require('./threat-scenarios-20261014');
const {load,check,prelim,normalize,game,hashSeed}=require('./lab');
const OUT=path.join(__dirname,'output','strategic-threats');
const OWN={
  C:teams().C_rill_gholdengo_for_gengar,
  E:teams().E_ee_primarina_for_skeledirge
};
const CONDITIONS=Object.keys(opponents);
function args(argv){
 let perPair=80;
 for(let i=0;i<argv.length;i++){
  if(argv[i]==='--per-pair')perPair=Number(argv[++i]);
  else throw Error('Unknown option '+argv[i]);
 }
 if(!Number.isInteger(perPair)||perPair<1||perPair>200)throw Error('perPair must be integer 1..200');
 return {perPair};
}
function legal(sim,teams){
 const validator=sim.TeamValidator.get('gen9championsbssregmc');
 for(const [name,team]of Object.entries(teams)){
  prelim(team,name);
  const errors=validator.validateTeam(normalize(team));
  if(errors?.length)throw Error('Invalid '+name+': '+errors.join('; '));
 }
}
function chosenCount(selection,species){
 return Boolean(selection&&selection.chosen.includes(species));
}
async function run({perPair}){
 const sim=load();check(sim);
 legal(sim,{...OWN,...opponents});
 fs.mkdirSync(OUT,{recursive:true});
 const csv=fs.createWriteStream(path.join(OUT,'games.csv'));
 csv.write('team,enemy_six,enemy_AI,our_preview,round,seed,side,win,turn,our_three,enemy_three,our_lead,enemy_lead,sun,psychic,priority_denied,mega_y,error_count\n');
 const result={
   mode:'PUBLIC_SIX_TO_THREE_PAIRED_POLICY_EVALUATION',
   games:0,perPair,engine:process.env.RESEARCH_SHOWDOWN_COMMIT||'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',
   disclaimer:'Synthetic heuristics, not M-7 ranked battle rates. Real opponent pick remains hidden from acting agent.',
   opponentSixes:Object.fromEntries(Object.entries(opponents).map(([name,team])=>[name,team.map(p=>p.species)])),
   rows:[],pairFlips:[]
 };
 const choices={},sides=['baseline','v2'];
 for(const [name,team]of Object.entries(OWN)){
  for(const [caseNumber,scenario]of CONDITIONS.entries()){
   for(const foePolicy of sides){
    for(const ownPolicy of ['stochastic','strategic']){
     let wins=0,weather=0,terrain=0,denied=0,megaY=0,selectedSetter=0,chosenOwn={},chosenEnemy={},gamesSun=0,winsSun=0,gamesPsy=0,winsPsy=0;
     for(let i=0;i<perPair;i++){
      const seed=hashSeed(10200000+caseNumber*20000+i+(foePolicy==='v2'?700000:0));
      const reverse=Boolean(i%2),recordLog=i===0;
      const g=await game(sim,reverse?opponents[scenario]:team,reverse?team:opponents[scenario],seed,recordLog,null,reverse,{
        previewPolicy:'stochastic',candidatePreviewPolicy:ownPolicy,opponentPreviewPolicy:'strategic',candidateDecisionPolicy:'v3',opponentDecisionPolicy:foePolicy
      });
      if(g.trace.errors.length)throw Error('Illegal action '+name+'/'+scenario+'/'+foePolicy+'/'+ownPolicy+'/'+i+':'+JSON.stringify(g.trace.errors));
      const ownSide=reverse?'p2':'p1',rivalSide=reverse?'p1':'p2';
      const a=g.trace.selections.find(s=>s.side===ownSide),b=g.trace.selections.find(s=>s.side===rivalSide);
      if(!a||!b||a.chosen.length!==3||b.chosen.length!==3)throw Error('Failed six-three selection');
      const win=reverse?g.winner==='opponent':g.winner==='candidate';
      wins+=Number(win);
      const picked=b.chosen.some(x=>x==='Charizard'||x==='Indeedee');
      selectedSetter+=Number(picked);
      weather+=Number(g.sunObserved);terrain+=Number(g.psychicTerrainObserved);
      denied+=g.priorityBlocked;megaY+=Number(g.megaCharizardObserved);
      gamesSun+=Number(g.sunObserved);winsSun+=Number(win&&g.sunObserved);
      gamesPsy+=Number(g.psychicTerrainObserved);winsPsy+=Number(win&&g.psychicTerrainObserved);
      const mine=a.chosen.slice().sort().join('/'),theirs=b.chosen.slice().sort().join('/');
      chosenOwn[mine]=(chosenOwn[mine]||0)+1;chosenEnemy[theirs]=(chosenEnemy[theirs]||0)+1;
      csv.write([name,scenario,foePolicy,ownPolicy,i,seed.join('-'),ownSide,Number(win),g.turns,
        a.chosen.join('/'),b.chosen.join('/'),a.lead,b.lead,Number(g.sunObserved),Number(g.psychicTerrainObserved),
        g.priorityBlocked,Number(g.megaCharizardObserved),g.trace.errors.length].join(',')+'\n');
      choices[[name,scenario,foePolicy,ownPolicy,i].join('|')]=Number(win);
      if(recordLog){
       fs.writeFileSync(path.join(OUT,[name,scenario,foePolicy,ownPolicy].join('_')+'.log'),
         g.log+'\nPUBLIC CHOICES\n'+JSON.stringify(g.trace,null,2));
      }
      result.games++;
     }
     result.rows.push({team:name,scenario,foePolicy,ourPolicy:ownPolicy,wins,total:perPair,
       setterSelected:selectedSetter,sunObserved:weather,psychicTerrainObserved:terrain,
       priorityBlocked:denied,megaYObserved:megaY,winsUnderSun:winsSun,gamesUnderSun:gamesSun,
       winsUnderPsychic:winsPsy,gamesUnderPsychic:gamesPsy,
       ownSelections:chosenOwn,enemySelections:chosenEnemy});
     console.log('STRATEGIC TEST '+name+' '+scenario+' enemy='+foePolicy+' own='+ownPolicy+
       ' wins='+wins+'/'+perPair+' setter='+selectedSetter+' sun='+weather+' psychic='+terrain+
       ' priorityBlocked='+denied+' megaY='+megaY);
    }
   }
  }
 }
 for(const team of Object.keys(OWN))for(const scenario of CONDITIONS)for(const foePolicy of sides){
  let winToLoss=0,lossToWin=0;
  for(let i=0;i<perPair;i++){
    const base=choices[[team,scenario,foePolicy,'stochastic',i].join('|')],changed=choices[[team,scenario,foePolicy,'strategic',i].join('|')];
    if(base===0&&changed===1)lossToWin++;
    if(base===1&&changed===0)winToLoss++;
  }
  result.pairFlips.push({team,scenario,foePolicy,lossToWin,winToLoss});
 }
 fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify(result,null,2));
 await new Promise((ok,fail)=>csv.end(e=>e?fail(e):ok()));
 console.log('STRATEGIC AUDIT COMPLETED '+result.games+' matched Showdown games');
 return result;
}
if(require.main===module)run(args(process.argv.slice(2))).catch(e=>{console.error(e.stack||String(e));process.exitCode=1;});
module.exports={run,args,legal,OWN,CONDITIONS};
