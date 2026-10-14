'use strict';
// Explicit public-six strategy diversity. Never use opposing selected 3 or sets.
// An alternative policy, not a universally optimal model.
const {rankPreview,softmaxPick}=require('./preview-policy');
const {canonical}=require('./tactics');
function rankStrategicPreview(dex,team,opponentSix,matchup){
  const ranked=rankPreview(dex,team,opponentSix,matchup);
  const seesCharizard=opponentSix.some(s=>canonical(s)==='charizard');
  const seesVolcarona=opponentSix.some(s=>canonical(s)==='volcarona');
  const seesIndeedee=opponentSix.some(s=>canonical(s)==='indeedee');
  const ownIndeedee=team.some(x=>canonical(x.species)==='indeedee');
  return ranked.map(c=>{
    const selected=c.three.map(i=>team[i]),allMoves=selected.flatMap(p=>p.moves);
    let bonus=0;
    if(seesCharizard){
      // A public Charizard could be X or Y. Keep a functional answer to Y,
      // but do not read or assume its privately held Mega stone.
      const rock=selected.some(p=>p.moves.some(m=>dex.moves.get(m).type==='Rock'&&
        dex.moves.get(m).category!=='Status'));
      const electric=selected.some(p=>p.moves.some(m=>dex.moves.get(m).type==='Electric'&&
        dex.moves.get(m).category!=='Status'));
      const fireWeak=selected.filter(p=>dex.getEffectiveness('Fire',dex.species.get(p.species).types)>=1).length;
      bonus+=rock?30:electric?14:-30;
      bonus-=fireWeak*(seesVolcarona?12:7);
      if(seesVolcarona&&fireWeak>=2)bonus-=15;
    }
    if(seesIndeedee){
      if(selected.some(p=>canonical(p.ability)==='grassysurge'))bonus+=28;
      if(selected.some(p=>p.moves.some(m=>{
        const def=dex.moves.get(m);
        return def.category!=='Status'&&(def.type==='Bug'||def.type==='Dark');
      })))bonus+=15;
    }
    if(ownIndeedee&&selected.some(p=>canonical(p.species)==='indeedee')){
      // Public set synergy, already known to that player. Field can turn
      // Expanding Force into a feasible win condition, especially with a
      // second Psychic attacker. Do not force the selection.
      bonus+=70;
      if(selected.some(p=>p.moves.some(m=>canonical(m)==='expandingforce')))
        bonus+=10;
      if(selected.filter(p=>p.moves.some(m=>canonical(m)==='expandingforce')).length>=2)
        bonus+=35;
    }
    return {...c,originalScore:c.score,score:c.score+bonus,strategyBonus:bonus};
  }).sort((a,b)=>b.score-a.score||a.three.join('').localeCompare(b.three.join('')));
}
function chooseStrategicPreview(dex,team,opponentSix,random,matchup){
  const ranked=rankStrategicPreview(dex,team,opponentSix,matchup);
  const best=ranked[0].score;
  const plausible=ranked.filter(x=>x.score>=best-23).slice(0,8);
  const choice=softmaxPick(plausible,random,9);
  const top=choice.leads[0].score;
  const leads=choice.leads.filter(x=>x.score>=top-12);
  const lead=softmaxPick(leads,random,6).i;
  return [lead,...choice.three.filter(i=>i!==lead).sort((a,b)=>a-b)].map(i=>i+1);
}
module.exports={rankStrategicPreview,chooseStrategicPreview};