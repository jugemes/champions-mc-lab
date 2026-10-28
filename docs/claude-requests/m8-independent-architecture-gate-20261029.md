# Claude Code 独立監査依頼：対戦AIと次期構築の合格ゲート（2026-10-29）

- 研究Issue：[#20](https://github.com/jugemes/champions-mc-lab/issues/20)
- 構築候補：[PR #35](https://github.com/jugemes/champions-mc-lab/pull/35)
- 対戦AI：[PR #36](https://github.com/jugemes/champions-mc-lab/pull/36)
- 未解決Claudeレビュー：[PR #31](https://github.com/jugemes/champions-mc-lab/pull/31)
- 共有指針：`CLAUDE.md`、`docs/REAL-BATTLE-CASES-2026-10-27.md`、`docs/HYBRID-COLLAB-2026-10-27.md`
- pinned Showdown: `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`, format `gen9championsbssregmc`.

## 優先する仕事

ユーザーは現行の6体でランクマを継続し、ChatGPTとClaudeは次の**実戦で勝てる構築**を作る。**Claude独立監査を採用判定の必須工程**にする。ChatGPT案を追認しない。現在の公開6→選出3・初手、敵の合理的な攻撃/交代/メガ/持ち物仮説、AIがプレミをしない前提の反例を重視し、合成勝率やCI緑だけで強いと認めない。

1. **最優先P0：構築候補の弱点監査**。PR #35内の現行6体、ヒートロトム1枠案、ウォッシュロトム維持＋ラウドボーン1枠案を独立比較。グソクムシャのであいがしらだけでなく、ミミッキュ後出し、スカーフガブじしん、カバルドン、メガリザX/Y、雨・イダイトウ、ルカリオ、サーフゴー、相手合理的な6→3と初手を対象にする。特にラウドボーンでサザンドラを失う弊害とヒートロトムで水打点を失う弊害を洗い出す。実戦で再現できる3体/初手・交代/技の勝ち筋がなければ採用保留と明示。
2. **P0：対戦AIの非合理を独立検出**。PR #36の `v4-public-status` はEncore状態を見られても56試合中Encore使用0で、効用がまだ測れていない。こちらと相手双方の選出・積み・Encore・回復・交代・先制技への応答を実Showdownの合法公開情報で評価。相手の未公開3体/技/持ち物への参照がないことをテストし、最低1つ、人間の合理的な相手行動を使う**再現可能な反例と修正判断**を報告。現行CI失敗の原因も独立確認。
3. **P1：前回レビューの未解決事項**。PR #31で人工的に作った `Thunderbolt→Baxcalibur→immune` をGravity/ふうせんのGround無効の説明に使用した点など、Claude報告に対するChatGPTの反論を再検証。実エンジンで起こる例のテストに限定し、現象が再現不能なら採用保留。

## 実施と成果の形式

- 最初にトリガー通常PR番号を明記したACKを**Issue #20**へ投稿。GitHubへの書き込みが失敗したら成功を装わない。
- Claudeの**独自の評価**をIssue #20に投稿し、重要な不具合・不足テスト・構築候補の相対評価と具体的勝ち筋/負け筋を整理。コード修正が妥当なら既存PRを無断変更せず、`claude/*`別ブランチ→PR→最小CI。ベースに積み上げPRを使う場合は明記。
- CI `failed` メールが大量発生済み。新たなワークフローを大量に追加せず、既存ログを読み、実行前に再現条件をレビュー。小さな独立テストを優先し、同じ失敗で再push/再実行を繰り返さない。
- Team既存利用枠のみ。追加クレジット・API従量課金・有料Runner・新規サブスク禁止。別のClaudeセッションを重複起動しない。main直Push/自動merge、本番6体変更、新規育成決定禁止。

**必須工程ゲート**：ChatGPT単独研究→Claude独立監査→ChatGPT反例再検収→ユーザー最終採否。Claudeの成果を受け取るまでは構築・対戦AIを「完成」と判定しない。
