# CLAUDE-TASK：P1公開6→3選出AIを本当に改善する実装と固定Showdown検収（2026-10-30）

## 背景と引継ぎ（先に読む）
1. [PR #53](https://github.com/jugemes/champions-mc-lab/pull/53#issuecomment-6518289413) はChatGPTの公開6→3選出診断。固定Showdown CI [#41024992246](https://github.com/jugemes/champions-mc-lab/actions/runs/41024992246)で3方式を比較。Aグソク/ミミにlegacyがミトムなし、BルカZ/ガア/アーキには**3方式すべてミトムなし**、CリザX/Y/ガブには**3方式すべてスカーフガブなし**。参考候補はClaudeの公開6事前合理性レビュー [PR #46](https://github.com/jugemes/champions-mc-lab/pull/46)（最適確定ではない）。
2. ターンAI [Claude PR #51](https://github.com/jugemes/champions-mc-lab/pull/51) を受け、修正と同状態分岐 [Claude PR #55](https://github.com/jugemes/champions-mc-lab/pull/55) / [ChatGPTレビュー](https://github.com/jugemes/champions-mc-lab/pull/55#pullrequestreview-5710002771)。P0は安全性の一定改善があるが、相手合理的な交代で旧baselineより弱い局面が残る。**rational2の勝率改善は未確定**。P1は別問題。研究に人間の最善を知ったふりはせず、現行L6を変更しない。
3. プロジェクト `CLAUDE.md`, `docs/HYBRID-COLLAB-2026-10-27.md`, `docs/REAL-BATTLE-CASES-2026-10-27.md`、`preview-policy.js`、`preview-strategic.js`、`threat.js`、`preview-risk.js`、`damage.js`、`lab.js`、`reported-live-roster-20261027.js`を必ず読む。固定Showdown `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`, format `gen9championsbssregmc`, Node22。既存の他branchの有用コードは必要時に比較し、無駄に再作成しない。

## 達成目標
「A/B/Cの答えをハードコードする」のではなく、公開6を見て相手の**合理的な3選出＋先発の複数仮説**に対応できる6見せ3出し政策を、新しい`previewPolicy:'threat-aware'`など**opt-in**候補として実装。既存`legacy/stochastic/strategic`の動作を変更せず、実戦への採用は保留。

### 強制ゲート
- AIには**相手の実際の隠れ3体・技4つ・所持道具・特性・素早さポイント/IVやomniscient Battle**を渡さない。相手の種族名6、メガX/Y等の公知可能性、自己6体の自前で確認済みセット、ルール上確定している特性などだけ。ベンチマーク用の真の敵セットは**Bot構築・対戦実行後の正解データ**であり、選出時に渡してはならない。
- A/B/Cは採用前反例：Aはミトム先発が候補だが控え未確定。BでルカZをスカーフガブに任せつつガアにミトムを残し、残りはメガグロスの対アシレ/ミミ性能も評価。CはリザX/Y分岐と相手スカーフガブ、バンギ先発時のY晴れ優先を区別。**この3体を強制選出する固定スコアはいけない**。Aで相手がアシレやカバ優先の別3体を出す場合も比較。
- 選出3体20候補と先発3候補（60組）を、相手の**複数の合理的な3体候補**に対して評価。各3体の脅威処理可能性（勝ち筋、交代先、優先度、スカーフ/メガ/天候等）、こちらの先発の行動リスクを検討。枚数を最大にするスコアに過剰適合せず、最も厳しい相手の想定から安全性と攻撃的勝ち筋を両立する。相手の技などの仮説は根拠と不確定性を明記。Showdownの真のBattle結果は実行したものだけ。
- 前回実戦の負け方を再現し、新しい選出で危険なB/C対策の抜けが減るか、別の相手やholdoutで過剰適合していないかをチェック。**先発を入れ替えても同じ3体なら良い**等、責任分類（選出・初手・技/交代・全6体の構築不能）で評価。
- 旧3方式と新候補のA/B/C/holdoutで選出20候補の順位・先発・候補型/合理的相手3・各脅威の回答役をログに残す。**勝率での採用判定は、双方のターンAIの明白なプレミが排除されてから**。再現seed、同条件、左右入替、選出した理由としなかった理由。
- `npm test`, `npm run check`、固定Showdownの少数の実Battle反例を実行。GitHub CI失敗メール乱発は禁止。新ワークフロー/課金/常時PC不要。
- 成果は`claude/*`ブランチの**コード＋テスト＋結果レポート付き別PR**とIssue #20へ。ACKは開始確認に過ぎず、**完成ではない**。ChatGPTの独立レビューで欠陥が出たら差戻し→再監査で1サイクル完結。main・実戦L6体・過去の研究条件を変更禁止。

### 残るP0について
PR #55の安全性修正は本番未承認。メガガブZの公開Levitate反映、ステロ/4回超の自発交代、ロトム10万→メガリザYのダメージ帯外（元ログ1/2件）などは未検証。P1選出をこれらのバグ依存の`damage.js`完全正確として評価しない。`rational2`へ依存するなら追加の安全性ゲートが必要。PR #55の値の独立実測と人間戦績を混同しないこと。
