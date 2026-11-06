'use strict';
// Engine-search turn AI (opt-in research policy, not the default bot).
//
// Every move/switch decision is made by the pinned Showdown engine itself:
// for D determinizations of the viewer's information set (engine-public-state)
// and S random seeds, each pair (our legal choice, opponent's legal choice) is
// played for one full turn and the resulting position is scored. The payoff
// matrix is solved as a simultaneous-move zero-sum game (regret matching); we
// play the best response to the opponent's equilibrium strategy, averaged over
// determinizations (ties within 0.01 go to the safer maximin choice). Speed order,
// priority, Scarf, abilities, weather, terrain, Mega, choice lock, Encore,
// Sash, immunities and damage rolls therefore come from the engine, never from
// a hand-written formula. Team preview is delegated to the base Bot.
// The search never receives the real Battle: only determinize() output.
const {Bot}=require('./lab');
const {seededRandom}=require('./preview-policy');
const {determinize,restore}=require('./engine-public-state');
const DEFAULTS={determinizations:3,seeds:3,iterations:400,maxMidTurn:6,rollout:3};
const STATUS_COST={brn:0.12,par:0.1,slp:0.2,frz:0.25,psn:0.05,tox:0.08};
const BOOST_VALUE={atk:0.06,spa:0.06,spe:0.05,def:0.03,spd:0.03};

// Legal choice strings for a Showdown request (same format for both sides).
function legalChoices(req){
  if(!req||req.wait||req.teamPreview)return [];
  const team=req.side.pokemon;
  const bench=team.map((p,i)=>({p,i})).filter(x=>!x.p.active&&!/ fnt$/.test(x.p.condition))
    .map(x=>'switch '+(x.i+1));
  if(req.forceSwitch)return req.forceSwitch[0]?bench:[];
  const active=req.active?.[0];
  if(!active)return [];
  const out=[];
  // When Mega Evolution is available every attack is offered WITH it: the
  // rollout would Mega next turn anyway, so the non-Mega twin differs only by
  // sampling noise and was picked by noise in testing (turn-1 Charizard).
  active.moves.forEach((m,i)=>{
    if(m.disabled||m.pp===0)return;
    out.push('move '+(i+1)+(active.canMegaEvo?' mega':''));
  });
  if(!active.trapped&&!active.maybeTrapped)out.push(...bench);
  return out.length?out:['default'];
}
// Position value for `viewer` (positive = good). Simple and transparent:
// each living Pokemon 0.2 + 0.8*HP fraction, active stat stages, status.
function evaluate(b,viewer){
  let v=0;
  // A decided game is worth 5 plus the winner's remaining material, so a win
  // that keeps more Pokemon (e.g. a priority KO instead of a speed tie) ranks higher.
  const won=b.ended&&b.winner===b.sides.find(s=>s.id===viewer).name,lost=b.ended&&b.winner&&!won;
  if(won)v+=5;if(lost)v-=5;
  for(const side of b.sides){
    let s=0;
    for(const p of side.pokemon){
      if(p.fainted||p.hp<=0)continue;
      s+=0.2+0.8*p.hp/p.maxhp;
      s-=STATUS_COST[p.status]||0;
      if(p.isActive)for(const [k,w] of Object.entries(BOOST_VALUE))s+=w*Math.max(-4,Math.min(4,p.boosts[k]||0));
    }
    s-=0.04*Object.keys(side.sideConditions).filter(k=>['stealthrock','spikes','toxicspikes','stickyweb'].includes(k)).length;
    v+=side.id===viewer?s:-s;
  }
  return v;
}
// Resolve requests that arise inside the simulated turn (U-turn, Eject
// Button...) with the engine's default choice; end-of-turn replacements are
// left pending so the position is scored before them.
function settle(b,maxMidTurn){
  for(let i=0;i<maxMidTurn&&!b.ended&&b.requestState==='switch'&&b.midTurn;i++){
    for(const s of b.sides)if(s.activeRequest&&!s.activeRequest.wait)b.choose(s.id,'default');
  }
}
// Greedy rollout policy used only AFTER the searched turn, so that tempo
// (staying in vs switching, Mega, KOs next turn) shows up in the score. Both
// sides attack with the engine-checked strongest move; replacements pick the
// bench member with the best one-on-one attack margin. Not a strong player.
function attackScore(b,user,target,id){
  const move=b.dex.moves.get(id);
  if(!move.exists||!target||target.fainted)return 0;
  if(move.category==='Status')return 1;
  const types=target.getTypes();
  if(!b.dex.getImmunity(move.type,types))return 0;
  if(move.type==='Ground'&&!target.isGrounded())return 0;
  const eff=2**b.dex.getEffectiveness(move.type,types);
  const stab=user.hasType(move.type)?1.5:1;
  const [a,d]=move.category==='Physical'?['atk','def']:['spa','spd'];
  const acc=typeof move.accuracy==='number'?move.accuracy/100:1;
  // unmodified=true: ability/item stat hooks need a live move context.
  return (move.basePower||60)*stab*eff*acc*user.getStat(a,false,true)/Math.max(1,target.getStat(d,false,true));
}
function rolloutChoice(b,side){
  const req=side.activeRequest;
  if(!req||req.wait)return null;
  const foe=side.foe.active[0];
  if(req.forceSwitch){
    let best=null,bestScore=-Infinity;
    req.side.pokemon.forEach((p,i)=>{
      const mon=side.pokemon[i];
      if(p.active||mon.fainted||mon.hp<=0)return;
      const mine=Math.max(0,...mon.moveSlots.map(m=>attackScore(b,mon,foe,m.id)));
      const theirs=foe?Math.max(0,...foe.moveSlots.map(m=>attackScore(b,foe,mon,m.id))):0;
      const score=mine/Math.max(1,foe?.hp||1)-theirs/Math.max(1,mon.hp);
      if(score>bestScore){bestScore=score;best='switch '+(i+1);}
    });
    return best||'default';
  }
  const act=req.active?.[0],me=side.active[0];
  if(!act||!me)return 'default';
  let best=null,bestScore=-1;
  act.moves.forEach((m,i)=>{
    if(m.disabled||m.pp===0)return;
    const v=attackScore(b,me,foe,m.id);
    if(v>bestScore){bestScore=v;best=i;}
  });
  return best==null?'default':'move '+(best+1)+(act.canMegaEvo?' mega':'');
}
function rollout(b,turns,maxMidTurn){
  for(let t=0;t<turns&&!b.ended;t++){
    for(let guard=0;guard<maxMidTurn&&!b.ended&&b.requestState==='switch';guard++)
      for(const s of b.sides){const c=rolloutChoice(b,s);if(c)b.choose(s.id,c);}
    if(b.ended||b.requestState!=='move')break;
    for(const s of b.sides){const c=rolloutChoice(b,s);if(c&&!b.choose(s.id,c))b.choose(s.id,'default');}
  }
}
function play(sim,det,seed,mine,theirs,cfg){
  const b=restore(sim,det,seed);
  const foeReq=b.sides.find(s=>s.id===det.foe).activeRequest;
  if(mine&&!b.choose(det.viewer,mine))return null;
  if(theirs&&foeReq&&!foeReq.wait&&!b.choose(det.foe,theirs))return null;
  settle(b,cfg.maxMidTurn);
  if(cfg.rollout)rollout(b,cfg.rollout,cfg.maxMidTurn);
  return evaluate(b,det.viewer);
}
// Zero-sum matrix game by regret matching+; returns average strategies.
function solve(M,iterations){
  const n=M.length,m=M[0].length;
  const rx=new Array(n).fill(0),ry=new Array(m).fill(0),sx=new Array(n).fill(0),sy=new Array(m).fill(0);
  const norm=r=>{const t=r.reduce((a,b)=>a+Math.max(0,b),0);return r.map(x=>t>0?Math.max(0,x)/t:1/r.length);};
  for(let t=0;t<iterations;t++){
    const x=norm(rx),y=norm(ry);
    const ux=M.map(row=>row.reduce((a,v,j)=>a+v*y[j],0));
    const uy=M[0].map((_,j)=>M.reduce((a,row,i)=>a+row[j]*x[i],0));
    const vx=ux.reduce((a,u,i)=>a+u*x[i],0),vy=uy.reduce((a,u,j)=>a+u*y[j],0);
    for(let i=0;i<n;i++){rx[i]=Math.max(0,rx[i]+ux[i]-vx);sx[i]+=x[i];}
    for(let j=0;j<m;j++){ry[j]=Math.max(0,ry[j]+vy-uy[j]);sy[j]+=y[j];}
  }
  const X=sx.map(v=>v/iterations),Y=sy.map(v=>v/iterations);
  const value=M.reduce((a,row,i)=>a+X[i]*row.reduce((b,v,j)=>b+v*Y[j],0),0);
  return {x:X,y:Y,value};
}
// One-turn game for a determinization: payoff matrix over legal choices.
function turnGame(sim,det,mine,cfg,rng){
  const base=restore(sim,det);
  const foeReq=base.sides.find(s=>s.id===det.foe).activeRequest;
  const theirs=legalChoices(foeReq);
  const cols=theirs.length?theirs:[null];
  const seeds=Array.from({length:cfg.seeds},()=>[1,2,3,4].map(()=>Math.floor(rng()*65536)));
  const M=mine.map(a=>cols.map(c=>{
    let sum=0,n=0;
    for(const s of seeds){const v=play(sim,det,s,a,c,cfg);if(v!=null){sum+=v;n++;}}
    return n?sum/n:null;
  }));
  // A choice the engine rejects in this hypothesis is dropped (column) or
  // scored as worst-case (row) so it is never preferred.
  const okCols=cols.map((_,j)=>M.some(r=>r[j]!=null));
  const C=M.map(r=>r.filter((_,j)=>okCols[j]).map(v=>v==null?-10:v));
  if(!C[0]?.length)return null;
  return {...solve(C,cfg.iterations),theirs:cols.filter((_,j)=>okCols[j]),M:C};
}
// Value of a position where only the viewer must act first (forced switch).
function switchValue(sim,det,choice,cfg,rng){
  const b=restore(sim,det);
  if(!b.choose(det.viewer,choice))return null;
  const foeReq=b.sides.find(s=>s.id===det.foe).activeRequest;
  if(foeReq?.forceSwitch&&!foeReq.wait)b.choose(det.foe,'default');
  settle(b,cfg.maxMidTurn);
  if(b.ended)return evaluate(b,det.viewer);
  if(b.requestState!=='move')return evaluate(b,det.viewer);
  const next={...det,json:JSON.stringify(b.toJSON()),fixes:[]};
  const myReq=b.sides.find(s=>s.id===det.viewer).activeRequest;
  const g=turnGame(sim,next,legalChoices(myReq),cfg,rng);
  return g?g.value:evaluate(b,det.viewer);
}
function chooseBySearch(sim,battle,viewer,req,{preview,pool,cfg,rng}){
  const mine=legalChoices(req);
  if(mine.length<=1)return {choice:mine[0]||'default',reason:'single legal choice'};
  const dets=Array.from({length:cfg.determinizations},()=>
    determinize(sim,battle,viewer,{preview,pool,rng,seed:[1,2,3,4].map(()=>Math.floor(rng()*65536))}));
  const weight=new Array(mine.length).fill(0),values=new Array(mine.length).fill(0);
  let used=0;
  if(req.forceSwitch){
    for(const d of dets){
      const vals=mine.map(c=>switchValue(sim,d,c,cfg,rng));
      if(vals.every(v=>v==null))continue;
      used++;vals.forEach((v,i)=>{values[i]+=v==null?-10:v;});
    }
    if(!used)return null;
    const best=values.indexOf(Math.max(...values));
    return {choice:mine[best],reason:'forced switch',values:values.map(v=>+(v/used).toFixed(3)),mine};
  }
  const ev=new Array(mine.length).fill(0);
  for(const d of dets){
    const g=turnGame(sim,d,mine,cfg,rng);
    if(!g)continue;
    used++;
    g.x.forEach((p,i)=>{weight[i]+=p;});
    g.M.forEach((row,i)=>{values[i]+=Math.min(...row);ev[i]+=row.reduce((a,v,j)=>a+v*g.y[j],0);});
  }
  if(!used)return null;
  // Arg-max of a mixed equilibrium is not a sound pure choice (indifference);
  // play the best response to the opponent's equilibrium mix instead.
  let best=0;
  for(let i=1;i<mine.length;i++)
    if(ev[i]>ev[best]+0.01||Math.abs(ev[i]-ev[best])<=0.01&&values[i]>values[best])best=i;
  return {choice:mine[best],reason:'turn game',ev:ev.map(v=>+(v/used).toFixed(3)),
    weights:weight.map(w=>+(w/used).toFixed(3)),maximin:values.map(v=>+(v/used).toFixed(3)),mine};
}
// Bot wrapper: base Bot parses public messages and picks the team; this
// subclass answers move/switch requests by engine search.
class EngineSearchBot extends Bot{
  constructor(stream,dex,team,side,trace,forcedSelection=null,scriptScenario=null,options={}){
    super(stream,dex,team,side,trace,forcedSelection,scriptScenario,options);
    this.sim=options.sim;
    this.battleSource=options.battleSource;
    this.pool=options.pool;
    this.searchConfig={...DEFAULTS,...(options.search||{})};
    this.searchRandom=seededRandom(options.seed||[1,2,3,4],side+'-search');
    this.searchLog=[];
  }
  decide(req){
    if(req.teamPreview||req.wait||this.errors>0||!this.battleSource)return super.decide(req);
    try{
      const r=chooseBySearch(this.sim,this.battleSource(),this.side,req,
        {preview:this.opp.slice(),pool:this.pool,cfg:this.searchConfig,rng:this.searchRandom});
      if(r){this.searchLog.push({turn:this.turn,...r});return r.choice;}
    }catch(err){this.searchLog.push({turn:this.turn,error:String(err.message||err)});}
    return super.decide(req);
  }
}
// Hypothesis pool from the public species name only (PR #65 role templates).
function rolePool(sim){
  const {legalRoleHypotheses}=require('./legal-role-hypotheses');
  const cache={};
  return species=>cache[species]||(cache[species]=legalRoleHypotheses(sim,species,{version:'v2'}).sets);
}
module.exports={EngineSearchBot,legalChoices,evaluate,solve,turnGame,chooseBySearch,rolePool,DEFAULTS};
