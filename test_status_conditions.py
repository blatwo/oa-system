"""
============================================================
项目状态达成条件 — QA 集成测试
============================================================
测试范围：server.py 中 6 个新增 API + 改造后的 PUT /api/projects/{pid}
遵循标准：PEP8，Arrange-Act-Assert，独立可重复
============================================================
"""
import json
import sys
import time
import traceback
import requests

BASE = "http://localhost:8089/api"
PASSED = 0
FAILED = 0
ERRORS = []


def log(msg):
    print(f"  {msg}")


def api_get(path):
    """GET request, return (status, data)."""
    try:
        resp = requests.get(f"{BASE}{path}", timeout=15)
        try:
            return resp.status_code, resp.json()
        except json.JSONDecodeError:
            return resp.status_code, resp.text[:200]
    except requests.RequestException as e:
        return 0, str(e)


def api_post(path, body_dict):
    """POST request, return (status, data)."""
    try:
        resp = requests.post(f"{BASE}{path}", json=body_dict, timeout=15)
        try:
            return resp.status_code, resp.json()
        except json.JSONDecodeError:
            return resp.status_code, resp.text[:200]
    except requests.RequestException as e:
        return 0, str(e)


def api_put(path, body_dict):
    """PUT request, return (status, data)."""
    try:
        resp = requests.put(f"{BASE}{path}", json=body_dict, timeout=15)
        try:
            return resp.status_code, resp.json()
        except json.JSONDecodeError:
            return resp.status_code, resp.text[:200]
    except requests.RequestException as e:
        return 0, str(e)


def api_delete(path):
    """DELETE request, return (status, data)."""
    try:
        resp = requests.delete(f"{BASE}{path}", timeout=15)
        try:
            return resp.status_code, resp.json()
        except json.JSONDecodeError:
            return resp.status_code, resp.text[:200]
    except requests.RequestException as e:
        return 0, str(e)


# ============================================================
#  SETUP: 获取测试项目
# ============================================================
def setup():
    """获取第一个"进行中"状态且存在时间较长的项目作为测试项目，
       并获取一个"已完成"状态的项目用于对比测试。"""
    print("\n--- SETUP ---")
    _, projects = api_get("/projects")
    active = [p for p in projects if p['status'] == '进行中']
    completed = [p for p in projects if p['status'] == '已完成']

    if not active:
        print("  ⚠️  No active project found, trying to use any project...")
        test_project = projects[0] if projects else None
    else:
        test_project = active[0]

    if not test_project:
        print("  ❌ No project found at all! Cannot run tests.")
        sys.exit(1)

    print(f"  测试项目: id={test_project['id']}, name={test_project['name']}, status={test_project['status']}")
    return test_project, completed


pid = None
original_status = None


# ============================================================
#  TEST 1: GET /api/projects/{pid}/status-conditions (空条件)
# ============================================================
def test_01_get_empty_conditions():
    """获取尚未配置条件的项目，应返回空列表"""
    status, data = api_get(f"/projects/{pid}/status-conditions?target_status=已完成")
    assert status == 200, f"Expected 200, got {status}"
    assert isinstance(data, list), f"Expected list, got {type(data)}"
    # 可能已有旧条件（之前测试残留），先清理
    log(f"  返回 {len(data)} 条条件")
    # 清理旧数据，以便后续测试
    for cond in data:
        api_delete(f"/projects/{pid}/status-conditions/{cond['id']}")
    # 再次获取确认已清空
    status2, data2 = api_get(f"/projects/{pid}/status-conditions?target_status=已完成")
    assert status2 == 200, f"Expected 200, got {status2}"
    assert len(data2) == 0, f"Expected empty list after cleanup, got {len(data2)}"


# ============================================================
#  TEST 2: POST /api/projects/{pid}/status-conditions (批量创建)
# ============================================================
def test_02_create_conditions():
    """批量创建条件"""
    body = {
        "target_status": "已完成",
        "conditions": [
            {"condition_text": "所有功能测试通过", "sort_order": 1},
            {"condition_text": "客户确认验收", "sort_order": 2},
            {"condition_text": "文档交付完成", "sort_order": 3},
        ]
    }
    status, data = api_post(f"/projects/{pid}/status-conditions", body)
    assert status == 200, f"Expected 200, got {status}"
    assert isinstance(data, list), f"Expected list, got {type(data)}"
    assert len(data) == 3, f"Expected 3 conditions, got {len(data)}"
    # 验证字段
    for c in data:
        assert 'id' in c, "Condition missing 'id'"
        assert 'condition_text' in c, "Condition missing 'condition_text'"
        assert 'is_met' in c, "Condition missing 'is_met'"
        assert c['is_met'] == 0, f"Expected is_met=0, got {c['is_met']}"
        assert c['target_status'] == '已完成', f"Expected target_status='已完成', got {c['target_status']}"
    log(f"  创建条件 IDs: {[c['id'] for c in data]}")
    return data  # 返回条件列表供后续测试使用


# ============================================================
#  TEST 3: GET /api/projects/{pid}/status-conditions (有数据)
# ============================================================
def test_03_get_existing_conditions():
    """获取已配置条件，应返回3条"""
    status, data = api_get(f"/projects/{pid}/status-conditions?target_status=已完成")
    assert status == 200, f"Expected 200, got {status}"
    assert len(data) == 3, f"Expected 3 conditions, got {len(data)}"
    # 验证按 sort_order 排序
    orders = [c['sort_order'] for c in data]
    assert orders == sorted(orders), f"Conditions not sorted by sort_order: {orders}"


# ============================================================
#  TEST 4: PUT /api/projects/{pid}/status-conditions/{cid} (勾选)
# ============================================================
def test_04_toggle_condition():
    """勾选一条条件，验证 is_met 变为 1，met_date 有值"""
    _, conditions = api_get(f"/projects/{pid}/status-conditions?target_status=已完成")
    cid = conditions[0]['id']

    # 勾选
    status, data = api_put(f"/projects/{pid}/status-conditions/{cid}",
                           {"is_met": 1, "met_by": "测试用户"})
    assert status == 200, f"Expected 200, got {status}"
    assert data['is_met'] == 1, f"Expected is_met=1, got {data['is_met']}"
    assert data['met_date'] != '', f"Expected met_date to be set, got empty"
    log(f"  勾选后: is_met={data['is_met']}, met_date={data['met_date']}")

    # 取消勾选
    status2, data2 = api_put(f"/projects/{pid}/status-conditions/{cid}",
                             {"is_met": 0, "met_by": "测试用户"})
    assert status2 == 200, f"Expected 200, got {status2}"
    assert data2['is_met'] == 0, f"Expected is_met=0, got {data2['is_met']}"
    assert data2['met_date'] == '', f"Expected met_date empty after uncheck, got '{data2['met_date']}'"
    log(f"  取消后: is_met={data2['is_met']}, met_date={data2['met_date']}")


# ============================================================
#  TEST 5: PUT ... (修改条件描述)
# ============================================================
def test_05_update_condition_text():
    """修改条件描述文本"""
    _, conditions = api_get(f"/projects/{pid}/status-conditions?target_status=已完成")
    cid = conditions[0]['id']
    new_text = "所有功能测试通过（已更新）"

    status, data = api_put(f"/projects/{pid}/status-conditions/{cid}",
                           {"condition_text": new_text})
    assert status == 200, f"Expected 200, got {status}"
    assert data['condition_text'] == new_text, \
        f"Expected '{new_text}', got '{data['condition_text']}'"

    # 还原
    api_put(f"/projects/{pid}/status-conditions/{cid}",
            {"condition_text": "所有功能测试通过"})


# ============================================================
#  TEST 6: DELETE /api/projects/{pid}/status-conditions/{cid}
# ============================================================
def test_06_delete_condition():
    """删除第3条条件，验证只剩2条"""
    _, conditions = api_get(f"/projects/{pid}/status-conditions?target_status=已完成")
    assert len(conditions) == 3, f"Expected 3 before delete, got {len(conditions)}"
    cid = conditions[2]['id']  # 第3条

    status, data = api_delete(f"/projects/{pid}/status-conditions/{cid}")
    assert status == 200, f"Expected 200, got {status}"
    assert data.get('ok') == True, f"Expected {{ok: true}}, got {data}"

    # 验证只剩2条
    _, after = api_get(f"/projects/{pid}/status-conditions?target_status=已完成")
    assert len(after) == 2, f"Expected 2 after delete, got {len(after)}"

    # 删除不存在的条件应返回404
    status2, _ = api_delete(f"/projects/{pid}/status-conditions/99999")
    assert status2 == 404, f"Expected 404 for non-existent, got {status2}"

    # 重建全部3条条件（POST 是批量替换，需传入完整列表）
    api_post(f"/projects/{pid}/status-conditions", {
        "target_status": "已完成",
        "conditions": [
            {"condition_text": "所有功能测试通过", "sort_order": 1},
            {"condition_text": "客户确认验收", "sort_order": 2},
            {"condition_text": "文档交付完成", "sort_order": 3},
        ]
    })


# ============================================================
#  TEST 7: GET /api/projects/{pid}/check-status (未全部达成)
# ============================================================
def test_07_check_status_unmet():
    """检查状态：条件未全部达成时 can_change=false"""
    # 确保所有条件都未勾选
    _, conditions = api_get(f"/projects/{pid}/status-conditions?target_status=已完成")
    for c in conditions:
        if c['is_met']:
            api_put(f"/projects/{pid}/status-conditions/{c['id']}", {"is_met": 0})

    status, data = api_get(f"/projects/{pid}/check-status?target=已完成")
    assert status == 200, f"Expected 200, got {status}"
    assert data['can_change'] == False, f"Expected can_change=false when unmet, got {data}"
    assert data['met_count'] == 0, f"Expected met_count=0, got {data['met_count']}"
    assert data['total_count'] == 3, f"Expected total_count=3, got {data['total_count']}"
    assert len(data['unmet_list']) == 3, \
        f"Expected 3 unmet, got {len(data['unmet_list'])}"

    # 验证 unmet_list 元素为字符串(condition_text)
    for item in data['unmet_list']:
        assert isinstance(item, str), \
            f"unmet_list item should be str (condition_text), got {type(item)}: {item}"

    log(f"  can_change={data['can_change']}, met={data['met_count']}/{data['total_count']}")
    log(f"  unmet_list={data['unmet_list']}")


# ============================================================
#  TEST 8: GET /api/projects/{pid}/check-status (全部达成)
# ============================================================
def test_08_check_status_all_met():
    """检查状态：全部达成时 can_change=true"""
    _, conditions = api_get(f"/projects/{pid}/status-conditions?target_status=已完成")
    for c in conditions:
        api_put(f"/projects/{pid}/status-conditions/{c['id']}", {"is_met": 1})

    status, data = api_get(f"/projects/{pid}/check-status?target=已完成")
    assert status == 200, f"Expected 200, got {status}"
    assert data['can_change'] == True, f"Expected can_change=true when all met, got {data}"
    assert data['met_count'] == 3, f"Expected met_count=3, got {data['met_count']}"
    assert data['total_count'] == 3, f"Expected total_count=3, got {data['total_count']}"
    assert len(data['unmet_list']) == 0, \
        f"Expected 0 unmet, got {len(data['unmet_list'])}"

    log(f"  can_change={data['can_change']}, met={data['met_count']}/{data['total_count']}")

    # 恢复：全部取消勾选
    for c in conditions:
        api_put(f"/projects/{pid}/status-conditions/{c['id']}", {"is_met": 0})


# ============================================================
#  TEST 9: PUT /api/projects/{pid} — 条件不满足时拒绝
# ============================================================
def _get_project(project_id):
    """Helper: get single project from list (no GET /api/projects/{id} endpoint)."""
    _, projects = api_get("/projects")
    for p in projects:
        if p['id'] == project_id:
            return p
    return None


def test_09_reject_status_change_when_unmet():
    """条件未全部达成时，变更状态为"已完成"应被拒绝(400)"""
    # 确保当前状态不是"已完成"，且条件未全部达成
    proj = _get_project(pid)
    assert proj is not None, f"Project {pid} not found"
    assert proj['status'] != '已完成', \
        f"Test project already '已完成', need a non-completed project"
    log(f"  项目当前状态: {proj['status']}")

    status, data = api_put(f"/projects/{pid}", {"status": "已完成"})
    assert status == 400, f"Expected 400 when conditions unmet, got {status}"
    # requests 库会自动解析 JSON 错误响应为 dict，urllib 返回原始字符串
    error_msg = data if isinstance(data, str) else json.dumps(data, ensure_ascii=False)
    log(f"  返回错误信息: {error_msg[:100]}...")


# ============================================================
#  TEST 10: PUT /api/projects/{pid} — 条件满足时允许变更
# ============================================================
def test_10_allow_status_change_when_all_met():
    """条件全部达成时，变更状态为"已完成"应成功，并记录日志"""
    global pid

    # 1. 勾选所有条件
    _, conditions = api_get(f"/projects/{pid}/status-conditions?target_status=已完成")
    for c in conditions:
        api_put(f"/projects/{pid}/status-conditions/{c['id']}", {"is_met": 1})

    # 2. 执行状态变更
    status, data = api_put(f"/projects/{pid}", {"status": "已完成"})
    assert status == 200, f"Expected 200 when all met, got {status}"
    assert data['status'] == '已完成', f"Expected status='已完成', got {data['status']}"
    log(f"  状态变更成功: {data['name']} → {data['status']}")

    # 3. 验证日志记录
    status2, logs = api_get(f"/projects/{pid}/status-logs")
    assert status2 == 200, f"Expected 200 for status-logs, got {status2}"
    assert len(logs) > 0, f"Expected at least 1 log entry, got {len(logs)}"

    # 查找 status_change 日志
    status_changes = [l for l in logs if l['action'] == 'status_change']
    assert len(status_changes) > 0, \
        f"Expected at least 1 'status_change' log entry, found {len(status_changes)}"

    latest = status_changes[0]
    assert latest['to_status'] == '已完成', \
        f"Expected to_status='已完成', got {latest['to_status']}"
    log(f"  日志记录: action={latest['action']}, from={latest['from_status']} → to={latest['to_status']}")

    # 4. 还原状态（改回"进行中"以便后续测试）
    api_put(f"/projects/{pid}", {"status": "进行中"})
    # 5. 取消所有条件勾选
    for c in conditions:
        api_put(f"/projects/{pid}/status-conditions/{c['id']}", {"is_met": 0})


# ============================================================
#  TEST 11: GET /api/projects/{pid}/status-logs (验证日志完整性)
# ============================================================
def test_11_status_logs_completeness():
    """验证状态日志包含多种操作类型"""
    _, logs = api_get(f"/projects/{pid}/status-logs")
    assert isinstance(logs, list), f"Expected list of logs, got {type(logs)}"

    actions = set(l['action'] for l in logs)
    log(f"  日志中的 action 类型: {actions}")

    # 应有 status_change (来自 test_10)
    assert 'status_change' in actions, \
        f"Expected 'status_change' in log actions, got {actions}"

    # 也可能有 condition_met/condition_unmet (来自 test_04 的勾选操作)
    # 注意：在前面的 test_04 toggle 中，勾选/取消是在 update_project_condition 中记录的
    # 应该有 condition_met 和 condition_unmet
    expected_actions = {'status_change', 'condition_met', 'condition_unmet'}
    found_expected = actions & expected_actions
    log(f"  匹配的 action 类型: {found_expected}")

    # 验证日志记录有 created_at 时间戳
    for log_entry in logs:
        assert 'created_at' in log_entry, "Log entry missing created_at"


# ============================================================
#  TEST 12: 边界情况 — 条件为0时 check-status
# ============================================================
def test_12_check_status_no_conditions():
    """无条件的项目检查状态：total_count=0, can_change=false"""
    # 用另一个目标状态测试（如"暂停"），不应有条件
    status, data = api_get(f"/projects/{pid}/check-status?target=暂停")
    assert status == 200, f"Expected 200, got {status}"
    assert data['total_count'] == 0, f"Expected total_count=0 for '暂停', got {data['total_count']}"
    assert data['can_change'] == False, \
        f"Expected can_change=false when no conditions, got {data['can_change']}"
    assert data['unmet_list'] == [], f"Expected empty unmet_list, got {data['unmet_list']}"


# ============================================================
#  TEST 13: 验证 is_met 字段为数字类型 (INTEGER 0/1)
# ============================================================
def test_13_is_met_data_type():
    """is_met 应为整数 0 或 1，在前端 JSON 中保持数字类型"""
    _, conditions = api_get(f"/projects/{pid}/status-conditions?target_status=已完成")
    for c in conditions:
        assert isinstance(c['is_met'], int), \
            f"is_met should be int, got {type(c['is_met'])}: {c['is_met']}"
        assert c['is_met'] in (0, 1), \
            f"is_met should be 0 or 1, got {c['is_met']}"


# ============================================================
#  TEST 14: 验证 batch 保存幂等性（重复POST覆盖）
# ============================================================
def test_14_batch_save_idempotency():
    """再次 POST 相同条件，应替换旧数据"""
    body = {
        "target_status": "已完成",
        "conditions": [
            {"condition_text": "条件A", "sort_order": 1},
            {"condition_text": "条件B", "sort_order": 2},
        ]
    }
    status, data = api_post(f"/projects/{pid}/status-conditions", body)
    assert status == 200
    assert len(data) == 2, f"Expected 2 after batch replace, got {len(data)}"
    texts = [c['condition_text'] for c in data]
    assert '条件A' in texts and '条件B' in texts, f"Unexpected conditions: {texts}"

    # 恢复原来的3条条件
    restore_body = {
        "target_status": "已完成",
        "conditions": [
            {"condition_text": "所有功能测试通过", "sort_order": 1},
            {"condition_text": "客户确认验收", "sort_order": 2},
            {"condition_text": "文档交付完成", "sort_order": 3},
        ]
    }
    api_post(f"/projects/{pid}/status-conditions", restore_body)


# ============================================================
#  TEST 15: PUT /api/projects/{pid} — 无条件配置时拒绝
# ============================================================
def test_15_no_conditions_reject():
    """该项目未配置条件时，变更状态为"已完成"应返回 400 并提示"""
    # 确保无"已完成"条件
    _, conditions = api_get(f"/projects/{pid}/status-conditions?target_status=已完成")
    for c in conditions:
        api_delete(f"/projects/{pid}/status-conditions/{c['id']}")

    # 确认该项目状态不是已完成
    proj = _get_project(pid)
    assert proj is not None
    if proj['status'] == '已完成':
        api_put(f"/projects/{pid}", {"status": "进行中"})

    status, data = api_put(f"/projects/{pid}", {"status": "已完成"})
    assert status == 400, f"Expected 400 without conditions, got {status}"
    error_str = data if isinstance(data, str) else json.dumps(data, ensure_ascii=False)
    assert '未配置' in error_str or '达成条件' in error_str, \
        f"Error should mention conditions, got: {error_str[:100]}"
    log(f"  错误信息: {error_str[:100]}")

    # 恢复条件
    restore_body = {
        "target_status": "已完成",
        "conditions": [
            {"condition_text": "所有功能测试通过", "sort_order": 1},
            {"condition_text": "客户确认验收", "sort_order": 2},
            {"condition_text": "文档交付完成", "sort_order": 3},
        ]
    }
    api_post(f"/projects/{pid}/status-conditions", restore_body)


# ============================================================
#  TEST 16: PUT condition 时 is_met 只有 0/1 值
# ============================================================
def test_16_is_met_edge_values():
    """验证 is_met 边界值处理"""
    _, conditions = api_get(f"/projects/{pid}/status-conditions?target_status=已完成")
    cid = conditions[0]['id']

    # 测试 is_met=0 正常
    s1, d1 = api_put(f"/projects/{pid}/status-conditions/{cid}", {"is_met": 0})
    assert s1 == 200
    assert d1['is_met'] == 0

    # 测试 is_met=1 正常
    s2, d2 = api_put(f"/projects/{pid}/status-conditions/{cid}", {"is_met": 1})
    assert s2 == 200
    assert d2['is_met'] == 1

    # 还原
    api_put(f"/projects/{pid}/status-conditions/{cid}", {"is_met": 0})


# ============================================================
#  TEST 17: 验证条件不属于该项目时返回404
# ============================================================
def test_17_condition_cross_project():
    """验证跨项目操作条件被拒绝"""
    # 使用模块级 pid（在 main 中通过 global 设置）
    # 找到另一个项目
    _, all_projects = api_get("/projects")
    other_pid = None
    for p in all_projects:
        if p['id'] != pid:
            other_pid = p['id']
            break
    
    if not other_pid:
        log("  SKIP: no other project found")
        return
    
    log(f"  测试跨项目: 条件属于 pid={pid}, 对 other_pid={other_pid} 操作")
    
    _, conditions = api_get(f"/projects/{pid}/status-conditions?target_status=已完成")
    if not conditions:
        log("  SKIP: no conditions to test cross-project")
        return
    
    cid = conditions[0]['id']
    s, body = api_put(f"/projects/{other_pid}/status-conditions/{cid}", {"is_met": 1})
    assert s == 404, f"Expected 404 for cross-project access, got {s}: {body}"
    log(f"  跨项目访问正确返回 404")


# ============================================================
#  MAIN
# ============================================================
def main():
    global pid
    global PASSED, FAILED, ERRORS

    print("=" * 60)
    print("项目状态达成条件 — QA 集成测试")
    print(f"API Base: {BASE}")
    print("=" * 60)

    # Setup
    test_project, completed = setup()
    pid = test_project['id']
    original_status = test_project['status']

    # 确保测试项目是"进行中"状态（否则后面的拒绝测试不准确）
    if original_status == '已完成':
        print(f"\n⚠️ 测试项目已是'已完成'，先改回'进行中'...")
        api_put(f"/projects/{pid}", {"status": "进行中"})

    # 清理可能残留的条件数据
    _, old_conditions = api_get(f"/projects/{pid}/status-conditions?target_status=已完成")
    for c in old_conditions:
        api_delete(f"/projects/{pid}/status-conditions/{c['id']}")

    # Run all tests
    all_tests = [
        ("01: 空条件查询", test_01_get_empty_conditions),
        ("02: 创建条件", test_02_create_conditions),
        ("03: 获取已有条件", test_03_get_existing_conditions),
        ("04: 勾选/取消", test_04_toggle_condition),
        ("05: 修改条件描述", test_05_update_condition_text),
        ("06: 删除条件", test_06_delete_condition),
        ("07: check-status 未达成", test_07_check_status_unmet),
        ("08: check-status 全部达成", test_08_check_status_all_met),
        ("09: 拒绝变更", test_09_reject_status_change_when_unmet),
        ("10: 允许变更+日志", test_10_allow_status_change_when_all_met),
        ("11: 日志完整性", test_11_status_logs_completeness),
        ("12: 无条件检查", test_12_check_status_no_conditions),
        ("13: is_met数据类型", test_13_is_met_data_type),
        ("14: 批量覆盖幂等", test_14_batch_save_idempotency),
        ("15: 无条件拒绝", test_15_no_conditions_reject),
        ("16: is_met边界值", test_16_is_met_edge_values),
        ("17: 跨项目安全", test_17_condition_cross_project),
    ]

    for name, test_fn in all_tests:
        print(f"\n>>> Starting {name}", flush=True)
        try:
            test_fn()
            print(f"<<< {name} DONE", flush=True)
            time.sleep(0.1)  # Small delay to avoid server overload
        except Exception as e:
            global PASSED, FAILED, ERRORS
            FAILED += 1
            err = f"[CRASH-{name}] {type(e).__name__}: {e}"
            ERRORS.append(err)
            print(f"<<< {name} CRASH: {type(e).__name__}: {e}", flush=True)
            traceback.print_exc()

    # === FINAL REPORT ===
    TOTAL = PASSED + FAILED
    print("\n" + "=" * 60)
    print("FINAL TEST REPORT")
    print("=" * 60)
    print(f"  Total:  {TOTAL}")
    print(f"  Passed: {PASSED}")
    print(f"  Failed: {FAILED}")
    print(f"  Rate:   {PASSED/TOTAL*100:.0f}%" if TOTAL > 0 else "  Rate: N/A")
    print("=" * 60)

    if ERRORS:
        print("\nFAILED TESTS:")
        for e in ERRORS:
            print(f"  - {e}")

    # Restore original state
    print("\n--- FINAL CLEANUP ---")
    # 确保项目改回"进行中"
    api_put(f"/projects/{pid}", {"status": "进行中"})
    # 清理条件（保留示例数据）
    # 不清理，保留供后续测试
    print("  测试项目已恢复为'进行中'状态")

    # 返回退出码
    if FAILED > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
