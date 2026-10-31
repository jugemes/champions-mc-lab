# CLAUDE-TASK｜PR #99 独立反証後：公開6の安定選出・合理敵A/N2回帰・実行可能T1/T2

2026-10-31 JST。**唯一の新しい正式Claude依頼**。旧依頼PR #98はClaude成果[PR #99](https://github.com/jugemes/champions-mc-lab/pull/99) head `6041ffc977de4364c85acda96e62b57a2af512ef` で回答済み。重複依頼禁止。最初に[ChatGPT独立レビュー #5722319208](https://github.com/jugemes/champions-mc-lab/pull/99#pullrequestreview-5722319208)、Issue #20、main/CLAUDE.md、docs/HYBRID-COLLAB-2026-10-27.md、docs/REAL-BATTLE-CASES-2026-10-27.md、PR99原文コード/報告/CIを実読。**PR #99 head上の別 `claude/*` branch → 成果PR**で作業。main/既存stack/現行実戦6体（Hydreigon/Mega Metagross/Primarina/Scarf Garchomp/Tyranitar/Rotom-Wash）/育成/課金/有料runner/PC常時起動/自動mergeは禁止。既存Claude Team Routineのみ。重複CLAUDE-TASK、FAILED連投、無駄なCI再実行は禁止。

## 確認済み事実と限界
- PR99の監査修正はopt-in。公開メガの同ターン情報遡及、Mold BreakerとAir Balloon、Outrageのlockedmove継続の誤タグは新しい単体/固定Showdown実Battleテストで改善。ただし**選出器とPR97の勝率は不変**、PR99自身NOT READY。
- CI run #41191821379 job #124509980143：固定Showdown SHA `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`、format `gen9championsbssregmc`、261 tests / 254 pass / 0 fail / 7 TODO、12チーム合法。ChatGPTは実コード・保存FINAL JSON・CI実ログを独立読取、原文関数隔離V8反例を実行。**ChatGPT自身の固定Showdown全Battle再実行は未実施**。
- PR96 FINAL JSON独立再集計：rational/aware meanAce legacy .7813 / v2 .8687 / pr95 .8562 / pr96 .8813、tm/aware legacy .925 / v2 .921 / pr95 .8927 / pr96 .9335。ただし N6/a tm pr96 .917 < legacy 1.000。DEV A/H0-H2 rational 合計 pr96 19/120 vs legacy 41/120。N2/a rational pr96 .84 vs v2 .99。v2のA/H1=1.0はH0/H2=0で型の事後最適化なので**単一H1だけを最適化しない**。同seed左右は独立標本として2倍計上禁止。
- 10公開6のうち4でselector seed A/Bにより選出分岐。選出17–32秒＋T1/T2表22–45秒（CI 4CPU）で実ランクの見せ合い時間に間に合うとは言えない。7 TODO、未知公開6への一般化、実行可能なT1/T2が未達。

## 必須作業（小さい実証を先に、改善なければ停止）
1. **公開6から安定する3体＋初手**：隠れた相手3/技/道具・真のhyp・事後oracleを選出器に渡さず、A/H0-H2とN2/aの合理敵3+初手/交代/T1/T2を別モデルで評価。Primarina同族の同速リスク、HeracrossのSwords Dance→+2 Close CombatとこちらのGarchomp先発、Metagross Psychic Fangsを原文実Battleログとseedで説明。legacy/v2/pr96の全A仮説合算と最悪セル、N2、N6の同時回帰を優先し、ある1セルだけ改善した案は不採用。公開6の同一入力・異seedで選出が割れるなら、順位差と不確実性を可視化して**abstain/legacy fallback**を候補として検証。選出が安定しないのに断定した人間用推奨を出さない。
2. **比較条件の固定**：新選出変種はFINALの前に別commitで実装・閾値・仮説集合・合理敵2系統・seed・左右・セル・停止条件・不合格条件を事前宣言。DEV A/H0-H2/N2/N6は開発用としてのみ使う。事前宣言した真の新未知公開6（例 N7/N8、エースを合理的に選ぶ難しい複数型）を初見FINALで**1回だけ**評価し、エース不選出の勝利を対エースの勝利に数えない。固定Showdown `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`、format `gen9championsbssregmc`、66P合計/各32/合法4技/メガ/TeamValidator、同seed左右と独立seed、対戦プロトコルと再現入力を保存。候補がDEVで改善せず根拠が弱ければ新FINAL大量実行を**行わず**NOT READYと報告。
3. **実行可能なT1/T2**：公開6→3体+初手に加え、T1/T2でそのターンの公開HP/状態/メガ形態/天候/能力変化/両側hazard層数/Encore/Choice/PP/合法手を使用。非公開の相手セット、実験branch、事後ログを参照しない。ルール発動数、勝敗差、合法手、abstain/fallback、見せ合い制限時間内に人間が使用できる簡潔な条件を記録。人間用判断が改善しないなら明示して未完成とする。
4. **新P1の合法性検証**：`pr98-timing.js:immuneAware98`（旧`pr96-paired.js:immuneAware`も同型）は、免疫技を `req2` でdisabledにした後、`decideWith(req2,bot,info)` が返す技の**合法性を再確認しない**。ChatGPTは原文を依存stub付き隔離V8で実行：`Earthquake` slot1（公開風船でmask）、`Iron Head` slot2（合法）、scriptがmask後も `move 1` を返すと、出力 `move 1`、記録 `replacement:'move:Earthquake'`。合成requestであり既存Battle発生は未確認。無効技の再選択、trapped/Choice/Encore/PP、合法な代替・交代がない場合の処理を固定Showdown実Battleと選択エラー0で検証。Gravity/Smack Down/Iron Ball等で風船免疫が消える場合も必要最小限の検証。Claudeの既存コードを上書きするのではなく、PR99上の新差分で対応。
5. **監査の実証**：PR99のshadowはT3以降のaware known FINAL101/DEV746を強制された `none (no alternative)` と推論しているだけ。該当turnのマスク器decisionログと実プロトコルを**直接結合**し、強制か選択かを証明（すべてでなく代表例＋件数でもよい）。監査タグの誤りと実際の選出勝率・プレミを混同しない。

## 合格条件・停止条件
**必須**：公開6のみの3体+初手+実行可能T1/T2、隠れ3/技/道具の漏洩なし、A全H・N2・N6の合理敵回帰の放置なし、新未知holdout一般化、無効連打/上限積み/ゴツメ自滅/無駄交代/Encore/Choice/公開メガ/強制交代の重大プレミ抑制、固定Showdown実Battle/合法性/CI/seed左右/再現ログ、Claude独立監査とChatGPT反証。どれか欠けたら **NOT READY**。PR本文・reportsに「成立/未成立/新反例/再現seed/対人勝率ではないこと/実戦6体と育成への影響/ChatGPTに反証してほしい点」を明記。ユーザーの実戦採用判断前にmainへmergeしない。
