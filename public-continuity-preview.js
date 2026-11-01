'use strict';
// PR #104 research-only continuity hypothesis, preregistered #6560227079.
// Only our six known sets and opposing six public species are inputs.
// Scores three/lead together with move continuity into a POSSIBLE switch.
// These are heuristic matchup units, not probabilities or engine damage.
const {matchup}=require('./lab');
const {canonical}=require('./tactics');
const {effectiveness}=require('./damage');
const {publicCertainAbility}=require('./public-action-gate');
const scoreHit=(dex,p,s,m)=>{
  const move=dex.moves.get(m),target=dex.species.get(s);
  if(!move.exists||move.category==='Status'||!target.exists)return 0;
  // Publicly unique abilities (e.g. Levitate) can make a type attack
  // completely ineffective. Unknown ability/item remains UNKNOWN.
  const ability=publicCertainAbility(dex,s);
  const ownAbility=canonical(p.ability);
  const bypass=['moldbreaker','teravolt','turboblaze'].includes(ownAbility);
  if(!effectiveness(dex,move,target,{foeAbility:bypass?'':ability}))return 0;
  return Math.max(0,matchup(dex,p,s,m));
};
const attacks=(dex,p)=>p.moves.filter(m=>dex.moves.get(m).category!=='Status');
const mean=a=>a.reduce((s,x)=>s+x,0)/Math.max(1,a.length);
const low=(a,n)=>mean([...a].sort((x,y)=>x-y).slice(0,n));
const max=(a)=>Math.max(0,...a);
function moveRows(dex,own,active,publicSix,available){
  const possibleSwitches=[...new Set(publicSix)].filter(s=>s!==active);
  const scarf=canonical(own.item)==='choicescarf';
  return available.filter(x=>dex.moves.get(x.move).category!=='Status').map(x=>{
    const current=scoreHit(dex,own,active,x.move);
    const switches=possibleSwitches.map(s=>({species:s,hit:scoreHit(dex,own,s,x.move)}));
    const sw=switches.map(x=>x.hit);
    // A locked attack cannot be replaced next turn. Penalize a PUBLICLY
    // possible immune switch more strongly, but do not assert it is selected.
    const score=scarf?.52*current+.23*mean(sw)+.25*low(sw,2):
      .72*current+.18*mean(sw)+.10*low(sw,2);
    return {...x,current,meanSwitch:mean(sw),worstSwitch:low(sw,2),
      immuneSwitches:switches.filter(x=>x.hit===0).map(x=>x.species),score};
  }).sort((a,b)=>b.score-a.score||b.current-a.current||a.i-b.i);
}
function chooseContinuityMove(dex,own,active,publicSix,available){
  if(publicSix.length!==6)return null;
  const rows=moveRows(dex,own,active,publicSix,available);
  if(rows.length<2)return null;
  return {i:rows[0].i,rows,warning:'public possible switches, not known opposing three or guaranteed pivot'};
}
function chooseContinuityPreview(dex,own,publicSix){
  if(own.length!==6||publicSix.length!==6||publicSix.some(s=>typeof s!=='string'))
    throw Error('continuity preview requires known own six and opposing public species six');
  const moves=own.map(p=>attacks(dex,p));
  const hit=(i,s,m)=>scoreHit(dex,own[i],s,m);
  const best=(i,s)=>max(moves[i].map(m=>hit(i,s,m)));
  const candidates=[];
  for(let a=0;a<6;a++)for(let b=a+1;b<6;b++)for(let c=b+1;c<6;c++){
    const three=[a,b,c];
    const coverage=publicSix.map(s=>{
      const vals=three.map(i=>best(i,s)).sort((x,y)=>y-x);
      return {best:vals[0],second:vals[1]};
    });
    const teamScore=.65*mean(coverage.map(x=>x.best))+
      .20*low(coverage.map(x=>x.best),3)+
      .15*mean(coverage.map(x=>x.second));
    const leads=three.map(i=>{
      const others=three.filter(j=>j!==i);
      const foeRows=publicSix.map(s=>{
        const possibleSwitches=publicSix.filter(x=>x!==s);
        const options=moves[i].map((m,k)=>({
          i:k,move:m,score:moveRows(dex,own[i],s,publicSix,[{i:k,move:m}])[0]?.score||0
        }));
        const direct=max(options.map(x=>x.score));
        // If a public switch blanks the lead, retain a second attack source.
        const backup=low(possibleSwitches.map(sw=>max(others.map(j=>best(j,sw)))),2);
        return .8*direct+.2*backup;
      });
      return {i,score:.7*mean(foeRows)+.3*low(foeRows,3)};
    }).sort((x,y)=>y.score-x.score||x.i-y.i);
    const megaCount=three.filter(i=>Boolean(dex.items.get(own[i].item).megaStone)).length;
    const score=teamScore*.60+leads[0].score*.40-Math.max(0,megaCount-1)*25;
    candidates.push({three,leads,score,teamScore});
  }
  candidates.sort((a,b)=>b.score-a.score||a.three.join(',').localeCompare(b.three.join(',')));
  const chosen=candidates[0],lead=chosen.leads[0].i;
  const rest=chosen.three.filter(i=>i!==lead).sort((a,b)=>
    chosen.leads.find(x=>x.i===b).score-chosen.leads.find(x=>x.i===a).score||a-b);
  return {selection:[lead,...rest].map(i=>i+1),status:'research-only',
    top:candidates.slice(0,3).map(c=>({three:c.three.map(i=>own[i].species),
      lead:own[c.leads[0].i].species,score:+c.score.toFixed(2)})),
    warning:'no enemy private sets or selected three; heuristic move/switch continuity only; no probabilities, Mega form exactness, or Showdown-exact turn solver'};
}
module.exports={chooseContinuityPreview,chooseContinuityMove,moveRows};
