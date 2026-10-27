# Claude CodeをChatGPTから呼び出す：PC常時起動不要・一度だけ認証（2026-10-27）

## 何ができるか（導入後）
ChatGPTの「じぴちゃん」に「次の研究を進めて」「Claudeにも独立監査させて」と依頼するだけで進める。ChatGPTがGitHubのIssueに作業の目的、実戦反例、成功条件を記録し、同Issueへ `@claude このIssueを実装して別ブランチからPRを作って。mainへマージしないで。` と**GitHubコメントを直接書く**。GitHubの `issue_comment` イベントを受けてAnthropic公式Claude Code GitHub Actionがクラウドで起動、Claudeが `CLAUDE.md` とIssue本文を読み作業しPR/報告を残す。ChatGPTはGitHubから検収する。ユーザーは**毎回プロンプトをClaudeにコピペする必要がない**。

PCは各回の実行に不要。CI（M-CのShowdown）は既存GitHub Actionsを利用。Claudeとのチャット内容の自動共有ではなく、GitHubのコード、Issue、PR、レポートを共有の正本にする。

## 初回のみ必要な操作
1. 既存GitHubの **[Claude GitHub App](https://github.com/apps/claude)** をリポジトリ `jugemes/champions-mc-lab` **だけ**に許可する。既に許可済みなら不要。Appの要求権限（Contents, Actions, Workflows, Issues, PRsへの読書き等）を確認する。
2. 認証の方法を決める。このワークフローでは、Claude Codeの**有料サブスクリプション**を用いる `CLAUDE_CODE_OAUTH_TOKEN` を利用する。Claude Codeの公式手順に従って `claude setup-token` で長期トークンを発行し、GitHub `Settings → Secrets and variables → Actions → New repository secret` に **Name: `CLAUDE_CODE_OAUTH_TOKEN`** として保存する。**トークン本体はChatGPTにもIssueにも貼らない。** この操作にPC/ターミナルが一度必要となる場合があるが常時起動不要。
3. [Claude GitHub Actions公式](https://code.claude.com/docs/en/github-actions)で、現在のGitHub App接続、認証手順、利用上限・課金を確認。APIキーによる従量課金を使う場合は、代わりに `ANTHROPIC_API_KEY` Secret を設定し、workflowの入力を `anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}` に切り替える（**本人が料金を確認してから**）。
4. 準備ができたら「GitHub側認証は設定した」とChatGPTに伝える。ChatGPTが安全なテストIssueを用意した上で、本設定用PRをmainへマージする（**認証確認とユーザー承認まではマージしない**）。
5. 最初の動作確認は本物のタスクではなく `@claude このIssueに受信確認コメントだけを返してください。コード変更とマージは不要です。` をChatGPTがコメントし、Claudeの返信とActions成否を確認する。機能して初めて実作業に用いる。

## このリポジトリに用意したガード
- GitHubコメントの投稿者 `jugemes` の `@claude` にのみ起動。第三者やbotのコメントでは起動しない。
- **Issue / PR コメント時のみ起動**。定期的に勝手にClaudeへ作業依頼・課金するスケジュールは作らない。自動マージ・構築変更は禁止。
- ユーザーの「研究を進めて」の意思をChatGPTが受け取ったとき、GitHub Issueを作成してClaudeへの依頼を開始する。タスク作成時には連続起動・重複を確認する。
- ClaudeとChatGPTの役割は`CLAUDE.md`で指定。Claudeは独立監査・修正・テスト・PR、ChatGPTは実戦分析・反証・PRレビュー。
- GitHub Actionsのワークフローにはコード変更権限があるため、**公開Issue/PRの文章からの悪意ある指示を実行しない**よう、Claudeのプロジェクト指示とユーザーのレビューが重要。
- リポジトリをforkした場合などで秘密情報が読み取れない実行を起こさない。権限は必要最小限に維持する。

## 代替案：Claude CodeのCloud Routines
[Claude Routines公式](https://code.claude.com/docs/en/routines)はClaudeのWeb UIで一度設定すると、**pull_request.opened等のGitHubイベント**や定時・API呼び出しでCloud Sessionsを起動できる。こちらはClaudeのサブスクリプション利用枠を使い、PCもGitHub ActionsのClaude専用トークンも不要。

ただし現在のGitHubイベント対応は主に**PRとRelease**であり、Issue新規作成そのものは直接のトリガーではない。IssueをClaudeに即時「実装依頼」したい用途では、上記 `@claude` のGitHub Actionが扱いやすい。一方、**ChatGPTが作成したPRをClaudeが自動レビューする**目的ならGitHubイベントルーティンが適する。両方を同時に無条件で有効にすると多重起動・利用枠消費の恐れがあるので、必要性を確かめてから追加する。

### 留意事項
GitHub Actions成功は「ツールと最低限のテストが通った」ことであり、勝てる構築や対人選出AI完成の証拠ではない。Claudeのクラウド処理はChatGPTへの回答に自動反映されず、ChatGPTがその後GitHubを確認する必要がある。ChatGPTがこの会話を閉じた後に自発的に巡回する仕組みも、この連携だけでは生まれない。通知や定期的な独立レビューの追加は、別途ユーザーに相談して設計する。

**導入状況：GitHub側にワークフロー案を別PRで準備した段階。Claude GitHub App接続・認証Secret・起動テストは未確認。**
