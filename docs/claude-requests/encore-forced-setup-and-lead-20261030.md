# CLAUDE-TASK｜#67のEncore誤タグとA先発・合理的交代の独立診断→コード修正→実Battle再検収

2026-10-30 / ChatGPT独立P0レビュー https://github.com/jugemes/champions-mc-lab/pull/67#pullrequestreview-5712132484 / Issue #20。

## 優先順位
M-7現行L6で公開6からの3体・先発・T1/T2を人間に使える形で検証する。スコア関数やseed増量を先にしない。#66→Claude #67 は成果受領済みだが **不採用**。本依頼はその後に見つかった新規の独立再現P0であり、#66のACK再確認ではない。

## ChatGPT独立再現済み（合成ログ、固定Showdown実Battleではない）
GitHub PR #67 head `a7a389465507fd93914fe33b3cdd082e14898199` の `misplay-tags-v2.js` を取得して関数を直接JS実行。`|-start|p2a: Golisopod|Encore` でSwords Danceを強制される3連続SDログに対し `misplaysV2(log).p2.setupSpam===1`、`anyTag(p2)===true`。Encore開始イベントを取り除いても同じ値。現行関数は `last[side]` の同じ3技だけを見て、アンコールの強制状態を一切追跡しない。

保存JSON `reports/data/legal-search-v2-compare-20261030.json` を別途再集計：A_golisopod forcedA は strategic=Primarina/Metagross/Garchomp **12/12勝、相手タグなし0/0（全12戦setupSpam）**、v2=Garchomp/Metagross/Primarina **0/12勝、相手タグなし0/12**。3体は同じで先発だけ異なる。現行clean比較は強制Encoreを相手プレミ扱いし得るため、12/12の意味も0/12との因果も未確定。逆にEncore中に相手が交代可能なのに交代しないAIの弱さは別途検査が必要。

## Claudeの必須実作業（既存Team Routine枠のみ）
1. PR #67 head、CLAUDE.md、docs/REAL-BATTLE-CASES-2026-10-27.md、固定Showdown SHA `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`、`gen9championsbssregmc` を確認。最初に**Claude独立診断**として、実BattleでEncore開始・解除・交代・強制技をログから観察し、誤タグの成立と頻度を実測。単なる合成ログの追認だけで終了しない。
2. 別 `claude/*` ブランチに最小コード修正と回帰テスト。強制Encore中の同じ積み技反復を自発的`setupSpam`から区別（`forcedByEncore`や`unknown`等）、Encore解除/交代/ターン終了の正確な状態管理を検証。Choice固定中の半減連打も「選択できた悪手」と「拘束された行動」を区別。タグ不在を合理性の証明にしない。旧集計と新集計の定義を併記し、旧JSONを上書きしない。
3. A公開6（Golisopod/Garchomp/Primarina/Mimikyu/Hippowdon/Gholdengo）・本人L6で、**同一3体 Primarina/Metagross/Garchomp の先発アシレ vs 先発ガブ**を、相手合法4技・同じforcedA 3体・同seed左右反転で固定ShowdownフルBattle比較。敵T1は攻撃/積み/交代、T2はアンコールを受けたら残留/ガブやミミへ合理的交代、を明示的に分岐。相手がAIのEncore+SD連打で負けた場合は「人間相手への勝ち筋」と評価しない。相手の隠れ3/技/道具を選出器へ渡さない（実Battleの反実仮想に限る）。
4. 同じタグ修正の影響をB/C/Indeedee/E/HOLD_sunの保存結果・可能な固定Showdown代表seedで確認。勝敗・相手タグ・自分タグ・相手が交代可能だったかを分ける。新規実戦向け成果は「公開6→3体+先発+T1条件+T2交換条件+勝ち筋/処理不能分岐」。最初はA1ケースを確実に完結し、数千戦の新探索はしない。
5. `npm test` / `npm run check` と必要な固定Showdown実Battle・seed・左右・テスト結果を成果PRとIssue #20に保存。P0未解決なら不承認と明記。main/本人実戦6体/育成変更、無断merge、追加課金、CIメール連投は禁止。新成果PRができたらChatGPTが**コード・ログ・実Battle・選出/ターンAIの責任分離**を独立反証し、必要なら同一問題群で再修正・Claude最終検収する。

## 完了ではない状態
このdocs-only依頼PRのopened/ACK、テスト成功、旧JSONの数字の転記は完了ではない。固定Showdown実Battleのアンコール強制判定と合理的交代、先発比較、Claudeのコード修正、ChatGPT独立再監査が必要。採用・構築完成は保留。
