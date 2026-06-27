# 瀚高工作记录系统 (OA System)

> 技术支持工程师工作管理平台 — 邱臣君

---

## 目录

- [运行说明](#运行说明)
- [技术栈](#技术栈)
- [日志系统](#日志系统)
- [模块清单](#模块清单)
- [数据库表结构](#数据库表结构)
- [API 端点](#api-端点)
- [侧栏导航结构](#侧栏导航结构)
- [开发指南](#开发指南)

---

## 运行说明

```bash
# 启动后端 (FastAPI + SQLite)
python server.py

# 服务运行在 http://localhost:8089

# 开发模式启动前端 (Vite HMR)
npx vite

# 生产构建
npx vite build
```

**数据保护**：`oa_data.db` 绝对禁止删除。`init_db()` 启动时自动备份到 `oa_data.bak.YYYYMMDD_HHMMSS`，保留最近 3 份。

---

## 技术栈

| 层面 | 技术 |
|------|------|
| 前端框架 | React 18 + Vite |
| UI 组件库 | MUI (Material-UI) v5 |
| 数据表格 | MUI X DataGrid **v6.20.4** ⚠️ |
| 状态管理 | React Context + useReducer |
| 后端框架 | FastAPI (Python) |
| 数据库 | SQLite (`oa_data.db`) |
| AI 集成 | OpenAI 兼容 API（多模型可配） |
| 服务端口 | 8089 |

---

## 日志系统

所有日志存储在 `logs/` 目录，自动轮转（单文件 2MB，保留 5 份）：

| 日志文件 | 用途 |
|----------|------|
| `logs/app.log` | 所有应用日志（INFO+），含 HTTP 请求方法/路径/状态码/耗时 |
| `logs/error.log` | 仅错误日志（ERROR+），含完整异常堆栈 |
| `logs/frontend.log` | 前端 JS 运行时错误，含组件名、错误消息、调用栈 |

**前端错误捕获**：
- `window.onerror` 全局钩子 → 自动 POST 到 `/api/logs/frontend`
- React `<ErrorBoundary>` 包裹主内容区 → 渲染错显示友好提示页 + 自动上报

**排查问题时，直接读取日志文件即可**：

```bash
# 查看最近的应用日志
tail -50 logs/app.log

# 查看错误
cat logs/error.log

# 查看前端报错
cat logs/frontend.log
```

---

## 模块清单

### 一级导航（9 项）

| 模块 | 页面键 | 组件 | 说明 |
|------|--------|------|------|
| 录入工作 | `form` | `WorkForm` | 工作记录录入表单，两列网格布局，含 AI 智能分类 |
| 工作记录列表 | `list` | `WorkList` | 工作记录 DataGrid，日期/项目筛选，批量删除，JSON 导入导出 |
| 项目工时统计 | `stats` | `ProjectStats` | 按项目分组汇总工时 + BSC 分类统计 |
| 待办事项 | `todo` | `TodoList` | 过滤含 todo 字段的记录，标记完成/删除 |
| 工作积压 | `backlog` | `BacklogTracker` | 按项目展示积压等级看板（严重/有积压/正常） |
| 加班记录 | `overtime` | `OvertimeManager` | 加班签到/签退/工时/调休/餐补/交通/报销 CRUD |
| AI 智能分析 | `ai` | `AIAnalysis` | 三种模式：项目总结/问题分析/自由提问 |
| 财务报销 | `expense` | `ExpenseManager` | 出差单 + 费用明细管理，含统计汇总 |
| 问题记录 | `issue_tracker` | `IssueTracker` | 问题/缺陷/操作记录/最佳实践追踪，关联产品版本 |

### 项目管理（6 项）

| 模块 | 页面键 | 组件 | 说明 |
|------|--------|------|------|
| 项目信息 | `project` | `ProjectManager` | 项目编码/名称/客户/ISV/状态/销售负责人 CRUD，DataGrid |
| 销售人员 | `sales` | `SalesManager` | 人员 CRUD + 销售-项目关联统计 |
| 用户画像 | `persona` | `PersonaManager` | 按项目的商务面貌/技术面貌/痛点/关键人员/期望 |
| 风险管理 | `risk` | `RiskManager` | 风险类型/等级/描述/影响/缓解措施/负责人/状态 |
| 里程碑管理 | `wbs` | `WbsManager` | Tab1: WBS 项管理, Tab2: WBS 场景组合配置 |
| 服务器管理 | `server` | `ServerManager` | 服务器信息(80+字段) + 磁盘管理(含性能指标) |

### 产品服务（6 项）

| 模块 | 页面键 | 组件 | 说明 |
|------|--------|------|------|
| 兼容证明 | `compat` | `CompatibilityManager` | 项目/应用系统/状态/环节/开具信息/适配信息 |
| 兼容流程 | `compat_flow` | `CompatFlow` | Stepper 展示，兼容环节通过字典维护 |
| 产品规划 | `plan` | `ProductPlanManager` | 关联产品目录三级分类，状态(规划中/开发中/已发布/已下线) |
| 产品超市 | `release` | `ProductMarketplace` | 产品版本/IP/销量/适配数/评分展示，支持排序 |
| 产品目录 | `catalog` | `ProductCatalogManager` | 三级树形层级（大类/系列/版本），CRUD |
| 服务目录 | `svc` | `ServiceCatalogManager` | 三级树形层级（服务大类/分类/子项），CRUD |

### 字典维护（4 项）

| 模块 | 页面键 | 组件 | 说明 |
|------|--------|------|------|
| 常规字典 | `dict` | `DictManager` | Tab: 字典分类管理 + 字典项管理 |
| 优先级准则 | `priority` | `PriorityCriteria` | 重要/不重要/紧急/不紧急四象限 |
| 典型案例库 | `issues` | `TypicalIssues` | 产品/场景/影响/发现人/服务分类 |
| LLM 模型管理 | `llm` | `LLMProfiles` | 多模型配置/测试连接/设为默认 |

---

## 数据库表结构

总计 **25 张表**：

| # | 表名 | 用途 |
|---|------|------|
| 1 | `work_records` | 工作记录（主表） |
| 2 | `dictionaries` | 字典项 |
| 3 | `dict_categories` | 字典分类 |
| 4 | `projects` | 项目信息 |
| 5 | `sales` | 销售人员 |
| 6 | `llm_profiles` | LLM 模型配置 |
| 7 | `risks` | 风险管理 |
| 8 | `expense_claims` | 报销单（旧平铺表，保留历史数据） |
| 9 | `trips` | 出差单 |
| 10 | `trip_expenses` | 出差费用明细（FK → trips） |
| 11 | `issue_records` | 问题记录 |
| 12 | `servers` | 服务器信息（80+ 字段） |
| 13 | `server_disks` | 服务器磁盘信息（FK → servers） |
| 14 | `priority_criteria` | 优先级准则 |
| 15 | `typical_issues` | 典型案例库 |
| 16 | `wbs_items` | WBS 项 |
| 17 | `wbs_scenarios` | WBS 场景 |
| 18 | `wbs_scenario_items` | WBS 场景-项关联 |
| 19 | `personas` | 用户画像 |
| 20 | `product_catalog` | 产品目录（三级层级） |
| 21 | `product_plans` | 产品规划 |
| 22 | `product_releases` | 产品发布/超市 |
| 23 | `service_catalog` | 服务目录（三级层级） |
| 24 | `overtimer` | 加班记录 |
| 25 | `compatibility_certs` | 兼容证明 |

> **关键表字段说明见下方 API 章节，详细 PRAGMA 请查看 `init_db()` 函数。**

---

## API 端点

所有后端 API 共约 **70 个路由**，按模块分组：

### 工作记录
| 方法 | URL | 说明 |
|------|-----|------|
| GET | `/api/records` | 列表（日期/项目筛选） |
| POST | `/api/records` | 创建 |
| PUT | `/api/records/{rid}` | 更新 |
| DELETE | `/api/records/{rid}` | 删除 |
| POST | `/api/records/batch-delete` | 批量删除 |

### 统计与待办
| 方法 | URL | 说明 |
|------|-----|------|
| GET | `/api/stats` | 项目工时统计 |
| GET | `/api/todos` | 待办事项（按项目筛选） |

### 积压分析
| 方法 | URL | 说明 |
|------|-----|------|
| GET | `/api/backlog` | 积压评分看板 |

### 加班
| 方法 | URL | 说明 |
|------|-----|------|
| GET | `/api/overtime` | 列表 |
| POST | `/api/overtime` | 创建 |
| PUT | `/api/overtime/{oid}` | 更新 |
| DELETE | `/api/overtime/{oid}` | 删除 |

### 兼容证明
| 方法 | URL | 说明 |
|------|-----|------|
| GET | `/api/compatibility-certs` | 列表 |
| POST | `/api/compatibility-certs` | 创建 |
| PUT | `/api/compatibility-certs/{cid}` | 更新 |
| DELETE | `/api/compatibility-certs/{cid}` | 删除 |

### 字典
| 方法 | URL | 说明 |
|------|-----|------|
| GET | `/api/dicts` | 所有字典项 |
| GET | `/api/dicts/{category}` | 按分类 |
| GET | `/api/dicts/check-value` | 检查使用次数 |
| POST | `/api/dicts` | 创建 |
| PUT | `/api/dicts/{did}` | 更新 |
| DELETE | `/api/dicts/{did}` | 删除 |
| GET | `/api/dict-categories` | 字典分类列表 |
| POST | `/api/dict-categories` | 创建分类 |
| PUT | `/api/dict-categories/{cid}` | 更新分类 |
| DELETE | `/api/dict-categories/{cid}` | 删除分类 |

### 项目
| 方法 | URL | 说明 |
|------|-----|------|
| GET | `/api/projects` | 列表 |
| POST | `/api/projects` | 创建（自动生成 HG-YYYY-NNN 编码） |
| PUT | `/api/projects/{pid}` | 更新 |
| DELETE | `/api/projects/{pid}` | 删除 |

### 销售人员
| 方法 | URL | 说明 |
|------|-----|------|
| GET | `/api/sales` | 列表 |
| POST | `/api/sales` | 创建 |
| PUT | `/api/sales/{sid}` | 更新 |
| DELETE | `/api/sales/{sid}` | 删除 |
| GET | `/api/sales/stats` | 项目关联统计 |

### 出差报销
| 方法 | URL | 说明 |
|------|-----|------|
| GET | `/api/trips` | 出差单列表 |
| GET | `/api/trips/stats` | 统计（年份/状态分组） |
| GET | `/api/trips/{tid}` | 详情（含费用明细） |
| POST | `/api/trips` | 创建 |
| PUT | `/api/trips/{tid}` | 更新 |
| DELETE | `/api/trips/{tid}` | 删除（级联） |
| POST | `/api/trip-expenses` | 创建费用明细（自动重算总费用） |
| PUT | `/api/trip-expenses/{eid}` | 更新 |
| DELETE | `/api/trip-expenses/{eid}` | 删除 |

### 问题记录
| 方法 | URL | 说明 |
|------|-----|------|
| GET | `/api/issues` | 列表（类型/状态/产品/严重度筛选） |
| GET | `/api/issues/{iid}` | 详情（LEFT JOIN product_catalog） |
| POST | `/api/issues` | 创建 |
| PUT | `/api/issues/{iid}` | 更新 |
| DELETE | `/api/issues/{iid}` | 删除 |

### AI / LLM
| 方法 | URL | 说明 |
|------|-----|------|
| GET | `/api/ai/profiles` | 所有配置 |
| GET | `/api/ai/profiles/default` | 默认模型 |
| POST | `/api/ai/profiles` | 创建 |
| PUT | `/api/ai/profiles/{pid}` | 更新 |
| DELETE | `/api/ai/profiles/{pid}` | 删除 |
| POST | `/api/ai/profiles/{pid}/set-default` | 设为默认 |
| POST | `/api/ai/test-connection` | 测试连接 |
| POST | `/api/ai/list-models` | 拉取模型列表 |
| POST | `/api/ai/auto-classify` | AI 智能分类 |
| POST | `/api/ai/analyze` | AI 分析 |

### 风险管理
| 方法 | URL | 说明 |
|------|-----|------|
| GET | `/api/risks` | 列表（按项目） |
| POST | `/api/risks` | 创建 |
| PUT | `/api/risks/{rid}` | 更新 |
| DELETE | `/api/risks/{rid}` | 删除 |

### 用户画像
| 方法 | URL | 说明 |
|------|-----|------|
| GET | `/api/personas` | 列表（按项目） |
| POST | `/api/personas` | 创建 |
| PUT | `/api/personas/{pid}` | 更新 |
| DELETE | `/api/personas/{pid}` | 删除 |

### 服务器管理
| 方法 | URL | 说明 |
|------|-----|------|
| GET | `/api/servers` | 列表（含磁盘） |
| POST | `/api/servers` | 创建 |
| PUT | `/api/servers/{sid}` | 更新 |
| DELETE | `/api/servers/{sid}` | 删除（级联磁盘） |
| POST | `/api/server-disks` | 创建磁盘 |
| PUT | `/api/server-disks/{did}` | 更新磁盘 |
| DELETE | `/api/server-disks/{did}` | 删除磁盘 |

### WBS / 里程碑
| 方法 | URL | 说明 |
|------|-----|------|
| GET | `/api/wbs-items` | 列表 |
| POST | `/api/wbs-items` | 创建 |
| PUT | `/api/wbs-items/{wid}` | 更新 |
| DELETE | `/api/wbs-items/{wid}` | 删除 |
| GET | `/api/wbs-scenarios` | 场景列表（含关联项和权重） |
| POST | `/api/wbs-scenarios` | 创建场景 |
| PUT | `/api/wbs-scenarios/{sid}` | 更新场景 |
| DELETE | `/api/wbs-scenarios/{sid}` | 删除场景 |

### 产品管理
| 方法 | URL | 说明 |
|------|-----|------|
| GET | `/api/product-catalog` | 目录（按层级/父级） |
| POST | `/api/product-catalog` | 创建 |
| PUT | `/api/product-catalog/{cid}` | 更新 |
| DELETE | `/api/product-catalog/{cid}` | 删除（级联子项） |
| GET | `/api/product-plans` | 规划列表 |
| POST | `/api/product-plans` | 创建规划 |
| PUT | `/api/product-plans/{pid}` | 更新规划 |
| DELETE | `/api/product-plans/{pid}` | 删除规划 |
| GET | `/api/product-releases` | 发布列表 |
| POST | `/api/product-releases` | 创建发布 |
| PUT | `/api/product-releases/{rid}` | 更新发布 |
| DELETE | `/api/product-releases/{rid}` | 删除发布 |
| GET | `/api/service-catalog` | 服务目录 |
| POST | `/api/service-catalog` | 创建 |
| PUT | `/api/service-catalog/{cid}` | 更新 |
| DELETE | `/api/service-catalog/{cid}` | 删除（级联子项） |

### 优先级准则 & 典型案例
| 方法 | URL | 说明 |
|------|-----|------|
| GET | `/api/priority-criteria` | 列表 |
| POST | `/api/priority-criteria` | 创建 |
| PUT | `/api/priority-criteria/{cid}` | 更新 |
| DELETE | `/api/priority-criteria/{cid}` | 删除 |
| GET | `/api/typical-issues` | 列表 |
| POST | `/api/typical-issues` | 创建 |
| PUT | `/api/typical-issues/{iid}` | 更新 |
| DELETE | `/api/typical-issues/{iid}` | 删除 |

### 前端日志
| 方法 | URL | 说明 |
|------|-----|------|
| POST | `/api/logs/frontend` | 前端 JS 错误上报（window.onerror自动调用） |

---

## 侧栏导航结构

```
┌─ 一级导航 ──────────────────────┐
│ 📝 录入工作                     │
│ 📋 工作记录列表                 │
│ 📊 项目工时统计                 │
│ 📋 待办事项                     │
│ ⚠️ 工作积压                     │
│ ⏰ 加班记录                     │
│ ✨ AI 智能分析                  │
│ 💰 财务报销                     │
│ 🐛 问题记录                     │
├─ 项目管理 ▼ ───────────────────├
│ 🏢 项目信息                     │
│ 👥 销售人员                     │
│ 👤 用户画像                     │
│ ⚠️ 风险管理                     │
│ 🌳 里程碑管理                   │
│ 🖥️ 服务器管理                   │
├─ 产品服务 ▼ ───────────────────├
│ ✅ 兼容证明                     │
│ 🌿 兼容流程                     │
│ 🎛️ 产品规划                     │
│ 🏪 产品超市                     │
│ 📂 产品目录                     │
│ 🔧 服务目录                     │
├─ 字典维护 ▼ ───────────────────├
│ ⚙️ 常规字典                     │
│ 📏 优先级准则                   │
│ 🐛 典型案例库                   │
│ 🧠 LLM 模型管理                 │
└─────────────────────────────────┘
  📊 记录总数：XXX 条
  🤖 默认模型名
```

---

## 开发指南

### 新增模块步骤

1. **数据库**：`server.py` → `init_db()` 追加 `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE` 迁移
2. **后端 API**：`server.py` → 追加 CRUD 路由（参考已有模块模式：Pydantic 模型 + `get_db()`）
3. **前端 DB 层**：`src/db/` → 新建 `xxx.js`，封装 API 调用
4. **前端组件**：`src/components/` → 新建 `XxxManager.jsx`
5. **注册路由**：`Layout.jsx` → `pages` 对象 + import
6. **加到导航**：`Sidebar.jsx` → `navItems` / `projectChildren` / `productServiceChildren` / `dictChildren`

### 代码规范

- **组件命名**：一律以功能命名如 `IssueTracker`、`ExpenseManager`
- **后端 model**：统一用 `BaseModel` + `Optional` 做更新校验
- **删除确认**：所有删除操作必须加确认弹窗
- **数据库迁移**：新加列一律用 `try: ALTER TABLE ... ADD COLUMN ... except: pass` 模式
- **数据保护**：任何操作不得删除 `oa_data.db`

### ⚠️ DataGrid v6 API（极易踩坑）

项目安装的是 `@mui/x-data-grid` **v6.20.4**，以下 API 与 v7 完全不同：

```jsx
// ✅ v6 正确写法
<DataGrid
  rows={data}
  columns={columns}
  pageSize={25}                         // NOT pageSizeOptions
  rowsPerPageOptions={[25, 50, 100]}    // NOT pageSizeOptions
  disableSelectionOnClick               // NOT disableRowSelectionOnClick
/>

// valueFormatter 参数是对象 {value, field, api}，不是原始值
✅ valueFormatter: ({ value }) => value ? value.slice(0, 10) : ''
❌ valueFormatter: (v) => v.slice(0, 10)  // $.slice is not a function!

// valueGetter 参数是对象 {value, row, id, field, api}
✅ valueGetter: (params) => params.row.name || params.value || '-'
❌ valueGetter: (v, row) => row.name  // row is undefined!

// renderCell 参数是对象 {value, row, id, field, ...}
✅ renderCell: (p) => <Chip label={p.value} />
```

### 构建后验证（必须执行）

```bash
# 1. 构建
cd oa-system && npx vite build

# 2. 重启服务
# （杀掉旧 python 进程 → 重新启动 server.py）

# 3. 触发新页面 API
curl -s http://127.0.0.1:8089/api/issues | head -c 100

# 4. 检查前端错误日志 — 这步最重要！
cat oa-system/logs/frontend.log | tail -20
cat oa-system/logs/error.log | tail -5
```

### 默认技术栈

- 新组件优先使用 MUI X DataGrid 做表格，支持筛选和分页
- 状态管理用 React `useState` + `useEffect`，复杂状态用 `useReducer`

---

> 文档生成日期：2026-06-18
> 最后更新功能：日志系统 + DataGrid v6 API 陷阱文档化
