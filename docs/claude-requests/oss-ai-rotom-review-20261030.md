# Claude独立監査依頼｜既存OSS AI + ai-rotom とM-C選出実験（2026-10-30）

## 目的
今期M-7マスターボール級到達を支える、現行L6体の「公開6から選出3＋初手」と合理的な敵AIの研究を改善する。現状の自作Botは双方非合理な行動が確認されたため、既存 OSS `poke-engine`（Rust MCTS）と `ai-rotom`（MCP情報／ダメ計）を比較・利用する可能性を独立監査してほしい。

## 読んでほしい正本
- 今回のChatGPT draft PR **#47** https://github.com/jugemes/champions-mc-lab/pull/47 （head `8ccf054e69392ce1373c1cb57dd7a1ab7acefea1`）。`oss-engine-mcts-probe.js`、`test/oss-engine-mcts-probe.test.js`、`reports/oss-engine-ai-rotom-integration-audit-2026-10-30.md`。
- 現行 `CLAUDE.md`、`docs/REAL-BATTLE-CASES-2026-10-27.md`、Claude実戦監査PR **#46**、Issue #20。
- https://github.com/pmariglia/poke-engine 固定研究候補main SHA `f7b147f13637ceecc1b0d1e9172ec232af4d45d0`、`Cargo.toml` の `bss=["champions"]`、`src/genx/state.rs`の60通り、`tests/test_bss_mechanics.rs`、`src/io.rs`、issue #32の配布0.0.48でメガGoli/LucarioZ/GarchompZ石が未知になる問題。
- https://github.com/pmariglia/foul-play の `requirements.txt` は `poke-engine==0.0.48` かつ `terastallization` feature。
- ユーザーが提示した記事 https://zenn.dev/nonz250/articles/nonz250-ai-rotom と実ソース https://github.com/nonz250/ai-rotom （main `4172a077db9b7e507dc209605889500009b9c78d`, npm 1.3.5, Node >=24）。

## 最優先で反証してほしいもの
1. **PR47コードの実際の問題**：60選出候補パースの仕様適合、重複ベンチ順・メガ/フォーム名正規化・MCTS出力のスコア/訪問数解釈、信頼できない状態入力/実行ファイル、ログ由来情報漏洩、時間制限、テストの十分性。これは7/7のローカルNode unitのみで、**Rust起動とShowdown完全一致は未実施**。CI途中の場合結果を読むこと。欠陥があれば「修正必要」と明示。
2. **公開情報だけの探索**：`poke-engine`の状態には双方の型/持ち物・技の完全情報が入り得る。相手の隠れ選出3・型や持ち物をAIへ不正入力しないために**具体的な最小インターフェース/仮説分布・情報境界**を設計。実対人の未確定情報と仮説を混ぜない。6見せ3出しを実際にMCTSする負荷/時間も検討。
3. **M-C特殊仕様の適合**：固定Showdown `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640` と比べ、メガGoli＋Mimikyu、メガLucarioZ、CharX/Yの天候、ききかいひ＋ボルチェン、スカーフ、ふゆう、アンコール、能力P66の機構を検証する最小比較テストを提案。未実行は未実行と明記。0.0.48導入は禁止。
4. **ai-rotomの活用範囲の厳密化**：`packages/mcp-server/src/tools/analysis/selection-analysis.ts`の `analyze_selection` は36対面行列の提示であり**60選出の推奨/スコアリングを行わない**。`data/champions/learnsets.json`の `rotomwash` が `["hydropump"]` のみ、`rotom`に電気技、`data-store.ts/getLearnsetMoveIdSet` はフォーム単独、`filterResultsByLearnset`でそのsetを利用。この組み合わせによって**ミトムが電気技を出せるのに分析で除外されるか**、実装/再現テストで確認。相手の技を指定せず全技の最大値を使う過剰評価の危険。必要ならupstreamへのissue候補を提案（外部へのissue投稿は承認なしには行わない）。
5. **最終判断**：今期Lの実戦支援の改善効果 vs 構築研究の長期価値、OSS別の採否条件と計算費用。後戻り可能なアダプタで導入し、main・本人L6体・Showdown固定版を変えないこと。実戦勝率の推定を捏造しない。

## 運用制約と成果
- 最初にIssue #20へ本**発注PR番号付きACK**を付す（ACKのみは成果ではない）。
- 短い結論＋重大欠陥の再現根拠＋最小の修正/検証順序をClaude固有の `claude/*` branch PR (docs/report onlyで十分) と Issue #20に残す。欠陥があれば不承認として具体的に指摘。ChatGPTの結論に合わせる必要はない。
- **追加Claude有料枠・API従量課金・有料runner・PC常時起動なし**。前回#45→#46は成果受領済みなので再発注しない。ChatGPT PR47の実コード勝手に変更しない。研究PRのmainへの無断merge・L6体変更禁止。CI赤なら原因集約し、ChatGPTがClaude監査なしで修正push連投しない。新規Actions workflow作成も今回不要。
