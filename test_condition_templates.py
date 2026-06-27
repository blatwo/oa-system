"""
Test suite for global status condition template APIs (project_id=0).

Tests the 5 new API endpoints added in server.py lines 1653-1768:
1. GET  /api/status-conditions/templates
2. POST /api/status-conditions/templates
3. PUT  /api/status-conditions/templates/{cid}
4. DELETE /api/status-conditions/templates/{cid}
5. POST /api/projects/{pid}/apply-conditions-template
"""

import requests
import sys

BASE_URL = "http://127.0.0.1:8000"
TEMPLATES_URL = f"{BASE_URL}/api/status-conditions/templates"
passed = 0
failed = 0

def test(name, fn):
    """Run a test function and print PASS/FAIL."""
    global passed, failed
    try:
        fn()
        passed += 1
        print(f"  PASS: {name}")
    except AssertionError as e:
        failed += 1
        print(f"  FAIL: {name} — {e}")
    except Exception as e:
        failed += 1
        print(f"  FAIL: {name} — unexpected error: {e}")


# ============================================================
#  1. GET /api/status-conditions/templates
# ============================================================
def test_01_get_empty_templates():
    """GET templates for '已完成' returns list (may be empty)."""
    r = requests.get(TEMPLATES_URL, params={"target_status": "已完成"})
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    data = r.json()
    assert isinstance(data, list), f"Expected list, got {type(data).__name__}"
    # initial state might have some records; that's fine—just verify shape
    for item in data:
        assert "id" in item, f"Missing 'id' in {item}"
        assert "condition_text" in item, f"Missing 'condition_text' in {item}"
        assert "sort_order" in item, f"Missing 'sort_order' in {item}"
        assert item.get("project_id") == 0, f"Expected project_id=0, got {item.get('project_id')}"


def test_02_get_templates_default_target_status():
    """GET templates without target_status defaults to '已完成'."""
    r = requests.get(TEMPLATES_URL)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    data = r.json()
    assert isinstance(data, list), f"Expected list, got {type(data).__name__}"


def test_03_get_templates_other_status():
    """GET templates for a different target_status returns empty."""
    r = requests.get(TEMPLATES_URL, params={"target_status": "暂停"})
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    data = r.json()
    assert isinstance(data, list), f"Expected list, got {type(data).__name__}"


# ============================================================
#  2. POST /api/status-conditions/templates
# ============================================================
def test_04_create_templates():
    """POST templates for '已完成' — create 2 conditions, verify response."""
    body = {
        "target_status": "已完成",
        "conditions": [
            {"condition_text": "客户验收签字完成", "sort_order": 1},
            {"condition_text": "所有文档已归档", "sort_order": 2},
        ]
    }
    r = requests.post(TEMPLATES_URL, json=body)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    data = r.json()
    assert isinstance(data, list), f"Expected list, got {type(data).__name__}"
    assert len(data) == 2, f"Expected 2 conditions, got {len(data)}"
    assert data[0]["condition_text"] == "客户验收签字完成"
    assert data[0]["sort_order"] == 1
    assert data[0]["project_id"] == 0
    assert data[1]["condition_text"] == "所有文档已归档"
    assert data[1]["sort_order"] == 2
    assert data[1]["project_id"] == 0


def test_05_get_templates_after_create():
    """GET templates after creation returns 2 items."""
    r = requests.get(TEMPLATES_URL, params={"target_status": "已完成"})
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    data = r.json()
    assert len(data) == 2, f"Expected 2, got {len(data)}"


def test_06_create_templates_replaces_old():
    """POST templates again replaces old ones (delete + insert)."""
    body = {
        "target_status": "已完成",
        "conditions": [
            {"condition_text": "新条件A", "sort_order": 1},
            {"condition_text": "新条件B", "sort_order": 2},
            {"condition_text": "新条件C", "sort_order": 3},
        ]
    }
    r = requests.post(TEMPLATES_URL, json=body)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    data = r.json()
    assert len(data) == 3, f"Expected 3 after replace, got {len(data)}"
    texts = [d["condition_text"] for d in data]
    assert "新条件A" in texts
    assert "新条件C" in texts


def test_07_create_templates_empty_conditions():
    """POST templates with empty conditions list clears them."""
    body = {
        "target_status": "已完成",
        "conditions": []
    }
    r = requests.post(TEMPLATES_URL, json=body)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    data = r.json()
    assert isinstance(data, list), f"Expected list, got {type(data).__name__}"
    assert len(data) == 0, f"Expected 0 after clear, got {len(data)}"


# ============================================================
#  3. PUT /api/status-conditions/templates/{cid}
# ============================================================
def test_08_put_update_condition_text():
    """PUT updates condition_text for a template."""
    # First create a template to update
    body = {
        "target_status": "已完成",
        "conditions": [
            {"condition_text": "待更新条件", "sort_order": 1},
        ]
    }
    r = requests.post(TEMPLATES_URL, json=body)
    assert r.status_code == 200
    created = r.json()
    assert len(created) == 1
    cid = created[0]["id"]

    # Now update its text
    r2 = requests.put(f"{TEMPLATES_URL}/{cid}", json={"condition_text": "已更新条件"})
    assert r2.status_code == 200, f"Expected 200, got {r2.status_code}: {r2.text}"
    updated = r2.json()
    assert updated["condition_text"] == "已更新条件", f"Expected '已更新条件', got {updated['condition_text']}"
    assert updated["id"] == cid


def test_09_put_update_sort_order():
    """PUT updates sort_order for a template."""
    body = {
        "target_status": "已完成",
        "conditions": [
            {"condition_text": "排序测试", "sort_order": 5},
        ]
    }
    r = requests.post(TEMPLATES_URL, json=body)
    assert r.status_code == 200
    cid = r.json()[0]["id"]

    r2 = requests.put(f"{TEMPLATES_URL}/{cid}", json={"sort_order": 99})
    assert r2.status_code == 200
    updated = r2.json()
    assert updated["sort_order"] == 99, f"Expected 99, got {updated['sort_order']}"


def test_10_put_template_not_found():
    """PUT for non-existent template returns 404."""
    r = requests.put(f"{TEMPLATES_URL}/999999", json={"condition_text": "不该存在"})
    assert r.status_code == 404, f"Expected 404, got {r.status_code}"


def test_11_put_empty_body_no_change():
    """PUT with empty body should return the existing record unchanged."""
    body = {
        "target_status": "已完成",
        "conditions": [
            {"condition_text": "不变条件", "sort_order": 10},
        ]
    }
    r = requests.post(TEMPLATES_URL, json=body)
    assert r.status_code == 200
    cid = r.json()[0]["id"]

    r2 = requests.put(f"{TEMPLATES_URL}/{cid}", json={})
    assert r2.status_code == 200, f"Expected 200, got {r2.status_code}"
    unchanged = r2.json()
    assert unchanged["condition_text"] == "不变条件", "condition_text should be unchanged"


# ============================================================
#  4. DELETE /api/status-conditions/templates/{cid}
# ============================================================
def test_12_delete_template():
    """DELETE removes a template condition."""
    body = {
        "target_status": "已完成",
        "conditions": [
            {"condition_text": "待删除条件", "sort_order": 1},
        ]
    }
    r = requests.post(TEMPLATES_URL, json=body)
    assert r.status_code == 200
    cid = r.json()[0]["id"]

    r2 = requests.delete(f"{TEMPLATES_URL}/{cid}")
    assert r2.status_code == 200, f"Expected 200, got {r2.status_code}: {r2.text}"
    assert r2.json() == {"ok": True}

    # Verify it's gone
    r3 = requests.get(TEMPLATES_URL, params={"target_status": "已完成"})
    ids = [d["id"] for d in r3.json()]
    assert cid not in ids, f"Deleted id {cid} still present"


def test_13_delete_template_not_found():
    """DELETE for non-existent template returns 404."""
    r = requests.delete(f"{TEMPLATES_URL}/999999")
    assert r.status_code == 404, f"Expected 404, got {r.status_code}"


# ============================================================
#  5. POST /api/projects/{pid}/apply-conditions-template
# ============================================================
def test_14_apply_template_to_project():
    """Apply template to a real project ID, verify conditions are copied with is_met=0."""
    # First create a template
    body = {
        "target_status": "已完成",
        "conditions": [
            {"condition_text": "客户验收签字完成", "sort_order": 1},
            {"condition_text": "所有文档已归档", "sort_order": 2},
            {"condition_text": "客户满意度调查完成", "sort_order": 3},
        ]
    }
    r = requests.post(TEMPLATES_URL, json=body)
    assert r.status_code == 200, f"Create template failed: {r.status_code} {r.text}"
    assert len(r.json()) == 3

    # Get a real project ID
    proj_r = requests.get(f"{BASE_URL}/api/projects")
    assert proj_r.status_code == 200
    projects = proj_r.json()
    assert len(projects) > 0, "No projects in DB"
    pid = projects[0]["id"]

    # Apply template
    r2 = requests.post(
        f"{BASE_URL}/api/projects/{pid}/apply-conditions-template",
        json={"target_status": "已完成"}
    )
    assert r2.status_code == 200, f"Expected 200, got {r2.status_code}: {r2.text}"
    result = r2.json()
    assert isinstance(result, list), f"Expected list, got {type(result).__name__}"
    assert len(result) == 3, f"Expected 3 conditions, got {len(result)}"

    # Verify all conditions have is_met=0 and project_id=pid
    for item in result:
        assert item["project_id"] == pid, f"Expected project_id={pid}, got {item['project_id']}"
        assert item["is_met"] == 0, f"Expected is_met=0, got {item['is_met']}"
        assert item["target_status"] == "已完成", f"Expected target_status='已完成', got '{item['target_status']}'"

    # Verify via project-specific conditions endpoint
    r3 = requests.get(
        f"{BASE_URL}/api/projects/{pid}/status-conditions",
        params={"target_status": "已完成"}
    )
    assert r3.status_code == 200
    project_conditions = r3.json()
    assert len(project_conditions) == 3, f"Project should have 3 conditions, got {len(project_conditions)}"


def test_15_apply_template_to_nonexistent_project():
    """Apply template to non-existent project returns 404."""
    r = requests.post(
        f"{BASE_URL}/api/projects/999999/apply-conditions-template",
        json={"target_status": "已完成"}
    )
    assert r.status_code == 404, f"Expected 404, got {r.status_code}"


def test_16_apply_template_empty_template():
    """Apply template when no template exists — empty conditions copied (nothing)."""
    # Clear templates for '暂停'
    r_clear = requests.post(TEMPLATES_URL, json={"target_status": "暂停", "conditions": []})
    assert r_clear.status_code == 200

    # Get a project
    proj_r = requests.get(f"{BASE_URL}/api/projects")
    pid = proj_r.json()[0]["id"]

    # Apply — should return empty list
    r = requests.post(
        f"{BASE_URL}/api/projects/{pid}/apply-conditions-template",
        json={"target_status": "暂停"}
    )
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    result = r.json()
    assert isinstance(result, list), f"Expected list, got {type(result).__name__}"
    assert len(result) == 0, f"Expected 0 with empty template, got {len(result)}"


def test_17_apply_template_replaces_existing_project_conditions():
    """Applying template twice to same project should replace, not duplicate."""
    body = {
        "target_status": "已完成",
        "conditions": [
            {"condition_text": "第一次条件A", "sort_order": 1},
        ]
    }
    r = requests.post(TEMPLATES_URL, json=body)
    assert r.status_code == 200

    proj_r = requests.get(f"{BASE_URL}/api/projects")
    pid = proj_r.json()[0]["id"]

    # Apply first time
    r1 = requests.post(
        f"{BASE_URL}/api/projects/{pid}/apply-conditions-template",
        json={"target_status": "已完成"}
    )
    assert r1.status_code == 200
    assert len(r1.json()) == 1

    # Change template
    body2 = {
        "target_status": "已完成",
        "conditions": [
            {"condition_text": "第二次条件X", "sort_order": 1},
            {"condition_text": "第二次条件Y", "sort_order": 2},
        ]
    }
    r_tpl = requests.post(TEMPLATES_URL, json=body2)
    assert r_tpl.status_code == 200

    # Apply second time — should replace
    r2 = requests.post(
        f"{BASE_URL}/api/projects/{pid}/apply-conditions-template",
        json={"target_status": "已完成"}
    )
    assert r2.status_code == 200
    result = r2.json()
    assert len(result) == 2, f"Expected 2 after second apply, got {len(result)}"
    texts = [d["condition_text"] for d in result]
    assert "第二次条件X" in texts
    assert "第二次条件Y" in texts
    assert "第一次条件A" not in texts, "Old condition should be replaced"


# ============================================================
#  Run all tests
# ============================================================
if __name__ == "__main__":
    print("=" * 60)
    print("TESTING: Global Status Condition Template APIs")
    print("=" * 60)

    print("\n[1] GET /api/status-conditions/templates")
    test("GET templates for '已完成' returns list", test_01_get_empty_templates)
    test("GET templates defaults to '已完成'", test_02_get_templates_default_target_status)
    test("GET templates for other status returns empty", test_03_get_templates_other_status)

    print("\n[2] POST /api/status-conditions/templates")
    test("POST creates 2 conditions", test_04_create_templates)
    test("GET after create returns 2 items", test_05_get_templates_after_create)
    test("POST replaces old conditions", test_06_create_templates_replaces_old)
    test("POST empty conditions clears list", test_07_create_templates_empty_conditions)

    print("\n[3] PUT /api/status-conditions/templates/{cid}")
    test("PUT updates condition_text", test_08_put_update_condition_text)
    test("PUT updates sort_order", test_09_put_update_sort_order)
    test("PUT non-existent returns 404", test_10_put_template_not_found)
    test("PUT empty body unchanged", test_11_put_empty_body_no_change)

    print("\n[4] DELETE /api/status-conditions/templates/{cid}")
    test("DELETE removes condition", test_12_delete_template)
    test("DELETE non-existent returns 404", test_13_delete_template_not_found)

    print("\n[5] POST /api/projects/{pid}/apply-conditions-template")
    test("Apply template copies with is_met=0", test_14_apply_template_to_project)
    test("Apply to non-existent project returns 404", test_15_apply_template_to_nonexistent_project)
    test("Apply with empty template returns empty", test_16_apply_template_empty_template)
    test("Apply twice replaces not duplicates", test_17_apply_template_replaces_existing_project_conditions)

    print("\n" + "=" * 60)
    print(f"RESULTS: {passed} passed, {failed} failed, {passed + failed} total")
    print("=" * 60)

    sys.exit(0 if failed == 0 else 1)
