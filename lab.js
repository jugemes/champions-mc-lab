#!/usr/bin/env node
'use strict';
// Experimental Champions M-C runner. The AI only receives player-visible messages.
// Win rates reflect this heuristic agent versus another heuristic agent, NOT ladder rank.
const fs=require('node:fs');
const path=require('node:path');
const {variants,archetypes,scenarios}=require('./fixtures');
const {policyStatusScore,shouldScriptedSetup,shouldScriptedRegen,canonical}=require('./tactics');
const {publicThreat,defensiveCoverage}=require('./threat');
const {moveUtility,incomingRisk}=require('./damage');
const {evaluateMove}=require('./decision-v2');
const {evaluateMoveV3}=require('./field-counterplay');
const rational=require('./decision-rational');
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
    this.random=seededRandom(options.seed||[1,2,3,4],side);
    this.boosts={};this.foeBoosts={};this.foeHP=1;this.foeItem='';
    this.foeStatus='';this.foeAbility='';this.foeLastMoveTurn=-999;this.lastStatuses={};this.hazards={};this.seenMoves={};this.terrain='';this.weather='';
    // Public memory used only by decisionPolicy 'rational' (baseline ignores it).
    this.foeMemory={};this.observedImmune={};this.ownEncored=false;this.foeEncored=false;this.lastOwnMove='';
    this.history=[];this.rationalSwitches=0;this.logMatrix=Boolean(options.logMatrix);
    // rational2 only: public own-side hazards/volatiles, observed own hits,
    // foe recovery uses, and the voluntary-switch streak against one foe.
    this.rationalV2=this.decisionPolicy==='rational2';
    this.loopSamples=Number(options.loopSamples||process.env.RATIONAL2_LOOP_SAMPLES||1);
    this.ownHazards={};this.ownVolatiles={};this.lastHit={};this.pendingHit=null;this.recoveryUses={};
    this.foeEncoreTurn=-999;this.switchStreak={foe:'',n:0,stint:0};
  }
  async run(){
    for await(const chunk of this.stream){
      for(const line of chunk.split('\n')){
        if(!line.startsWith('|'))continue;
        const a=line.split('|');
        if(a[1]==='poke'&&a[2]===this.foe)this.opp.push(nameOf(a[3]));
        if(['switch','drag','replace','detailschange'].includes(a[1])&&a[2]?.startsWith(this.foe+'a:')){
          this.foeActive=nameOf(a[3]);
          if(a[1]!=='detailschange'){
            this.foeBoosts={};
            const hp=String(a[4]||'').match(/^(\d+)\/(\d+)/);
            this.foeHP=hp&&Number(hp[2])>0?Number(hp[1])/Number(hp[2]):1;
            this.foeItem='';this.foeStatus='';
            this.foeAbility='';this.lastMove='';this.foeLastMoveTurn=-999;
          }
        }
        if(['switch','drag','replace'].includes(a[1])&&a[2]?.startsWith(this.side+'a:')){this.boosts={};this.ownEncored=false;this.ownVolatiles={};}
        if(['switch','drag','replace','detailschange'].includes(a[1])&&a[2]?.startsWith(this.side+'a:'))this.ownForm=nameOf(a[3]);
        if(['switch','drag','replace'].includes(a[1])&&a[2]?.startsWith(this.foe+'a:')){this.foeEncored=false;
          if(this.switchStreak.foe!==nameOf(a[3]))this.switchStreak={foe:nameOf(a[3]),n:0,stint:0};}
        if(['-start','-end'].includes(a[1])&&canonical(String(a[3]).replace(/^move: /,''))==='encore'){
          if(a[2]?.startsWith(this.side+'a:'))this.ownEncored=a[1]==='-start';
          if(a[2]?.startsWith(this.foe+'a:')){this.foeEncored=a[1]==='-start';if(a[1]==='-start')this.foeEncoreTurn=this.turn;}
        }
        if(['-start','-end'].includes(a[1])&&a[2]?.startsWith(this.side+'a:')){
          const v=canonical(String(a[3]).replace(/^move: /,''));
          if(['encore','taunt','disable'].includes(v))this.ownVolatiles[v]=a[1]==='-start';
        }
        if(a[1]==='-sidestart'&&a[2]?.startsWith(this.side+':')){
          const key=canonical(String(a[3]).replace(/^move: /,''));this.ownHazards[key]=(this.ownHazards[key]||0)+1;
        }
        if(a[1]==='-sideend'&&a[2]?.startsWith(this.side+':'))delete this.ownHazards[canonical(String(a[3]).replace(/^move: /,''))];
        if(a[1]==='-crit'&&a[2]?.startsWith(this.foe+'a:')&&this.pendingHit)this.pendingHit.crit=true;
        if(a[1]==='-damage'&&a[2]?.startsWith(this.foe+'a:')&&!line.includes('[from]')&&this.pendingHit){
          const pair=String(a[3]).split('/').map(Number),after=pair.length===2&&pair[1]>0?pair[0]/pair[1]:0;
          const h={...this.pendingHit,dealt:this.pendingHit.before-after};
          if(!h.crit)this.lastHit[h.foe+'|'+h.move]=h.dealt;
          this.trace.hits=(this.trace.hits||[]).concat({side:this.side,turn:this.turn,own:h.own,move:h.move,foe:h.foe,before:+h.before.toFixed(3),dealt:+h.dealt.toFixed(3),crit:Boolean(h.crit),boosts:{...this.boosts},foeBoosts:{...this.foeBoosts}});
          this.pendingHit=null;
        }
        if(a[1]==='move'&&a[2]?.startsWith(this.foe+'a:')&&rational.RECOVERY.has(canonical(a[3]))){
          const k=this.foeActive+'|'+canonical(a[3]);this.recoveryUses[k]=(this.recoveryUses[k]||0)+1;}
        if(a[1]==='-immune'&&a[2]?.startsWith(this.foe+'a:')&&this.lastOwnMove){
          const list=this.observedImmune[this.foeActive]||(this.observedImmune[this.foeActive]=[]);
          if(!list.includes(this.lastOwnMove))list.push(this.lastOwnMove);
        }
        {const mem=this.foeMemory[this.foeActive]||(this.foeMemory[this.foeActive]={});
          const from=line.match(/\[from\] (item|ability): ([^|]+)\|\[of\] (p[12])a:/);
          if(from&&from[3]===this.foe)mem[from[1]]=from[2].trim();
          if(a[1]==='-item'&&a[2]?.startsWith(this.foe+'a:'))mem.item=a[3];
          if(['-enditem','-takeitem'].includes(a[1])&&a[2]?.startsWith(this.foe+'a:'))mem.item='';
          if(a[1]==='-ability'&&a[2]?.startsWith(this.foe+'a:'))mem.ability=a[3];}
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
        if(a[1]==='-fieldstart'&&String(a[2]).startsWith('move: '))this.terrain=canonical(a[2].slice(6));
        if(a[1]==='-weather')this.weather=canonical(a[2])==='none'?'':canonical(a[2]);
        if(a[1]==='-fieldend'&&canonical(String(a[2]).replace(/^move: /,''))===this.terrain)this.terrain='';
        if(a[1]==='-status'&&a[2]?.startsWith(this.foe+'a:'))this.foeStatus=a[3];
        if(a[1]==='-curestatus'&&a[2]?.startsWith(this.foe+'a:'))this.foeStatus='';
        if(a[1]==='-sidestart'&&a[2]?.startsWith(this.foe+':')){
          const key=canonical(String(a[3]).replace(/^move: /,''));this.hazards[key]=(this.hazards[key]||0)+1;
        }
        if(a[1]==='-sideend'&&a[2]?.startsWith(this.foe+':'))delete this.hazards[canonical(String(a[3]).replace(/^move: /,''))];
        if(a[1]==='-damage'&&a[2]?.startsWith(this.foe+'a:')){
          const pair=String(a[3]).split('/').map(Number);
          if(pair.length===2&&pair[1]>0)this.foeHP=pair[0]/pair[1];
        }
        if(a[1]==='-heal'&&a[2]?.startsWith(this.foe+'a:')){
          const pair=String(a[3]).split('/').map(Number);
          if(pair.length===2&&pair[1]>0)this.foeHP=pair[0]/pair[1];
        }
        if(a[1]==='-damage'&&line.includes('item: Rocky Helmet')&&line.includes('[of] '+this.foe+'a:'))this.foeItem='Rocky Helmet';
        if(a[1]==='move'&&a[2]?.startsWith(this.foe+'a:')){this.lastMove=a[3];this.foeLastMoveTurn=this.turn;
          const old=this.seenMoves[this.foeActive]||[];if(!old.includes(a[3]))old.push(a[3]);this.seenMoves[this.foeActive]=old;}
        if(a[1]==='move'&&a[2]?.startsWith(this.side+'a:')){
          const move=canonical(a[3]);this.lastOwnMove=move;
          this.pendingHit={own:this.ownForm||'',move,foe:this.foeActive,before:this.foeHP};
          if(move==='trick')this.lastStatuses.trickDone=true;
          if(['reflect','lightscreen','stealthrock'].includes(move))this.lastStatuses[move]=true;
        }
        if(a[1]==='turn'){this.turn=Number(a[2]);this.pendingHit=null;}
        if(a[1]==='error'){this.errors++;this.trace.errors.push({side:this.side,line});if(this.errors>4)throw Error('Repeated unavailable choices: '+line);}
        if(a[1]==='request'){
          const req=JSON.parse(line.slice(9));if(req.wait)continue;
          const choice=this.decide(req);
          this.trace.choices.push({side:this.side,turn:this.turn,choice});
          if(!req.teamPreview&&!req.forceSwitch&&req.active){
            const cur=req.side.pokemon.find(p=>p.active),[hp,max]=String(cur?.condition).split('/').map(Number);
            this.history.push({turn:this.turn,foe:this.foeActive,foeHP:this.foeHP,ratio:max>0?hp/max:0,kind:choice.startsWith('switch')?'switch':'move'});
            if(this.rationalV2){
              // Ping-pong memory: consecutive voluntary switches into the same foe.
              if(this.switchStreak.foe!==this.foeActive)this.switchStreak={foe:this.foeActive,n:0,stint:0};
              if(choice.startsWith('switch')){this.switchStreak.n++;this.switchStreak.stint++;this.switchStreak.left=nameOf(cur?.details);}
              else this.switchStreak.n=0;
            }
          }
          await this.stream.write(choice);
        }
      }
    }
  }
  rationalState(my,ratio){
    const mem=this.foeMemory[this.foeActive]||{};
    const seen=this.seenMoves[this.foeActive]||[];
    return {ratio,foeHP:this.foeHP,foeItem:this.foeItem||mem.item||'',foeAbility:this.foeAbility||mem.ability||'',
      boosts:this.boosts,foeBoosts:this.foeBoosts,terrain:this.terrain,weather:this.weather,seenMoves:seen,
      foeRecovers:seen.some(m=>rational.RECOVERY.has(canonical(m))),
      observedImmune:this.observedImmune[this.foeActive]||[],flags:{}};
  }
  // Rational guards (candidate policy). Returns a choice or null to fall
  // through to the unchanged baseline switch heuristic.
  rationalDecide(active,side,my,available,best,ratio,rs){
    if(this.rationalV2)return this.rationalDecideV2(active,side,my,available,best,ratio,rs);
    const bench=side.map((p,i)=>({p,i})).filter(x=>!x.p.active&&!String(x.p.condition).endsWith(' fnt'));
    const canSwitch=bench.length>0&&canSwitchAgainst(this.dex,active,my,this.foeActive,rs.foeAbility)&&this.rationalSwitches<8;
    const benchRows=bench.map(x=>{const [h,m]=String(x.p.condition).split('/').map(Number);return {set:this.getSet(x.p),slot:x.i+1,ratio:m>0?h/m:1};});
    const rows=rational.simultaneousMatrix(this.dex,{...rs,own:my,foe:this.foeActive,moves:available.map(x=>x.m.id||x.m.move),bench:benchRows});
    const locked=available.length===1&&(active.moves.length>1||this.ownEncored);
    const only=available[0].m.id||available[0].m.move;
    let reason='';
    if(locked&&rational.lockedMoveIsBad(this.dex,my,this.foeActive,only,{...rs,statusValue:best.score}))reason=this.ownEncored?'encore-locked-bad':'choice-locked-bad';
    else if(best.score<=-1e4)reason='all-moves-bad';
    else{
      const bm=available.find(x=>x.i===best.i),bflags=rs.flags[bm.m.id||bm.m.move]||[];
      const breaker=rows.some(r=>r.action.startsWith('switch ')&&r.offense>=0.3&&r.worst>-0.6);
      if(rs.foeRecovers&&bflags.some(f=>/contact|recovery/.test(f))&&rational.noProgressLoop(this.history,this.foeActive,{foeHP:this.foeHP,ratio}))reason='no-progress-loop';
      else if(bflags.includes('contact-into-recovery')&&breaker)reason='contact-into-recovery';
    }
    const pick=reason&&canSwitch?rational.chooseSwitch(rows):null;
    if(this.logMatrix)this.trace.matrix=(this.trace.matrix||[]).concat({side:this.side,turn:this.turn,foe:this.foeActive,reason,flags:rs.flags,
      rows:rows.map(r=>({action:r.action,worst:+r.worst.toFixed(3),mean:+r.mean.toFixed(3)}))});
    if(pick){this.rationalSwitches++;this.trace.rational=(this.trace.rational||[]).concat({side:this.side,turn:this.turn,reason,choice:'switch '+pick.slot});return 'switch '+pick.slot;}
    if(reason)this.trace.rational=(this.trace.rational||[]).concat({side:this.side,turn:this.turn,reason,choice:'no-legal-switch'});
    // Foe is publicly Encored into a non-damaging move: its next action is
    // known, so a voluntary switch is a wasted free turn.
    if(this.foeEncored&&this.dex.moves.get(this.lastMove).category==='Status')
      return 'move '+(best.i+1)+(active.canMegaEvo?' mega':'');
    return null;
  }
  // rational2: one shared voluntary-switch counter (this.switches) with two
  // ceilings, a ping-pong guard per foe stint, restriction classification
  // from the request + public volatiles, a damage-race/PP-aware loop
  // detector, and a hazard/KO-aware stay-vs-switch gate.
  rationalDecideV2(active,side,my,available,best,ratio,rs){
    const R=rational,dex=this.dex,log=x=>{this.trace.rational=(this.trace.rational||[]).concat({side:this.side,turn:this.turn,...x});};
    const bench=side.map((p,i)=>({p,i})).filter(x=>!x.p.active&&!String(x.p.condition).endsWith(' fnt'));
    const benchRows=bench.map(x=>{const [h,m]=String(x.p.condition).split('/').map(Number);return {set:this.getSet(x.p),slot:x.i+1,ratio:m>0?h/m:1};});
    const rows=R.simultaneousMatrix(dex,{...rs,own:my,foe:this.foeActive,moves:available.map(x=>x.m.id||x.m.move),bench:benchRows});
    for(const r of rows)if(r.slot){const b=benchRows.find(x=>x.slot===r.slot);
      r.hazard=R.hazardEntry(dex,b.set,this.ownHazards);r.koOnEntry=-r.worst+r.hazard>=b.ratio-1e-9;}
    const cur=side.find(p=>p.active);
    const restriction=R.classifyRestriction({moves:active.moves,ownItem:cur?.item||'',lastOwnMove:this.lastOwnMove,volatiles:this.ownVolatiles});
    const only=available[0].m.id||available[0].m.move;
    const bm=available.find(x=>x.i===best.i),bid=bm.m.id||bm.m.move,bflags=rs.flags[bid]||[];
    let reason='',hardReason=false;
    if(restriction&&R.lockedMoveIsBad(dex,my,this.foeActive,only,{...rs,statusValue:best.score})){
      reason=restriction+'-locked-bad';
      // Staying does literally nothing: exempt from the switch ceiling.
      const h=R.hitBand(dex,my,this.foeActive,only,rs);
      hardReason=Boolean(h.immune||rs.observedImmune.includes(canonical(only))||R.setupIsCapped(dex,only,rs.boosts));
    }else if(best.score<=-1e4)reason='all-moves-bad';
    else if(rs.foeRecovers&&bflags.some(f=>/contact|recovery/.test(f))){
      const hb=R.hitBand(dex,my,this.foeActive,bid,rs),obs=this.lastHit[this.foeActive+'|'+canonical(bid)];
      const uses=Object.entries(this.recoveryUses).filter(([k])=>k.startsWith(this.foeActive+'|'));
      const left=uses.length?Math.min(...uses.map(([k,n])=>R.championsPP(dex,k.split('|')[1])-n)):Infinity;
      const hit=obs??hb.mid*hb.accuracy;
      if(R.noProgressLoopV2(this.history,this.foeActive,{foeHP:this.foeHP,ratio},{hit,heal:0.5,recoveryLeft:left,samples:this.loopSamples}))reason='no-progress-loop';
      else if(bflags.includes('contact-into-recovery')&&hit<0.5&&left>1
        &&rows.some(r=>r.slot&&r.offense>=0.3&&r.worst-(r.hazard||0)>-0.6&&!r.koOnEntry))reason='contact-into-recovery';
    }
    // Stay value for the gate: a lock repeats (Encore/Choice/Taunt...), so the
    // stay row is paid at least twice; a move that does literally nothing
    // (immune / capped setup) is never preferred to a switch that survives.
    const stayRow=rows.find(r=>r.action==='move '+dex.moves.get(restriction?only:bid).name);
    // Fainting while staying is clamped to the remaining HP in the matrix; it
    // gets the same 0.5 penalty as a KO on entry.
    const stayWorst=hardReason||!stayRow?-Infinity:stayRow.worst*(restriction?2:1)-(-stayRow.worst>=ratio-1e-9?0.5:0);
    const ceiling=hardReason?Infinity:6;
    const legal=bench.length>0&&canSwitchAgainst(dex,active,my,this.foeActive,rs.foeAbility);
    let pick=null,blocked='';
    if(reason){
      if(!legal)blocked='no-legal-switch';
      else if(this.switches>=ceiling)blocked='switch-ceiling';
      else{
        const ok=hardReason?rows:rows.filter(r=>!r.slot||!this.pingPong(side[r.slot-1]));
        pick=R.chooseSwitchV2(ok,{stayWorst});
        if(!pick)blocked=ok.length<rows.length&&R.chooseSwitchV2(rows,{stayWorst})?'ping-pong':'switch-worse-than-stay';
      }
    }
    if(this.logMatrix)this.trace.matrix=(this.trace.matrix||[]).concat({side:this.side,turn:this.turn,foe:this.foeActive,reason,restriction,blocked,flags:rs.flags,
      rows:rows.map(r=>({action:r.action,worst:+r.worst.toFixed(3),mean:+r.mean.toFixed(3),hazard:r.hazard,koOnEntry:r.koOnEntry}))});
    if(pick){this.switches++;this.rationalSwitches++;log({reason,choice:'switch '+pick.slot});return 'switch '+pick.slot;}
    if(reason)log({reason,choice:blocked});
    // Foe publicly Encored into a status move: its action is known for the
    // Encore's remaining turns (3 in gen9, so the turn it started +2). Attack
    // instead of a voluntary switch only while that is still true and our
    // best move has positive value.
    if(this.foeEncored&&this.turn-this.foeEncoreTurn<=2&&best.score>0&&dex.moves.get(this.lastMove).category==='Status')
      return 'move '+(best.i+1)+(active.canMegaEvo?' mega':'');
    // The legacy switch heuristic below shares this.switches (cap 3) and
    // pingPong() (checked at its switch site).
    return null;
  }
  // rational2: a voluntary switch back into the mon that just left against
  // the SAME foe with no move in between (A->B->A), or a 4th voluntary switch
  // while that foe stays in. A double switch to a third mon is allowed.
  pingPong(p){
    const st=this.switchStreak;
    if(st.foe!==this.foeActive)return false;
    return (st.n>=1&&nameOf(p?.details)===st.left)||st.stint>=3;
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
      }):this.previewPolicy==='stochastic'
        ?choosePreview(this.dex,this.team,this.opp,this.random,matchup)
        :this.previewPolicy==='strategic'
          ?chooseStrategicPreview(this.dex,this.team,this.opp,this.random,matchup)
          :chooseThree(this.dex,this.team,this.opp);
      this.trace.selections.push({side:this.side,chosen:selected.map(n=>this.team[n-1].species),lead:this.team[selected[0]-1].species});
      return 'team '+selected.join('');
    }
    const side=req.side.pokemon;
    if(req.forceSwitch){
      const bench=side.map((p,i)=>({p,i})).filter(x=>!x.p.active&&!String(x.p.condition).endsWith(' fnt'));
      const score=p=>Math.max(...this.getSet(p).moves.map(m=>moveUtility(this.dex,this.getSet(p),this.foeActive,m,{foeItem:this.foeItem,foeAbility:this.foeAbility,foeHP:this.foeHP})))
        -75*incomingRisk(this.dex,this.getSet(p),this.foeActive,{foeBoosts:this.foeBoosts,seenMoves:this.seenMoves[this.foeActive]});
      bench.sort((a,b)=>score(b.p)-score(a.p));
      return bench.length?'switch '+(bench[0].i+1):'default';
    }
    const active=req.active?.[0], current=side.find(p=>p.active);
    if(!active||!current)return 'default';
    const my={...this.getSet(current),species:nameOf(current.details)};
    const available=active.moves.map((m,i)=>({m,i})).filter(x=>!x.m.disabled&&x.m.pp>0);
    if(!available.length)return 'default';
    const [selfhp,selfmax]=String(current.condition).split('/').map(Number);
    const ratio=selfmax>0?selfhp/selfmax:1;
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
    const rs=this.decisionPolicy==='rational'||this.rationalV2?this.rationalState(my,ratio):null;
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
      if(rs){
        const r=rational.rationalMoveScore(this.dex,my,this.foeActive,m.id||m.move,score,rs);
        score=r.score;if(r.flags.length)(rs.flags[m.id||m.move]=r.flags);
      }
      if(score>best.score)best={score,i};
    }
    if(rs){
      const r=this.rationalDecide(active,side,my,available,best,ratio,rs);
      if(r)return r;
    }
    const bench=side.map((p,i)=>({p,i})).filter(x=>!x.p.active&&!String(x.p.condition).endsWith(' fnt'));
    if(canSwitchAgainst(this.dex,active,my,this.foeActive,this.foeAbility)&&bench.length&&this.switches<3){
      const riskOf=p=>incomingRisk(this.dex,this.getSet(p),this.foeActive,{foeBoosts:this.foeBoosts,seenMoves:this.seenMoves[this.foeActive]});
      const score=p=>Math.max(...this.getSet(p).moves.map(m=>moveUtility(this.dex,this.getSet(p),this.foeActive,m,{foeItem:this.foeItem,foeAbility:this.foeAbility,foeHP:this.foeHP}))) - 80*riskOf(p);
      const currentRisk=incomingRisk(this.dex,my,this.foeActive,{foeBoosts:this.foeBoosts,seenMoves:this.seenMoves[this.foeActive]});
      bench.sort((a,b)=>score(b.p)-score(a.p));
      if(score(bench[0].p)>Math.max(25,best.score+18)
        && (riskOf(bench[0].p)<currentRisk*0.70||ratio<0.25)
        && riskOf(bench[0].p)<0.85
        && !(this.rationalV2&&this.pingPong(bench[0].p))){
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
module.exports={prelim,normalize,hashSeed,args,matchup,chooseThree,Bot,load,check,game,canSwitchAgainst};
