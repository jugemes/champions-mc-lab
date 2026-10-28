#!/usr/bin/env node
'use strict';
/**
 * P0 stage 3: GitHub Actions tracks upstream Showdown, not ChatGPT tasks.
 * Newly identified mechanics-relevant diffs create an Issue #20 comment.
 * Research maintains a pinned SHA until independently reviewed.
 */
const fs=require('node:fs');
const UPSTREAM='smogon/pokemon-showdown';
const BASELINE='1242c1e2d9763ba5b85d33f13aecb89bae19ae3d';
const PINNED='3a766f2cfb5e51c1e428cfe87d0dba91a8f01640';
const ISSUE=20;
const MARKER='showdown-upstream-reviewed-head';

function relevantPath(path) {
  if(path.startsWith('data/mods/champions/') ||
     path.startsWith('data/mods/championsregm') ||
     path==='config/formats.ts')return 'champions-direct';
  if(/^sim\//.test(path))return 'engine-review';
  if(/^data\/(moves|items|abilities|rulesets|conditions|pokedex|formats-data)\.ts$/.test(path))
    return 'shared-mechanics';
  return null;
}
function markerFrom(body){
  const m=String(body||'').match(/<!-- showdown-upstream-reviewed-head:([a-f0-9]{40}) -->/);
  return m?.[1]||null;
}
function trustedWatchComment(c){return c?.user?.login==='github-actions[bot]';}
function lastBaseline(comments){
  for(let i=comments.length-1;i>=0;i--){
    if(!trustedWatchComment(comments[i]))continue;
    const sha=markerFrom(comments[i].body);
    if(sha)return sha;
  }
  return BASELINE;
}
function summarizeDiff(compare,previous,latest) {
  const files=(compare.files||[]).map(f=>({
    path:f.filename,change:f.status,group:relevantPath(f.filename)
  }));
  const relevant=files.filter(f=>f.group);
  return {previous,latest,commits:compare.ahead_by,listedFiles:files.length,
    relevant,needsReview:compare.too_large || compare.ahead_by>250 || files.length>=300 ||
      (compare.status!=='ahead'&&compare.status!=='identical')};
}
function commentText(d){
  const link='https://github.com/'+UPSTREAM+'/compare/'+d.previous+'...'+d.latest;
  const count=d.relevant.length;
  const filelines=d.relevant.slice(0,55).map(f=>'- ['+f.group+'] `'+f.path+'` ('+f.change+')');
  return [
    '<!-- '+MARKER+':'+d.latest+' -->',
    '### Showdown upstream 差分検知（GitHub Actions自動記録）',
    '',
    '- 前回確認: `'+d.previous+'`',
    '- 今回確認: `'+d.latest+'`',
    '- 現行の研究固定SHA（**変更しない**）: `'+PINNED+'`',
    '- GitHub比較: '+link,
    '- 増分コミット: '+d.commits+'、差分ファイル掲載: '+d.listedFiles,
    '- Champions/ゲーム処理に関係し得るファイル: '+count,
    '- '+(d.needsReview?'**比較が大きいか非直線的なため、差分が不完全な可能性。手動検収必須。**':
      'ファイル差分を検知。**仕様変更・勝率への影響は未検証**。'),
    '',
    '**レビュー対象**',
    ...filelines,
    ...(count>55?['- ほか '+(count-55)+'ファイル：比較リンク参照']:[]),
    '',
    '**次に確認すること**：Champions M-Cの合法性、メガ形態、攻撃/ダメージ、行動順・交代、公開情報境界について、固定SHA vs 候補SHAを同条件・同seedで検証する。',
    '**禁止**：未検証のupstream SHAをCIの固定値に自動代入しない。AI勝率改善と混同しない。',
  ].join('\n');
}
async function githubRequest(path,{method='GET',body,token,fetcher=fetch}={}){
  const res=await fetcher('https://api.github.com'+path,{
    method,headers:{'Accept':'application/vnd.github+json',
      'Authorization':'Bearer '+token,
      'X-GitHub-Api-Version':'2022-11-28',
      ...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  });
  if(!res.ok)throw Error('GitHub API '+method+' '+path+': '+res.status+' '+(await res.text()).slice(0,300));
  return res.json();
}
async function reviewUpstream({token,repository,fetcher=fetch,write=true}={}){
  if(!token||!repository)throw Error('GITHUB_TOKEN and GITHUB_REPOSITORY required');
  const api=(p,opt={})=>githubRequest(p,{...opt,token,fetcher});
  const current=await api('/repos/'+UPSTREAM+'/commits/master');
  const latest=current.sha;
  if(!/^[a-f0-9]{40}$/.test(latest))throw Error('Invalid upstream SHA');
  let comments=[];
  for(let page=1;page<=10;page++){
    const chunk=await api('/repos/'+repository+'/issues/'+ISSUE+'/comments?per_page=100&page='+page);
    comments.push(...chunk);
    if(chunk.length<100)break;
    if(page===10)throw Error('Issue comments pagination limit; fail closed');
  }
  const previous=lastBaseline(comments);
  if(previous===latest)return {status:'unchanged',previous,latest};
  const compare=await api('/repos/'+UPSTREAM+'/compare/'+previous+'...'+latest);
  const d=summarizeDiff(compare,previous,latest);
  if(!d.relevant.length&&!d.needsReview)return {status:'no-mechanics-diff',...d};
  if(comments.some(c=>trustedWatchComment(c)&&markerFrom(c.body)===latest))
    return {status:'already-recorded',...d};
  if(write)await api('/repos/'+repository+'/issues/'+ISSUE+'/comments',{
    method:'POST',body:{body:commentText(d)}
  });
  return {status:write?'recorded':'dry-run',...d};
}
async function main(){
  const result=await reviewUpstream({
    token:process.env.GITHUB_TOKEN,
    repository:process.env.GITHUB_REPOSITORY,
    write:process.env.WATCH_DRY_RUN!=='true'
  });
  const summary='### Showdown upstream mechanics watch\n\n'+
    '- status: '+result.status+'\n- pinned: `'+PINNED+'`\n'+
    '- previous observed: `'+result.previous+'`\n- upstream head: `'+result.latest+'`\n'+
    '- relevant changed paths: '+(result.relevant?.length??0)+'\n';
  console.log(summary);
  if(process.env.GITHUB_STEP_SUMMARY)
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={BASELINE,PINNED,relevantPath,markerFrom,lastBaseline,summarizeDiff,commentText,reviewUpstream};
