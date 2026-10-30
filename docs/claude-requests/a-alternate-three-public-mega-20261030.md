# CLAUDE-TASK｜PR #71独立不承認後：A公開6→3の別選出・初手を実Battle反証、公開メガ能力を統合監査

2026-10-30。GitHub Issue #20、[Claude PR #71](https://github.com/jugemes/champions-mc-lab/pull/71)、[ChatGPT独立レビュー #5713544858](https://github.com/jugemes/champions-mc-lab/pull/71#pullrequestreview-5713544858) を正本として読む。#68/#70は成果#69/#71を受領済み。**これらを未回答として再発注しない**。この依頼はPR #71の新しい不承認点を同一群として修正・再監査する唯一の正式依頼。

## 最優先の問題と成功条件

1. **A forcedA（相手公開6：グソクムシャ/ガブリアス/アシレーヌ/ミミッキュ/カバルドン/サーフゴー）の別3体と先発**。#71は自軍アシレ/メタグロス/スカーフガブの同一3体で先発を変えたのみ。合理的相手分岐の最悪0/12のまま。現行L6の全20通り×先発3通りを、相手公開**種族名6のみ**から評価。特に**ウォッシュロトム（研究コードの仮説型はLeftovers、Will-O-Wisp/Volt Switch/Thunderbolt/Hydro Pump）を含む候補**を検証する。対メガグソクのIron Head/Leech Life/Sucker Punch/Swords Dance、対ガブ/ミミの後続・初手・T2・交代条件を固定Showdownの実Battleで示す。ロトムを必ず採用せよという指示ではない。相手の公開6に対する複数の合法4技・メガ/非メガ・合理的な3体/先発を分岐。隠し相手3体・技・持ち物の事前漏洩をテスト。公開種族名ハードコードで勝たせない。
2. **敵行動の合理性**。#71 `RATIONAL_T` はSucker Punch/SDなど合法技を局面無視で全て合理的と分類している。T1/T2のHP・速度・優先度・ダメージ・積み・交代先被弾・技選択を確認し、`legal` と `plausibly rational` と `known blunder` を区別する。相手がEncore中にSDへ居座る勝利、アシレMoonblastでガブが即死する後出しなどは採用証拠から除外。相手側が本当に強い選出/先発を選んだときの最悪分岐を残す。0/12は「列挙した条件の中の反例」であり人間相手の勝ち筋不存在の数学的証明ではない。
3. **公開メガ能力P0**。研究Draft [PR #57](https://github.com/jugemes/champions-mc-lab/pull/57) head `cb005eb06887bd85cada8193c6a7b13a6d32c0c1` は公開メガ形態の固定能力更新＋メガ→交代→再登場の固定Showdown統合テストをCIで通過済みだがClaude独立監査未了。#71のopt-in `lab.js` と**必要な差分だけ安全に統合**し、Mega GolisopodのTough Claws、Mega Garchomp-ZのLevitate、Mega detailschange/switch/drag/replace、能力上書き/無効化などで公開情報を正しく更新。非公開能力や未選出情報を漏らさない。単純な丸ごとcherry-pickで既存AIを巻き戻さない。競合が大きいなら独立修正PRとし、根拠を示す。
4. **監査数と再現性**。#71の`encore-turn-p0-audit.js`は静的に数えると通常分岐3456＋非合理参照96＝**3552回**の`battle()`呼出しとなるが、報告書には「1776戦」とある。保存JSON `rows.length` と各分類の件数をコードで数えて矛盾を解消。固定Showdown SHA `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`、`gen9championsbssregmc`、同seed・左右反転、相手の異なる合法3体、独立holdout（B/C/Indeedee/E/新公開6）を含む。**レポートに短い機械可読の集計とseed別反例**を付け、巨大JSONがGitHub connectorから読めなくてもレビューできるようにする。CIは`npm test`/`npm run check`と新しい回帰テストを通す。テストを削除・TODO化して赤CIを隠さない。
5. **Encore guardの残り**。#71 `encoreGuard` はopt-inで`foeLastMoveTurn<0`判定。ひるみ・まひ・ねむり・失敗Sucker Punchなどで`|move|`行が出ない局面、同時ターン交代での避けられない空振りを区別し、誤判定なら実Battle反例で最小修正。#71の修正済みP0（stint reset、タグ3段階）は壊さない。

## 作業方法と提出物

- **最初に#71 head `536357b15e3c48178640f6f83dd72c2e53709dfb` のコード/CI/レポートを確認**。PR #57の差分は独立比較。成果は**新しい `claude/*` ブランチの通常PR**に実コード・新テスト・実Battle seed/左右・勝敗だけでなく合理的T1/T2・相手の選出/先発・個別反例・明示的な採否を書き、Issue #20へ記録する。修正前後を同一条件で比較し、Aの3体と先発・初手・T2/交代条件を人間が使える短い表にする。改善しないなら「不成立」と明記し、データを捏造しない。
- 新方式の対人勝率を推定しない。ユーザーの現行実戦6体、main、育成、固定Showdown、料金/runner/Team契約を無断変更しない。Claude Team Routine既存枠のみ、追加API課金・有料runner・常時PC禁止。CIのFAILEDメールを大量発生させない。
- Claudeの自己合格だけで完成にしない。**ChatGPTが成果PRのコード・CIログ・実Battleと合理性を独立反証レビューし、不成立なら修正を続ける**。A/B/C/Indeedeeとholdoutの高優先度欠陥が残れば「ランク用研究候補として暫定完成」を宣言しない。
