# Claude TeamプランだけでChatGPT→Claude Codeを呼び出す（2026-10-28更新）

## 課金上の絶対条件

この研究では、**既に契約中のClaude Teamプランの標準シートに含まれるClaude Code利用枠しか使用しない**。新しいClaude Pro/Max/Premiumシート、Claude Console API従量課金、ANTHROPIC_API_KEY、AWS等の外部AI従量課金サービス、使用量クレジットの購入・自動超過利用は**禁止**。

Anthropic公式ではTeam Standard/PremiumともClaude Codeが含まれ、`claude setup-token` で生成した `CLAUDE_CODE_OAUTH_TOKEN` を **Claude Teamのサブスクリプション認証**としてGitHub Actionsに使用できる。APIキー認証とは異なりClaudeの利用分はTeamの既存利用枠から消費される。ただしTeamの**追加使用量クレジットが有効なら従量超過料金が発生する恐れがある**ため、組織管理画面 `https://claude.ai/admin-settings/usage` で管理者に **使用量クレジット/追加使用量をオフ**にしてもらう。既存のTeam利用枠が尽きたら、その時点で処理を停止する（復活まで待つ）。無断でクレジットを有効化しない。

- [Anthropic公式：TeamでClaude Codeを使う](https://support.claude.com/en/articles/11845131-use-claude-code-with-your-team-or-enterprise-plan)
- [Anthropic公式：GitHub ActionsでサブスクリプションOAuthを使う](https://code.claude.com/docs/en/github-actions)
- [Anthropic公式：追加利用クレジットとルーティンの上限](https://code.claude.com/docs/en/routines)
- [GitHub公式：公開リポジトリの標準ランナーは無料](https://docs.github.com/en/actions/concepts/billing-and-usage)

`jugemes/champions-mc-lab` は公開リポジトリで、`ubuntu-latest` 標準ランナーを使う。GitHub Actions時間はGitHubの無料対象である。ただし巨大なArtifacts/Storageや有料の大型ランナーは使わない。

## 有効化後の作業
ユーザーは通常のChatGPTのチャットで「Claudeにも監査させて」「次を進めて」と依頼するだけ。ChatGPTが既存Issue/PRを確認→GitHub Issueに要求仕様、前提、成功条件を記録→所有者名義で `@claude` コメントを発行→GitHub ActionsがClaude Codeを起動→Claudeが専用ブランチ/PR/CI/レポートを残す→ChatGPTが別視点で独立レビューを行う。**毎回ユーザーがClaude Codeを開き依頼文を貼る必要はない**。

双方の会話は自動同期されない。GitHubに記録された内容だけが共有データとなる。PCを常時起動する必要はない。**ChatGPT側も何も依頼せずに勝手に作業を続ける仕組みではない**。

## 初回の設定（ユーザーの操作はここだけ）
1. Claude Teamの組織管理者が **追加使用量クレジットをオフ**にしていることを確認。既にオフなら変更不要。Teamの標準シートのままでよい。
2. **[Claude GitHub App](https://github.com/apps/claude)** を `jugemes/champions-mc-lab` のみに許可。既に許可済みなら変更不要。
3. TeamアカウントでClaude Codeにログインし、`claude setup-token` で既存Teamの長期OAuthトークンを発行。GitHub `jugemes/champions-mc-lab → Settings → Secrets and variables → Actions → New repository secret` に **Name: `CLAUDE_CODE_OAUTH_TOKEN`** として登録。**トークンの値はChatGPT、Issue、PR、コードには絶対書かない。** 公式に従った一度限りのPC/CLI操作が必要な場合があるが常時起動不要。
4. 設定が済み、利用枠・権限を確認できたらChatGPTへ「Team認証と追加使用量オフの設定完了」と伝える。**ChatGPTはユーザー承認前にこのDraft PR #7をマージしない。**
5. ユーザー承認後に連携用PRをマージし、ChatGPTが受信テスト用Issueで一回だけ`@claude`を送信。Actions実行・Claude返信の実績を確認してから通常運用へ移行。

現在のワークフロー `.github/workflows/claude-issue-dispatch.yml` は`ANTHROPIC_API_KEY`を**使わず**、Team OAuthのみを参照する。GitHubコメントの投稿者 `jugemes` かつ本文に `@claude` が含まれる場合だけ起動。定期起動なし、30分タイムアウト・最大12ターン・同時起動制限。PRの自動マージや育成済み構築の無断変更は禁止。

**設定だけでClaude Codeの性能や構築勝率を保証しない。** 毎回の実行後に使用量と検証条件を確認する。

## 代替：Team内のClaude Code Routines（API・トークン不要）

Claude Teamプランには[Claude Code Routines](https://code.claude.com/docs/en/routines)も含まれる。ブラウザ `https://claude.ai/code/routines` からクラウドルーティンを作り、GitHub `pull_request.opened` と **head branch starts with `chatgpt/claude-request-`** という条件を設定すれば、ChatGPTが「研究依頼PR」を作るだけでClaudeを呼び出せる。Routinesでも既存Teamの利用枠だけを消費し、追加使用量クレジットをオフにすれば上限超過時には止まる。GitHub連携は必要だが、CLIでの長期OAuthトークンを発行せずにすむ。**RoutinesのGitHubイベントはIssue投稿には対応しないため、依頼用PR作成が必要**。

この代替経路とGitHub Actionsの`@claude`経路を同時に有効にすると、PRをきっかけに重複実行するおそれがある。原則は**どちらか一つを有効化**。ルーティンは「Cloud」を選び「Local」は選ばない（ローカルはPCが必要）。

## 現在の実施状況
- 既存GitHubの監査・研究環境、CLAUDE.md、Issue/PR連携ルール：準備済み
- Team OAuth限定のGitHub Actionsコード：Draft PR #7、**未マージ・未稼働**
- Teamの追加使用量クレジット設定：**未確認**
- GitHub App/Team OAuthトークンの設定：**未確認**
- 追加契約・API従量課金：**導入していない**
