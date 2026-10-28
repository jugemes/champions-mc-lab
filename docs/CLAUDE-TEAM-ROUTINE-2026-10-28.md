# Claude Team付属Cloud RoutinesでPC不要・追加課金なしの連携（2026-10-28）

> この方法はGitHub ActionsのClaude用OAuthトークンを作らずに、Claude Teamプランの**既存利用枠だけ**で作業を自動起動する代替案です。Claude Pro/Max/Premiumの新規契約も、APIキーの課金も不要です。まず組織の**追加使用量クレジットを無効**にしてください。制限に達したらClaudeのルーティン実行は停止します。
>
> 対応： [Claude Code Routines公式](https://code.claude.com/docs/en/routines)。Teamプランで利用可能。クラウド上で実行されるのでWindows PCの常時起動は不要。Claude Teamの管理者がRoutinesを無効にしている場合、利用には管理者の許可が必要です。

## 一度だけ設定する
1. `https://claude.ai/code/routines` を、既存Claude Teamアカウントで開く。
2. 「New routine」を押し、名前を `Champions - ChatGPT共同研究依頼` とする。
3. リポジトリを `jugemes/champions-mc-lab` に限定する。
4. 下記の「保存する指示文」を**一度だけ**ルーティンに設定。
5. Triggerに **GitHub event → Pull request → opened** を選ぶ。必要ならClaude GitHub Appの権限をこのrepoだけに許可する。
6. **フィルターをすべて適用（AND）**：
   - Author equals `jugemes`
   - Base branch equals `main`
   - Head branch starts with `chatgpt/claude-request-`
   - Title starts with `CLAUDE-TASK:`
   - （使える場合）Is draft equals `true`
7. 定時起動やAPIトリガーは追加しない。新規の使用量クレジットは購入しない。Routineを保存して終了。

**注意：** RoutinesのGitHubイベントはPRイベントとReleaseイベントだけで、Issue作成・コメントでは直接起動しない。ChatGPTは、Issueで仕様を記録し、独立の軽微なタスクファイルを作った**依頼用Draft PR**を開くことでイベントを発行する。ClaudeはPR本文を読んでIssueに記録された要求を実装し、別PRで改修案を提出。依頼用PRはコード本体の変更ではない。二重起動しないようPRの新規作成は各依頼につき1回。

## ルーティンに保存する指示文（一度だけコピー）

```text
あなたは「jugemes/champions-mc-lab」におけるClaude Code独立監査・改善担当です。共同研究の相手はChatGPTです。最重要目標はPokémon Champions M-Cシングルのチャンピオン級到達です。

このルーティンはChatGPTが作成した「CLAUDE-TASK:」というタイトルの依頼用Pull Requestから起動します。まず起動原因となったPRの本文、リンクされたGitHub Issue、ルートのCLAUDE.md、docs/HYBRID-COLLAB-2026-10-27.md、docs/REAL-BATTLE-CASES-2026-10-27.md、最新mainと他の未マージPRを取得し、重複や競合の無い範囲を確認してください。

そのIssueに記載された実装・独立監査・回帰テストを行い、専用のclaude/* ブランチで独立のPRを作成してください。元の依頼用PRをマージしないでください。構築・個体・過去の試験条件は勝手に書き換えないでください。変更後のCI、Showdown固定版、合法性、相手6体→合理的3体選出、公開情報境界と最悪対面を検査し、試験不能な事項は未確認と報告してください。ChatGPTや自分の以前の結果を盲信しないこと。

費用制約：既存Claude Teamプランの標準シート利用枠の範囲のみを使用。Claude Console API、追加クレジット、新規有料契約、外部従量課金、GitHubの有料ランナーは利用禁止。既存利用枠が切れたら停止し、費用追加で続行しないこと。大量シミュレーションを勝手に回さず最小再現を優先してください。

PRでは原因・変更内容・テスト結果・未解決リスク・ChatGPTに反証してほしい点を必ず示し、ユーザー承認前にmainへマージしないでください。
```

## 運用と注意
- ユーザーのチャット依頼→ChatGPTがIssue作成→ChatGPTが依頼用PRを作成→**Claude Teamのクラウドルーティンが1回だけ起動**→Claude実装PR→ChatGPTが独立レビュー。
- AnthropicのCloud RoutinesはTeam利用枠を消費する。**追加使用量クレジットがオンだと従量課金が起こり得る**。管理画面 `https://claude.ai/admin-settings/usage` でオフになっていることが必須。
- GitHubのIssue/PRは公開。ユーザーの個人情報・認証情報・非公開の戦闘動画を勝手に公開しない。
- **同時にDraft PR #7の`@claude` GitHub Actions連携を有効にしない**。どちらか片方で十分。
- 実装済みという意味ではない：**ルーティンはユーザーのClaude Team環境で設定されるまで未稼働**。ChatGPTは自分の権限だけでClaude Teamのルーティンを設定できない。
