#!/usr/bin/env node
'use strict';
// PR #96 request: paired comparison of legacy / quick / v2 / pr93 (+T1T2) /
// pr95 (= pr94 floor, +T1T2 with the pr94 key) / pr96 (+T1T2 keyOf96) on the
// SAME rival 3 + lead cells, branches, seeds and sides (holdout-20261031-pr96).
//   rival   'aware' = pr96 immune-aware rival (PRIMARY); 'naive' = the PR #95
//           rival (secondary, for continuity with PR #95 numbers).
//   metric  meanAce = mean win over ALL games of the cells whose rival three
//           contains the ace (no per-candidate filter); meanAll over all
//           cells; meanRat94 (PR #95 metric, naive rival) for continuity.
//   PHASE=DEV    A/C/F2/F3/N1/N2/N3/N4 (all developed). legacy/quick/v2/pr93/
//                pr95 picks are the SAVED ones (reports/data/pr94-eval-*.json),
//                pr93 T1/T2 = saved pr92 tables (A..N2 only), pr95 T1/T2 is
//                rebuilt with the PR #95 code from the public six.
//   PHASE=FINAL  N5/N6 (predeclared df1a3ce), run ONCE, every selector run.
// Every selector receives ONLY the six public species strings.
// Heuristic AI vs heuristic AI on constructed sets. NOT a ladder win rate.
const fs=require('node:fs');
const {load,hashSeed,chooseThree,normalize}=require('./lab');
const M=require('./pr82-switch-utility-t1t2');
const GP=require('./pr88-guarded-preview');
const V2=require('./pr90-guarded-preview-v2');
const P92=require('./pr92-rational-cover-preview');
const T92=require('./pr92-t1t2');
const C=require('./pr94-cover-preview');
const T=require('./pr94-t1t2');
const E94=require('./pr94-eval');
const H94=require('./holdout-20261031-pr94');
const H92=require('./holdout-20261031-pr92');
const H=require('./holdout-20261031-pr96');
const X=require('./pr96-paired');
const {rivalCandidates}=require('./preview-legal-search');
const {picks,label}=require('./a-preview-matrix-audit');
const SHOWDOWN='3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',FORMAT='gen9championsbssregmc';
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null,r3=x=>x==null?null:+x.toFixed(3);
const pk=p=>Array.isArray(p)?p.join('>'):p.replace(/\//g,'>');
const MODELS=['rational','tm'],RIVALS=['aware','naive'];
function devSixes(){
  const dev=JSON.parse(fs.readFileSync('reports/data/pr94-eval-dev.json','utf8')).sixes;
  const fin=JSON.parse(fs.readFileSync('reports/data/pr94-eval-final.json','utf8')).sixes;
  const out=E94.devSixes().map(x=>({...x,saved:{...x.saved,pr95:dev[x.id].selection.pr94floor},seedBase95:H94.DEV_SEARCH_BASE}));
  for(const x of E94.finalSixes())out.push({...x,saved:{legacy:fin[x.id].selection.legacy,quick:fin[x.id].selection.quick,v2:fin[x.id].selection.v2,pr93:fin[x.id].selection.pr93,pr95:fin[x.id].selection.pr94floor},seedBase95:H94.SEARCH_SEED_BASE});
  return out;
}
function finalSixes(){return Object.entries(H.unseenSixesPR96()).map(([id,x])=>({id,ace:x.ace,hyps:x.hypotheses,saved:null,table92:null}));}
// The pr94 selector's public-derived scenario teams and rival cells (no battle).
function selectorCells94(sim,own,publicSix){
  const dex=sim.Dex.mod('champions'),o=C.COVER94,ownSpecies=own.map(p=>p.species);
  const {teams}=C.scenarioTeamsPR94(sim,publicSix,o);
  if(o.altRatio)for(const a of GP.altCategoryScenarios(sim,publicSix,teams[0],o.altRatio))teams.push(a.team);
  const cells=[];teams.forEach((t,si)=>{for(const c of P92.rivalCellsRational(dex,t,ownSpecies,o))cells.push({si,...c});});
  return {teams,cells};
}
function cellsFor(model,{dex,team,ownSpecies,ace}){
  if(model==='rational')return H92.rationalCellsPR92({dex,team,ownSpecies,ace,chooseThree,rivalCandidates}).cells;
  return H94.tmCells({dex,team,ownSpecies,ace}).cells;
}
async function main(){
  const sim=load(),dex=sim.Dex.mod('champions'),validator=sim.TeamValidator.get(FORMAT);
  const own=require('./reported-live-roster-20261027').reportedLive(),ownSpecies=own.map(p=>p.species);
  const PHASE=process.env.PHASE||'DEV',W=Number(process.env.WORKERS||4);
  const only=process.env.ONLY?new RegExp(process.env.ONLY):null;
  const sixes=(PHASE==='FINAL'?finalSixes():devSixes()).filter(x=>!only||only.test(x.id));
  const evalBase=PHASE==='FINAL'?H.FINAL_SEED_BASE:H.DEV_SEED_BASE,selA=PHASE==='FINAL'?H.SEARCH_SEED_BASE:H.DEV_SEARCH_BASE,selB=PHASE==='FINAL'?H.SEARCH_SEED_BASE_B:H.DEV_SEARCH_BASE_B;
  const out={},J=[],teams=[],T0=Date.now();
  for(const [ui,x] of sixes.entries()){
    const publicSix=Object.values(x.hyps)[0].map(p=>p.species);
    for(const t of Object.values(x.hyps)){if(JSON.stringify(t.map(p=>p.species))!==JSON.stringify(publicSix))throw Error(x.id+' hyps differ');
      const p=validator.validateTeam(normalize(t));if(p?.length)throw Error(x.id+': '+p.join('; '));}
    const sel={},sec={},plans={},tables={};
    let table92=x.table92||null,t0;
    if(x.saved)Object.assign(sel,x.saved);
    else{
      t0=Date.now();sel.legacy=pk(GP.legacyPick(dex,own,publicSix.slice()));sec.legacy=(Date.now()-t0)/1000;
      const qp=await M.livePreview({sim,own,publicSix:publicSix.slice(),seed:hashSeed(selA+ui*100),budgetSeconds:M.QUICK_SECONDS,workers:W});sel.quick=pk(qp.pick);sec.quick=qp.seconds;
      const v=await V2.guardedPreviewHard({dex,own,publicSix:publicSix.slice(),seedBase:selA+ui*1000,workers:W,budgetSeconds:120});sel.v2=pk(v.pick);sec.v2=v.seconds;
      const c93=await P92.coverPreviewHard({dex,own,publicSix:publicSix.slice(),seedBase:selA+ui*1000,workers:W,budgetSeconds:300,opts:{cellRule:P92.FROZEN.cellRule}});
      sel.pr93=pk(c93.pick);sec.pr93=c93.seconds;
      if(c93._teams){const tt=await T92.buildT1T2({sim,own,pick:c93.pick,teams:c93._teams,cells:c93._cells,seedBase:H.T1T2_SEED_BASE+ui*1000,workers:W});table92=tt.table;sec.pr93T1T2=tt.seconds;}
      t0=Date.now();const c94=await C.coverPreview94({sim,own,publicSix:publicSix.slice(),seedBase:selA+ui*1000,workers:W,budgetSeconds:300});
      sel.pr95=pk(c94.status==='abstain'?c94.label:C.decidePR94(c94.scores,{...C.COVER94,decision:'floor'}).pick);sec.pr95=+((Date.now()-t0)/1000).toFixed(1);
    }
    // pr95 T1/T2: PR #95 code (naive rival, pr94 key) on the pr94 selector cells
    {const sc=selectorCells94(sim,own,publicSix.slice());t0=Date.now();
      const tt=await T.buildT1T2({sim,own,pick:sel.pr95.split('>'),teams:sc.teams,cells:sc.cells,seedBase:(x.saved?x.seedBase95:H.T1T2_SEED_BASE)+5000+ui*1000,workers:W});
      tables.pr95={rules:T.humanRules(tt.table).filter(r=>r.includes(' -> DO ')),nRules:tt.rules,keys:tt.keys,games:tt.games,seconds:tt.seconds};
      plans.pr95T1T2={pick:sel.pr95,plan:{table:tt.table},keyVer:'pr94'};sec.pr95T1T2=tt.seconds;}
    // pr96: selector seed A (policy) and seed B (stability only)
    t0=Date.now();const c96=await X.coverPreview96({sim,own,publicSix:publicSix.slice(),seedBase:selA+ui*1000,workers:W,budgetSeconds:300});sec.pr96=+((Date.now()-t0)/1000).toFixed(1);
    sel.pr96=pk(c96.label||c96.pick);
    t0=Date.now();const c96b=await X.coverPreview96({sim,own,publicSix:publicSix.slice(),seedBase:selB+ui*1000,workers:W,budgetSeconds:300});sec.pr96seedB=+((Date.now()-t0)/1000).toFixed(1);
    if(c96._teams){t0=Date.now();
      const tt=await X.buildT1T2_96({sim,own,pick:sel.pr96.split('>'),teams:c96._teams,cells:c96._cells,seedBase:(x.saved?selA:H.T1T2_SEED_BASE)+5000+ui*1000,workers:W});
      tables.pr96={rules:T.humanRules(tt.table).filter(r=>r.includes(' -> DO ')),nRules:tt.rules,keys:tt.keys,t2Keys:tt.t2Keys,t2KeysWithRivalHazard:tt.t2KeysWithRivalHazard,t2RulesWithRivalHazard:tt.t2RulesWithRivalHazard,games:tt.games,seconds:tt.seconds};
      plans.pr96T1T2={pick:sel.pr96,plan:{table:tt.table},keyVer:'pr96'};sec.pr96T1T2=tt.seconds;}
    console.log(x.id,JSON.stringify(sel),'pr96 seedB',pk(c96b.label||c96b.pick),JSON.stringify(sec));
    for(const k of ['legacy','quick','v2','pr93','pr95','pr96'])plans[k]={pick:sel[k],plan:{}};
    if(table92)plans.pr93T1T2={pick:sel.pr93,plan:{table92}};
    const strip=c=>{if(!c)return c;const {_teams,_cells,...r}=c;return r;};
    out[x.id]={publicSix,ace:x.ace,selection:sel,pr96SeedB:pk(c96b.label||c96b.pick),selectorSeconds:sec,pr96:strip(c96),pr96SeedBRun:{status:c96b.status,reason:c96b.reason,scores:c96b.scores},tables,hyps:{}};
    const distinct=new Map();for(const [pol,v] of Object.entries(plans)){const key=v.pick+'#'+(v.plan.table92?'t92':v.plan.table?'t'+pol:'ai');(distinct.get(key)||distinct.set(key,{...v,pols:[]}).get(key)).pols.push(pol);}
    Object.entries(x.hyps).forEach(([k,t],hi)=>{
      const ti=teams.push(t)-1;out[x.id].hyps[k]={cells:{}};
      MODELS.forEach((model,mi)=>{
        const cells=cellsFor(model,{dex,team:t,ownSpecies,ace:x.ace});
        out[x.id].hyps[k].cells[model]=cells.map(c=>c.src+':'+c.foe.join('/'));
        for(const [key,v] of distinct)cells.forEach((c,ci)=>H.BRANCHES.forEach((branch,bi)=>H.SEEDS.forEach(s=>RIVALS.forEach(rival=>{
          const base={six:x.id,hyp:k,model,rival,key,pols:v.pols,team:ti,own:v.pick.split('>'),foe:c.foe,cell:c.src,ci,aceCell:c.foe.includes(x.ace),branch,s,plan:v.plan,keyVer:v.keyVer||'pr96',
            immuneAware:rival==='aware',keepLines:branch==='ai'&&s<2&&rival==='aware'};
          J.push({...base,seed:H.evalSeed(evalBase,ui,hi,mi,ci,bi,s),reverse:H.sideOf(s)});
          if(s===0&&rival==='aware')J.push({...base,pairedOnly:true,keepLines:false,seed:H.evalSeed(evalBase,ui,hi,mi,ci,bi,s),reverse:!H.sideOf(s)});
        }))));
      });
    });
  }
  const tSel=Math.round((Date.now()-T0)/1000);
  const Rs=await X.runGames96(own,teams,J,{workers:W});
  const tGames=Math.round((Date.now()-T0)/1000)-tSel;
  const R=J.map((j,i)=>({j,r:Rs[i]}));
  const summary={};
  for(const [id,o] of Object.entries(out))for(const [k,h] of Object.entries(o.hyps)){
    h.byModel={};
    for(const model of MODELS){
      const hm=h.byModel[model]={};
      const Z=R.filter(z=>z.j.six===id&&z.j.hyp===k&&z.j.model===model);
      const pols=[...new Set(Z.flatMap(z=>z.j.pols))];
      for(const pol of pols)for(const rival of RIVALS){
        const Y=Z.filter(z=>z.j.rival===rival&&z.j.pols.includes(pol)&&!z.j.pairedOnly);
        const cell={};for(const z of Y)(cell[z.j.cell]||(cell[z.j.cell]={ace:z.j.aceCell,w:[]})).w.push(z.r.won);
        const byCell=Object.fromEntries(Object.entries(cell).map(([c,v])=>[c,{v:r3(mean(v.w)),ace:v.ace,n:v.w.length}]));
        const ace=Object.entries(byCell).filter(([,v])=>v.ace).sort((a,b)=>a[1].v-b[1].v);
        const all=Object.entries(byCell).sort((a,b)=>a[1].v-b[1].v);
        const rat=Y.filter(z=>C.rational94(z.j,{...z.r,immune:z.r.immune94}));
        const pair=rival==='aware'?Z.filter(z=>z.j.pairedOnly&&z.j.pols.includes(pol)).map(z=>{const m=Y.find(y=>y.j.s===0&&y.j.ci===z.j.ci&&y.j.branch===z.j.branch);return m?m.r.won===z.r.won:null;}).filter(v=>v!=null):[];
        const AY=Y.filter(z=>z.j.aceCell);
        const x={pick:Y[0].j.own.join('>'),plan:Y[0].j.plan.table?pol:Y[0].j.plan.table92?'pr93T1T2':'ai',n:Y.length,
          meanAce:r3(mean(AY.map(z=>z.r.won))),nAce:AY.length,aceCells:ace.length,worstAceCell:ace.length?ace[0][1].v:null,worstAceCellName:ace.length?ace[0][0]:null,
          meanAll:r3(mean(Y.map(z=>z.r.won))),worstCell:all[0][1].v,worstCellName:all[0][0],meanNonAce:r3(mean(Y.filter(z=>!z.j.aceCell).map(z=>z.r.won))),
          byCell,meanRat94:r3(mean(rat.map(z=>z.r.won))),nRat94:rat.length,
          maskedGames:Y.filter(z=>z.r.masked.length).length,maskedT12Games:Y.filter(z=>z.r.masked.some(m=>m.turn<=2)).length,
          residualImmuneT12:Y.filter(z=>z.r.immune.some(m=>m.turn<=2)).length,irrationalT12:Y.filter(z=>z.r.irrational.some(m=>Number(m.split(':')[0])<=2)).length,
          sameSeedSidesAgree:r3(mean(pair.map(v=>v?1:0))),sameSeedPairs:pair.length,
          use:Y[0].j.plan.table?T.useSummary(Y.map(z=>z.r)):undefined,
          useAceRuleWin:Y[0].j.plan.table?{T1:r3(mean(AY.filter(z=>String(z.r.used?.[1]).startsWith('rule:')).map(z=>z.r.won))),T2:r3(mean(AY.filter(z=>String(z.r.used?.[2]).startsWith('rule:')).map(z=>z.r.won)))}:undefined,
          lossLines:rival==='aware'?AY.filter(z=>z.j.cell===(ace[0]||[])[0]&&z.j.keepLines&&!z.r.won).slice(0,2).map(z=>({foe:z.j.foe.join('>'),branch:z.j.branch,seed:z.j.seed,reverse:z.j.reverse,turns:z.r.turns,keys:z.r.keys,used:z.r.used,masked:z.r.masked,lines:(z.r.lines||[]).slice(0,26)})):undefined};
        hm[rival+':'+pol]=x;
        (summary[rival+':'+model+':'+pol]||(summary[rival+':'+model+':'+pol]=[])).push({h:id+'/'+k,m:x.meanAce,w:x.worstAceCell,a:x.meanAll});
      }
    }
  }
  const agg=Object.fromEntries(Object.entries(summary).map(([p,v])=>[p,{hyps:v.length,meanAce:r3(mean(v.map(x=>x.m))),worstAceMean:r3(mean(v.map(x=>x.w))),zeroWorstAce:v.filter(x=>x.w===0).length,meanAll:r3(mean(v.map(x=>x.a))),perHyp:Object.fromEntries(v.map(x=>[x.h,[x.m,x.w,x.a]]))}]));
  // verdict (holdout-20261031-pr96 item 7)
  const fails=[],notes=[];
  const get=(id,k,model,pol)=>out[id]?.hyps[k]?.byModel[model]?.['aware:'+pol];
  if(PHASE==='DEV'){
    for(const [id,k] of [['A_golisopod','H1'],['N2_heracross','a']])for(const model of MODELS){const a=get(id,k,model,'pr96'),b=get(id,k,model,'v2');
      if(a&&b&&a.meanAce<b.meanAce-0.10-1e-9)fails.push('(c) DEV '+id+'/'+k+'/'+model+': pr96 '+a.meanAce+' < v2 '+b.meanAce+' - 0.10');}
  }
  if(PHASE==='FINAL'){
    let allEasy=true;
    for(const [id,o] of Object.entries(out))for(const k of Object.keys(o.hyps))for(const model of MODELS){
      const x=get(id,k,model,'pr96');if(!x)continue;
      if(x.aceCells<2){notes.push('insufficient '+id+'/'+k+'/'+model+': '+x.aceCells+' ace cells');continue;}
      if(x.worstAceCell===0)fails.push('(a) '+id+'/'+k+'/'+model+': worstAceCell 0 ('+x.worstAceCellName+')');
      const ref=Math.max(...['legacy','v2','pr95'].map(p=>get(id,k,model,p)?.meanAce??0));
      if(x.meanAce<ref-0.05-1e-9)fails.push('(b) '+id+'/'+k+'/'+model+': meanAce '+x.meanAce+' < max(legacy,v2,pr95) '+ref+' - 0.05');
      for(const p of ['legacy','quick','v2','pr93','pr95','pr96'])if((get(id,k,model,p)?.meanAce??1)<0.90)allEasy=false;
    }
    if(allEasy)fails.push('STOP: every policy >= .90 meanAce on every FINAL hypothesis x model: too easy, no pass');
    const t2=R.filter(z=>!z.j.pairedOnly&&z.j.rival==='aware'&&z.j.pols.includes('pr96T1T2')&&String(z.r.used?.[2]).startsWith('rule:')).length;
    const t1=R.filter(z=>!z.j.pairedOnly&&z.j.rival==='aware'&&z.j.pols.includes('pr96T1T2')&&String(z.r.used?.[1]).startsWith('rule:')).length;
    notes.push('pr96T1T2 forced rules FINAL (aware rival): T1 '+t1+' T2 '+t2+(t1+t2===0?' -> NOT a human recommendation':''));
  }
  const verdict={rule:'holdout-20261031-pr96 item 7',phase:PHASE,fails,notes,pass:!fails.length};
  const result={showdown:SHOWDOWN,format:FORMAT,phase:PHASE,evalSeedBase:evalBase,selectorSeedBases:[selA,selB],seeds:H.SEEDS,branches:H.BRANCHES,models:MODELS,rivals:RIVALS,
    sides:'one side per seed (reverse = s%2); same-seed opposite side only as pairedOnly on s=0 (aware)',own:'reportedLive',games:J.length,
    seconds:{selectionAndTables:tSel,evalGames:tGames},msPerGame:r3(mean(Rs.map(r=>r.ms))),summary:agg,verdict,sixes:out,
    note:'Selectors see only the six public species strings; T1/T2 tables are built from selector public-derived scenarios and executed against the real sets. AI vs AI, NOT a ladder win rate.'};
  const file=process.env.OUT||'reports/data/pr96-eval-'+PHASE.toLowerCase()+'.json';
  fs.writeFileSync(file,JSON.stringify(result,null,1));
  const show=Object.fromEntries(Object.entries(agg).filter(([p])=>p.startsWith('aware:')).map(([p,v])=>[p,[v.meanAce,v.worstAceMean,v.zeroWorstAce,v.meanAll]]));
  console.log(JSON.stringify({summary:show,verdict,seconds:result.seconds,games:J.length},null,1));
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={devSixes,finalSixes,selectorCells94};
