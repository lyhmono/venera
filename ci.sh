#!/usr/bin/env bash
# ci.sh — fork 仓库的 CI/发布辅助（push 事件在 fork 上被 GitHub 吞掉，全部走 dispatch）
# 用法:
#   ./ci.sh analyze        # 触发 analyze workflow 并等待结果
#   ./ci.sh build [tag]    # 触发 Build ALL（默认当前 master；发布时传 tag 如 v1.6.7）
#   ./ci.sh status [runid]  # 查询 run 状态
set -euo pipefail

cd "$(dirname "$0")"
REPO="lyhmono/venera"

# PAT 从 hermes config 提取（与 git remote 同源）
TOKEN=$(python3 - << 'PYEOF'
import re
cfg = open('/home/agent/.hermes/config.yaml', encoding='utf-8').read()
m = re.search(r'GITHUB_PERSONAL_ACCESS_TOKEN:\s*"([^"]+)"', cfg)
print(m.group(1) if m else '')
PYEOF
)
[ -n "$TOKEN" ] || { echo "no PAT found"; exit 1; }
AUTH="Authorization: Bearer $TOKEN"

wait_run() {
  local rid=$1 name=$2
  echo "waiting for run $rid ($name)..."
  for i in $(seq 1 60); do
    sleep 30
    st=$(curl -sS -m 20 -H "$AUTH" "https://api.github.com/repos/$REPO/actions/runs/$rid" \
      | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['status'], d.get('conclusion') or '')")
    echo "  [$((i*30))s] $st"
    case "$st" in
      completed*) echo "RESULT: $st"; return 0 ;;
    esac
  done
  echo "TIMEOUT"; return 1
}

case "${1:-}" in
  analyze)
    curl -sS -m 20 -X POST -H "$AUTH" -H "Accept: application/vnd.github+json" \
      "https://api.github.com/repos/$REPO/actions/workflows/analyze.yml/dispatches" \
      -d '{"ref":"master"}' -o /dev/null -w "dispatch: %{http_code}\n"
    sleep 20
    rid=$(curl -sS -m 20 -H "$AUTH" "https://api.github.com/repos/$REPO/actions/workflows/analyze.yml/runs?per_page=1" \
      | python3 -c "import json,sys; print(json.load(sys.stdin)['workflow_runs'][0]['id'])")
    wait_run "$rid" "analyze"
    ;;
  build)
    ref="${2:-master}"
    curl -sS -m 20 -X POST -H "$AUTH" -H "Accept: application/vnd.github+json" \
      "https://api.github.com/repos/$REPO/actions/workflows/main.yml/dispatches" \
      -d "{\"ref\":\"$ref\"}" -o /dev/null -w "dispatch: %{http_code}\n"
    sleep 20
    rid=$(curl -sS -m 20 -H "$AUTH" "https://api.github.com/repos/$REPO/actions/workflows/main.yml/runs?per_page=1" \
      | python3 -c "import json,sys; print(json.load(sys.stdin)['workflow_runs'][0]['id'])")
    wait_run "$rid" "build@$ref"
    ;;
  status)
    rid="${2:-}"
    if [ -z "$rid" ]; then
      curl -sS -m 20 -H "$AUTH" "https://api.github.com/repos/$REPO/actions/runs?per_page=5" | \
        python3 -c "import json,sys; [print(r['id'], r['name'], r['head_branch'], r['status'], r.get('conclusion')) for r in json.load(sys.stdin)['workflow_runs']]"
    else
      wait_run "$rid" "run"
    fi
    ;;
  *)
    echo "用法: $0 {analyze|build [tag]|status [runid]}"
    ;;
esac
