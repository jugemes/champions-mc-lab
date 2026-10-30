#!/usr/bin/env node
'use strict';
// Experimental Champions M-C runner. The AI only receives player-visible messages.
// Win rates reflect this heuristic agent versus another heuristic agent, NOT ladder rank.
const fs=require('node:fs');
const path=require('node:path');
const {variants,archetypes,scenarios}=require('./fixtures');
const {policyStatusScore,shouldScriptedSetup,shouldScriptedRegen,canonical}=require('./tactics');
const {publicThreat,defensiveCoverage}=require('./threat');
const {moveUtility,incomingRisk,knownStat}=require('./damage');
const {evaluateMove}=require('./decision-v2');
const {evaluateMoveV3}=require('./field-counterplay');
const {seededRandom,choosePreview}=require('./preview-policy');
const {chooseStrategicPreview}=require('./preview-strategic');
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
function fixedMegaAbility(dex,name){
  const sp=dex.species.get(name);
  return sp.exists&&sp.isMega?(sp.abilities['0']||''):'';
}
function nameOf(details){return String(details||'').split(',')[0].replace(/-\*/g,'').trim();}
// PR #76 P0-A: one parser for a public HP condition ("80/100 par", "0 fnt",
// "100/100"). The status suffix is what broke split('/') (80/200 par ->
// [80,NaN]). The pinned champions mod also appends a health colour at exactly
// 20% / 50% ("50/100g", "20/100r"; sim/pokemon.ts getHealth), which split('/')
// drops too. hp is null when the string carries no HP (e.g. detailschange).
const STATUSES=['slp','frz','par','brn','psn','tox'];
function parseCondition(condition){
  const s=String(condition??'').trim();
  if(/^0( fnt)?$/.test(s)||/ fnt$/.test(s))return {hp:0,fainted:true,status:''};
  const m=s.match(/^(\d+)\/(\d+)[gyr]?(?: (\w+))?$/);
  if(!m||Number(m[2])<=0)return {hp:null,fainted:false,status:''};
  return {hp:Number(m[1])/Number(m[2]),fainted:false,status:STATUSES.includes(m[3])?m[3]:''};
}
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
      - defensiveCoverage(dex,selected.map(n=>team[n]),opp)/5
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
// Switching legality from public state, not inaccessible opponent sets.
function canSwitchAgainst(dex,active,own,foeName,revealedAbility=''){
  if(active?.trapped||active?.maybeTrapped)return false;
  const us=dex.species.get(own.species),foe=dex.species.get(foeName);
  if(!us.exists||!foe.exists)return true;
  const types=us.types;
  // A disclosed Mega form has a public and fixed ability.
  const ability=canonical(revealedAbility||(foe.isMega?foe.abilities['0']:''));
  if(ability==='shadowtag'&&!types.includes('Ghost')&&canonical(own.ability)!=='shadowtag')return false;
  if(ability==='magnetpull'&&types.includes('Steel'))return false;
  if(ability==='arenatrap'&&!types.includes('Flying')&&canonical(own.ability)!=='levitate'&&own.item!=='Air Balloon')return false;
  return true;
}
class Bot{
  constructor(stream,dex,team,side,trace,forcedSelection=null,scriptScenario=null,options={}){
    this.stream=stream;this.dex=dex;this.team=team;this.side=side;
    this.foe=side==='p1'?'p2':'p1';this.opp=[];this.foeActive='';
    this.turn=0;this.lastMove='';this.switches=0;this.errors=0;this.trace=trace;
    this.forcedSelection=forcedSelection;this.scriptScenario=scriptScenario;
    this.previewPolicy=options.previewPolicy||'legacy';
    this.decisionPolicy=options.decisionPolicy||'baseline';
    // PR #70: opt-in turn-AI fix, default off so saved results replay unchanged.
    // Never pick Encore into a foe that is already Encored or has not moved
    // since it came in (Encore fails). Both read from the public log only.
    this.encoreGuard=['speed','speedSafe'].includes(options.encoreGuard)?options.encoreGuard:Boolean(options.encoreGuard);this.foePublicStatus='';this.foeConfused=false;this.foeEncored=false;this.ownEncored=false;this.ownHazards={};
    // PR #72 (PR #57 audit): opt-in, default off. A visible Mega forme has one
    // publicly fixed ability (Golisopod-Mega Tough Claws, Garchomp-Mega-Z
    // Levitate). Set it on detailschange and on switch/drag/replace back in;
    // a non-Mega forme change clears a stale ability. Only the public species
    // name on the protocol line is read.
    this.publicMegaAbility=Boolean(options.publicMegaAbility);
    // PR #76 P0-A: opt-in, default off so saved results replay unchanged.
    // publicCondition: foe HP/status from every public condition string
    // (switch/drag/replace, -damage/-heal/-sethp, faint) with parseCondition;
    // foeStatus and foePublicStatus are then always the same value.
    // ownCondition: own HP ratio in decide() parsed the same way (legacy
    // split('/') gave ratio 1 for any statused own mon).
    this.publicCondition=Boolean(options.publicCondition);this.ownCondition=Boolean(options.ownCondition);
    this.random=seededRandom(options.seed||[1,2,3,4],side);this.previewSeed=options.seed||[1,2,3,4];
    this.boosts={};this.foeBoosts={};this.foeHP=1;this.foeItem='';
    this.foeStatus='';this.foeAbility='';this.foeLastMoveTurn=-999;this.lastStatuses={};this.hazards={};this.seenMoves={};this.terrain='';this.weather='';
  }
  async run(){
    for await(const chunk of this.stream){
      for(const line of chunk.split('\n')){
        if(!line.startsWith('|'))continue;
        const a=line.split('|');
        if(a[1]==='poke'&&a[2]===this.foe)this.opp.push(nameOf(a[3]));
        if(['switch','drag','replace','detailschange'].includes(a[1])&&a[2]?.startsWith(this.foe+'a:')){
          this.foeActive=nameOf(a[3]);
          const megaAbility=this.publicMegaAbility?fixedMegaAbility(this.dex,this.foeActive):'';
          if(this.publicMegaAbility&&a[1]==='detailschange')this.foeAbility=megaAbility;
          if(a[1]!=='detailschange'){
            this.foeBoosts={};
            const hp=String(a[4]||'').match(/^(\d+)\/(\d+)/);
            this.foeHP=hp&&Number(hp[2])>0?Number(hp[1])/Number(hp[2]):1;
            this.foeItem='';this.foeStatus='';
            this.foeAbility=megaAbility;this.lastMove='';this.foeLastMoveTurn=-999;
            // speedSafe bookkeeping only: the switch line carries a public status
            // (e.g. "185/185 slp"); legacy foeStatus stays cleared as before.
            this.foePublicStatus=(String(a[4]||'').match(/ (slp|frz|par|brn|psn|tox)$/)||[])[1]||'';this.foeConfused=false;
            if(this.publicCondition){const c=parseCondition(a[4]);this.foeHP=c.hp??1;this.foeStatus=this.foePublicStatus=c.status;}
          }
        }
        if(['switch','drag','replace'].includes(a[1])&&a[2]?.startsWith(this.side+'a:')){this.boosts={};this.ownEncored=false;}
        if(['switch','drag','replace'].includes(a[1])&&a[2]?.startsWith(this.foe+'a:'))this.foeEncored=false;
        if((a[1]==='-start'||a[1]==='-end')&&/(^|: )Encore$/.test(a[3]||'')){
          if(a[2]?.startsWith(this.foe+'a:'))this.foeEncored=a[1]==='-start';
          if(a[2]?.startsWith(this.side+'a:'))this.ownEncored=a[1]==='-start';
        }
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
        if(['-enditem','-takeitem'].includes(a[1])&&a[2]?.startsWith(this.foe+'a:'))this.foeItem='';
        if(a[1]==='-ability'&&a[2]?.startsWith(this.foe+'a:'))this.foeAbility=a[3];
        // Gastro Acid style suppression is public; it ends on switch-out.
        if(this.publicMegaAbility&&a[1]==='-endability'&&a[2]?.startsWith(this.foe+'a:'))this.foeAbility='';
        if(a[1]==='-fieldstart'&&String(a[2]).startsWith('move: '))this.terrain=canonical(a[2].slice(6));
        if(['-fieldstart','-fieldend'].includes(a[1])&&a[2]==='move: Trick Room')this.trickRoom=a[1]==='-fieldstart';
        if(a[1]==='-weather')this.weather=canonical(a[2])==='none'?'':canonical(a[2]);
        if(a[1]==='-fieldend'&&canonical(String(a[2]).replace(/^move: /,''))===this.terrain)this.terrain='';
        if(a[1]==='-status'&&a[2]?.startsWith(this.foe+'a:'))this.foeStatus=this.foePublicStatus=a[3];
        if(a[1]==='-curestatus'&&a[2]?.startsWith(this.foe+'a:'))this.foeStatus=this.foePublicStatus='';
        if((a[1]==='-start'||a[1]==='-end')&&a[2]?.startsWith(this.foe+'a:')&&/^confusion$/.test(a[3]||''))this.foeConfused=a[1]==='-start';
        if(a[1]==='-sidestart'&&a[2]?.startsWith(this.foe+':')){
          const key=canonical(String(a[3]).replace(/^move: /,''));this.hazards[key]=(this.hazards[key]||0)+1;
        }
        if(a[1]==='-sideend'&&a[2]?.startsWith(this.foe+':'))delete this.hazards[canonical(String(a[3]).replace(/^move: /,''))];
        // Own-side hazards: bookkeeping only (read by audit scripts), no effect on decide().
        if(a[1]==='-sidestart'&&a[2]?.startsWith(this.side+':')){const k=canonical(String(a[3]).replace(/^move: /,''));this.ownHazards[k]=(this.ownHazards[k]||0)+1;}
        if(a[1]==='-sideend'&&a[2]?.startsWith(this.side+':'))delete this.ownHazards[canonical(String(a[3]).replace(/^move: /,''))];
        if(!this.publicCondition){
        if(a[1]==='-damage'&&a[2]?.startsWith(this.foe+'a:')){
          const pair=String(a[3]).split('/').map(Number);
          if(pair.length===2&&pair[1]>0)this.foeHP=pair[0]/pair[1];
        }
        if(a[1]==='-heal'&&a[2]?.startsWith(this.foe+'a:')){
          const pair=String(a[3]).split('/').map(Number);
          if(pair.length===2&&pair[1]>0)this.foeHP=pair[0]/pair[1];
        }
        }else{
          // The condition on these lines always carries the current public status.
          if(['-damage','-heal','-sethp'].includes(a[1])&&a[2]?.startsWith(this.foe+'a:')){
            const c=parseCondition(a[3]);if(c.hp!==null){this.foeHP=c.hp;this.foeStatus=this.foePublicStatus=c.status;}
          }
          if(a[1]==='faint'&&a[2]?.startsWith(this.foe+'a:'))this.foeHP=0;
        }
        if(a[1]==='-damage'&&line.includes('item: Rocky Helmet')&&line.includes('[of] '+this.foe+'a:'))this.foeItem='Rocky Helmet';
        if(a[1]==='move'&&a[2]?.startsWith(this.foe+'a:')){this.lastMove=a[3];this.foeLastMoveTurn=this.turn;
          const old=this.seenMoves[this.foeActive]||[];if(!old.includes(a[3]))old.push(a[3]);this.seenMoves[this.foeActive]=old;}
        if(a[1]==='move'&&a[2]?.startsWith(this.side+'a:')){
          const move=canonical(a[3]);
          if(move==='trick')this.lastStatuses.trickDone=true;
          if(['reflect','lightscreen','stealthrock'].includes(move))this.lastStatuses[move]=true;
        }
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
  // encoreGuard. Showdown Encore fails when the target is already Encored or
  // has no lastMove; lastMove is cleared on switch-in and set only by a used
  // move (a flinch / full paralysis / sleep |cant| line leaves it unset, and so
  // does foeLastMoveTurn). PR #70 (encoreGuard true) blocks every fresh foe.
  // 'speed' (PR #72): a fresh foe that publicly outspeeds us even at its
  // minimum stat moves first and sets lastMove, so Encore works unless it
  // switches; block only when we might move first. No Trick Room tracking
  // beyond the public -fieldstart line; unknown cases keep the block.
  // 'speedSafe' (PR #74, P0-A of the PR #73 review): 'speed' assumed a surely
  // faster fresh foe always acts first. It does not when it picks a negative
  // priority move (Dragon Tail -6, Trick Room -7, ...), or cannot act (asleep,
  // frozen, fully paralysed, confused self-hit): no |move|, lastMove unset,
  // Encore fails. The foe's moves are hidden, so block on what is public: the
  // species' legal move pool (dex learnset of the pinned champions mod; same as
  // TeamValidator.checkCanLearn on all 401 legal species), its possible
  // abilities, and status/confusion lines. A foe acting first with a
  // failencore move (Encore, Copycat, ...) also makes Encore fail, and Magic
  // Bounce reflects it. Accepted residual risks, shared by every move: the foe
  // switches or Protects. 'speed' is kept unchanged for PR #73 reproduction.
  encoreSafeBlock(){
    if(['slp','frz','par'].includes(this.foePublicStatus)||this.foeConfused)return true;
    const foe=this.dex.species.get(this.foeActive);if(!foe.exists)return true;
    const known=canonical(this.foeAbility);
    const abilities=known?[known]:Object.values(foe.abilities).map(canonical);
    if(abilities.some(x=>['stall','myceliummight','magicbounce'].includes(x)))return true;
    this.encoreRiskCache??={};
    if(!(foe.id in this.encoreRiskCache)){
      const pool=[...this.dex.species.getMovePool(foe.id)].map(id=>this.dex.moves.get(id));
      this.encoreRiskCache[foe.id]=pool.filter(m=>m.priority<0||(m.flags.failencore&&!['sleeptalk','struggle'].includes(m.id))).map(m=>m.name);
    }
    return this.encoreRiskCache[foe.id].length>0;
  }
  encoreWouldFail(my,side){
    if(this.foeEncored)return true;
    if(this.encoreGuard==='speedSafe'&&this.foeLastMoveTurn>=0&&this.dex.moves.get(this.lastMove).flags?.failencore)return true;
    if(this.foeLastMoveTurn>=0)return false;
    if(!['speed','speedSafe'].includes(this.encoreGuard)||this.trickRoom)return true;
    if(this.encoreGuard==='speedSafe'&&this.encoreSafeBlock())return true;
    const foe=this.dex.species.get(this.foeActive);if(!foe.exists)return true;
    const stage=n=>n>=0?(2+n)/2:2/(2-n);
    const cur=side.find(p=>p.active),ownPar=/ par$/.test(String(cur?.condition));
    // Own speed is private-known: current (Mega) forme, points, nature, Scarf.
    const scarf=canonical(cur?.item||my.item)==='choicescarf'?1.5:1;
    const own=knownStat(this.dex,{...my,species:nameOf(cur?.details)||my.species},'spe')*scarf*stage(this.boosts.spe||0)*(ownPar?0.5:1);
    const foeMin=Math.floor((foe.baseStats.spe+20)*0.9)*stage(this.foeBoosts.spe||0)*(this.foeStatus==='par'?0.5:1);
    return !(own<foeMin);
  }
  // publicMegaAbility only: the foe's public attacking ability for incomingRisk.
  attackerInfo(){return this.publicMegaAbility&&this.foeAbility?{attackerAbility:this.foeAbility}:{};}
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
      }):this.previewPolicy==='publicSix'
        // PR #76 P0-B: public-six entry point (registered robust mixture or logged legacy fallback).
        ?(this.previewLog=require('./public-six-preview').choosePublicSixPreview({dex:this.dex,own:this.team,publicSix:this.opp.slice(),seed:this.previewSeed,side:this.side})).selection
        :this.previewPolicy==='stochastic'
        ?choosePreview(this.dex,this.team,this.opp,this.random,matchup)
        :this.previewPolicy==='strategic'
          ?chooseStrategicPreview(this.dex,this.team,this.opp,this.random,matchup)
          :chooseThree(this.dex,this.team,this.opp);
      this.trace.selections.push({side:this.side,chosen:selected.map(n=>this.team[n-1].species),lead:this.team[selected[0]-1].species,...(this.previewLog?{previewLog:this.previewLog}:{})});
      return 'team '+selected.join('');
    }
    const side=req.side.pokemon;
    if(req.forceSwitch){
      const bench=side.map((p,i)=>({p,i})).filter(x=>!x.p.active&&!String(x.p.condition).endsWith(' fnt'));
      const score=p=>Math.max(...this.getSet(p).moves.map(m=>moveUtility(this.dex,this.getSet(p),this.foeActive,m,{foeItem:this.foeItem,foeAbility:this.foeAbility,foeHP:this.foeHP})))
        -75*incomingRisk(this.dex,this.getSet(p),this.foeActive,{foeBoosts:this.foeBoosts,seenMoves:this.seenMoves[this.foeActive],...this.attackerInfo()});
      bench.sort((a,b)=>score(b.p)-score(a.p));
      return bench.length?'switch '+(bench[0].i+1):'default';
    }
    const active=req.active?.[0], current=side.find(p=>p.active);
    if(!active||!current)return 'default';
    const my={...this.getSet(current),species:nameOf(current.details)};
    const available=active.moves.map((m,i)=>({m,i})).filter(x=>!x.m.disabled&&x.m.pp>0);
    if(!available.length)return 'default';
    const [selfhp,selfmax]=String(current.condition).split('/').map(Number);
    const ratio=this.ownCondition?(parseCondition(current.condition).hp??1):selfmax>0?selfhp/selfmax:1;
    if(this.scriptScenario==='stall'&&this.getSet(current).species==='Toxapex'&&this.turn===1){
      const spikes=available.find(x=>canonical(x.m.id||x.m.move)==='toxicspikes');
      if(spikes)return 'move '+(spikes.i+1);
    }
    const scripted=shouldScriptedSetup({scenario:this.scriptScenario,ownSpecies:this.getSet(current).species,foeSpecies:this.foeActive,stage:this.boosts,ratio,turn:this.turn});
    if(scripted){
      const found=available.find(x=>canonical(x.m.id||x.m.move)===scripted);
      if(found)return 'move '+(found.i+1)+(active.canMegaEvo?' mega':'');
    }
    if(shouldScriptedRegen({scenario:this.scriptScenario,ownSpecies:this.getSet(current).species,ratio,turn:this.turn,switches:this.switches})){
      const bench=side.map((p,i)=>({p,i})).filter(x=>!x.p.active&&!String(x.p.condition).endsWith(' fnt'));
      bench.sort((a,b)=>Number(this.getSet(b.p).species==='Umbreon')-Number(this.getSet(a.p).species==='Umbreon'));
      if(bench.length&&canSwitchAgainst(this.dex,active,my,this.foeActive,this.foeAbility)){this.switches++;return 'switch '+(bench[0].i+1);}
    }
    let best={score:-Infinity,i:available[0].i};
    for(const {m,i} of available){
      const def=this.dex.moves.get(m.id||m.move);
      let score=moveUtility(this.dex,my,this.foeActive,m.id||m.move,{foeItem:this.foeItem,foeAbility:this.foeAbility,foeHP:this.foeHP,boosts:this.boosts,foeBoosts:this.foeBoosts,terrain:this.terrain,weather:this.weather});
      if(def.category!=='Status'){
        // Already applied exactly once by moveUtility's public-state range calculator.
        if(def.priority>0&&this.foeHP<=0.35)score+=25;
        if(this.foeItem==='Rocky Helmet'&&def.flags?.contact)score-=32;
      }
      if(def.category==='Status')score=policyStatusScore(def.id,{
        ratio,turn:this.turn,boosts:this.boosts,foeBoosts:this.foeBoosts,foeSpecies:this.foeActive,
        foeHP:this.foeHP,foeStatus:this.foeStatus,foeLastMove:this.lastMove,
        foeLastMoveTurn:this.foeLastMoveTurn,foeAbility:this.foeAbility,
        ownItem:this.getSet(current).item,ownSpecies:my.species,
        lastStatuses:this.lastStatuses,hazards:this.hazards,
      });
      if(this.decisionPolicy==='v2'){
        score=evaluateMove(this.dex,my,this.foeActive,m.id||m.move,{
          ratio,foeHP:this.foeHP,foeItem:this.foeItem,foeAbility:this.foeAbility,
          boosts:this.boosts,foeBoosts:this.foeBoosts,foeStatus:this.foeStatus,
          foeLastMove:this.lastMove,foeLastMoveTurn:this.foeLastMoveTurn,
          seenMoves:this.seenMoves[this.foeActive]||[],turn:this.turn,terrain:this.terrain,weather:this.weather,
          available:available.map(x=>x.m.id||x.m.move),
          ownStatus:String(current.condition).includes(' brn')?'brn':'',
          lastStatuses:this.lastStatuses,hazards:this.hazards
        });
      }
      if(this.decisionPolicy==='v3'){
        score=evaluateMoveV3(this.dex,my,this.foeActive,m.id||m.move,{
          ratio,foeHP:this.foeHP,foeItem:this.foeItem,foeAbility:this.foeAbility,
          boosts:this.boosts,foeBoosts:this.foeBoosts,foeStatus:this.foeStatus,
          foeLastMove:this.lastMove,foeLastMoveTurn:this.foeLastMoveTurn,
          seenMoves:this.seenMoves[this.foeActive]||[],turn:this.turn,
          terrain:this.terrain,weather:this.weather,
          available:available.map(x=>x.m.id||x.m.move),
          ownStatus:String(current.condition).includes(' brn')?'brn':'',
          lastStatuses:this.lastStatuses,hazards:this.hazards
        });
      }
      if(this.encoreGuard&&canonical(m.id||m.move)==='encore'&&this.encoreWouldFail(my,side))score=-Infinity;
      if(score>best.score)best={score,i};
    }
    const bench=side.map((p,i)=>({p,i})).filter(x=>!x.p.active&&!String(x.p.condition).endsWith(' fnt'));
    if(canSwitchAgainst(this.dex,active,my,this.foeActive,this.foeAbility)&&bench.length&&this.switches<3){
      const riskOf=p=>incomingRisk(this.dex,this.getSet(p),this.foeActive,{foeBoosts:this.foeBoosts,seenMoves:this.seenMoves[this.foeActive],...this.attackerInfo()});
      const score=p=>Math.max(...this.getSet(p).moves.map(m=>moveUtility(this.dex,this.getSet(p),this.foeActive,m,{foeItem:this.foeItem,foeAbility:this.foeAbility,foeHP:this.foeHP}))) - 80*riskOf(p);
      const currentRisk=incomingRisk(this.dex,my,this.foeActive,{foeBoosts:this.foeBoosts,seenMoves:this.seenMoves[this.foeActive],...this.attackerInfo()});
      bench.sort((a,b)=>score(b.p)-score(a.p));
      if(score(bench[0].p)>Math.max(25,best.score+18)
        && (riskOf(bench[0].p)<currentRisk*0.70||ratio<0.25)
        && riskOf(bench[0].p)<0.85){
        this.switches++;return 'switch '+(bench[0].i+1);
      }
    }
    return 'move '+(best.i+1)+(active.canMegaEvo?' mega':'');
  }
}
async function game(sim,one,two,seed,captureLog,scenario,reverse,options={}){
  const streams=sim.getPlayerStreams(new sim.BattleStream({noCatch:true}));
  const dex=sim.Dex.mod('champions');
  const trace={choices:[],selections:[],errors:[]};
  const stress=scenario==null?null:scenarios[scenario];
  if(scenario!=null&&!stress)throw Error('Unknown scenario '+scenario);
  const b1=new Bot(streams.p1,dex,one,'p1',trace,reverse?stress?.chosen:null,reverse?(stress?.scriptAs||scenario):null,{...options,decisionPolicy:reverse?(options.opponentDecisionPolicy||options.decisionPolicy):(options.candidateDecisionPolicy||options.decisionPolicy),previewPolicy:reverse?(options.opponentPreviewPolicy||options.previewPolicy):(options.candidatePreviewPolicy||options.previewPolicy),seed});
  const b2=new Bot(streams.p2,dex,two,'p2',trace,reverse?null:stress?.chosen,reverse?null:(stress?.scriptAs||scenario),{...options,decisionPolicy:reverse?(options.candidateDecisionPolicy||options.decisionPolicy):(options.opponentDecisionPolicy||options.decisionPolicy),previewPolicy:reverse?(options.candidatePreviewPolicy||options.previewPolicy):(options.opponentPreviewPolicy||options.previewPolicy),seed});
  const logs=[];let winner='',turns=0,rainObserved=false,sunObserved=false,psychicTerrainObserved=false,priorityBlocked=0,megaCharizardObserved=false;
  const oppSide=reverse?'p1':'p2';
  let opponentSetupMoves=0,opponentToxicSpikes=0,regenSwitchOuts=0;
  let opponentActive='',opponentActiveHP=1;
  const observer=(async()=>{for await(const msg of streams.omniscient){
    if(captureLog)logs.push(msg);
    if(msg.includes('|-weather|RainDance'))rainObserved=true;
    if(msg.includes('|-weather|SunnyDay'))sunObserved=true;
    if(msg.includes('|-fieldstart|move: Psychic Terrain'))psychicTerrainObserved=true;
    if(msg.includes('Charizard-Mega-Y'))megaCharizardObserved=true;
    priorityBlocked+=(msg.match(/\|-activate\|[^\n]*\|move: Psychic Terrain/g)||[]).length;
    for(const line of msg.split('\n')){
      if(line.startsWith('|win|'))winner=line.slice(5);
      if(line.startsWith('|turn|'))turns=Number(line.slice(6));
      const a=line.split('|');
      if(a[1]==='move'&&a[2]?.startsWith(oppSide+'a:')){
        if(['Dragon Dance','Quiver Dance','Swords Dance','Nasty Plot'].includes(a[3]))opponentSetupMoves++;
        if(a[3]==='Toxic Spikes')opponentToxicSpikes++;
      }
      if(a[1]==='-damage'&&a[2]?.startsWith(oppSide+'a:')){
        const pair=String(a[3]).split('/').map(Number);
        if(pair.length===2&&pair[1]>0)opponentActiveHP=pair[0]/pair[1];
      }
      if(a[1]==='switch'&&a[2]?.startsWith(oppSide+'a:')){
        if(opponentActive==='Toxapex'&&opponentActiveHP<0.84&&opponentActiveHP>0)regenSwitchOuts++;
        opponentActive=nameOf(a[3]);const pair=String(a[4]).split('/').map(Number);
        opponentActiveHP=pair.length===2&&pair[1]>0?pair[0]/pair[1]:1;
      }
    }
  }})();
  const run1=b1.run(),run2=b2.run();
  await streams.omniscient.write('>start '+JSON.stringify({formatid:FORMAT,seed})+'\n>player p1 '+JSON.stringify({name:'candidate',team:normalize(one)})+'\n>player p2 '+JSON.stringify({name:'opponent',team:normalize(two)}));
  await Promise.all([observer,run1,run2]);
  if(!winner)throw Error('Game had no winner. Errors: '+JSON.stringify(trace.errors));
  if(stress?.mustSeeRain&&!rainObserved)throw Error('Rain stress test did not activate rain!');
  const enemy=reverse?'p1':'p2';
  const selected=trace.selections.find(x=>x.side===enemy);
  if(stress&&(!selected||selected.chosen.join('/')!==stress.chosen.join('/')))throw Error('Forced scenario selection failed');
  return {winner,turns,trace,log:logs.join('\n'),rainObserved,sunObserved,psychicTerrainObserved,priorityBlocked,megaCharizardObserved,opponentSetupMoves,opponentToxicSpikes,regenSwitchOuts};
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
  const rows=[],header=['variant','archetype','index','seed','side','win','turns','selection','errors','rain_observed','opponent_setup_moves','opponent_toxic_spikes','regen_switchouts'];
  for(const [name,team] of Object.entries(variants))for(const [match,opponent] of Object.entries(archetypes)){
    let wins=0;
    for(let i=0;i<cfg.count;i++){
      const seed=hashSeed(100000+archetypeIndex(match)*20000+i),reverse=Boolean(i%2);
      const g=reverse?await game(sim,opponent,team,seed,i<cfg.logs,match,true):await game(sim,team,opponent,seed,i<cfg.logs,match,false);
      const own=reverse?'p2':'p1';
      const won=g.winner==='candidate'&&!reverse||g.winner==='opponent'&&reverse;
      wins+=Number(won);
      rows.push([name,match,i,seed.join('-'),own,Number(won),g.turns,JSON.stringify(g.trace.selections.find(s=>s.side===own)||{}),g.trace.errors.length,Number(g.rainObserved),g.opponentSetupMoves,g.opponentToxicSpikes,g.regenSwitchOuts]);
      if(i<cfg.logs)fs.writeFileSync(path.join(out,name+'_'+match+'_'+i+'.log'),g.log+'\nCHOICES\n'+JSON.stringify(g.trace,null,2));
    }
    const focused=rows.filter(r=>r[0]===name&&r[1]===match);
    const extras=' setup='+focused.reduce((n,r)=>n+r[10],0)+' toxspikes='+focused.reduce((n,r)=>n+r[11],0)+' regenSwitch='+focused.reduce((n,r)=>n+r[12],0);
    if(scenarios[match].mustSeeSetup&&!focused.some(r=>r[10]>0))throw Error('NO ACTUAL SETUP MOVE OBSERVED for '+name);
    if(match==='stall'&&!focused.some(r=>r[11]>0))throw Error('NO ACTUAL STALL HAZARD OBSERVED for '+name);
    console.log(name+'/'+match+' '+wins+'/'+cfg.count+' '+extras+' (SCRIPTED STRESS TEST; HEURISTIC AI ONLY)');
  }
  fs.writeFileSync(path.join(out,'results.csv'),[header,...rows].map(r=>r.map(csv).join(',')).join('\n')+'\n');
  fs.writeFileSync(path.join(out,'experiment.json'),JSON.stringify({format:FORMAT,versions:'see showdown-commit.txt',note:'FIXED three-member synthetic opponent scenarios, noncompetitive heuristic AI; NOT ladder win rates',count:cfg.count},null,2));
}
function archetypeIndex(k){return Object.keys(archetypes).indexOf(k);}
if(require.main===module)main().catch(err=>{console.error(err.stack||String(err));process.exitCode=1;});
module.exports={prelim,normalize,hashSeed,args,matchup,chooseThree,Bot,load,check,game,canSwitchAgainst,fixedMegaAbility,parseCondition};
