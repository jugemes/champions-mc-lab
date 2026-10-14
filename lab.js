#!/usr/bin/env node
'use strict';
// Experimental Champions M-C runner. The AI only receives player-visible messages.
// Win rates reflect this heuristic agent versus another heuristic agent, NOT ladder rank.
const fs=require('node:fs');
const path=require('node:path');
const {variants,archetypes,scenarios}=require('./fixtures');
const FORMAT='gen9championsbssregmc';
const STAT=['hp','atk','def','spa','spd','spe'];
const root=__dirname;
const all={...variants,...archetypes};
function normalize(team){
  return team.map(s=>({
    name:s.species,species:s.species,item:s.item,ability:s.ability,nature:s.nature,
    level:50,moves:s.moves,
    evs:Object.fromEntries(STAT.map(k=>[k,s.evs[k]||0])),
    ivs:Object.fromEntries(STAT.map(k=>[k,31]))
  }));
}
function prelim(team,label){
  if(team.length!==6)throw Error(label+': must have 6 Pokemon');
  const items=new Set(),species=new Set();
  for(const p of team){
    const total=STAT.reduce((v,k)=>v+(p.evs[k]||0),0);
    if(total!==66)throw Error(label+'/'+p.species+': '+total+' points (expected 66)');
    if(STAT.some(k=>!Number.isInteger(p.evs[k]||0)||(p.evs[k]||0)<0||(p.evs[k]||0)>32))throw Error(label+'/'+p.species+': invalid stat points');
    if(p.moves.length!==4)throw Error(label+'/'+p.species+': needs four moves');
    if(items.has(p.item)||species.has(p.species))throw Error(label+': duplicate species or item');
    if(p.item==='Assault Vest')throw Error(label+': Assault Vest unavailable');
    items.add(p.item);species.add(p.species);
  }
}
function load(){
  const dir=process.env.SHOWDOWN_DIR;
  if(!dir)throw Error('Set SHOWDOWN_DIR to an already built Pokemon Showdown directory');
  const built=path.join(dir,'dist','sim','index.js');
  if(!fs.existsSync(built))throw Error('Showdown missing '+built);
  return require(built);
}
function check(sim){
  if(!sim.Dex.formats.get(FORMAT).exists)throw Error('Format '+FORMAT+' not found');
  const validator=sim.TeamValidator.get(FORMAT);
  const bad=[];
  for(const [name,team] of Object.entries(all)){
    try { prelim(team,name); const problems=validator.validateTeam(normalize(team));
      if(problems?.length)bad.push(name+': '+problems.join('; '));
    } catch(err){bad.push(name+': '+err.message);}
  }
  if(bad.length)throw Error('Illegal teams ('+bad.length+'):\n'+bad.join('\n'));
  console.log('LEGALITY CHECK PASSED: '+Object.keys(all).length+' teams');
}
function hashSeed(n){let x=n+1;const r=[];for(let i=0;i<4;i++){x=(Math.imul(x^x>>>16,0x7feb352d))>>>0;x=(Math.imul(x^x>>>15,0x846ca68b))>>>0;r.push(x&65535);x=(x+0x9e3779b9)>>>0;}return r;}
function nameOf(details){return String(details||'').split(',')[0].replace(/-\*/g,'').trim();}
function matchup(dex,p,foe,move){
  const m=dex.moves.get(move);
  if(!m.exists||m.category==='Status')return 0;
  const a=dex.species.get(p.species),b=dex.species.get(foe);
  const power=m.basePower||60;
  const stab=a.types.includes(m.type)?1.5:1;
  const effective=b.exists?(dex.getImmunity(m.type,b.types)?2**dex.getEffectiveness(m.type,b.types):0):1;
  const attack=m.category==='Physical'?a.baseStats.atk:a.baseStats.spa;
  const defend=b.exists?(m.category==='Physical'?b.baseStats.def:b.baseStats.spd):100;
  return power*stab*effective*(attack/Math.max(40,defend))*(typeof m.accuracy==='number'?m.accuracy/100:1);
}
function maxHit(dex,p,foe){return Math.max(...p.moves.map(m=>matchup(dex,p,foe,m)));}
function chooseThree(dex,team,opp){
  let best=-Infinity,chosen=[1,2,3];
  for(let i=0;i<6;i++)for(let j=i+1;j<6;j++)for(let k=j+1;k<6;k++){
    const selected=[i,j,k];
    const cov=opp.map(f=>Math.max(...selected.map(n=>maxHit(dex,team[n],f))));
    const score=cov.reduce((x,y)=>x+y,0)/(cov.length||1)
      + (selected.some(n=>team[n].item==='Choice Scarf')?8:0)
      - (selected.filter(n=>Boolean(dex.items.get(team[n].item).megaStone)).length>1?25:0);
    if(score>best){
      best=score;
      selected.sort((a,b)=>opp.reduce((s,f)=>s+maxHit(dex,team[b],f)-maxHit(dex,team[a],f),0));
      chosen=selected.map(n=>n+1);
    }
  }
  return chosen;
}
class Bot{
  constructor(stream,dex,team,side,trace,forcedSelection=null){
    this.stream=stream;this.dex=dex;this.team=team;this.side=side;
    this.foe=side==='p1'?'p2':'p1';this.opp=[];this.foeActive='';
    this.turn=0;this.lastMove='';this.switches=0;this.errors=0;this.trace=trace;
    this.forcedSelection=forcedSelection;this.boosts={};this.foeBoosts={};this.foeHP=1;this.foeItem='';
  }
  async run(){
    for await(const chunk of this.stream){
      for(const line of chunk.split('\n')){
        if(!line.startsWith('|'))continue;
        const a=line.split('|');
        if(a[1]==='poke'&&a[2]===this.foe)this.opp.push(nameOf(a[3]));
        if(['switch','drag','replace','detailschange'].includes(a[1])&&a[2]?.startsWith(this.foe+'a:')){
          this.foeActive=nameOf(a[3]);
          if(a[1]!=='detailschange'){this.foeBoosts={};this.foeHP=1;this.foeItem='';}
        }
        if(['switch','drag','replace'].includes(a[1])&&a[2]?.startsWith(this.side+'a:'))this.boosts={};
        if(['-boost','-unboost','-setboost'].includes(a[1])){
          const target=a[2]?.startsWith(this.side+'a:')?this.boosts:a[2]?.startsWith(this.foe+'a:')?this.foeBoosts:null;
          if(target){
            const stat=a[3],value=Number(a[4])||0;
            target[stat]=Math.max(-6,Math.min(6,a[1]==='-setboost'?value:(target[stat]||0)+(a[1]==='-boost'?value:-value)));
          }
        }
        if(a[1]==='-clearallboost'){this.boosts={};this.foeBoosts={};}
        if(a[1]==='-clearboost'&&a[2]?.startsWith(this.side+'a:'))this.boosts={};
        if(a[1]==='-clearboost'&&a[2]?.startsWith(this.foe+'a:'))this.foeBoosts={};
        if(a[1]==='-item'&&a[2]?.startsWith(this.foe+'a:'))this.foeItem=a[3];
        if(a[1]==='-damage'&&a[2]?.startsWith(this.foe+'a:')){
          const pair=String(a[3]).split('/').map(Number);
          if(pair.length===2&&pair[1]>0)this.foeHP=pair[0]/pair[1];
        }
        if(a[1]==='-heal'&&a[2]?.startsWith(this.foe+'a:')){
          const pair=String(a[3]).split('/').map(Number);
          if(pair.length===2&&pair[1]>0)this.foeHP=pair[0]/pair[1];
        }
        if(a[1]==='-damage'&&line.includes('item: Rocky Helmet')&&line.includes('[of] '+this.foe+'a:'))this.foeItem='Rocky Helmet';
        if(a[1]==='move'&&a[2]?.startsWith(this.foe+'a:'))this.lastMove=a[3];
        if(a[1]==='turn')this.turn=Number(a[2]);
        if(a[1]==='error'){this.errors++;this.trace.errors.push({side:this.side,line});if(this.errors>4)throw Error('Repeated unavailable choices: '+line);}
        if(a[1]==='request'){
          const req=JSON.parse(line.slice(9));if(req.wait)continue;
          const choice=this.decide(req);
          this.trace.choices.push({side:this.side,turn:this.turn,choice});
          await this.stream.write(choice);
        }
      }
    }
  }
  getSet(p){
    const name=nameOf(p.details);
    const base=this.dex.species.get(name).baseSpecies||name;
    const found=this.team.find(x=>x.species===name||x.species===base);
    if(!found)throw Error('No known set for active '+name+' on '+this.side);
    return found;
  }
  decide(req){
    if(this.errors>0){this.errors=0;return 'default';}
    if(req.teamPreview){
      const selected=this.forcedSelection?this.forcedSelection.map(name=>{
        const index=this.team.findIndex(x=>x.species===name);
        if(index<0)throw Error('Scenario member not in team: '+name);
        return index+1;
      }):chooseThree(this.dex,this.team,this.opp);
      this.trace.selections.push({side:this.side,chosen:selected.map(n=>this.team[n-1].species),lead:this.team[selected[0]-1].species});
      return 'team '+selected.join('');
    }
    const side=req.side.pokemon;
    if(req.forceSwitch){
      const bench=side.map((p,i)=>({p,i})).filter(x=>!x.p.active&&!String(x.p.condition).endsWith(' fnt'));
      bench.sort((a,b)=>maxHit(this.dex,this.getSet(b.p),this.foeActive)-maxHit(this.dex,this.getSet(a.p),this.foeActive));
      return bench.length?'switch '+(bench[0].i+1):'default';
    }
    const active=req.active?.[0], current=side.find(p=>p.active);
    if(!active||!current)return 'default';
    const my={...this.getSet(current),species:nameOf(current.details)};
    const available=active.moves.map((m,i)=>({m,i})).filter(x=>!x.m.disabled&&x.m.pp>0);
    if(!available.length)return 'default';
    let best={score:-Infinity,i:available[0].i};
    for(const {m,i} of available){
      const def=this.dex.moves.get(m.id||m.move);
      let score=matchup(this.dex,my,this.foeActive,m.id||m.move);
      if(def.category!=='Status'){
        const stat=def.category==='Physical'?'atk':'spa';
        const stage=this.boosts[stat]||0,foeStage=this.foeBoosts[def.category==='Physical'?'def':'spd']||0;
        const scale=n=>n>=0?(2+n)/2:2/(2-n);
        score*=scale(stage)/scale(foeStage);
        if(def.priority>0&&this.foeHP<=0.35)score+=25;
        if(this.foeItem==='Rocky Helmet'&&def.flags?.contact)score-=32;
      }
      const [hp,maxhp]=String(current.condition).split('/').map(Number);
      const ratio=maxhp>0?hp/maxhp:1;
      if(def.category==='Status'){
        score=0;
        if(['slackoff','recover','roost','softboiled'].includes(def.id))score=ratio<0.5?240:ratio<0.72?85:0;
        if(['swordsdance','nastyplot','dragondance','quiverdance'].includes(def.id))score=ratio>0.7&&this.turn<=3?95:5;
        if(def.id==='trick')score=this.turn<5?48:6;
        if(def.id==='haze')score=Math.max(this.foeBoosts.atk||0,this.foeBoosts.spa||0,this.foeBoosts.spe||0)>=2?140:0;
        if(def.id==='encore')score=['swordsdance','dragondance','quiverdance','recover','roost','slackoff'].includes(this.lastMove.toLowerCase().replace(/[^a-z]/g,''))?150:0;
        if(['stealthrock','reflect','lightscreen'].includes(def.id))score=this.turn<3?68:3;
        if(['willowisp','thunderwave','toxic'].includes(def.id))score=35;
      }
      if(score>best.score)best={score,i};
    }
    const bench=side.map((p,i)=>({p,i})).filter(x=>!x.p.active&&!String(x.p.condition).endsWith(' fnt'));
    if(!active.trapped&&bench.length&&this.switches<3){
      bench.sort((a,b)=>maxHit(this.dex,this.getSet(b.p),this.foeActive)-maxHit(this.dex,this.getSet(a.p),this.foeActive));
      if(maxHit(this.dex,this.getSet(bench[0].p),this.foeActive)>Math.max(70,best.score*1.65+25)){
        this.switches++;return 'switch '+(bench[0].i+1);
      }
    }
    return 'move '+(best.i+1)+(active.canMegaEvo?' mega':'');
  }
}
async function game(sim,one,two,seed,captureLog,scenario,reverse){
  const streams=sim.getPlayerStreams(new sim.BattleStream({noCatch:true}));
  const dex=sim.Dex.mod('champions');
  const trace={choices:[],selections:[],errors:[]};
  const stress=scenarios[scenario];
  if(!stress)throw Error('Unknown scenario '+scenario);
  const b1=new Bot(streams.p1,dex,one,'p1',trace,reverse?stress.chosen:null);
  const b2=new Bot(streams.p2,dex,two,'p2',trace,reverse?null:stress.chosen);
  const logs=[];let winner='',turns=0,rainObserved=false;
  const observer=(async()=>{for await(const msg of streams.omniscient){
    if(captureLog)logs.push(msg);
    if(msg.includes('|-weather|RainDance'))rainObserved=true;
    for(const line of msg.split('\n')){
      if(line.startsWith('|win|'))winner=line.slice(5);
      if(line.startsWith('|turn|'))turns=Number(line.slice(6));
    }
  }})();
  const run1=b1.run(),run2=b2.run();
  await streams.omniscient.write('>start '+JSON.stringify({formatid:FORMAT,seed})+'\n>player p1 '+JSON.stringify({name:'candidate',team:normalize(one)})+'\n>player p2 '+JSON.stringify({name:'opponent',team:normalize(two)}));
  await Promise.all([observer,run1,run2]);
  if(!winner)throw Error('Game had no winner. Errors: '+JSON.stringify(trace.errors));
  if(stress.mustSeeRain&&!rainObserved)throw Error('Rain stress test did not activate rain!');
  const enemy=reverse?'p1':'p2';
  const selected=trace.selections.find(x=>x.side===enemy);
  if(!selected||selected.chosen.join('/')!==stress.chosen.join('/'))throw Error('Forced scenario selection failed');
  return {winner,turns,trace,log:logs.join('\n'),rainObserved};
}
function args(argv){let count=1,logs=1,checkOnly=false;for(let i=0;i<argv.length;i++){
  if(argv[i]==='--check')checkOnly=true;
  else if(argv[i]==='--count')count=Number(argv[++i]);
  else if(argv[i]==='--logs')logs=Number(argv[++i]);
  else throw Error('Unknown argument: '+argv[i]);
}
  if(!Number.isInteger(count)||count<1||count>10000||!Number.isInteger(logs)||logs<0)throw Error('Bad count/logs');
  return {count,logs,checkOnly};
}
const csv=v=>{let s=String(v??'');return /[,"\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
async function main(){
  const cfg=args(process.argv.slice(2)),sim=load();check(sim);
  if(cfg.checkOnly)return;
  const out=path.join(root,'output');fs.mkdirSync(out,{recursive:true});
  const rows=[],header=['variant','archetype','index','seed','side','win','turns','selection','errors','rain_observed'];
  for(const [name,team] of Object.entries(variants))for(const [match,opponent] of Object.entries(archetypes)){
    let wins=0;
    for(let i=0;i<cfg.count;i++){
      const seed=hashSeed(100000+archetypeIndex(match)*20000+i),reverse=Boolean(i%2);
      const g=reverse?await game(sim,opponent,team,seed,i<cfg.logs,match,true):await game(sim,team,opponent,seed,i<cfg.logs,match,false);
      const own=reverse?'p2':'p1';
      const won=g.winner==='candidate'&&!reverse||g.winner==='opponent'&&reverse;
      wins+=Number(won);
      rows.push([name,match,i,seed.join('-'),own,Number(won),g.turns,JSON.stringify(g.trace.selections.find(s=>s.side===own)||{}),g.trace.errors.length,Number(g.rainObserved)]);
      if(i<cfg.logs)fs.writeFileSync(path.join(out,name+'_'+match+'_'+i+'.log'),g.log+'\nCHOICES\n'+JSON.stringify(g.trace,null,2));
    }
    console.log(name+'/'+match+' '+wins+'/'+cfg.count+' (FIXED-SCENARIO STRESS TEST; HEURISTIC AI ONLY)');
  }
  fs.writeFileSync(path.join(out,'results.csv'),[header,...rows].map(r=>r.map(csv).join(',')).join('\n')+'\n');
  fs.writeFileSync(path.join(out,'experiment.json'),JSON.stringify({format:FORMAT,versions:'see showdown-commit.txt',note:'FIXED three-member synthetic opponent scenarios, noncompetitive heuristic AI; NOT ladder win rates',count:cfg.count},null,2));
}
function archetypeIndex(k){return Object.keys(archetypes).indexOf(k);}
if(require.main===module)main().catch(err=>{console.error(err.stack||String(err));process.exitCode=1;});
module.exports={prelim,normalize,hashSeed,args};
