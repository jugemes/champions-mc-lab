# 2026-10-30｜OSS探索エンジンとai-rotomの利用可能性・実装試作（未導入）

## 目的・今回の判断
Pokémon Champions M-Cシングル、現行L6体のM-7実戦選出精度とM-8構築評価を高めるため、従来自作の技・交代ヒューリスティクスだけに依存せず、外部OSSを**比較対象**として扱う。実戦L6体、main、Showdown固定SHA `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`は変更しない。今回のエンジン比較は対人勝率の証明ではない。

## 1. poke-engine / Foul Play（局面遷移＋探索）
- https://github.com/pmariglia/poke-engine のmain SHA `f7b147f13637ceecc1b0d1e9172ec232af4d45d0`（2026-10-11時点の最新確認）。MITライセンス。Rust `Cargo.toml` に `champions=[]` `bss=["champions"]` のfeature、`src/genx/state.rs` に `MoveChoice::TeamPreview(lead,second,third)`、`bss_team_preview_get_all_options()` が**20通りの3体組合せ×3先発＝60行動**を生成する実装を確認。`tests/test_bss_mechanics.rs` で60行動と3体選出の状態遷移のテストが存在する。
- Foul Play https://github.com/pmariglia/foul-play は既存MCTSエンジンのPython接続Bot。ただし公開 `requirements.txt` は `poke-engine==0.0.48` を固定し、`poke-engine/terastallization` featureでビルドしている。M-Cシングルへの**直接対応は未成立**。
- https://github.com/pmariglia/poke-engine/issues/32 により0.0.48ではGolisopite、Lucarionite Z、Garchompite Z等が `UNKNOWNITEM` となる不具合を確認。M-Cメガ必須の対戦評価にこの版を利用しない。mainの修正を候補にしても**固定Showdownと一致するまでは非正本**。
- 6→3と初手は公開6だけを使用。相手の隠れ選出3や技をモデルに渡さず、公開6から合法な複数の型仮説を生成する設計を別途監査する。

### 今回の試作
- `oss-engine-mcts-probe.js`：poke-engineのMCTSの標準出力を解析し、**自分の公開6からの60個の合法な「3体＋先発」候補**だけを識別する読み取り専用の試験コード。任意の絶対パスの実行ファイルを受け取る任意実行ではなく、利用者が信頼する固定ローカルバイナリを明示する機能。shell=false、時間制限あり。MCTS出力のvisitsを勝率へ変換しない。テスト用関数の入力に `scenarioProvenance: 'public-six-hypothesis'` の明示を要求するが、**このマーカーだけで未公開情報の混入を検査できるわけではない**。状態シリアライズの独立監査までは、実戦利用禁止。
- `test/oss-engine-mcts-probe.test.js`：候補20組×3初手、合法3、全60網羅、候補重複の排除、時間上限、スコア表示の制約。**ローカルNode22で7/7成功**。なお、出力のパース試験であって**Rustエンジンの実起動や対戦勝率の検証ではない**。
- 今回のホストにはcargoが無いため、Rust build・Champions専用メガ技・能力P・持ち物・天候・交代順序等の機構一致は**未実行**。次は孤立した同一条件のShowdown対照テストと状態変換の仕様検査。CI失敗メール連投を避け、追加CIを無条件に作らない。

## 2. ai-rotom（MCPによる検証ツール、対戦AI本体ではない）
- 2026-04-19 Zenn記事 https://zenn.dev/nonz250/articles/nonz250-ai-rotom に対し、実装 https://github.com/nonz250/ai-rotom を確認。main SHA `4172a077db9b7e507dc209605889500009b9c78d`（2026-10-25）、npm `@nonz250/ai-rotom` 1.3.5（GitHub `packages/mcp-server/package.json`）。MIT、Node **>=24**。本研究mainのNode22と異なるため、同一実行環境への無条件導入は避ける。
- 静的辞書・日本語名解決・能力P・特性・道具・ `@smogon/calc` 0.12.0による単発ダメージ、素早さ、対面行列の再利用価値がある。Mega Golisopod/Lucario Zなどのデータ収録を確認。ただし作者READMEが一部特性/持ち物がダメージ未反映と明記。正しさを推定しない。
- **重要な制約**：`packages/mcp-server/src/tools/analysis/selection-analysis.ts` の `analyze_selection` は6×6＝最大36対面行列であり、説明文に「ツール側では推奨やスコアリングを行わない」と明記。**6見せ3出しで最適3＋初手を探索するエンジンではない**。未指定技では覚える全攻撃技から最大威力を選ぶため、実機の相手技や本採用4技の推定とも異なる。
- **具体的な不一致候補**：`data/champions/learnsets.json` の `rotomwash` は `["hydropump"]`、共通 `rotom` に電気技が別途登録。`data-store.ts` の `getLearnsetMoveIdSet(pokemonId)` はフォーム単独を返し、`selection-analysis.ts` は `getLearnsetMoveIdSet(entryId)` を呼ぶ。`filterResultsByLearnset` はその単独setで絞り込む。したがって**技を明示しないウォッシュロトムの対面分析はボルトチェンジ・10まんボルトを落とす可能性が高い**。コード読取からの仮説で、MCP実行による出力再現は**未実施**。明示指定技はlearnset検証をバイパスする仕様であり、対策にはなっても厳格な合法性証明にはならない。
- 作者記事はリアルタイム毎ターンの最善行動をまだカバーしないと説明。**poke-engineの探索と競合しない**。ダメージ/型データの第二情報源として、固定Showdownオラクルと照合して採用の可否を判断する。
- 大量の他人の対戦データ取得、第三者APIへの実戦パーティ送信、MCP外部導入、新課金は現時点では行わない。

## 次の厳格なゲート
1. この試作は**MCTS候補の読み取りと60個の合法性検証**のみ。実際のChampions 6→3で最強と呼ぶこと禁止。
2. `poke-engine` の固定ソース版をRust `--features bss` でビルドし、メガストーン認識、実数値、Showdownとの技/天候/状態異常/交代順序一致、実行時間の証拠を記録する（**未実施**）。
3. `ai-rotom` 1.3.5のミトム全技分析と、メガGoli/LucarioZ/リザYダメージを固定Showdownと同条件で比較する（**未実施**）。対戦の未公開型を確定させない。
4. 自分・相手双方の公開6と合法的に観測した行動だけで選出/交代/技を決めることを保証し、合理的な敵Botと同一条件を比較する。複数試験の結果が整うまで実戦導入・L変更なし。
5. **Claude独立監査を必須**とし、コードの合否、対戦Botの合理性、対人勝率を混同しない。CI failed時は原因を集約し、修正pushを連投しない。
