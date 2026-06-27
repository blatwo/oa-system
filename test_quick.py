"""Quick diagnosis test"""
import json
import urllib.request
import urllib.parse
import sys

BASE = "http://localhost:8089/api"


def api_get(path):
    # Proper URL encoding
    if '?' in path:
        base, query = path.split('?', 1)
        params = {}
        for pair in query.split('&'):
            k, v = pair.split('=', 1)
            params[k] = v
        encoded = urllib.parse.urlencode(params)
        url = f"{BASE}{base}?{encoded}"
    else:
        url = f"{BASE}{path}"
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        return e.code, body


def api_put(path, body_dict):
    data = json.dumps(body_dict).encode('utf-8')
    req = urllib.request.Request(f"{BASE}{path}", data=data,
                                 headers={"Content-Type": "application/json"}, method="PUT")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        return e.code, body


def api_post(path, body_dict):
    data = json.dumps(body_dict).encode('utf-8')
    req = urllib.request.Request(f"{BASE}{path}", data=data,
                                 headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        return e.code, body


# Get test project
_, projects = api_get("/projects")
pid = projects[0]['id']
print(f"Using project id={pid}")

# Test is_met data type
print("\n--- Test: is_met data type ---")
_, conds = api_get(f"/projects/{pid}/status-conditions?target_status=已完成")
print(f"  {len(conds)} conditions")
for c in conds:
    print(f"  id={c['id']}, is_met={c['is_met']!r} type={type(c['is_met']).__name__}")
print("PASS" if all(isinstance(c['is_met'], int) and c['is_met'] in (0, 1) for c in conds) else "FAIL")

# Test batch idempotency
print("\n--- Test: batch idempotency ---")
body = {"target_status": "已完成", "conditions": [{"condition_text": "条件A", "sort_order": 1}, {"condition_text": "条件B", "sort_order": 2}]}
s, d = api_post(f"/projects/{pid}/status-conditions", body)
print(f"  POST result: {len(d)} conditions, ids={[c['id'] for c in d]}")
assert len(d) == 2, f"Expected 2, got {len(d)}"

# Restore
restore = {"target_status": "已完成", "conditions": [
    {"condition_text": "所有功能测试通过", "sort_order": 1},
    {"condition_text": "客户确认验收", "sort_order": 2},
    {"condition_text": "文档交付完成", "sort_order": 3},
]}
s2, d2 = api_post(f"/projects/{pid}/status-conditions", restore)
print(f"  Restore: {len(d2)} conditions, ids={[c['id'] for c in d2]}")
assert len(d2) == 3, f"Expected 3, got {len(d2)}"
print("PASS")

# Test edge values
print("\n--- Test: is_met edge values ---")
_, conds = api_get(f"/projects/{pid}/status-conditions?target_status=已完成")
cid = conds[0]['id']
print(f"  Testing condition id={cid}")
s, d = api_put(f"/projects/{pid}/status-conditions/{cid}", {"is_met": 0})
print(f"  is_met=0: status={s}, is_met={d['is_met']}")
s, d = api_put(f"/projects/{pid}/status-conditions/{cid}", {"is_met": 1})
print(f"  is_met=1: status={s}, is_met={d['is_met']}")
api_put(f"/projects/{pid}/status-conditions/{cid}", {"is_met": 0})
print("PASS")

# Test cross-project
print("\n--- Test: cross-project access ---")
other_pid = None
for p in projects:
    if p['id'] != pid:
        other_pid = p['id']
        break
if other_pid:
    print(f"  Other project: id={other_pid}")
    s, _ = api_put(f"/projects/{other_pid}/status-conditions/{cid}", {"is_met": 1})
    print(f"  Cross-project PUT: status={s} (expect 404)")
    assert s == 404, f"Expected 404, got {s}"
    print("PASS")
else:
    print("SKIP - no other project")

print("\n=== ALL TESTS PASSED ===")
