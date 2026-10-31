# CLAUDE-TASK｜PR #95 独立反証：合理敵の比較標本・T2公開設置・A/H1/N2回帰

2026-10-31 JST。**唯一の新規正式Claude依頼**。旧依頼 PR #94 は成果 [PR #95](https://github.com/jugemes/champions-mc-lab/pull/95) head `4f2716656b4a2a09c47db2768e2f833b75391d8d` を受領済み。重複発注しない。最初に [ChatGPT独立レビュー #5721799952](https://github.com/jugemes/champions-mc-lab/pull/95#pullrequestreview-5721799952)、Issue #20、mainのCLAUDE.md、協業文書、実戦反例を実読。**#95 headから別 `claude/*` branchを作成し成果PR**。main・既存stack・現行実戦6体・育成・課金・有料runner・PC常時起動・自動mergeは変更しない。既存Claude Team Routineのみ。

## 確認済み
- #95 CI run #41178442547 job #124470730066：244 tests/237 pass/0 fail/7 TODO、12 teams LEGALITY PASS、固定Showdown `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`。保存DEV/FINAL・原文コードをChatGPT独立検収、ただしChatGPT自身の固定Showdown全Battle再実行は未実施。
- 旧T2の公開Mega X/Y衝突は改善。N2/aで浮遊Rotom-WashへのEarthquakeとSkill Link技の仮説欠落を診断。新N3/N4 FINALは事前規則passだが易しすぎる。N4 rationalでは相手エース選出率0.4、T1 rule実発動0、T2 rule実発動6、unseen率35〜84%。
- **新P0-1**：`pr94-t1t2.js:obsFrom` と `OBS` は `rivalHazards` を含むのに `keyOf` は無視。原文隔離V8で、T2の公開状態が相手側ステロなし/ステロあり/ステロ＋まきびしでも同一キーを返すと再現。自軍ボルトチェンジ/相手交代の期待値が異なり得る。
- **新P0-2**：`pr94-cover-preview.js:cellValues` は候補ごとに `rational94` 不合格Battleを除外し、セル0件なら全試合へfallback。原文隔離V8の合成反例で、同一10条件 A=1勝9敗（9敗が免疫タグ）/B=6勝4敗を入力すると `rationalOnly` はA=1.0/B=.6、全試合はA=.1/B=.6。実保存値が誤りという直接証拠ではないが、**候補ごとに評価標本が異なるため公平なpaired比較と解釈できない**。DEV A/H1/tmの `nRat94` はv2=108/pr93=88/pr94floor=120（各n=144）。
- **残存P0**：DEV A/H1 rational v2=.97→pr94floor=.29→T1T2=.221、N2/a rational v2=1.00→floor=.77、tm v2=.97→floor=.57。選出seed依存、N3/N4の識別力不足、7 TODO。

## 必須実装・実証
1. **合理的な相手行動の比較を先に修正**。相手3体＋先発＋T1/T2の候補を公開6のみから作り、こちらの選出候補ごとに**事後的に不合理行動を除外して有利な標本にしない**。相手AIが浮遊Rotomへ地震を選んだ場合は「不合理」を記録した上で、公開免疫を理解した相手AIに**実際に別の合法で合理的な技/交代を選ばせて固定Showdownで再Battle**。相手選出・技・道具の真値をこちらのselectorに漏らさない。比較候補間で敵3/初手/行動方策・seed・左右を揃え、無効/除外/再実行/評価不能数をセル別に報告。fallbackで不合理試合を「合理的」として黙って採用しない。相手行動は公開状態に依存して変わり得るので、同一文字列の技を強制するだけの不自然な比較にしない。
2. **T2キーの公開設置情報**。相手側ステルスロック・まきびし・毒びし・ねばねばネット等が異なると、必要な場合は別キー/別行動になり得ることを最小再現テスト＋固定Showdown実Battleで確認。公開されていない相手の型/技/持ち物/控え3はキーに含めない。キーの爆発とunseen率を測定し、ルールの根拠が不足するなら明示ABSTAIN。合法手/PP/Choice/Encore/メガ公開形態・強制交代の回帰テストも維持。
3. **A/H1・N2/aの機構回帰**。v2/quick/#93/#95/修正案を合理的な相手3+初手（エース先発と後ろ）、T1/T2交代・積み・攻撃、同seed左右ペアと別独立seedで比較。A/H1のPrimarina同族対面のMoonblast負けと、その後Gholdengo/Mimikyuを診断。N2/aのSkill Link＋CC/Pin Missile/Rock Blastと相手の合理的交代を検証。v2より重大悪化なら採用しない。改善不能なら明示。
4. **真の難しい未知公開6**。N3/N4/F1〜F3/N1/N2/A/B/C/Indeedee/E/HX/U1〜U3はすべて開発済みとして扱う。新しい**未使用の公開6最低2つ**、合法な複数型、相手のエースを合理的に選出する3+先発・交代モデル2系統、seed、停止条件、不合格条件を**実行前コミットで固定**。新holdoutは全候補が90%超で識別できない易しすぎる条件を避け、エース不選出の勝利を対エース勝ちにしない。事前に難度を調整するための評価はDEVに限定。
5. **T1/T2の実用性**。公開6→3体+初手、公開状態に応じて具体的合法T1/T2行動・根拠・ABSTAINを出し、実Battleでの実発動・実行一致・勝敗・unseen・強制交代を集計。ルールが実発動0なら人間用推奨が完成したとは書かない。対戦時間制限に実装が間に合うかは未確認と明示。
6. **証跡と合否**。固定Showdown SHA、`gen9championsbssregmc`、66P各32、合法4技、メガ・天候・公開特性・Choice・Encore・PP・無効技・強制交代・積み上限・ゴツメ、TeamValidator、CI、同seed左右・独立seed、実Battleログとコマンド、相手3/初手/T1/T2/勝敗、処理時間、保存JSON、7 TODOを報告。開発/FINAL/holdoutは厳格に分離。**Claude監査＋ChatGPT独立反証が両方揃うまでNOT READY**。

成果は既存コードを上書きせず、PR #95上の追加差分と報告・再現可能なデータを別PRに残す。**現行実戦6体を変更・マージ・課金しない**。Claude Routineの重複起動・FAILED連投・無駄CI再実行は禁止。
