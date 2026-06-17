# 开发工具

GitHub CLI 

## GitHub (gh CLI)

GitHub 官方命令行工具，用于仓库、Issue、PR、Actions、Release 以及 API 访问。

默认只做读取、搜索和查看。创建仓库、fork、同步仓库、创建 Issue/PR/Release 等写操作必须有用户明确请求。

```bash
# 认证
gh auth login
gh auth status

# 搜索
gh search repos "query" --sort stars --limit 10
gh search code "query" --language python

# 仓库
gh repo view owner/repo
gh repo clone owner/repo

# Issues
gh issue list -R owner/repo --state open
gh issue view 123 -R owner/repo

# Pull Requests
gh pr list -R owner/repo --state open
gh pr view 123 -R owner/repo
gh pr checks 123 --repo owner/repo

# Actions / CI
gh run list --repo owner/repo --limit 10
gh run view <run-id> --repo owner/repo
gh run view <run-id> --repo owner/repo --log-failed
gh workflow list --repo owner/repo

# Releases
gh release list -R owner/repo

# API
gh api /user
gh api repos/owner/repo

# JSON 输出
gh issue list --repo owner/repo --json number,title --jq '.[] | "\(.number): \(.title)"'
```

## 写操作（需要用户明确请求）

```bash
gh repo create my-repo --private
gh repo fork owner/repo
gh repo fork owner/repo --clone
gh repo sync owner/repo
gh issue create -R owner/repo --title "Title" --body "Body"
gh pr create -R owner/repo --title "Title" --body "Body"
gh release create v1.0.0
```

在 Pixiu 中执行这些命令前，确认用户确实要求对 GitHub 远端进行写入或账号相关操作。


## 选择指南

| 工具 | 来源 | 用途 |
|-----|------|------|
| gh CLI | agent-reach | GitHub 仓库、Issue、PR、Actions、Release、API |
| Pixiu file tools | Pixiu built-in | 已克隆仓库的本地代码阅读与修改 |
