# CLAUDE-TASK｜PR #93 独立反証後：公開済みメガX/Y・T2状態衝突・N2/A回帰の修正と新holdout

2026-10-31 JST。**唯一の新規正式Claude依頼**。旧依頼 [PR #92](https://github.com/jugemes/champions-mc-lab/pull/92) はClaude成果 [PR #93](https://github.com/jugemes/champions-mc-lab/pull/93) head `7b8937a6a18f517fb11445015cc58e1ff39a82cd` を受領済みであり、再発注しない。最初に [ChatGPT独立レビュー #5721596824](https://github.com/jugemes/champions-mc-lab/pull/93#pullrequestreview-5721596824) と Issue #20、mainのCLAUDE.mdと協業規程、実戦反例を読む。**#93 head上に別 `claude/*` branch→成果PR**、既存stackとmainは改変・mergeしない。

## PR93の検収結果（ChatGPT独立検証）

- CI run #41172661862 job #124453733884 実ログ：228 tests / 221 pass / 0 fail / 7 TODO、12 teams合法、固定Showdown SHA一致。事前宣言 commit `1910153`→DEV実装 `b553a54`→FINAL `7b8937a` の順は成立。ChatGPTは保存FINAL/DEV JSONを独立再集計し、FINAL平均 legacy .660 / quick .855 / v2 .867 / proposed .910を確認。ただしChatGPT自身の固定Showdown全Battle再実行は未実施。
- **P0公開情報衝突**：`pr92-t1t2.js:keyOf` は `M.baseName` で相手メガ形態を削る。Nodeで原文関数を隔離再現すると `Charizard` / `Charizard-Mega-X` / `Charizard-Mega-Y` のT2キーが全て `T2|Charizard|Rotom-Wash|Charizard`。さらにHP/状態/天候/フィールド/積み/PP/Choice/Encore/設置など、T2で既に観測できる状態を許可リストから落としている。違う合法手一覧でも同じキーになり、`ownHP` は `non-public field` と誤拒否。これは**実際の隠れ情報漏洩の証拠ではなく、公開情報の取りこぼし**。
- **P0回帰**：未見N2_heracross/aではv2 1.00（最悪セル1.00）→proposed .68（最悪セル .20）。相手メガHeracross先発のClose CombatでこちらRotom-Wash先発がT1即死。DEV A/H1はv2 .93→proposed .43（T1/T2込み .42）、A/H0は0セル。新候補はNOT READY。
- **T1/T2未達**：保存JSON独立集計でFINAL4仮説の実使用はT1強制0/T2強制0（計480評価Battle）、DEV8仮説はT1強制312/T2強制0（計960）。`ai`の表示上の最頻行動は実行時に強制されずbase AIへ委譲される。人間用の実行可能T2指示としては不足。
- **P1 seed相関**：`pr92-eval.js` の `hashSeed(evalBase+ui*100+s)` はcell/branchを含まない。100評価Battle/仮説に使う乱数初期値は4種類だけ（各セル/分岐で再利用）。別対面のBattleは有効だが、100独立seedとは呼ばない。独立seed単位の検証とpaired比較を分ける。

## Claudeへの必須作業

1. **小さな失敗回帰を先に作成**：T2で相手のCharizard未メガ/Mega-X/Mega-Y、公開済み能力・天候・HP・状態・積み・Encore/Choice・場の設置・自分のPP/合法手が異なる条件を、公開観測だけで識別できるか、また未知の相手の道具/技/実選出が異なるだけならキーと判断が一致するかをテスト。相手の未公開メガ形態を確定扱いしない。最小必要状態を使い、キーの爆発を抑え、衝突・過学習を検証。旧PRの公開情報境界テストを破らない。
2. **実行可能なT1/T2**：表に `ai` しかない場合「人間に具体的な推奨行動がある」と表現しない。合法手/PP/対象/強制交代をエンジンrequestと照合し、公開状態の分岐ごとに具体的な行動・根拠・abstainを返す。実Battleで実際に強制されたT1/T2件数と成功/失敗、強制交代と自発交代の区別を示す。T2発動ゼロなら完成不承認。
3. **N2/a・A/H1・A/H0の最悪セルを実Battle診断**：N2/aのMega Heracross先発Close Combat対Rotom-Washを先に固定Showdownで再現。相手の合理的な別3+先発、T1/T2交代/積みも複数保持。v2 / quick / PR93 proposed と同一セル・同seed左右・独立seedで比較し、N2/aとA/H1の重大回帰を放置しない。勝てない場合は改善不能と明示。公開6だけから推定した合法仮説を使い、評価相手の真の型/結果/事後oracleを選出器に注入しない。
4. **相手モデルの独立性**：PR93のselectorと評価器が共有する `rationalCells` 規則以外の合理的な3体/先発/交代モデルでも、同じ候補を反証。既知A/F2/N2を開発用とし、**新しい未使用の公開6最低2つ＋合法型複数＋評価seed＋停止/不合格条件を実行前コミットで固定**。既存F1/F2/F3、N1/N2は新holdout扱いしない。未知の相手を簡単に選出しないモデルは不合格。
5. **独立標本の扱い**：同seed左右ペアと異なるseedを混同しない。セル/分岐で共通乱数を使う場合は相関を明示し、追加の独立seedで再評価。100 Battle/仮説を100独立seedと呼ばない。小標本の偶然差を過剰解釈しない。
6. **機構・証跡**：固定Showdown SHA `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`、`gen9championsbssregmc`、能力66P各32、4合法技、メガ/天候/Choice/Encore/技無効/強制交代/ゴツメ/積み上限のTeamValidator・実Battleを確認。実行コマンド、seed/左右/敵3+初手/T1/T2/勝敗/処理時間、元JSONと比較可能な差分、7 TODOを残す。CI successだけで完成としない。

## 絶対条件と完成判定

- 自軍実戦6体＝サザンドラ/メガメタグロス/アシレーヌ/スカーフガブリアス/バンギラス/ウォッシュロトム（コードでは`reportedLive`）を**無断変更しない**。main/既存stack/育成/追加課金/有料runner/PC常時起動/自動merge禁止。既存Claude Team Routineのみ、重複CLAUDE-TASK/FAILED連投/無駄CI再実行禁止。
- 公開6のみで3+初手と、T1/T2の**実行可能な公開状態分岐**を説明でき、合理的な相手への重大回帰・非公開情報漏洩・未見holdout悪化がないことを実Battleで確認するまで **NOT READY**。採用はユーザー判断。
- Claude成果は別 `claude/*` PRにし、ChatGPTの**独立コード/実Battle反証レビュー**を待つ。ChatGPTのレビューはClaudeの自己評価と独立に行う。
