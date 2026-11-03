'use strict';
// Corroborate PUBLIC switch observations with this harness's OWN request/choice
// trace. Never infer human rationality or the opponent's hidden information.
// This audit is unavailable for real ladder logs without decision traces.
const {classifyPublicSwitches}=require('./public-execution-audit');
const species=s=>String(s||'').split(',')[0].trim();
function classifyChoiceCorroboratedSwitches(log,ownSide,rivalSide,choiceAudit,maxTurn=2){
  const observed=classifyPublicSwitches(log,ownSide,rivalSide,maxTurn);
  const detail={own:[],rival:[]};
  let turn=0;
  for(const line of String(log).split('\n')){
    const a=line.split('|');
    if(a[1]==='turn'){turn=Number(a[2])||0;continue;}
    if(turn<1||turn>maxTurn||!['switch','drag'].includes(a[1]))continue;
    const match=String(a[2]||'').match(/^(p[12])[a-f]:/);
    if(!match)continue;
    const key=match[1]===ownSide?'own':match[1]===rivalSide?'rival':null;
    if(key)detail[key].push({turn,kind:a[1],species:species(a[3])});
  }
  const result={own:[],rival:[]};
  for(const [key,side] of [['own',ownSide],['rival',rivalSide]]){
    if(detail[key].length!==observed[key].length)
      throw Error('public switch event alignment failed for '+side);
    for(let i=0;i<observed[key].length;i++){
      const e=observed[key][i],d=detail[key][i];
      if(e.turn!==d.turn||e.kind!==d.kind)throw Error('switch order mismatch');
      let evidence=e.classification;
      if(e.classification==='nonfaint-switch-cause-unknown'){
        const matches=(choiceAudit||[]).filter(c=>c.side===side&&
          c.turn===e.turn&&/^switch [1-6](?:$|\s)/.test(c.choice||'')&&
          species(c.chosenSpecies)===d.species&&c.requestKind!=='preview');
        if(matches.length===1){
          evidence=matches[0].requestKind==='normal'
            ?'bot-chose-switch-on-normal-request'
            :matches[0].requestKind==='forced'
              ?'switch-on-forced-request':'unresolved';
        }else evidence='unresolved';
      }
      result[key].push({...e,species:d.species,evidence,
        // This proves only the harness Bot's submitted choice, not optimality.
        botChoiceCorroborated:evidence==='bot-chose-switch-on-normal-request'});
    }
  }
  return result;
}
module.exports={classifyChoiceCorroboratedSwitches};
