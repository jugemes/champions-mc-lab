# CLAUDE-TASK｜PR #51 rational AIの採用阻害を修正＋公開6→3選出の頑健性を検証（2026-10-30）

## 最優先
本件は既存 #50→Claude成果 #51 の**修正再監査**。重複した新規AI/シミュレータの作成は禁止。成果は #51 の commit `679c5e14f85cf96878d3ce5030f0e49bb1b5d45d` を**ベースとして**別 `claude/*` branch PRへ。PR #51を一方的に上書きしない。完了報告は**実コード/固定Showdownのテスト/旧新比較結果を提供した時のみ**。ACKを完了扱いしない。ChatGPTがレビュー後に改善点があれば更に回す。

## 開始前必読
- ChatGPTの [PR #51 review #5709382419](https://github.com/jugemes/champions-mc-lab/pull/51#pullrequestreview-5709382419) と [Issue #20独立集計](https://github.com/jugemes/champions-mc-lab/issues/20#issuecomment-6517569391)。
- `decision-rational.js`, `lab.js`, `damage.js`, `rational-cases.js`, `rational-benchmark.js`, `test/decision-rational.test.js`。公開6→3 `preview-policy.js`, `preview-strategic.js`、Claude [PR #46](https://github.com/jugemes/champions-mc-lab/pull/46)のケースA/B/C事前選出及び実Battle裏付け。
- `CLAUDE.md`, `docs/REAL-BATTLE-CASES-2026-10-27.md`、固定Showdown SHA `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640` / `gen9championsbssregmc`、L6体`reported-live-roster-20261027.js`、GitHub既存 workflow。チームはまだM-7実戦継続（2026-11-04期限）。**実戦6体変更とmainマージは禁止**。

## P0：必須のコード修正・テスト
1. **自発交代カウンタ不一致**：`rationalSwitches<8`と既存`this.switches<3`は独立。安全に同じカウンタ/統合制限へ。交代リセットの自然な条件（相手交換後等）、盤面の詰み状況で固定8回制限が強すぎないかも試験。反例：交代ピンポン、ステロ+相手の回復連打。単純な『自発交代無制限』も不可。
2. **禁止理由ではなく適切な合法性観測**：`available.length===1`がChoice/EncoreだけではなくPP切れ、ちょうはつ、かなしばりでも成立。実際に`req.active[0]` / `req.side.pokemon`、所持道具（こちら既知）と公開ログのEncore状態で固定を区別。どの状態でも「無効技に居座る」プレミを減らしつつ、交代が不利なら無理に交換しない。特にガブのスカーフで`Rock Slide`→Corviknight反例が旧AIでもT2交代したことは**未再現**として保持する。
3. **重大な逆効果の回帰**：PR #51 `B_helmet_roost`でrationalだけ負けた seed `52522-48513-31438-37827` p2 を、`rational-cases`の**固定Showdown実Battle**で再実行し、T1→T5を双方の選出と合法情報を見てレビュー。相手のHP/回復PP、設置ダメージを考慮し、回復に勝てる接触技まで無条件にvetoしない。交代先も見えたhazardとHPを評価。メガ後のかたいツメなど、粗い `estimateDamage` と**固定Showdownの実際のダメージ差**を記録。
4. **公開情報のテストを頑健に**：PR51 hidden-info unit `runT1`の`void r1;void r2`はstreamを未完了放置。終了条件管理とawait、例外ハンドリングを修正。複数seed/相手公開6は同じで技/道具/相手選出3を変え、選出時/ターン判断が変わらないことを検証。相手の`switch`/観測技を見たら更新されるのは正常。
5. **Gate前の実Battle**：元のA `+6 Swords Dance 70→0`、B `Poison Jab→Archaludon 21→10`、ゴツメ`31→22`が修正によって退行しない。テストの誤った成功条件（固定相手の非合理なEncore再利用等）には追試を付ける。最低限ケースA/B/元の失敗seedで旧/修正版の行動ログを比較し、打点と交代理由が合理的かをレビュー。**新候補のtest数の多さで成功としない**。

## P1：公開6→3選出の課題・修正候補（P0を犠牲にしない）
- 現行`rankPreview/chooseThree`が平均ダメージと「スカーフ+7」「メガ2体-28」で選出し、**相手の公開6から合理的な3+先発を選ぶこと、重要な脅威に対する対策3を保つこと**が未検証。Claude #46のA=Golisopod/Mimikyu、B=Lucario Z/Corviknight/Archaludon、C=Charizard X/Y/Scarf Garchompを最優先に。
- 1つだけ頑健な候補をopt-inで用意するなら、公開情報のみでの**相手の合理的な3選出の列挙→最悪ケースへの選出候補の安全性＋先発の立ち回り**。選出時点に敵の実際の3体、技、所持品を渡してはいけない。相手の種族/フォルムの不確定（例：Char X/Y）とS-A/B型など複数を列挙する。3体の合理性はゲーム仕様と対人勝ち筋で検証、過去の候補を結果論で有利としない。負けたのがターンAIか選出AIか構築自体かを別項目で計測する。
- ここでの「選出改善」は未確認の強化として**採用を保留**し、P0修正まで実戦候補にしない。別PRで行うなら新規依頼PRを増やす前にその旨Issue #20に記録。

## 定量報告
- 固定Showdown SHA、TeamValidator、seed・先発・相手選出・合理/非合理の判定・AIの技/交代理由、run/test/CI可否。CI失敗メールの無用な連投禁止（1点修正→テスト→まとめてpush）。11構築×40×4の戦績は実測した場合のみ記載し、相関で水増しされた勝率を対人性能の根拠としない。
- **Claude成果PRとIssue #20に、修正内容・本当に再実行したテスト・解消した欠陥・残った欠陥を区別して報告**。ChatGPTが反証してから次へ。追加課金・API・有料runner・PC常時稼働なし。
