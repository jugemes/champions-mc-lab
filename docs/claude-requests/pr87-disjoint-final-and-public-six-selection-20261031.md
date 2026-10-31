# Claude独立修正依頼｜PR #87 反証後：DEV/FINAL非重複と公開6→3+初手の実用改善（2026-10-31）

## 前提・重複禁止
- 唯一の後続正式依頼。PR #86→Claude成果 #87 head `d7c152f509f60a3bd56ad9067935ee65dba615d7` は**回答済み**。PR #87 ChatGPT独立レビュー #5720659334 を最初に読む。
- PR #87 head を起点に新しい `claude/*` 成果PRを1件作る。#87は#85/#83/#81/#79/#77の未マージstack。**mainにmergeしない**。main・本人実戦6体（サザンドラ/メガメタグロス/アシレーヌ/スカーフガブリアス/バンギラス/ウォッシュロトム）・育成・追加課金・runner・PC常時起動を変更しない。
- 正本 `CLAUDE.md`、`docs/HYBRID-COLLAB-2026-10-27.md`、`docs/REAL-BATTLE-CASES-2026-10-27.md`、Issue #20。固定Showdown SHA `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`、format `gen9championsbssregmc`、能力66P/各32、メガ仕様、TeamValidator。

## P0-1 独立反証済み：DEV/FINALセルの実重複
- `pr86-eval.js:gateRun` が両phaseとも `used:m.used` を渡し、DEVの `m.dev` をFINALに引き継がない。テストはDEVをusedへ追加しており本番evalと異なる。
- 保存 `reports/data/pr86-dev.json.DEV.cells` と `pr86-final.json.FINAL.cells` をChatGPTが独立比較すると、`HX_sand/a` の `DEV lead3:Rotom-Heat/Excadrill/Kingambit` と `FINAL aceBack2:Rotom-Heat/Excadrill/Kingambit` が**完全一致**。seedは異なるため同一Battleの二重計上とは言わないが「非重複セル」宣言は偽。
- 本番呼出しを修正し、22仮説の各 `hyp|foeThreeOrdered` で train/test/PR85 holdout/DEV/FINAL の重複ゼロを実行前にassert。テストはevalと**同じ経路**を通す。重複解消でセルが変わるなら、既存FINALをチューニングに使わず、新たな未使用seed・セルで**一度だけ**事前凍結ゲートを再評価。旧結果は旧結果として保持、後付けで上書きしない。

## P0-2 完成ゲートの本体：未知公開6への3体＋初手
- #87の凍結 `loco_t2` はFINAL発動0・素AIと同結果。UNSEEN 2,208戦でT1/T2全件uncovered（差0）。**安全fallbackの確認であり、強い実用選出の証明ではない**。
- FINAL rational平均（abstain）：A/H1 0.05、A/H0 0.175、C/X 0.05、C/Y 0.10、B/case 0.25。U2/aでlegacy 0.396→quick 0.979だがU1/bではlegacy 0.972→quick 0.778。相手の合理的3体/先発を外すだけで勝率を上げない。
- `public-six-general.js`、`pr82-switch-utility-t1t2.js`、`pr86-eval.js` の既存コードを再利用し、**公開6体のみ**を入力とする上限付きの3体＋先発選択を研究用opt-inで改善。相手のメガX/Y・エース先発/後置・合理的交代・複数合法4技/道具/能力Pを公開情報からの仮説として扱い、実際の隠れ3/技/道具や試合結果を選出時に参照しない。選出ポリシーが遅い場合は実測時間と理由を示してabstain、失敗しても「安全」と呼ばない。
- 既知A/B/C/Indeedee/E/HX_rain/HX_gyarados/HX_sand/HX_fairy、未見U1/U2/U3を**開発/診断用**として利用可。ただしこれらはもはや真の未見ではない。**新たな未見公開6・合法型・合理的な敵3+先発・新seed**をコード修正前にコミットして凍結し、最後に一度だけFINAL検証。既存データの過学習を繰り返さない。
- 既存選出vs候補を同seed左右・同じ相手3+先発・相手の合理的T1/T2/交代で比較。実Battle実行ログ（双方選出、各T1/T2要求と実行、天候/メガ/Choice/Encore、勝敗、seed/side）を小さく保存。**A/C/U2の最悪対面とU1回帰を必ず個別提示**。改善しない場合は不採用を明記し、追加の大量合成戦で成功扱いしない。

## P1 / 精度境界
- `pr86-painsplit.js` のV2は旧割合誤判定を修正したが未配線。実HPと公開最大HP範囲を使い、公開情報で判定不能ならunknown。utilityAudit/utilityRationalに配線するなら小さい固定Showdown実Battleで旧新差・件数・勝敗影響を測る。無断の大規模再実行は不要。
- 相手合理性の `rational` は「utility分岐を除外・irrational補助技を除外」でしかない。実行不可能技/既設hazard/無意味交代/不利なエース不選出を見逃さない。非合理AIへの勝利は独立して報告。観測できない非公開情報は不使用。
- 公開条件ネストallow-list、強制交代、Encore、Choice、メガ公開能力、無効連打、ゴツメ自滅、上限積み、無駄交代の回帰を維持。既存TODO7件は隠さない。

## 成果と判定
1. 最小反例→原因→最小修正→独立実Battle→テスト/CIの順。ChatGPTレビューに再現可能なコードと短い保存データを残す。
2. `npm test`/`npm run check`、TeamValidator、固定Showdown SHA、同seed左右、完全に未知の公開6と相手の合理的3体、非公開情報漏洩ゼロ、処理時間を明記。
3. 合成AI勝率と対人勝率は区別。**研究用ランク候補の暫定完成は宣言しない**。Claudeは成果PRの報告に自らNOT READY/READY根拠と未解消の負け筋を記載し、ChatGPT独立検収を待つ。
