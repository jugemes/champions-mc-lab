# CLAUDE-TASK｜PR #75 独立反証の差戻し：公開HP・状態異常と実用6→3 holdout（2026-10-31）

## 起点・重複禁止
- 正本 main `72ad162b3f453ce2c5e4e1156b09056e31fbc766`、`CLAUDE.md`、`docs/HYBRID-COLLAB-2026-10-27.md`、`docs/REAL-BATTLE-CASES-2026-10-27.md`、Issue #20。
- 前発注 #74 → Claude成果 [PR #75](https://github.com/jugemes/champions-mc-lab/pull/75) head `61443a754efd08052fc26d2d21623a6e3cbbd4c4` **受領・ChatGPT独立レビュー #5716273022済み**。#74を未回答として再発注しない。#75のspeedSafe/実行ログ合理性/robust Aは部分改善だが**暫定完成不承認**。
- 今回は**残存する同一P0の実装未対応**と、完成ゲート未達をまとめた**唯一の後続発注**。Claude成果は別 `claude/*` branch→PR。main・実戦6体・本人育成・追加課金は変更禁止。PR #75も自動マージしない。
- 固定Showdown SHA `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`、format `gen9championsbssregmc`、能力P66/各32、TeamValidator。実Battleで seed・左右・選出・実行技・相手行動を保存する。既存CIの無意味な再実行・失敗連投禁止。

## P0-A：公開HP/状態のパース未修正（最優先、最小修正＋実Battle）
PR #75 `lab.js` L139-147は `|switch|p2a: Garchomp|Garchomp, L50|100/200 par` の公開麻痺を `foePublicStatus='par'` に入れる一方、`foeStatus=''` のまま。`-damage/-heal` L185-191 は `String(a[3]).split('/').map(Number)` のまま。`80/200 par` は `[80,NaN]`、`180/200 brn` もNaNで `foeHP` を更新しない。ChatGPTは該当コードの隔離Node実行で初期0.75→0.75の誤りを再現済み（正しくは0.40/0.90）。前回#74のコメント #6527991457 で既報だが #75で未修正。**speedSafeのfoePublicStatusだけ直しても本体の技/交代判断に影響する。**

- switch/drag/replace/detailschange、-damage/-heal、-status/-curestatus、fnt、状態なし/麻痺/火傷/毒/睡眠/凍りの公開conditionを一貫して正規化する。必要なら共通の小さなparseConditionを作る。公開情報以外を読まない。
- `foeHP`、`foeStatus`、`foePublicStatus` を二重管理で食い違わせない（既存default挙動の変更は明記）。`encoreWouldFail`、`moveUtility`、`evaluateMoveV3`、`incomingRisk` への伝播を確認。
- 固定Showdown実Battleで状態異常後の被弾・回復・交代再登場の**エンジン公開HP/状態 vs Bot内部値**を左右同seedで照合し、状態なし対照とともにassert。再現ログと選出/初手/T2/交代判断への影響を示す。正常な既存テストを削除しない。
- 新しいバグが見つかれば反例と最小修正を実装。修正前後のBot判断が変わらない場合もその旨を記録し、未検証を「改善」と書かない。

## P0-B：PR #75の「robust」はA専用の事前計算で、実戦の公開6一般化ゲート未達
- `robust-preview.js` は `reports/data/a-preview-matrix-20261030.json` のH0/H1行列を固定読込する解析用。未知の公開6から合法型候補→3体+初手を選ぶ完成ポリシーではない。H2は**Aと同じ公開6の別の未学習型**で、未知公開6ではない。
- まずAの選出混合分布から、**相手公開6のみを入力とする実際の選出3＋先発を決める再現可能な入口**（seedに基づくサンプル、使用した仮説集合・重み・不確実性・選出理由をログ出力）を明示。隠れた相手3/持ち物/技/真のHを引数に入れない。前計算が必要ならそれを明示し、未登録公開6は適切に保留/フォールバック（不正なA行列の使い回し禁止）。
- **B/C/Indeedee/Eと未知公開6**を、現行6体と相手公開6を混同せず、少なくとも1つずつ合法な役割仮説と合理的相手選出3＋初手＋T1/T2の小規模固定Showdown回帰で検証する。全43,200戦を機械的に繰り返すより、先に代表的な反例・旧方式との同seed左右比較、相手目線の強いエース（リザY/イエッサン等）を切らないことを優先。
- 公開6/実際の型と、研究用A/C/Eのセットの違いを厳密に分離。本人現行L6を無断変更しない。
- `reports/data/pr74-summary-20261031.json` H2 security robust=0.151 は**質量0.983の評価対象に正規化**された数値。残り1.7%は未評価なので、下限/感度とともに報告。対人勝率とは呼ばない。

## P0-C：実行ログ合理性の境界を回帰
- `a-branch-audit-v2.js` `executed(lines,t,side)` は `|turn|t` が存在しないと `indexOf=-1` から `slice(0)` を走査し、例えばT1で終了したログのT1 `Earthquake` をT2実行と誤認する（ChatGPTが実関数の同一制御フローを隔離Node実行で再現）。`i<0` は `kind:'none'` とし、存在しないターンのラベルを勝手にplausibleにしない。3体戦の通常ケースで発生したかは未検証なので発生率を捏造しない。
- `-immune`、交代前後、Encore拘束、相手のT2実行技と指定技の不一致、強制交代をログで照合し、ラベル不明は不明として残す。H0の0/84を人間相手の必敗とは表現しない。

## 受入・引継ぎ
1. PR #75で成立したspeedSafeの6/6→0/6、正常4/4、H0/H1 bits再現34,560/34,560、合法12・CIを回帰維持。PR #75の変更を勝手に上書きしない。
2. コード/テスト/固定Showdownの実Battleログ/保存した小さな機械可読集計、同seed左右、合法性、未知公開6の失敗時動作をPRに提出。巨大な未検証JSONだけでは不可。
3. Claudeが独立コード監査し、残るP0と勝率を推定できない範囲を列挙。ChatGPTの反証レビュー前に完成宣言・自動マージしない。
4. Issue #20に成果・未成立・次の作業を記録。外部処理待ちの場合は次の定期実行で自動再開。重複CLAUDE-TASKを作らない。
