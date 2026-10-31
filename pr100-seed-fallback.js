#!/usr/bin/env node
'use strict';
// PR #100 request item 1: is "selector seed A != seed B -> abstain to a
// fallback pick" a usable stability rule? Zero new battles: the PR #97 eval
// already played legacy / v2 / pr96 on IDENTICAL jobs (same seeds, sides,
// cells, rival models), so a fallback policy's value is read from the saved
// per-cell values of the pick it would send.
//   stable96   = pr96 pick if seedA pick == seedB pick, else legacy
//   stable96v2 = pr96 pick if seedA == seedB, else v2
// Immune-aware rival, plan ai (no T1/T2 table). DEV decides; N5/N6 rows are
// the SPENT PR #97 FINAL, shown for information only (post-hoc).
// Usage: node pr100-seed-fallback.js reports/data/pr100-seed-fallback-dev.json
const d=require('./reports/data/pr96-eval-dev.json'),f=require('./reports/data/pr96-eval-final.json');
const out=[];
for(const [tag,j] of [['DEV',d],['FINAL',f]])for(const [id,s] of Object.entries(j.sixes)){
  const same=s.selection.pr96===s.pr96SeedB;
  for(const [h,H] of Object.entries(s.hyps))for(const model of ['rational','tm']){
    const row={tag,id,h,model,same};
    for(const pol of ['legacy','v2','pr96','stable96','stable96v2']){
      const p=pol==='stable96'?(same?'pr96':'legacy'):pol==='stable96v2'?(same?'pr96':'v2'):pol;const c=H.byModel[model]['aware:'+p];
      const cells=Object.values(c.byCell);const ace=cells.filter(x=>x.ace);
      row[pol]={aceW:ace.reduce((a,x)=>a+x.v*x.n,0),aceN:ace.reduce((a,x)=>a+x.n,0),worstAce:Math.min(...ace.map(x=>x.v)),allW:cells.reduce((a,x)=>a+x.v*x.n,0),allN:cells.reduce((a,x)=>a+x.n,0),worst:Math.min(...cells.map(x=>x.v))};
    }
    out.push(row);
  }}
const agg=(rows,pol)=>{const a=rows.reduce((o,r)=>({w:o.w+r[pol].aceW,n:o.n+r[pol].aceN,aw:o.aw+r[pol].allW,an:o.an+r[pol].allN,wa:Math.min(o.wa,r[pol].worstAce),wc:Math.min(o.wc,r[pol].worst)}),{w:0,n:0,aw:0,an:0,wa:1,wc:1});
  return `ace ${Math.round(a.w)}/${a.n}=${(a.w/a.n).toFixed(3)} all ${(a.aw/a.an).toFixed(3)} worstAceCell ${a.wa.toFixed(2)} worstCell ${a.wc.toFixed(2)}`;};
const groups={'A all H (DEV) rational':r=>r.id.startsWith('A_')&&r.model==='rational','A all H (DEV) tm':r=>r.id.startsWith('A_')&&r.model==='tm',
 'N2/a rational':r=>r.id.startsWith('N2')&&r.h==='a'&&r.model==='rational','N2 all tm':r=>r.id.startsWith('N2')&&r.model==='tm',
 'DEV all rational':r=>r.tag==='DEV'&&r.model==='rational','DEV all tm':r=>r.tag==='DEV'&&r.model==='tm',
 'N6 (spent FINAL) rational':r=>r.id.startsWith('N6')&&r.model==='rational','N6 (spent FINAL) tm':r=>r.id.startsWith('N6')&&r.model==='tm',
 'N5 (spent FINAL) rational':r=>r.id.startsWith('N5')&&r.model==='rational'};
const res={};
for(const [g,fn] of Object.entries(groups)){const rows=out.filter(fn);res[g]={};for(const pol of ['legacy','v2','pr96','stable96','stable96v2'])res[g][pol]=agg(rows,pol);}
console.log(JSON.stringify(res,null,1));
// per cell regressions of stable96 vs legacy and vs v2 (DEV)
const reg=out.filter(r=>r.tag==='DEV').map(r=>({k:r.id+'/'+r.h+'/'+r.model,st:+(r.stable96.aceW/r.stable96.aceN).toFixed(3),leg:+(r.legacy.aceW/r.legacy.aceN).toFixed(3),v2:+(r.v2.aceW/r.v2.aceN).toFixed(3)})).filter(x=>x.st<x.leg-0.05||x.st<x.v2-0.05);
console.log(JSON.stringify(reg));
require('fs').writeFileSync(process.argv[2],JSON.stringify({groups:res,rows:out,devRegressionsOver5pt:reg},null,1));
