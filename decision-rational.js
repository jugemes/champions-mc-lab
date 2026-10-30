'use strict';
// Candidate-only 'rational' turn policy (opt-in; baseline/v2/v3 unchanged).
// Guards against four reproducible blunders of the heuristic bot:
//  (i)   contact moves into a public Rocky Helmet / Rough Skin / Iron Barbs
//        while the foe has shown recovery (no progress, self-KO by chip),
//  (ii)  staying in while locked (Choice/Encore) into an immune/resisted or
//        non-progressing move when a legal switch exists,
//  (iii) using a self-boosting move whose stats are already capped at +6,
//  (iv)  re-evaluating an Encore lock on either side every turn.
// Inputs are PUBLIC: own known set, foe species, revealed moves/item/ability,
// HP fractions and boosts. Unknown foes are given a public STAB risk band
// (never "zero damage because no move was seen yet").
// The simultaneous matrix below is a coarse PROJECTION, not a battle result.
const {estimateDamage,knownStat,effectiveness,damage}=require('./damage');
const {canonical}=require('./tactics');
const RECOVERY=new Set(['roost','recover','slackoff','softboiled','moonlight','morningsun','synthesis','shoreup','milkdrink','strengthsap']);
const stageMult=n=>n>=0?(2+n)/2:2/(2-n);
function contactRecoil(dex,own,moveName,foe={}){
  const move=dex.moves.get(moveName);
  if(!move.exists||move.category==='Status'||!move.flags?.contact)return 0;
  if(canonical(own.item)==='protectivepads'||canonical(own.ability)==='longreach')return 0;
  let r=0;
  if(canonical(foe.item)==='rockyhelmet')r+=1/6;
  if(['roughskin','ironbarbs'].includes(canonical(foe.ability)))r+=1/8;
  return r;
}
// Self-targeted boosting moves whose every boosted stat is already +6.
function setupIsCapped(dex,moveName,boosts={}){
  const move=dex.moves.get(moveName);
  if(!move.exists||move.category!=='Status')return false;
  const b=move.target==='self'?move.boosts:move.self?.boosts;
  if(!b)return false;
  const ups=Object.entries(b).filter(([,v])=>v>0).map(([k])=>k);
  if(!ups.length)return false;
  return ups.every(k=>Number(boosts[k]||0)>=6);
}
// Public band of the foe's speed. Choice Scarf is possible unless an item is revealed.
function speedBand(dex,foeName,foeBoosts={},foeItem=''){
  const s=dex.species.get(foeName);
  if(!s.exists)return {min:0,max:Infinity};
  const st=stageMult(Number(foeBoosts.spe||0));
  const scarf=!foeItem||canonical(foeItem)==='choicescarf'?1.5:1;
  return {min:Math.floor((s.baseStats.spe+20)*0.9)*st,max:Math.floor((s.baseStats.spe+52)*1.1)*st*scarf};
}
function ownSpeed(dex,own,boosts={}){
  return knownStat(dex,own,'spe')*stageMult(Number(boosts.spe||0))*(canonical(own.item)==='choicescarf'?1.5:1);
}
// Plausible enemy actions from PUBLIC information only.
function foePublicActions(dex,foeName,seenMoves=[]){
  const foe=dex.species.get(foeName);
  const out=[];
  if(!foe.exists)return out;
  for(const type of foe.types)for(const category of ['Physical','Special'])
    out.push({label:'STAB '+type+' '+category[0]+'90 (public band)',type,category,basePower:90,attack:true});
  for(const name of seenMoves){
    const m=dex.moves.get(name);
    if(!m.exists)continue;
    if(m.category!=='Status'&&m.basePower)out.push({label:m.name+' (seen)',type:m.type,category:m.category,basePower:m.basePower,attack:true,priority:m.priority,id:m.id});
    else if(RECOVERY.has(m.id))out.push({label:m.name+' (seen)',recover:true});
  }
  out.push({label:'setup/status',status:true});
  out.push({label:'switch (unknown target)',switch:true});
  return out;
}
// Upper-band fraction of defender HP that a max-investment foe deals with the action.
function foeHit(dex,defender,foeName,action,foeBoosts={},weather=''){
  if(!action.attack)return 0;
  const foe=dex.species.get(foeName),own=dex.species.get(defender.species);
  if(!foe.exists||!own.exists)return 0;
  const eff=effectiveness(dex,{type:action.type},own,{foeAbility:defender.ability,foeItem:defender.item});
  if(!eff)return 0;
  const stat=action.category==='Physical'?'atk':'spa',def=action.category==='Physical'?'def':'spd';
  const stage=canonical(defender.ability)==='unaware'?0:Number(foeBoosts[stat]||0);
  const atk=(foe.baseStats[stat]+52)*1.1*stageMult(stage);
  const stab=foe.types.includes(action.type)?1.5:1;
  const w=canonical(weather);
  const wm=w==='sunnyday'?(action.type==='Fire'?1.5:action.type==='Water'?0.5:1):w==='raindance'?(action.type==='Water'?1.5:action.type==='Fire'?0.5:1):1;
  return damage(50,action.basePower,atk,knownStat(dex,defender,def),stab,eff)*wm/knownStat(dex,defender,'hp');
}
// own action x plausible enemy action. Value = foe HP removed - own HP lost
// (fractions), KOs clamp, unknown speed order resolved pessimistically for
// "worst" and averaged for "mean". Not exact Showdown damage.
function simultaneousMatrix(dex,s){
  const enemy=foePublicActions(dex,s.foe,s.seenMoves||[]);
  const band=speedBand(dex,s.foe,s.foeBoosts,s.foeItem);
  const rows=[];
  const info={boosts:s.boosts||{},foeBoosts:s.foeBoosts||{},foeHP:s.foeHP,foeItem:s.foeItem,foeAbility:s.foeAbility,terrain:s.terrain,weather:s.weather};
  for(const move of s.moves||[]){
    const m=dex.moves.get(move);
    const hit=m.category==='Status'?{mid:0,min:0,max:0,accuracy:1}:estimateDamage(dex,s.own,s.foe,move,info);
    const recoil=contactRecoil(dex,s.own,move,{item:s.foeItem,ability:s.foeAbility});
    const mySpe=ownSpeed(dex,s.own,s.boosts);
    const cells=enemy.map(e=>{
      const dealt=Math.min(s.foeHP,hit.mid*hit.accuracy);
      const taken=foeHit(dex,s.own,s.foe,e,s.foeBoosts,s.weather);
      const surelyFirst=m.priority>(e.priority||0)||(m.priority===(e.priority||0)&&mySpe>band.max);
      const surelySecond=m.priority<(e.priority||0)||(m.priority===(e.priority||0)&&mySpe<band.min);
      const order=(weFirst)=>{
        if(e.switch)return dealt*0.5-recoil; // unknown switch-in absorbs it
        let d=dealt,t=Math.min(s.ratio,taken+recoil);
        if(weFirst&&hit.min>=s.foeHP)t=Math.min(s.ratio,recoil);
        if(!weFirst&&taken>=s.ratio)d=0;
        if(e.recover)d=Math.max(0,d-Math.min(0.5,1-s.foeHP+d));
        if(e.status)d-=0.1; // tempo given to an unseen setup
        return d-t;
      };
      const a=order(true),b=order(false);
      return {enemy:e.label,worst:surelyFirst?a:surelySecond?b:Math.min(a,b),mean:surelyFirst?a:surelySecond?b:(a+b)/2};
    });
    rows.push({action:'move '+m.name,worst:Math.min(...cells.map(c=>c.worst)),mean:cells.reduce((x,c)=>x+c.mean,0)/cells.length,cells});
  }
  for(const b of s.bench||[]){
    const cells=enemy.map(e=>{const t=-Math.min(b.ratio??1,foeHit(dex,b.set,s.foe,e,s.foeBoosts,s.weather));return {enemy:e.label,worst:t,mean:t};});
    const offense=Math.max(0,...b.set.moves.map(x=>{const h=estimateDamage(dex,b.set,s.foe,x,{foeHP:s.foeHP,foeItem:s.foeItem,foeAbility:s.foeAbility,foeBoosts:s.foeBoosts,terrain:s.terrain,weather:s.weather});return h.immune?0:Math.min(s.foeHP,h.mid*h.accuracy);}));
    rows.push({action:'switch '+b.set.species,slot:b.slot,offense,worst:Math.min(...cells.map(c=>c.worst)),mean:cells.reduce((x,c)=>x+c.mean,0)/cells.length,cells});
  }
  return rows;
}
// Score adjustment for one move. Returns {score, flags}.
function rationalMoveScore(dex,own,foeName,moveName,base,s){
  const move=dex.moves.get(moveName);
  const flags=[];
  if(!move.exists)return {score:-1e6,flags:['unknown']};
  if(setupIsCapped(dex,moveName,s.boosts)){flags.push('setup-capped');return {score:-1e5,flags};}
  if(move.category==='Status'){
    if(base<=0){flags.push('no-value-status');return {score:-1,flags};}
    if(RECOVERY.has(move.id)&&s.ratio>=0.95){flags.push('full-hp-recovery');return {score:-1,flags};}
    return {score:base,flags};
  }
  const info={boosts:s.boosts||{},foeBoosts:s.foeBoosts||{},foeHP:s.foeHP,foeItem:s.foeItem,foeAbility:s.foeAbility,terrain:s.terrain,weather:s.weather};
  const hit=estimateDamage(dex,own,foeName,moveName,info);
  if(hit.immune||s.observedImmune?.includes(move.id)){flags.push('immune');return {score:-1e5,flags};}
  let score=base;
  const recoil=contactRecoil(dex,own,moveName,{item:s.foeItem,ability:s.foeAbility});
  const ko=hit.min>=s.foeHP;
  if(recoil){
    if(recoil>=s.ratio&&!ko){flags.push('contact-self-ko');return {score:-1e4,flags};}
    score-=120*recoil;
    if(s.foeRecovers&&hit.mid*hit.accuracy<0.5+recoil&&!ko){flags.push('contact-into-recovery');score-=60;}
  }
  if(s.foeRecovers&&!ko&&hit.max<0.5){flags.push('below-recovery');score-=30;}
  return {score,flags};
}
// When locked, is the only legal move worth staying in for?
function lockedMoveIsBad(dex,own,foeName,moveName,s){
  const move=dex.moves.get(moveName);
  if(!move.exists)return true;
  if(setupIsCapped(dex,moveName,s.boosts))return true;
  if(move.category==='Status'){
    // Encored into a status move. Allow only when it still has value now.
    return !(s.statusValue>0);
  }
  const info={boosts:s.boosts||{},foeBoosts:s.foeBoosts||{},foeHP:s.foeHP,foeItem:s.foeItem,foeAbility:s.foeAbility,terrain:s.terrain,weather:s.weather};
  const hit=estimateDamage(dex,own,foeName,moveName,info);
  if(hit.immune||s.observedImmune?.includes(move.id))return true;
  if(hit.min>=s.foeHP)return false;
  const recoil=contactRecoil(dex,own,moveName,{item:s.foeItem,ability:s.foeAbility});
  if(recoil>=s.ratio)return true;
  const progress=hit.mid*hit.accuracy-(s.foeRecovers?0.5:0);
  if(progress<=0.05)return true;
  const eff=effectiveness(dex,move,dex.species.get(foeName),info);
  return eff<=0.5&&hit.mid<0.3;
}
// Empirical stall detector from public history: since our previous move into
// the same foe, it lost no net HP (it recovered) while we lost HP.
function noProgressLoop(history,foe,now){
  const prev=history[history.length-1];
  if(!prev||prev.foe!==foe||prev.kind!=='move')return false;
  return now.foeHP>=prev.foeHP-0.05&&now.ratio<prev.ratio-0.05;
}
// Best bench by worst-case incoming damage over plausible public enemy actions,
// then offensive value; never by inaccessible opponent sets.
function chooseSwitch(rows){
  const sw=rows.filter(r=>r.action.startsWith('switch '));
  const v=r=>r.worst+0.5*(r.offense||0);
  sw.sort((a,b)=>v(b)-v(a)||b.mean-a.mean);
  return sw[0]||null;
}
module.exports={RECOVERY,contactRecoil,setupIsCapped,speedBand,foePublicActions,foeHit,simultaneousMatrix,rationalMoveScore,lockedMoveIsBad,noProgressLoop,chooseSwitch};
