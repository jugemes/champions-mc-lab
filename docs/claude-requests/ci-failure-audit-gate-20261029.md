# Claude Code必須：CI失敗後の修正を独立検収する（2026-10-29）

## 発注理由

ユーザーから「失敗しているのにClaudeを通していない。なぜ？」と再度指摘。ChatGPTは「構築完成前だけClaude必須」と誤った運用をして、CIが赤になった後、自分でテストと判定を繰り返した。これは共同研究の必須ゲート違反。

**今後は赤CIの解消もClaudeの独立検証なしで完了と呼ばない。** この依頼は前回の監査PR #37→Claude PR #38（自己Encore固定の反例）の「失敗→修正→再検収」を対象とする**新しい必須チェック**。前回の未着手な構築比較まで無断で完了とみなさない。

## 今回の照合対象

- ChatGPT作業ブランチ/PR #36 https://github.com/jugemes/champions-mc-lab/pull/36
- Claudeの元指摘 PR #38 https://github.com/jugemes/champions-mc-lab/pull/38
- **失敗** https://github.com/jugemes/champions-mc-lab/actions/runs/40799239783 （コミット`512fb439`、追加された「安全な控えがあれば必ず交代」テストに新v4も`move 4`、単体失敗）
- **後続の診断成功** https://github.com/jugemes/champions-mc-lab/actions/runs/40799748952 （当該ケース公開ステータス`brn`、自己Encore確定、交代可能。近似被ダメリスク：ミトム0.599、控えアシレ0.481、サザン2.556）
- **修正版CI成功** https://github.com/jugemes/champions-mc-lab/actions/runs/40800211225 （PR #36コミット`c2f1744ab3`、174 pass / 0 fail / 5 TODO。実Battle request、危険控えの場合は居座り、安全なドヒドイデ控えの別構築では新v4が実Battleで交代）
- ChatGPT再検証コメント https://github.com/jugemes/champions-mc-lab/pull/38#issuecomment-6485314736
- 固定Showdown `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`、`gen9championsbssregmc`。

## Claudeが独立して検収すべき事項（必須）

1. **失敗原因が本当にテスト期待値/安全性判断の問題かを追試**。元のPR #38の問題を「交代しないのは悪手」と即断するのではなく、AIの`incomingRisk`が公開情報だけで判断できる範囲、実Showdownでの交代法令、相手のMoonblast/Encoreなど合理的応手を確認。**赤CIをテスト弱体化で緑にしただけでないか**批判する。
2. **現行修正`c2f1744`のコード監査**：`lab.js` の`ownEncoreActive`は相手の公開イベントだけでなく自分の既知状態を正しく追い、交代・Encore終了でリセットされるか。技の有効性を誤認しないか。厳しすぎる固定閾値（`risk<0.42`かつ現役の78%未満）が本当に最善か、交代の機会損失やHP残量を含め検討。双方AIで走るか。**無条件交代より局面評価が改善したといえるか**。
3. **実対戦盤面での反例**：a)控えが安全、b)控えが危険、c)交換不能・交代先なし、d)ロック中に相手交換、e)アンコール解除後の状態。全てを機械的に実装する必要はないが、重要なバグの再現手順、推奨修正、未検証条件を明確にする。相手未公開3体/技/持ち物は絶対に参照しない。
4. **5件の`test/hybrid01-audit.test.js` TODO**：サブウェポン、スカーフ速度帯、ふゆう、かたいツメ、砂嵐岩特防（5項目）は「CI成功」と別の未解消課題。既存の`public-risk-bands.js`と`preview-risk.js`に機能があるが、旧`damage.js`と複数preview政策に不一致がある。特にサザンが実戦イエッサンに先手を取られてマジカルシャインを受けたケースの再現可能性を優先。残すべきTODOと先に統合すべきコードを独自評価。
5. **構築研究は本来目的**：PR #35の現行6/ミトム→ヒトム/サザンドラ→ラウドボーンを対人の合理的行動と選出3体で比較するという前回未実施の課題は「未完了」のまま明記。時間が許せば最重要の反例を一つ具体化するが、今回のCI監査を優先。

## 必須返却物

まず**この専用PRの番号入りACK**を既存[Issue #20](https://github.com/jugemes/champions-mc-lab/issues/20)に投稿。これは受領確認であり検収完了ではない。次に、**失敗したコミットと成功したコミット両方を独立比較した実証記録**を同Issueの新しいコメントか新しい`claude/*`成果PRで返す（結果だけの「OK」は検収としない）。再現のseed、コマンド、エンジンSHA、判断が変化した根拠、残る脆弱性、承認/不承認を明示。赤CI再実行や大量の連続コミットは不要。修正コードが必要なら発注PR、main、本人の6体を直接変更せず、別ブランチ/PRで最小限にする。

**CI失敗時の新運用**：GitHub Actionsが`failed`→ChatGPTが根拠ログ・コード差分を調査し**コード修正を凍結**→Claude独立診断・修正案（1 failure clusterに1依頼）→ChatGPTがその指摘を独立照合して最小修正＋CI→Claudeが修正版を最終検収→初めて「失敗を解消」と報告。Claude未検収なら最新CIが緑でも「暫定成功/Claude検収待ち」とする。Claudeがすでにその失敗を監査していれば重複発注せず成果を再利用する。

## 制約

Claude Teamの**既存利用枠のみ**。追加クレジット、API従量課金、有料GitHub runner、PC常時稼働、二重起動禁止。CI failedメールを増やさず、既存CIのログ読取中心。合成AIの勝率やテスト成功を実対人の構築性能と混同しない。mainマージ、ユーザー使用中のランク6体変更、新規育成の決定はしない。
