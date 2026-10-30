# CLAUDE-TASK: PR #69 独立反証P0を修正し、合理的なA対面を実Battleで再検収（2026-10-30）

正本：Issue #20、依頼 #68 → Claude成果 #69 head `80ed0e6a091ad516adf7a8c49870078250566ebe`、ChatGPT独立レビュー [#5712337767](https://github.com/jugemes/champions-mc-lab/pull/69#pullrequestreview-5712337767)。**#68は成果受領済み、重複発注ではなく新たな確定反例への1件の差戻し。** #69から別 `claude/*` branchを作り、修正は最小差分。元v2・旧保存JSONを変更しない。

## 必須P0（コード・再現・修正・テスト）
1. `misplay-tags-v3.js`の `last[side]` が交代/再登場を跨いでSD回数を加算。ChatGPTが**実関数を隔離JS実行**し、`T1 Golisopod SD → T2 switch Garchomp → T3 Golisopod return → T4 SD → T5 SD`で`setupSpam=1`を再現。ゲームでは交代で積み段階リセット。v3をactive stint基準へ修正、v2は保持、合成＋固定Showdown実Battle回帰。
2. `canSwitch=true`だけで`encoreStay/lockedStay`を「確定したプレミ」と断定しない。交代先がステロ致死、居座りで勝てる、拘束攻撃が相手を倒す等では合理的に残る。事実タグ／合理性未確定／反実仮想で劣る行動を分離し、旧集計も併記。強制SDは`setupForcedEncore`情報タグ。
3. #69のT1 `switch`分岐は相手ガブがアシレのMoonblastに後出しされ**即死**する保存実Battle例がある（`reports/data/encore-lead-audit-20261030.json` early）。これは合理的相手交代ではない。被ダメ・相手控えの役割・次ターンを考えた交代（または単なる非合理反例と明記）を実装し、グソクIron Head/Leech Life/Sucker Punchの合法4技内でT1/T2反実仮想を比較。相手の未公開技/持ち物/実選出を**こちらの選出・ターンAIへ漏らさない**。
4. 自軍アシレがアンコール中の相手へEncoreを再使用し、相手が交代した直後のポケモンへEncore空撃ちするターンAI欠陥を修正。選出3と先発を固定して、**旧ターンAI vs 修正ターンAI**を同seed・左右反転・合理的相手T1/T2で比較。Choice/Disable/Taunt/PPで1技しか有効でない状態をEncoreと誤認しない。攻撃・交代・Encoreの合法性を固定Showdownのリクエストとログで検証。

## 成果と完成ゲート
- Node22、固定Showdown SHA `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`、`gen9championsbssregmc`、66能力P、合法4技・1メガ・item clause、TeamValidator。
- A forcedA グソク/ガブ/ミミの**合理的な3体＋先発**を基点に、同じこちら3体（アシレ/メタ/スカーフガブ）でアシレ先発 vs ガブ先発、T1/T2・相手交代/先制/攻撃・旧新・同seed左右反転を実Battleで確認。追加で他のこちら3体が必要なら公開6だけから選び、先発・T1/T2を提示。相手がEncoreに残る非合理な勝ちは実戦有効勝利として加点しない。
- A以外のB/C/Indeedee/E＋新未学習公開6で最低限の非回帰。両Botのプレミを分け、タグなしを合理的と断定しない。保存JSONを独立再集計可能にする。テストを無効化しない。
- **CI successと構築完成は別**。コード・実Battle seed/左右・敗因・勝ち筋・TODO・PR #57のMega能力統合リスクをレポート。実対人勝率は未検証と明記。Claude自身が不承認なら不承認と書く。成果PRとIssue #20へリンク。
- ChatGPTが成果を独立検収し、不合格なら具体的な反例で再修正を続ける。**ACKだけで完了しない**。main・本人M-7実戦L6・育成・追加課金・有料runner・PC常時起動・自動マージ禁止。Claude Team既存Routineのみ。