'use strict';
// Research-only observer: a repeated attack met by repeated healing is a
// CANDIDATE for tactical non-progress, never an automatic misplay.
// Only public Showdown protocol events are read. Unknown Choice, PP, and
// private sets must NOT be inferred. This does not modify battle decisions.
function sideOf(actor) {
  const m=String(actor||'').match(/^(p[12])[a-f]:/);
  return m?m[1]:null;
}
function health(s) {
  const m=String(s||'').match(/^(\d+)\/(\d+)[gyr]?(?:\s|$)/);
  if(m && +m[2]>0)return +m[1]/+m[2];
  if(/^0(?: fnt)?$/.test(String(s||'')))return 0;
  return null;
}
function auditRepeatedHealing(log,{ownSide='p1',minAttacks=3,minHealingTurns=2}={}) {
  if(!['p1','p2'].includes(ownSide))throw Error('ownSide must be p1 or p2');
  if(!Number.isInteger(minAttacks)||minAttacks<2||!Number.isInteger(minHealingTurns)||minHealingTurns<1)
    throw Error('invalid audit thresholds');
  const foe=ownSide==='p1'?'p2':'p1';
  const sides=['p1','p2'];
  const active={p1:'',p2:''},lastHP={p1:null,p2:null};
  const encore={p1:false,p2:false},knownChoice={p1:false,p2:false};
  const turns=[];
  let row=null;
  const makeTurn=n=>({
    turn:n,moves:{p1:[],p2:[]},heals:{p1:0,p2:0},
    switches:{p1:0,p2:0},boosts:{p1:0,p2:0},
    cant:{p1:0,p2:0},hpBefore:{...lastHP},hpAfter:null
  });
  for(const line of String(log).split('\n')){
    const a=line.split('|'),type=a[1],s=sideOf(a[2]);
    if(type==='turn'){
      if(row){row.hpAfter={...lastHP};turns.push(row);}
      row=makeTurn(Number(a[2]));
      continue;
    }
    if(['switch','drag','replace'].includes(type)&&s){
      active[s]=String(a[2]).slice(5);
      if(type!=='replace'){encore[s]=false;knownChoice[s]=false;}
      if(row)row.switches[s]++;
      const hp=health(a[4]);if(hp!==null)lastHP[s]=hp;
    }
    if(type==='-start'&&s&&a[3]==='Encore')encore[s]=true;
    if(type==='-end'&&s&&a[3]==='Encore')encore[s]=false;
    if(type==='-item'&&s&&/^Choice (?:Band|Specs|Scarf)$/.test(a[3]||''))knownChoice[s]=true;
    if(['-enditem','-takeitem'].includes(type)&&s)knownChoice[s]=false;
    if(!row||!Number.isInteger(row.turn)||row.turn<1)continue;
    if(type==='move'&&s){
      row.moves[s].push({actor:a[2],move:a[3],encored:encore[s],choiceRevealed:knownChoice[s]});
    }
    if(type==='cant'&&s)row.cant[s]++;
    if(type==='-heal'&&s)row.heals[s]++;
    if(['-boost','-unboost','-setboost','-clearboost'].includes(type)&&s)row.boosts[s]++;
    if(type==='-clearallboost')for(const p of sides)row.boosts[p]++;
    if(['-damage','-heal','-sethp'].includes(type)&&s){
      const hp=health(a[3]);if(hp!==null)lastHP[s]=hp;
    }
    if(type==='faint'&&s)lastHP[s]=0;
  }
  if(row){row.hpAfter={...lastHP};turns.push(row);}
  const findings=[];
  for(const attackSide of sides){
    const defendingSide=attackSide==='p1'?'p2':'p1';
    let run=[];
    const commit=()=>{
      if(run.length>=minAttacks){
        const healingTurns=run.filter(r=>r.heals[defendingSide]>0).length;
        if(healingTurns>=minHealingTurns){
          const first=run[0],last=run[run.length-1];
          const start=first.hpBefore[defendingSide],end=last.hpAfter[defendingSide];
          findings.push({
            attackSide,defendingSide,attackActor:first.moves[attackSide][0].actor,
            repeatedMove:first.moves[attackSide][0].move,
            fromTurn:first.turn,toTurn:last.turn,attackTurns:run.length,healingTurns,
            hpStart:start,hpEnd:end,hpNet:start===null||end===null?null:Number((end-start).toFixed(4)),
            attackerEncoreObserved:run.some(r=>r.moves[attackSide][0].encored),
            attackerChoiceRevealed:run.some(r=>r.moves[attackSide][0].choiceRevealed),
            boostTurns:run.filter(r=>r.boosts.p1||r.boosts.p2).length,
            forcedCantTurns:run.filter(r=>r.cant[attackSide]).length,
            ppKnown:false,
            classification:'candidate-only; assess legality, PP, HP, KO line, voluntary choice and alternatives separately'
          });
        }
      }
      run=[];
    };
    for(const t of turns){
      const m=t.moves[attackSide];
      const previous=run[run.length-1];
      const prevMove=previous?.moves[attackSide][0];
      const compatible=m.length===1 && !t.switches[attackSide]&&!t.switches[defendingSide] &&
        (!previous||(t.turn===previous.turn+1&&m[0].actor===prevMove.actor&&m[0].move===prevMove.move));
      if(!compatible)commit();
      if(m.length===1&&!t.switches[attackSide]&&!t.switches[defendingSide])run.push(t);
    }
    commit();
  }
  return {ownSide,foeSide:foe,turnsObserved:turns.length,
    // No PP assertions: the public battle log does not expose both sides' PP.
    ppKnown:false,findings:findings.sort((a,b)=>a.fromTurn-b.fromTurn)};
}
module.exports={auditRepeatedHealing};
