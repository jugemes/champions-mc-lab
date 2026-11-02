'use strict';
// Research-only P0 opponent selection hypotheses. No hidden opposing set access.
// ownKnownSix = the RIVAL's own complete legal sets; opposingPublicSix = species names ONLY.
// Enumerates distinct legal 3+lead hypotheses for stress testing, not a calibrated
// rational-human policy or usage-frequency model. Never activates default Bot.
const {matchup}=require('./lab');
const mean=a=>a.reduce((s,x)=>s+x,0)/Math.max(1,a.length);
function enumeratePublicRivalBranches(dex,ownKnownSix,opposingPublicSix,{limit=3}={}){
  if(ownKnownSix.length!==6||opposingPublicSix.length!==6||
     opposingPublicSix.some(s=>typeof s!=='string')||
     new Set(opposingPublicSix.map(s=>dex.species.get(s).baseSpecies||s)).size!==6)
    throw Error('rival hypotheses require six public species and six known own sets');
  if(!Number.isInteger(limit)||limit<1||limit>12)throw Error('invalid branch limit');
  // Public preview ordering is not strategic evidence; stabilize floating sums.\n  const publicSpecies=[...opposingPublicSix].sort();\n  const hit=(i,s)=>Math.max(0,...ownKnownSix[i].moves.map(m=>matchup(dex,ownKnownSix[i],s,m)));
  const leadHit=(i)=>mean(publicSpecies.map(s=>hit(i,s)));
  const rows=[];
  for(let a=0;a<6;a++)for(let b=a+1;b<6;b++)for(let c=b+1;c<6;c++){
    const trio=[a,b,c];
    const coverage=publicSpecies.map(s=>trio.map(i=>hit(i,s)).sort((x,y)=>y-x));
    const broad=mean(coverage.map(x=>x[0]));
    const backup=mean(coverage.map(x=>x[1]));
    const floor=Math.min(...coverage.map(x=>x[0]));
    const megaCount=trio.filter(i=>Boolean(dex.items.get(ownKnownSix[i].item).megaStone)).length;
    for(const lead of trio){
      const pressure=leadHit(lead);
      // Three complementary hypotheses: coverage, immediate pressure, and floor.
      // Values are matchup HEURISTICS, not engine damage or survival guarantees.
      const scores={
        coverage:.55*broad+.25*backup+.20*pressure,
        pressure:.40*broad+.15*backup+.45*pressure,
        floor:.40*broad+.20*backup+.25*floor+.15*pressure
      };
      for(const mode of Object.keys(scores))rows.push({
        mode,selection:[lead,...trio.filter(i=>i!==lead)].map(i=>ownKnownSix[i].species),
        score:scores[mode]-Math.max(0,megaCount-1)*25
      });
    }
  }
  const result=[],usedTrio=new Set(),usedLead=new Set();
  // Each objective supplies one DIFFERENT 3-mon roster, where possible.
  for(const mode of ['coverage','pressure','floor']){
    const candidates=rows.filter(r=>r.mode===mode).sort((a,b)=>
      b.score-a.score||a.selection.join(',').localeCompare(b.selection.join(',')));
    const pick=candidates.find(r=>{
      const key=[...r.selection].sort().join(',');
      return !usedTrio.has(key)&&!usedLead.has(r.selection[0]);
    })||candidates.find(r=>!usedTrio.has([...r.selection].sort().join(',')));
    if(!pick)continue;
    result.push({...pick,rationale:'public-species offensive coverage hypothesis; rationality NOT certified'});
    usedTrio.add([...pick.selection].sort().join(','));usedLead.add(pick.selection[0]);
    if(result.length>=limit)break;
  }
  return result;
}
module.exports={enumeratePublicRivalBranches};
