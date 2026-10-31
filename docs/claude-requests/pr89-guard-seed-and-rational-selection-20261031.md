# Claude独立修正依頼｜PR #89 反証後：guard左右同seed・候補選別・実戦負け筋（2026-10-31）

## 前提と重複禁止
- 唯一の新規正式依頼。**#88は成果PR #89（head `69311d75f283ad1b93a5eaa0a138b36b66a3e3d5`）で回答済み**。ChatGPT独立レビュー [#5721083231](https://github.com/jugemes/champions-mc-lab/pull/89#pullrequestreview-5721083231) を必読。**PR #89 head を起点に新しい `claude/*` 成果PRを1件**。#89は#87/#85/#83/#81/#79/#77上の未マージstack。mainへmergeしない。
- 正本 `CLAUDE.md`、`docs/HYBRID-COLLAB-2026-10-27.md`、`docs/REAL-BATTLE-CASES-2026-10-27.md`、Issue #20。固定Showdown `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`、`gen9championsbssregmc`、能力66P/各32、Mega/合法4技。
- 現行実戦6体（サザンドラ／メガメタグロス／アシレーヌ／スカーフガブリアス／バンギラス／ウォッシュロトム）・main・育成・追加課金・runner・常時PC・自動mergeを変更しない。既存Claude Team Routineのみ。重複CLAUDE-TASK、FAILED連投、無駄CI再実行禁止。

## 受領済み改善を壊さない
- PR #89の `pr86-eval.js` 実呼出し経路DEV/FINAL2重複0件（22仮説）、新seed 8680000、凍結loco_t2発動0を維持。保存旧FINALを上書きしない。
- ChatGPTが `pr88-selection-dev.json`・`pr88-selection-final.json` を独立再集計：DEV13仮説 legacy .616/quick .770/guarded .844、FINAL新公開6の6仮説 legacy .568/quick .923/guarded .886。対人勝率ではない。A/H0 guarded .35、A/H2 .45、F2/a .55、F3/a guarded .775 < quick 1.0 は未解決。**暫定完成は不承認**。

## P0-1：guard内部の左右同seedが成立していない（ChatGPT原文隔離実行で再現）
- `pr88-guarded-preview.js`：`seed:hashSeed(seedBase+300000+ci*16+rep), reverse:(ci+rep)%2===1`。seedBase=8700000, ci=0 の左rep0 `[6654,38881,52623,7123]`、右rep1 `[44798,55675,22272,29975]`。**左右で別seed**。候補間は同条件だが、guardの左右差と乱数差を分離できない。
- 各guard候補・相手cell・分岐・seedに対し左右を両方実行し、同seed左右・同じ相手3+先発・同じ合理分岐をログでassert。既存 `pr88-selection-eval.js` FINALは同seed左右であり、その結果自体を否定しない。**追加Battleは小規模の反例/境界から**。side対称性の回帰と所要時間を記録。guardの選出が変われば、既存FINALを再チューニングに使わず、新たな未見ケースを事前コミットし最後に1回だけ評価。

## P1-1：guard候補の適格判定が1候補で打ち切られる（ChatGPT原文隔離実行で再現）
- `pr88-guarded-preview.js:decide()` はworst最大候補AがmeanSlackで失格でも、適格な次点Bを調べずlegacyを返す。
- 再現：legacy `worst=.40,mean=.70`、A `.70,.60`、B `.60,.75`、margin=.10、meanSlack=.02 → 現行出力legacy、**Bはworst>=.50かつmean>=.68を満たす**。適格候補を先にfilterし、その中でworst/meanで選ぶテストを追加。既存保存DEV/FINAL scoreでこの失敗の発生は未確認であり、既報成績の誤りとは断定しない。

## P1-2：T2の公開済み道具/特性が判断キーに入らない（実漏洩ではない）
- `pr84-public-cond-entry.js:condFromBot/condSig` 原文隔離実行：他の公開状態を同一にして `bot.foeItem` と `bot.foeAbility` を変更しても `cond`・署名が同一。例 `Choice Scarf/Levitate` vs `Leftovers/Pressure` はどちらも `o:Lpar//h:|f:H//h:|w:/t:`。`condSig({...cond,foeItem:'Rocky Helmet'})` は throw。公開済みと未公開を厳格に区別し、実ログで公開された特性/道具だけを必要に応じてキーへ反映。未公開の真値は絶対に参照しない。実Battleで判断差が出ないなら影響なしと明記し、過剰実装はしない。

## P0-2：人間が使える選出3＋初手＋T1/T2と合理的敵への実証
- **A/H0/H2（グソクムシャ先発＋アシレーヌ/ガブリアス）、C/X/Y（リザY/X先発/後置）、F2/a（メガオーダイル竜舞）、F3/a（guard保守過剰）**を、こちら・相手双方の公開6から合理的な3+先発・T1/T2/交代で小規模固定Showdown実Battle検証。勝ち筋が現6体で存在しないなら「構築側の限界」と切り分ける。相手がエースを出さない勝利で成功認定しない。
- 対人採用のための3体/初手/実行可能T1/T2を公開情報だけで説明できること。選出器の探索25〜37秒が実戦の選出時間に間に合うか、実際の時間制限と比較（未確認なら未確認と明記）。`budgetSeconds` は現コードでは処理後判定で**実行中断するハードタイムアウトではない**。予算を超えてからfallbackしても実用上間に合わないため、上限を守る最小実装・実測を要求。
- 合法性・TeamValidator、Mega公開能力、Choice/Encore、強制交代、PP、無効技連打、ゴツメ、積み上限、公開情報境界を確認。7 TODOを隠さない。対人勝率を捏造しない。

## 成果・判定
1. 原文反例→最小修正→小さい固定Showdown実Battle→同seed左右/相手合理性/未知holdout→CI→短い再現ログ。既存コード/結果は上書きしない。
2. Claudeが独立監査し、新 `claude/*` PRに修正範囲、実Battle・合法性、A/C/F2負け筋、悪化、実測時間、NOT READY/READY根拠を記載。ChatGPTが独立反証するまで完成扱いしない。
3. 現行6体採用・育成はユーザー判断。研究用opt-inを実戦既定に無断変更しない。
