#!/usr/bin/env node
'use strict';
/**
 * Actual outcome-divergent battles, with original PREVIEW policies and
 * identical seeds/teams/AI settings. All logs are POSTMATCH audit material.
 * We do NOT automatically call losing preview a mistake or enemy AI rational.
 */
const fs=require('node:fs');
const path=require('node:path');
const {load,game,hashSeed}=require('./lab');
const {groups}=require('./environment-m7-teams');
const {reportedLive}=require('./reported-live-roster-20261027');
const {comparePair,actionSummary}=require('./battle-loss-audit');
const sim=load(),own=reportedLive();
const cases=[
  ['01_M7_golisopod_balance','forced-pressure',0],
  ['01_M7_golisopod_balance','rational-opponent',0],
  ['01_M7_golisopod_balance','rational-opponent',1],
  ['07_M7_baxcalibur_offense','forced-pressure',1],
  ['07_M7_baxcalibur_offense','rational-opponent',0],
  ['07_M7_baxcalibur_offense','rational-opponent',1],
];
const out=path.resolve('output','p0-winloss-audit');
async function main(){
  fs.mkdirSync(out,{recursive:true});
  const summary=[];
  for(const [name,mode,i] of cases){
    const group=groups.find(x=>x.name===name);
    if(!group)throw Error('Missing fixture '+name);
    const seed=hashSeed(1200000+groups.indexOf(group)*10000+
      (mode==='forced-pressure'?1000:0)+i);
    const reverse=Boolean(i%2);
    const sides=reverse?[group.team,own]:[own,group.team],ourSide=reverse?'p2':'p1';
    const opts={megaAware:true,opponentPreviewPolicy:'rational',
      candidateDecisionPolicy:'v3',opponentDecisionPolicy:'v3'};
    if(mode==='forced-pressure')opts.opponentForced=group.forcedA;
    const matches=[];
    for(const policy of ['rational-top','engine-two-turn-coverage']){
      const result=await game(sim,sides[0],sides[1],seed,true,null,reverse,{
        ...opts,candidatePreviewPolicy:policy
      });
      if(result.trace.errors.length)throw Error('Invalid choices '+JSON.stringify(result.trace.errors));
      matches.push(result);
    }
    const [oldMatch,newMatch]=matches;
    const comparison=comparePair(oldMatch,newMatch,ourSide);
    const win=match=>match.winner===(reverse?'opponent':'candidate');
    const last={
      case:name,mode,seed,reverse,ourSide,
      oldWon:win(oldMatch),newWon:win(newMatch),
      oldThree:comparison.before.selected,newThree:comparison.after.selected,
      oldLead:comparison.before.lead,newLead:comparison.after.lead,
      oldFoeThreePostGame:comparison.before.foeSelectedOnlyKnownPostGame,
      newFoeThreePostGame:comparison.after.foeSelectedOnlyKnownPostGame,
      oldFoeLeadPostGame:comparison.before.foeLeadPostGame,
      newFoeLeadPostGame:comparison.after.foeLeadPostGame,
      oldFoeActions:actionSummary(oldMatch.trace,ourSide==='p1'?'p2':'p1'),
      newFoeActions:actionSummary(newMatch.trace,ourSide==='p1'?'p2':'p1'),
      firstDifferentOwnAction:comparison.firstDifferentAction,
      ownOld:comparison.before.ownObserved,
      ownNew:comparison.after.ownObserved,
      foeOld:comparison.before.foeObserved,
      foeNew:comparison.after.foeObserved,
      turnsOld:oldMatch.turns,turnsNew:newMatch.turns,
      requiredJudgments:comparison.causes
    };
    summary.push(last);
    const file=name+'_'+mode+'_'+i+'.json';
    fs.writeFileSync(path.join(out,file),JSON.stringify({
      metadata:last,
      publicTimelines:comparison.timeline,
      ownActions:{old:comparison.before.actions,new:comparison.after.actions},
      evidencePurpose:'postgame only; real hidden three never used in preview Bot',
    },null,2));
    console.log('BATTLE_CAUSAL_PAIR '+JSON.stringify({
      ...last,oldFoeActions:last.oldFoeActions.slice(0,6),
      newFoeActions:last.newFoeActions.slice(0,6)
    }));
  }
  const divergence=summary.filter(x=>x.oldWon!==x.newWon);
  const report=[
    '# P0-6 実戦用の負け筋分析に向けた対戦ログ・独立監査素材',
    '',
    '比較方法：現在の6体、M-Cの固定Showdown、対戦条件・シード・敵AI v3を固定し、選出AIだけを旧rational-topと新engine-two-turn-coverageで変更。',
    '敵の実際の3体・技・行動は、**選出後の監査用ログ**でのみ見る。選出AI入力は敵公開6体のみ。',
    '**この報告は因果の確定やプレミ判定を自動で行わない。**',
    '',
    '## 結果',
    '| ケース | 条件 | 旧 | 新 | 旧初手 | 新初手 |',
    '|---|---|---|---|---|---|',
    ...summary.map(x=>'| '+x.case+' | '+x.mode+' | '+(x.oldWon?'勝':'負')+
      ' | '+(x.newWon?'勝':'負')+' | '+x.oldLead+' | '+x.newLead+' |'),
    '',
    '勝敗変化：'+divergence.length+'/'+summary.length+'ケース。',
    '',
    '## 必須の人間・独立AI監査',
    '1. **選出合理性**：敵公開6体のみから、旧・新の3体と初手の勝ち筋を採点。事後判明した敵3体を事前採点へ持ち込まない。',
    '2. **相手AI合理性**：相手自身の公開可能情報に基づき、選出・交代・技を別採点。旧版勝利が相手のプレミなら優位性の証拠としない。',
    '3. **ターンAIのプレミ**：固定の同じv3でも、選出で盤面が変わった後の技/交代を監査。明確なプレミを実装側へ帰属。',
    '4. **構築上の弱点**：双方の合理的なプレイでも勝ち筋が成立しないか確認。6体は同一なので構築弱さだけでは旧新の差を説明しない。',
    '5. **検証条件の偏り**：固定合成3体・2seedの結果を実ランク勝率と混同しない。',
    '',
    '各ケースのJSONに**公開ターンログ・自他の行動・選出・結果**を分離保存。勝敗以外の確認ができない事象は未判定。',
  ].join('\n');
  fs.writeFileSync(path.join(out,'audit-review.md'),report);
  fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify({
    cases:summary.length,oldWins:summary.filter(x=>x.oldWon).length,
    newWins:summary.filter(x=>x.newWon).length,
    diverged:divergence.length,casesToReview:summary
  },null,2));
  console.log('BATTLE_CAUSAL_SUMMARY '+JSON.stringify({
    cases:summary.length,oldWins:summary.filter(x=>x.oldWon).length,
    newWins:summary.filter(x=>x.newWon).length,diverged:divergence.length,
    actualOutcomeDivergence:divergence.map(x=>({case:x.case,mode:x.mode,seed:x.seed,
      oldWon:x.oldWon,newWon:x.newWon,oldLead:x.oldLead,newLead:x.newLead})),
    interpretation:'Outcome-divergent matches now captured; NO selection/turn/opponent rationality conclusions without reviewing turn logs.'
  }));
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
