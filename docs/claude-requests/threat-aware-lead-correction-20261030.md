# CLAUDE-TASK: PR #58公開6→3 threat-aware 不承認からの実修正・再監査（2026-10-30）

## 既存成果と不承認根拠
- 発注 #56 → Claude成果 [PR #58](https://github.com/jugemes/champions-mc-lab/pull/58), SHA `e86174ef28b0bb927455f707b0a509fbe9be311f`。
- ChatGPTが実装・test・2016行保存JSONを独立レビューし、[レビュー #5710360938](https://github.com/jugemes/champions-mc-lab/pull/58#pullrequestreview-5710360938)で**採用不承認**。このレビュー全文とPR #58のコード・レポートを読んでから着手。既存PR #56を未受領と扱わない。
- 重大反例：Aグソク群 forcedAは同じ3体（サザン/アシレ/メタ）で**先発だけメタへ変更**した新policyが0/12、旧サザン先発10/12。BルカZ群 rival-threat-awareは新0/12 vs旧12/12（相手はガブ/アシレ/ミミ）。相手legacy選出で得た勝数は改善証拠にしない。
- 実装の確定不整合：`preview-threat-aware.js:246-248` の `best(rows)` が敵1体のvariantを対面ごとに別々に最適化（実在しない一貫性のない型）；`304-311` のpivotは非スカーフ・先頭特性だけ；`megaScenarios`がhyp.likelyMegaと不整合；`sandstream && sandforce` は両立せず補正死文化。PR #58は実対人Indeedeeを静的選出だけで扱い、実Battle未実施。
- 固定Showdown `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`、format `gen9championsbssregmc`、Node22、能力ポイント合計66・各最大32。

## 具体的な実行と成果物（ACKだけで終了禁止）
1. PR #58を起点に**新しい claude/* 実装ブランチ・成果PR**を作る（main/実戦L6は変更禁止）。Aで同じ3体・同seed・同じ相手のまま先発を入れ替えた実BattleのT1〜T4、Bでガブ/アシレ/ミミ相手に0/12となるT1〜T4を固定Showdownで再現し、先発モデル/ターンAI/構築相性を切り分ける。勝敗ログを保存。
2. 対戦相手の各**個体variant（形態・持ち物・特性・技仮説）は1シナリオ内で一貫**させる。相手公開6の種族名のみから複数合法シナリオを作り、実際の隠し3・道具・技・能力Pを事前に渡さない。敵も公開6だけから合理的な3と初手を選ぶ（同一モデルへの過適合に注意）。
3. 初手はスカーフ・先制技・メガ遅延・設置技・控えへの着地被弾・砂/晴れの書換えを考慮し、A/B/Cで個体名への加点・固定選出を禁止。Bミトム不在、CリザX/Yとガブ・バンギ先発、Indeedee（相手スカーフ**未確定**）の公開6に対して、複数合法型のholdout実Battleを追加。相手合理的な交代も必要。
4. 旧legacy/strategicと新policyを同seed・左右反転・forcedA/B・合理的相手選出・**新しい相手6の未調整holdout**で比較。baselineターンAIのプレミに勝った数を強さと主張しない。 `npm test` / `npm run check` / TeamValidator とCIログを検収。failed時は原因別にまとめて最小差分修正、push連投禁止。既存TODOの黙殺禁止。
5. [PR #57](https://github.com/jugemes/champions-mc-lab/pull/57) SHA `cb005eb06887bd85cada8193c6a7b13a6d32c0c1`の「メガガブZ進化→交代→再登場の公開ふゆう」を独立コード/固定Showdown実Battleでレビュー。#58系と#57系の両方が`lab.js`を変更しているので、統合可否・競合・公開情報境界を評価し、**無断マージしない**。修正が別系統ならレビューと統合方針を同じ成果PR/Issue #20に残す。
6. コード＋test＋再現seed＋実BattleのT1〜T4ログ＋結果JSON＋失敗/未解消を新Claude成果PRとIssue #20へ提出。ChatGPTがコード/CI/実Battleを再検収するまで「完成」「実戦推奨」は不可。対人勝率未確認なら未確認と記載。

## 禁止事項
Claude Team既存枠のみ。API従量課金/追加クレジット/有料runner/常設PC/並列Cloudセッション禁止。main/ユーザー現行6体/育成/本番設定は変更しない。レビューへのACKだけで終わらず実修正・独立反証可能な結果を提出する。