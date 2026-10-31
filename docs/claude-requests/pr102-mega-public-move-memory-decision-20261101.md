# CLAUDE-TASK 2026-11-01: PR #102 公開済み技のメガ前後記憶と実戦判断への影響を独立監査

## 正本・前サイクル
- GitHub: jugemes/champions-mc-lab, main=`72ad162b3f453ce2c5e4e1156b09056e31fbc766`。必ず最新main/CLAUDE.md/docs/HYBRID-COLLAB-2026-10-27.md/docs/REAL-BATTLE-CASES-2026-10-27.md/Issue #20と実装を確認。固定Showdown=`3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`、`gen9championsbssregmc`、Node22。
- #100→Claude #101は正式回答済み。新しい研究 [PR #102](https://github.com/jugemes/champions-mc-lab/pull/102) head `2a45cf447519736daff5bba4c693513796589e27` を対象にする。#102 は #101 head 上の未マージstackで、本番未採用。別の重複発注は不要。
- ChatGPT独立の固定Showdownテストは旧#102 headでsuccess。新headの追加opt-in `publicMoveMemory:true` と2テストのCIは [run #41225142523](https://github.com/jugemes/champions-mc-lab/actions/runs/41225142523) を結果確認してから扱い、未確認をgreenと言わない。

## 確認済みの問題
実BattleでGolisopodがT1 Sucker Punchを公開→T2 Megaにより `detailschange`。旧Botの`seenMoves.Golisopod`には公開Sucker Punch、`seenMoves['Golisopod-Mega']`は空。Metagrossに対する内部`incomingRisk`は0.74522 vs公開技を保持した0.77834。これは人間相手への勝率差ではない。旧#102はこの固定Showdown再現テストだけ。
今回ChatGPTが#102同branchに`lab.js`の**opt-inかつデフォルトOFF**な公開Mega同種族技記憶継承と実Battle回帰比較・合成境界テストを追加。必要な独立監査と**実際のAIの選出後の行動差 / 勝敗影響**は未確定。

## Claudeが実際に完了すること（単なるACKで止まらない）
1. **独立コード監査**：#102最新headの`lab.js`で`publicMoveMemory`が公開技のみを保持し、相手未公開の技・選出3・持ち物・本当の型を参照しないことを確認。メガ前/後、途中交代、メガ後再登場、メガ別形態（X/Y/Z）、Illusion/別種族の混同、`-enditem`等の公開状態、`seenMoves`配列のalias副作用を検証する。公開メガ化によって種族名が異なる場合だけ条件付き転送し、未確認を確定とみなさない。テスト用scriptの行動を合理敵の証明と混同しない。
2. **固定Showdown実Battle影響検証**：同じ相手の合法4技型・こちらM-7報告6体・相手公開6・自/相手3体/先発/同一seed・左右反転で、旧`publicMoveMemory:false`と修正`true`を比較。現実に公開した非STAB/先制技をメガ後に覚えているか、Botの技選択／交代／勝敗に**実際に差が生じるケースを探索**。差がなければ『該当試験で行動差0』と正直に記録、合成スコアの差を勝率改善と言わない。A Mega Golisopodを優先し、可能ならC Mega Charizard Y / Garchomp-Mega-Zも調べる。合理相手T1/T2を少なくとも別途1本設定。
3. **回帰・時間**：CIの固定Showdown sha、test total/pass/fail/TODO、合法TeamValidator、異常choice、反例のseed・双方の3選出・先発・実Battleログを保存。旧baselineの実戦結果を上書きせずopt-inを維持。不要な大規模CI/大量seed・通知を避ける。
4. **成果の提出**：Claude独自`claude/*`ブランチから非採用・opt-in成果PR、レポート/必要なコード修正・小さな回帰テスト・実Battleログと独立採否判断を提出し、Issue #20にも記録。ChatGPTがPR実コード/実CIを独立反証した後、必要なら再修正・Claude再レビュー。回答ACKやCI成功だけではサイクル完了としない。

## 禁止事項
main、実戦M-7の6体、既存構築、育成、課金、Showdown pinを変更しない。自動mergeしない。人間ランクの勝率を偽装しない。コードをただ再実行してテストgreenで『完成』にしない。A/N2/N6合理敵・未知公開6・T1/T2の汎用選出ゲートは引き続き未達であり、この局所修正がそれらを解決したとは言わない。
