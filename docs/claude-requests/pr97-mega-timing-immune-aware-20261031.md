# CLAUDE-TASK｜PR #97 独立反証：メガ公開時点・免疫監査・合理敵回帰

2026-10-31 JST。**唯一の新規正式Claude依頼**。旧依頼 PR #96 は Claude成果 [PR #97](https://github.com/jugemes/champions-mc-lab/pull/97) head `36725dc0372f19397d96c4f529d064747ee001a7` で回答済み。重複発注禁止。最初に [ChatGPT独立レビュー #5722096718](https://github.com/jugemes/champions-mc-lab/pull/97#pullrequestreview-5722096718)、Issue #20、mainのCLAUDE.md、docs/HYBRID-COLLAB-2026-10-27.md、docs/REAL-BATTLE-CASES-2026-10-27.mdを実読。**#97 headから別 `claude/*` branch → 成果PR**。main・既存stack・現行実戦6体（Hydreigon/Mega Metagross/Primarina/Scarf Garchomp/Tyranitar/Rotom-Wash）・育成・課金・有料runner・PC常時起動・自動mergeは変更しない。既存Claude Team Routineのみ。重複CLAUDE-TASK/FAILED連投/無駄CI再実行禁止。

## 独立検収の事実と限界
- PR97はPR95上の4コミット増分。CI run #41183571227 job #124485797696 success、Showdown `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`、`gen9championsbssregmc`、255 tests/248 pass/0 fail/7 TODO、12チーム合法。ChatGPTは原文コード/テスト/報告/FINAL JSON/CI実ログを読んだが、自身の固定Showdown全Battle再実行は未実施。
- PR97のpaired全job比較・公開免疫を理解する相手の選び直し・T2両側hazard層数キー・N5/N6事前宣言は前進。ただしClaude自身がNOT READY。FINALの合理モデル meanAce pr96 .881、tm .933、N6/a tm .917 < legacy 1.000。DEV A/H1、N2/aでv2より悪化、10公開6中4でseed A/B選出分岐、T1/T2人間用未完成。
- **新P0：`pr96-paired.js:publicImmune96` が `|detailschange|` 後のメガ形態を同ターン開始時の `start` に上書き**。相手が技を選んだ時点では未公表のメガタイプを、既知の公開免疫と誤認する。原文関数隔離V8合成反例：通常Altaria（Dragon/Flying）→同ターンMega Altaria（Dragon/Fairy）→相手Hydreigon Dragon Pulse→`|-immune|` で、原文が `{turn:1,move:'Dragon Pulse',target:'Altaria-Mega',why:'type'}` を返す。通常AltariaへのDragon技は有効。これは事後結果を意思決定時点へ漏らす**監査上の誤分類**であり、合成ログ＋簡略Dex反例、固定Showdown実Battleでの発生頻度は未確認。予測としてメガを警戒することと「事前に確定していた」ことは別。
- **新P1：`publicImmuneMoves` の `balloon=...&&!BREAKER.has(ownAb)` はMold BreakerがAir Balloonという道具まで無視すると扱う**。原文関数隔離V8では公開Air BalloonのGarchompへのEarthquakeが相手Mold Breaker時にmaskされない。Mold BreakerはLevitateを貫通するがAir Balloonは貫通しない。現行実戦6体への実害は未確認。

## 必須作業（小さい再現→必要な実Battle→評価）
1. **公開情報の時間境界を修正**：相手が選択した瞬間の通常形態/公開メガ/公開特性/公開持ち物と、選択後に判明したメガ/交代/道具を区別する。ログを事後監査しても未来の公開状態を遡及しない。メガ化を予測する合理的行動は「既知免疫への不合理攻撃」と別のunknown/possible分類にする。N6/aのMega Altaria（Dragon/Fairy）・N2/Aの既知メガを含め、合法4技/66P各32・TeamValidator・固定Showdown実Battleで、通常→メガの同ターン変化と次ターン既知メガの**別判定**をテスト。エンジンの実プロトコル・seed・左右・判断前の公開観測を保存。
2. **Air BalloonとMold Breaker**：公開風船/未公開風船、Levitate/Mold Breaker、タイプ免疫と能力免疫を混同せず、実Showdownで相手のEarthquakeが風船で無効になることを確認。元の関数を壊さず最小差分でテスト追加。残存公開免疫タグ件数と、mask前後の合法再選択を測る。固定Showdownの対象レギュレーションで合法でなければ、実行不能と明示し無理にチーム改変しない。
3. **評価への実影響**：既存PR97保存JSONは上書きしない。まずPR97のN6/a等の保存ログで誤ラベル候補を数え、保存ログに意思決定前の情報がなければ必要最小限の新Battleを実行して検証。事後除外が選出スコアに戻らないようpaired同一jobを維持。 `publicImmune96`・`irrationalGame`・intersection感度・T1/T2テーブルへの影響を区別して報告。相手AIの選択を変更する場合は、候補間の相手3/初手/branch/seed/左右を揃える。
4. **重大回帰**：A/H0-H2、N2/a、N6/a tmの合理相手3+初手/T1/T2を具体的な勝敗ログで診断。H1だけv2が1.0でもH0/H2が0なら単一仮説に最適化しない。公開6からの選出と合理相手モデル、未知の道具・技・相手3体を混ぜない。seed A/Bで選出が分かれる場合は順位差/標本不確実性/ABSTAINを明示。T2の公開hazard層数は修正済みだが表で発動が0なら実用性を主張しない。選出時間とT1/T2実行可能性を測る。
5. **新holdoutと合格判定**：N5/N6は既に開発済み。さらに必要ならN7/N8等の**真の未知公開6**を合法な複数型・合理敵3+初手/交代モデル2系統・seed/左右・予算・停止条件・不合格条件とともにFINAL実行前の別commitで事前宣言。DEVを見てFINALの型・閾値を変えない。最初は最小再現と回帰、十分な改善の見込みがない場合は大規模評価を無駄に回さない。固定Showdown SHA/format/合法4技/66P各32/メガ、CI実ログ、再現seedを保存。保存JSON再集計と実Battleを区別。

## 完成判定
公開6だけで3体+初手+**実行可能なT1/T2**、非公開情報の漏洩ゼロ、未知holdout一般化、合理敵への重大悪化放置なし、無効連打/上限積み/ゴツメ自滅/Encore/Choice/メガ/強制交代の重大プレミ抑制、同seed左右・独立seed・TeamValidator・固定Showdown実Battle/CI/再現ログ、Claude独立監査＋ChatGPT独立反証の**全て**。それまでは**NOT READY**。main・実戦6体・育成・費用を変更しない。成果PRの本文・reportsには「改善/不成立/未確認/実戦への影響/ChatGPTに疑ってほしい点」を明示。
