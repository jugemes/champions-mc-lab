# Claude独立修正依頼｜PR #85：T1/T2過学習・未知公開6・公開状態境界（2026-10-31）

## 正本・発注条件
- 先行依頼PR #84 → Claude成果 [PR #85](https://github.com/jugemes/champions-mc-lab/pull/85) head `4beb50c08459929e7b0f856b79e57da0014582cf` をChatGPTがコード/保存JSON/CIログで独立検収済み。レビュー [#5720466858](https://github.com/jugemes/champions-mc-lab/pull/85#pullrequestreview-5720466858) を必ず読む。
- **今回だけが現行の正式CLAUDE-TASK**。PR #84は回答済み。Claude Team既存Routineのみで処理し、重複発注・別料金API/runner・PC常時起動は禁止。
- `main` `72ad162b3f453ce2c5e4e1156b09056e31fbc766`、`CLAUDE.md`、`docs/HYBRID-COLLAB-2026-10-27.md`、`docs/REAL-BATTLE-CASES-2026-10-27.md`、Issue #20を読む。
- 実装・検証は**PR #85 head上の別claude/* branch → 成果PR**。本発注PRはmain基点docs-only。既存main・現行ランク6体・育成・課金・実戦採用は無断変更しない。PR85とそれ以前の保存値は再現可能に残す。自動mergeしない。
- 固定Showdown `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`、`gen9championsbssregmc`、66P各32、メガ・合法4技/道具/特性、TeamValidator。

## 検収で確定したこと
1. PR85はEmergency Exit/Eject Buttonの自発交代誤分類を修正し、固定Showdown実BattleのCI統合テストが通った。199 tests/192 pass/0 fail/7 TODO、12 teams合法。要求交代36,312件はV2/V3で一致、全ターンで旧自発交代誤分類1,088件。**分類器修正と勝率改善を混同しない**。
2. ChatGPTが`reports/data/pr84-reaudit.json`を独立パース・22仮説を再平均。学習と同じcellのtestはhuman1=0.556、entryV3=0.681。しかし**未学習の相手3体+初手cell**ではhuman1=0.793、entryV3=0.753。22仮説で**8悪化・2改善・12同率**。Indeedee/scarf 1.000→0.667、A/H0 0.417→0.208、A/H1 0.583→0.417。42 cell×6分岐×2 seed×左右で小標本、対人勝率ではない。PR85自身がNOT READY。
3. **未見の公開6体そのものは未検証**。現在のエントリーは公開6体キーに依存し、新しい公開6は全てuncovered。EメガリザY、Cガブ交代、HX_rain、HX_fairy等の負け筋が残る。
4. 新P1：`pr84-public-cond-entry.js:condSig`の`COND_KEYS`はトップレベルのみを検証し、`ownBoosts`等のネストを無制限にキー化。原文をV8で隔離実行：`condSig({ownHP:.5,ownBoosts:{atk:1,hiddenHeldItem:'Choice Specs'},foeHP:.8})` が `hiddenHeldItemChoice Specs` をキーに含める。**現行`condFromBot`経由の実際の秘密情報漏洩は未立証**。ネストの許可キー/値型を検証し、非法フィールドはthrowする。
5. `pr84-reaudit.js`はutility原因ラベルの後修正があり、報告書は修正版の再実行未了と明記。CI successは77,136戦のChatGPT再実行ではない。

## 今回の最優先P0：実用判断に近づくための反証と最小修正
1. **学習cellに過適合したT1/T2を無条件で実戦に出さない**。公開情報だけで判断する実行ポリシーの安全な適用/abstain条件を設計し、`uncovered`/素AIフォールバックを明示。非公開相手3/技/持ち物、事後勝敗、実験branchを実行時に参照しない。相手の合理的交代/初手/別3体と、失敗するEncore・既設hazard・無効技・Choice/メガ/天候を実Battleで反証する。相手AIの非合理fallbackに依存した勝利を合理相手への有効性として加点しない。
2. **真に未学習の公開6体**を、実験前に別コミットで宣言。既存A/B/C/Indeedee/E/HX_*と重複しない公開6（複数）を用い、合法な相手の複数3体・エース先発・合理的T1/T2を固定Showdownで試す。既存のPR85 holdoutを学習・閾値調整に流用しない。必要なら開発用の新しいcellを別に確保し、最後まで触れない最終holdoutを別コミットで凍結。新規公開6に対する実際の3+先発選出関数、実行時間、キャッシュミス時の安全な動作も評価。10〜15秒探索がlegacyより弱かった事実を隠さない。
3. **短い反例→修正→CI→限定Battle→必要な拡大試験**の順で進める。seed左右・合法チーム・実ログ・双方の公開情報・相手合理的3体・T1/T2と勝ち筋を残す。大量戦数だけを成果にしない。現行6体から実用候補が成立しない場合は「不成立」を明示し、必要なメカニクス/選出の欠陥を特定する。
4. ネスト公開キー検証のP1を最小修正・回帰テスト。Pain Splitの実数HPと割合誤判定（PR84コメント #6537030779）は合法性・公開HP実数の可用性を先に確認し、非公開最大HPを捏造しない。77,136戦のutility原因ラベルは**修正後コードと保存結果の一致**を最小再現で確認し、未再実行なら未再実行と記載。

## 必須成果・判定
- 変更差分、原因と個別再現、テスト、固定Showdown実Battleログ、同seed左右、TeamValidator、CI実ログ、公開情報漏洩境界、未見公開6 holdout、対戦AIの合理性、ベースとの悪化/改善を分けてPR/Issue #20へ記録。
- 特にA/H0/H1、Indeedee/scarf、EリザY、Cガブ交代、HX_rain/fairyの既知負け筋を未解消のまま「完成」としない。
- **ChatGPT独立レビューまで暫定完成・mainマージ・現行実戦採用不可**。Claudeの合格宣言/ACK/CI成功のみでは完成でない。実対人勝率は未検証なら未検証と明記。
