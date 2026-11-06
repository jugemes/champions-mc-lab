#!/usr/bin/env node
'use strict';
// PR #80 item 5: one concrete 3+lead per public six and a conditional T1/T2
// table, read from the ENGINE logs of public-six-general-eval.js (PR #80 run).
// Preview decision = the human1 pick, fixed from the saved search only (public
// species, role-template hypotheses); the hidden rival sets are only the
// hypotheses the games were RUN with, aggregated over all hypotheses of the
// six. Conditions are public at the time of the decision: the rival's lead
// (visible at T1) and the rival's T1 action (visible before our T2).
// Rows: rival-view 3 (its legacy pick and its ace-lead pick) x rival T1/T2
// branch (ai / attack / setup / switch / utility = recovery-Encore-hazard-
// status). "our T1"/"our T2" = what our turn AI actually executed (modal), the
// failure line = the modal T1/T2 sequence of the lost games.
// Heuristic AI vs heuristic AI, 3 seeds x both sides per row: small samples,
// NOT a ladder win rate.
//   EVALS=a.json,b.json OUT=reports/... node pr80-decision-trees.js
const fs=require('node:fs');
const mode=a=>{const c={};for(const x of a)c[x]=(c[x]||0)+1;const e=Object.entries(c).sort((p,q)=>q[1]-p[1]);return e.length?e[0][0]+(e.length>1?' ('+e[0][1]+'/'+a.length+')':''):'-';};
// T1/T2 action of one side from earlyLines output
function actions(t1t2,who){
  const out={T1:[],T2:[]};let t=null,fainted=false;
  for(const l of t1t2){
    if(l==='T1'||l==='T2'){t=l;fainted=false;continue;}
    if(!t)continue;
    const [kind,actor,rest]=l.split('|');
    if(!actor||!actor.startsWith(who+':'))continue;
    const mon=actor.slice(who.length+1);
    if(kind==='faint'){out[t].push(mon+' fainted');fainted=true;}
    else if(kind==='move')out[t].push(mon+':'+rest);
    else if(kind==='-mega')out[t].push('Mega '+mon);
    else if(kind==='switch'||kind==='drag')out[t].push((fainted?'replace→':kind==='drag'?'dragged→':'switch→')+mon);
    else if(kind==='-start'&&/Encore/.test(rest||''))out[t].push(mon+' Encored');
  }
  return {T1:out.T1.join(', ')||'(no action)',T2:out.T2.join(', ')||'(no action)'};
}
function trees(evals){
  const bySix={};
  for(const e of evals)for(const c of e.cases)(bySix[c.six]||(bySix[c.six]=[])).push(c);
  const out=[];
  for(const [six,cs] of Object.entries(bySix)){
    const human=cs[0].summary.human1?.support?.[0]?.[0];
    if(!human)continue;
    const rows=[],grp={};
    for(const c of cs)for(const g of c.branchGames.filter(g=>g.pick===human)){
      const lead=g.rival.split('/')[0],key=g.rsrc+'|'+g.rival+'|'+g.branch;
      (grp[key]||(grp[key]={rsrc:g.rsrc,rival:g.rival,lead,branch:g.branch,games:[],hyps:{}})).games.push(g);
      const h=grp[key].hyps[c.hyp]||(grp[key].hyps[c.hyp]=[0,0]);h[0]+=g.won;h[1]++;
    }
    for(const r of Object.values(grp)){
      const own=r.games.map(g=>actions(g.t1t2,'OWN')),riv=r.games.map(g=>actions(g.t1t2,'RIVAL'));
      const lost=r.games.filter(g=>!g.won);
      const req=r.games.flatMap(g=>g.requested||[]).map(q=>q.result);
      rows.push({rivalSource:r.rsrc,rival3:r.rival,rivalLead:r.lead,branch:r.branch,won:r.games.reduce((s,g)=>s+g.won,0),n:r.games.length,
        byHypothesis:Object.fromEntries(Object.entries(r.hyps).map(([k,[w,n]])=>[k,w+'/'+n])),
        rivalT1:mode(riv.map(a=>a.T1)),ourT1:mode(own.map(a=>a.T1)),rivalT2:mode(riv.map(a=>a.T2)),ourT2:mode(own.map(a=>a.T2)),
        failureLine:lost.length?mode(lost.map(g=>{const o=actions(g.t1t2,'OWN'),v=actions(g.t1t2,'RIVAL');return 'T1 '+v.T1+' / '+o.T1+' ; T2 '+v.T2+' / '+o.T2;})):null,
        requested:req.length?Object.fromEntries(['executed','preempted','forcedOut','mismatch'].map(k=>[k,req.filter(x=>x===k).length]).filter(([,v])=>v)):null,
        rivalTagged:r.games.filter(g=>g.foeTagged).length,ownTagged:r.games.filter(g=>g.ownTagged).length});
    }
    rows.sort((a,b)=>a.rivalSource.localeCompare(b.rivalSource)||a.branch.localeCompare(b.branch));
    const s=cs.map(c=>({hyp:c.hyp,human1:c.summary.human1,general:c.summary.general,top2:c.summary.top2,fallback:c.summary.fallback,
      registeredA:c.summary.registeredA,perPick:c.perPick.find(p=>p.pick===human),sets:c.sets}));
    out.push({six,ace:cs[0].ace,human1:human,hypotheses:s,rows});
  }
  return out;
}
const pct=(w,n)=>w+'/'+n;
function markdown(T){
  const L=[];
  for(const t of T){
    const [lead,rest]=t.human1.split('>');
    L.push('### '+t.six+' — 選出 **'+lead+'先発、裏 '+rest+'**（ace想定: '+t.ace+'）','');
    L.push('| 仮説 | human1 sec / mean / ace / 最悪の相手選出 | general sec / mean | fallback sec / mean |','|---|---|---|---|');
    for(const h of t.hypotheses)L.push('| '+h.hyp+' | '+h.human1.security+' / '+h.human1.mean+' / '+h.human1.aceCoverage+' / '+(h.perPick?.worstBy||[]).slice(0,2).join(', ')+
      ' | '+h.general.security+' / '+h.general.mean+' | '+h.fallback.security+' / '+h.fallback.mean+' |');
    L.push('','| 相手3体（出所） | 相手T1分岐 | 勝 | 相手T1（実行） | こちらT1（実行） | 相手T2 | こちらT2 | 負け筋（最頻） |','|---|---|---|---|---|---|---|---|');
    for(const r of t.rows)L.push('| '+r.rival3+' ('+r.rivalSource+') | '+r.branch+' | '+pct(r.won,r.n)+' | '+r.rivalT1+' | '+r.ourT1+' | '+r.rivalT2+' | '+r.ourT2+' | '+(r.failureLine||'—')+' |');
    L.push('');
  }
  return L.join('\n');
}
function main(){
  const evals=process.env.EVALS.split(',').map(f=>JSON.parse(fs.readFileSync(f,'utf8')));
  const T=trees(evals);
  if(process.env.OUT){fs.writeFileSync(process.env.OUT+'.json',JSON.stringify(T,null,1));fs.writeFileSync(process.env.OUT+'.md',markdown(T));}
  else console.log(markdown(T));
}
if(require.main===module)main();
module.exports={actions,trees,markdown};
