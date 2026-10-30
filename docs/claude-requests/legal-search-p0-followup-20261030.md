# CLAUDE-TASK｜PR #65の独立P0反例を修正し、公開6→3を再検収（2026-10-30）

## 前提
- 正本：CLAUDE.md、Issue #20、docs/HYBRID-COLLAB-2026-10-27.md、docs/REAL-BATTLE-CASES-2026-10-27.md。
- 前発注 #64 → Claude成果 [PR #65](https://github.com/jugemes/champions-mc-lab/pull/65)（head 8114a291a8fe3f5c55ef8e0f89109944e6b004d2）受領・ChatGPT独立レビュー [#5711453967](https://github.com/jugemes/champions-mc-lab/pull/65#pullrequestreview-5711453967) 済。**#64への未回答扱い、重複起動をしない**。
- #65 CI #41041481397：105 tests/98 pass/0 fail/7 TODO、12 teams legal。CIは合格したが新AIは不採用。保存JSONをChatGPT独立集計：legacy 160/252、legal-search-v1 177/252（相手プレミを伴う勝ち73）、legal-search 122/252。対人勝率ではない。
- 固定Showdown 3a766f2cfb5e51c1e428cfe87d0dba91a8f01640、format gen9championsbssregmc、Node22。実戦L6・main・育成は変更禁止、追加API/課金禁止。

## 最優先 P0（修正の具体条件）
1. **重要な合法技を消さない**：#65 `legal-role-hypotheses.js` の `IMPRACTICAL` は `lastrespects`（イダイトウ）、`expandingforce`（イエッサン）、`firstimpression`（グソクムシャ）を全役割から除外。Mega-Y `Solar Beam` は `allowImpractical` 指定があっても `attackValue` が `flags.charge` で0を返し候補に入らない。ChatGPTが実`pickAttacks`を合成Dexで隔離実行し、Solar Beam/Last Respects不採用を再現。実M-C固定Showdown Dex・TeamValidatorで合法性を再確認し、天候・フィールド・味方ひんし数・優先度など**成立条件付きの代表4技セット**として保持し、適切な戦況で実Battle評価する。既存合法fixture `threat-scenarios-20261014.js`（Mega-Y/Solar Beam, Indeedee/Expanding Force）、`environment-m7-teams.js`（Basculegion/Last Respects）を回帰に使う。単に全技を常時最大火力にする旧欠陥を再導入しない。
2. **6→3探索の打切り**：#65 `chooseLegalSearch` は `ownTrios=6` のデフォルトで20組中6組×3先発=18案しか短期Battle評価しない。全20組×3先発を評価するか、除外組が勝てないことを安全に示す探索方法とカバレッジ証跡を実装。相手側 `rivalCandidates` も上位切断でエースが欠落しないことを実Dex A/B/C/Indeedee/Eで確認。
3. **相手型の脅威カバレッジ**：デフォルト `rivalScenario(k=0..2)` は役割順indexから機械的に3本を選ぶため、AでSDグソクを想定せず実Battle0/36に悪化した。公開6のみから「SD/先制/回復/スカーフ/天候/メガX/Y/ふゆう」の合法な**相互排他的な4技型**を複数シナリオに残す。隠し3体・相手実技/道具は選出AIに渡さない。カバレッジ欠落ならスコアを確定せず未検証とする。
4. **同じseedで行動分岐を比較**：#65 `seedBase+ci*10+branches.indexOf(branch)` では相手行動と乱数が同時に変化。各セル・同seedで T1 `ai/attack/setup/switch` を比較し、独立seedを複数回、左右反転。最悪セルと平均の恣意係数や3ターンHP差での評価限界を報告。
5. **ターンAIプレミを勝率に混ぜない**：旧/新の両側でアンコール・積み・スカーフロック・接触ゴツメ・無駄交代・砂/晴れ更新の不合理をタグ化。合理的な相手初手攻撃/交代/裏3体を含むA/B/C/Indeedee/E＋未使用公開6 holdoutで、旧新同seed/左右の個別ログ・合法性・勝ち筋を評価。PR #57公開メガ特性の統合安全性も確認。#63はDraftのまま、#65も本番不採用のまま扱う。

## 必須成果
- main基点の既存コードを無断変更せず、Claude自身の `claude/*` **新成果PR**で最小修正・回帰テスト・固定Showdown実Battleの再現コマンド/seed/敗北ログ・CI結果・公開6からの選出3＋初手と合理的分岐を提出。
- 最低限、上記P0の実際の修正前/後の再現が必要。既存AIに勝てないなら**不採用と明記**し、何が阻害しているかコードと実Battleで示す。CI緑、ACK、依頼書だけを完成と呼ばない。
- ChatGPTが成果PRを独立再実行・反証レビューし、必要なら差戻し→Claude最終レビューまで継続。追加Claude Team既存Routineのみ（API従量課金/追加クレジット/有料Runner/PC常時起動禁止）。main自動merge・実戦L6体変更禁止。
