import sqlite3
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List
import uuid
import datetime
import json as json_lib
from urllib.request import Request, urlopen
from urllib.error import URLError
import logging
from logging.handlers import RotatingFileHandler
import time

DB_PATH = Path(__file__).parent / "oa_data.db"

# ===== Logging Setup =====
LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)

# Main application logger
app_logger = logging.getLogger("oa-app")
app_logger.setLevel(logging.INFO)
app_logger.propagate = False

# Console handler (also print to stdout)
ch = logging.StreamHandler()
ch.setLevel(logging.INFO)
ch.setFormatter(logging.Formatter('[%(asctime)s] [%(levelname)s] %(message)s', datefmt='%Y-%m-%d %H:%M:%S'))
app_logger.addHandler(ch)

# File handler - all logs (INFO+)
fh = RotatingFileHandler(LOG_DIR / "app.log", maxBytes=2*1024*1024, backupCount=5, encoding='utf-8')
fh.setLevel(logging.INFO)
fh.setFormatter(logging.Formatter('[%(asctime)s] [%(levelname)s] %(message)s', datefmt='%Y-%m-%d %H:%M:%S'))
app_logger.addHandler(fh)

# Error file handler (ERROR+ only, with tracebacks)
efh = RotatingFileHandler(LOG_DIR / "error.log", maxBytes=2*1024*1024, backupCount=5, encoding='utf-8')
efh.setLevel(logging.ERROR)
efh.setFormatter(logging.Formatter('[%(asctime)s] [%(levelname)s] %(message)s', datefmt='%Y-%m-%d %H:%M:%S'))
app_logger.addHandler(efh)

# Frontend error logger
fe_logger = logging.getLogger("oa-frontend")
fe_logger.propagate = False
fe_fh = RotatingFileHandler(LOG_DIR / "frontend.log", maxBytes=2*1024*1024, backupCount=5, encoding='utf-8')
fe_fh.setFormatter(logging.Formatter('[%(asctime)s] %(message)s', datefmt='%Y-%m-%d %H:%M:%S'))
fe_logger.addHandler(fe_fh)

app_logger.info("=== OA System logging initialized ===")


def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    # Auto-backup before any schema changes
    db_file = Path(DB_PATH)
    if db_file.exists():
        import shutil, time
        stamp = time.strftime("%Y%m%d_%H%M%S")
        bak = str(DB_PATH).replace('.db', f'.bak.{stamp}')
        shutil.copy2(str(DB_PATH), bak)
        # Keep only last 3 backups
        bak_dir = db_file.parent
        baks = sorted(bak_dir.glob(db_file.name.replace('.db', '.bak.*')), reverse=True)
        for old in baks[3:]:
            old.unlink()

    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    # ===== Schema: use CREATE IF NOT EXISTS (safe for existing DBs) =====
    conn.executescript('''
        CREATE TABLE IF NOT EXISTS work_records (
          id TEXT PRIMARY KEY,
          date TEXT NOT NULL,
          project TEXT NOT NULL,
          env TEXT DEFAULT '',
          stage TEXT DEFAULT '',
          product1 TEXT DEFAULT '',
          product2 TEXT DEFAULT '',
          product3 TEXT DEFAULT '',
          service1 TEXT DEFAULT '',
          service2 TEXT DEFAULT '',
          service3 TEXT DEFAULT '',
          method TEXT DEFAULT '',
          status TEXT DEFAULT '进行中',
          importance TEXT DEFAULT '重要',
          urgency TEXT DEFAULT '不紧急',
          difficulty TEXT DEFAULT '一般',
          bsc TEXT DEFAULT '常规',
          hours REAL NOT NULL DEFAULT 0,
          content TEXT DEFAULT '',
          remark TEXT DEFAULT '',
          todo TEXT DEFAULT '',
          todo_done INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now','localtime')),
          updated_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS dictionaries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category TEXT NOT NULL,
          value TEXT NOT NULL,
          sort_order INTEGER DEFAULT 0,
          description TEXT DEFAULT '',
          code TEXT DEFAULT '',
          category_id INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now','localtime')),
          UNIQUE(category, value)
        );

        CREATE TABLE IF NOT EXISTS dict_categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL UNIQUE,
          sort_order INTEGER DEFAULT 0,
          description TEXT DEFAULT ''
        );

    ''')
    # Seed dict_categories
    for code, name, sort in [
        ('01','环境',1),('02','商机',2),('03','阶段',3),('04','方式',4),
        ('05','状态',5),('06','重要',6),('07','紧急',7),('08','难易',8),('09','BSC',9),
        ('12','兼容状态',12),('13','兼容环节',13),
    ]:
        conn.execute("INSERT OR IGNORE INTO dict_categories (code, name, sort_order) VALUES (?,?,?)", [code, name, sort])

    # Migration: add new columns to existing DBs
    for col, typ, dflt in [('code', 'TEXT', "''"), ('category_id', 'INTEGER', '0')]:
        try: conn.execute(f"ALTER TABLE dictionaries ADD COLUMN {col} {typ} DEFAULT {dflt}")
        except sqlite3.OperationalError: pass
    try: conn.execute("ALTER TABLE work_records ADD COLUMN service3 TEXT DEFAULT ''")
    except sqlite3.OperationalError: pass

    conn.executescript('''
        CREATE TABLE IF NOT EXISTS projects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT DEFAULT '',
          name TEXT NOT NULL UNIQUE,
          customer TEXT DEFAULT '',
          isv TEXT DEFAULT '',
          product_version TEXT DEFAULT '',
          status TEXT DEFAULT '进行中',
          sales_person TEXT DEFAULT '',
          created_at TEXT DEFAULT (datetime('now','localtime'))
        );

    ''')
    # Migration: add code column to existing DBs
    try: conn.execute("ALTER TABLE projects ADD COLUMN code TEXT DEFAULT ''")
    except sqlite3.OperationalError: pass

    # 项目状态达成条件表
    conn.execute('''
        CREATE TABLE IF NOT EXISTS project_status_conditions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            target_status TEXT NOT NULL,
            condition_text TEXT NOT NULL,
            is_met INTEGER DEFAULT 0,
            met_date TEXT DEFAULT '',
            met_by TEXT DEFAULT '',
            sort_order INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now','localtime')),
            updated_at TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
    ''')
    # 项目状态变更日志表
    conn.execute('''
        CREATE TABLE IF NOT EXISTS project_status_condition_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            condition_id INTEGER DEFAULT 0,
            action TEXT NOT NULL,
            from_status TEXT DEFAULT '',
            to_status TEXT DEFAULT '',
            operator TEXT DEFAULT '',
            remark TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );
    ''')

    conn.executescript('''
        CREATE TABLE IF NOT EXISTS sales (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          department TEXT DEFAULT '',
          phone TEXT DEFAULT '',
          notes TEXT DEFAULT '',
          created_at TEXT DEFAULT (datetime('now','localtime'))
        );
    ''')
    # Add sales_person column if table already exists
    try:
        conn.execute("ALTER TABLE projects ADD COLUMN sales_person TEXT DEFAULT ''")
    except sqlite3.OperationalError:
        pass  # column already exists

    # Add product3 column if table already exists
    try:
        conn.execute("ALTER TABLE work_records ADD COLUMN product3 TEXT DEFAULT ''")
    except sqlite3.OperationalError:
        pass

    # LLM profiles table
    conn.execute('''
        CREATE TABLE IF NOT EXISTS llm_profiles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          endpoint TEXT NOT NULL,
          api_key TEXT DEFAULT '',
          model TEXT DEFAULT 'deepseek-chat',
          is_default INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now','localtime'))
        );
    ''')
    # Set default for first profile if none is default
    conn.execute("UPDATE llm_profiles SET is_default=1 WHERE id=(SELECT MIN(id) FROM llm_profiles) AND 0=(SELECT COUNT(*) FROM llm_profiles WHERE is_default=1)")
    # Migration: add is_default column
    try: conn.execute("ALTER TABLE llm_profiles ADD COLUMN is_default INTEGER DEFAULT 0")
    except sqlite3.OperationalError: pass
    # Migrate old settings-based config
    try:
        old = conn.execute("SELECT value FROM settings WHERE key='llm_endpoint'").fetchone()
        if old and old['value']:
            ep = old['value']
            key = conn.execute("SELECT value FROM settings WHERE key='llm_api_key'").fetchone()
            md = conn.execute("SELECT value FROM settings WHERE key='llm_model'").fetchone()
            conn.execute("INSERT OR IGNORE INTO llm_profiles (name, endpoint, api_key, model) VALUES (?,?,?,?)",
                         ['默认', ep, key['value'] if key else '', md['value'] if md else 'deepseek-chat'])
            conn.execute("DELETE FROM settings WHERE key LIKE 'llm_%'")
            conn.commit()
    except:
        pass

    # Risk management table (per project)
    conn.execute('''
        CREATE TABLE IF NOT EXISTS risks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_name TEXT NOT NULL,
          risk_type TEXT DEFAULT '技术风险',
          risk_level TEXT DEFAULT '中',
          description TEXT DEFAULT '',
          impact TEXT DEFAULT '',
          mitigation TEXT DEFAULT '',
          status TEXT DEFAULT '待处理',
          owner TEXT DEFAULT '',
          created_at TEXT DEFAULT (datetime('now','localtime')),
          updated_at TEXT DEFAULT (datetime('now','localtime'))
        );
    ''')

    # Expense claims (financial reimbursement)
    conn.execute('''
        CREATE TABLE IF NOT EXISTS expense_claims (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT DEFAULT '',
          project TEXT DEFAULT '',
          location TEXT DEFAULT '',
          start_time TEXT DEFAULT '',
          end_time TEXT DEFAULT '',
          amount REAL DEFAULT 0,
          invoice_amount REAL DEFAULT 0,
          invoice_count INTEGER DEFAULT 0,
          tax_rate TEXT DEFAULT '',
          category TEXT DEFAULT '',
          status TEXT DEFAULT '未报销',
          from_place TEXT DEFAULT '',
          to_place TEXT DEFAULT '',
          description TEXT DEFAULT '',
          fee_info TEXT DEFAULT '',
          param TEXT DEFAULT '',
          remark TEXT DEFAULT '',
          year INTEGER DEFAULT 0,
          source_sheet TEXT DEFAULT '',
          created_at TEXT DEFAULT (datetime('now','localtime')),
          updated_at TEXT DEFAULT (datetime('now','localtime'))
        );
    ''')
    # Migration: add columns to existing DB
    for col in ['tax_rate TEXT', 'fee_info TEXT', 'param TEXT']:
        try:
            col_name, col_type = col.split()
            conn.execute(f"ALTER TABLE expense_claims ADD COLUMN {col_name} {col_type} DEFAULT ''")
        except sqlite3.OperationalError:
            pass

    # Trip management (one record per business trip)
    conn.execute('''
        CREATE TABLE IF NOT EXISTS trips (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT NOT NULL,
          project TEXT DEFAULT '',
          location TEXT DEFAULT '',
          start_time TEXT DEFAULT '',
          end_time TEXT DEFAULT '',
          total_amount REAL DEFAULT 0,
          allowance REAL DEFAULT 0,
          status TEXT DEFAULT '未报销',
          year INTEGER DEFAULT 0,
          remark TEXT DEFAULT '',
          created_at TEXT DEFAULT (datetime('now','localtime')),
          updated_at TEXT DEFAULT (datetime('now','localtime'))
        );
    ''')
    # Add columns for existing DBs
    for col_sql in ['total_amount REAL', 'allowance REAL', 'year INTEGER', 'remark TEXT']:
        try:
            col_name, _ = col_sql.split(' ', 1)
            conn.execute(f"ALTER TABLE trips ADD COLUMN {col_name} {col_sql.split(' ',1)[1]} DEFAULT ''")
        except sqlite3.OperationalError:
            pass

    # Trip expenses (individual cost items linked to a trip)
    conn.execute('''
        CREATE TABLE IF NOT EXISTS trip_expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          trip_id INTEGER NOT NULL,
          category TEXT DEFAULT '',
          amount REAL DEFAULT 0,
          invoice_amount REAL DEFAULT 0,
          invoice_count INTEGER DEFAULT 0,
          tax_rate TEXT DEFAULT '',
          start_time TEXT DEFAULT '',
          end_time TEXT DEFAULT '',
          location TEXT DEFAULT '',
          from_place TEXT DEFAULT '',
          to_place TEXT DEFAULT '',
          description TEXT DEFAULT '',
          fee_info TEXT DEFAULT '',
          param TEXT DEFAULT '',
          remark TEXT DEFAULT '',
          sort_order INTEGER DEFAULT 0,
          FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
        );
    ''')

    # Issue records (problems / bugs / best practices — linked to products)
    conn.execute('''
        CREATE TABLE IF NOT EXISTS issue_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          type TEXT DEFAULT 'bug',
          product_id INTEGER DEFAULT 0,
          version TEXT DEFAULT '',
          severity TEXT DEFAULT '中',
          status TEXT DEFAULT '未解决',
          description TEXT DEFAULT '',
          solution TEXT DEFAULT '',
          tags TEXT DEFAULT '',
          created_at TEXT DEFAULT (datetime('now','localtime')),
          updated_at TEXT DEFAULT (datetime('now','localtime'))
        );
    ''')
    # Migration: add category column to issue_records
    try: conn.execute("ALTER TABLE issue_records ADD COLUMN category TEXT DEFAULT ''")
    except sqlite3.OperationalError: pass

    # Script templates (话术库 — talking scripts for project communication)
    conn.execute('''
        CREATE TABLE IF NOT EXISTS script_templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          script TEXT NOT NULL,
          description TEXT DEFAULT '',
          category TEXT DEFAULT '',
          sort_order INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now','localtime')),
          updated_at TEXT DEFAULT (datetime('now','localtime'))
        );
    ''')

    # Q2 Goals (重要但不紧急 — personal growth goals with routine tracking)
    conn.execute('''
        CREATE TABLE IF NOT EXISTS q2_goals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT DEFAULT '',
          weekly_schedule TEXT DEFAULT '',
          active INTEGER DEFAULT 1,
          sort_order INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now','localtime')),
          updated_at TEXT DEFAULT (datetime('now','localtime'))
        );
    ''')

    # Work templates (录入工作模板 — pre-fill form fields)
    conn.execute('''
        CREATE TABLE IF NOT EXISTS work_templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          project TEXT DEFAULT '',
          env TEXT DEFAULT '',
          stage TEXT DEFAULT '',
          product1 TEXT DEFAULT '',
          product2 TEXT DEFAULT '',
          product3 TEXT DEFAULT '',
          service1 TEXT DEFAULT '',
          service2 TEXT DEFAULT '',
          service3 TEXT DEFAULT '',
          method TEXT DEFAULT '',
          status TEXT DEFAULT '进行中',
          importance TEXT DEFAULT '重要',
          urgency TEXT DEFAULT '不紧急',
          difficulty TEXT DEFAULT '一般',
          bsc TEXT DEFAULT '',
          content TEXT DEFAULT '',
          remark TEXT DEFAULT '',
          hours REAL DEFAULT 0,
          sort_order INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now','localtime'))
        );
    ''')

    # Server management tables
    conn.execute('''
        CREATE TABLE IF NOT EXISTS servers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_name TEXT NOT NULL,
          resource_id TEXT DEFAULT '',
          node_name TEXT DEFAULT '',
          eu TEXT DEFAULT '',
          isv TEXT DEFAULT '',
          purpose TEXT DEFAULT '',
          deploy_arch TEXT DEFAULT '',
          master_slave TEXT DEFAULT '',
          install_date TEXT DEFAULT '',
          dbid TEXT DEFAULT '',
          server_vendor TEXT DEFAULT '',
          vm_vendor TEXT DEFAULT '',
          cloud_vendor TEXT DEFAULT '',
          nic_name TEXT DEFAULT '',
          ip TEXT DEFAULT '',
          mac TEXT DEFAULT '',
          nic_uuid TEXT DEFAULT '',
          fip TEXT DEFAULT '',
          vip TEXT DEFAULT '',
          eip TEXT DEFAULT '',
          cpu_vendor TEXT DEFAULT '',
          cpu_model TEXT DEFAULT '',
          cpu_arch TEXT DEFAULT '',
          logical_cpus TEXT DEFAULT '',
          threads_per_core TEXT DEFAULT '',
          physical_cores TEXT DEFAULT '',
          sockets TEXT DEFAULT '',
          numa_nodes TEXT DEFAULT '',
          max_freq TEXT DEFAULT '',
          min_freq TEXT DEFAULT '',
          l1d TEXT DEFAULT '',
          l1i TEXT DEFAULT '',
          l2 TEXT DEFAULT '',
          l3 TEXT DEFAULT '',
          byte_order TEXT DEFAULT '',
          virtualization TEXT DEFAULT '',
          hypervisor_vendor TEXT DEFAULT '',
          virtualization_type TEXT DEFAULT '',
          memory_total TEXT DEFAULT '',
          memory_avail TEXT DEFAULT '',
          swap TEXT DEFAULT '',
          os_version TEXT DEFAULT '',
          os_id TEXT DEFAULT '',
          hostname TEXT DEFAULT '',
          os_user TEXT DEFAULT '',
          os_password TEXT DEFAULT '',
          locale TEXT DEFAULT '',
          db_version TEXT DEFAULT '',
          license_expiry TEXT DEFAULT '',
          extensions TEXT DEFAULT '',
          ha_type TEXT DEFAULT '',
          ha_scope TEXT DEFAULT '',
          ha_last_tl TEXT DEFAULT '',
          read_write_split TEXT DEFAULT '',
          ha_port TEXT DEFAULT '',
          backup_time TEXT DEFAULT '',
          backup_retention TEXT DEFAULT '',
          backup_script TEXT DEFAULT '',
          max_connections TEXT DEFAULT '',
          shared_buffer TEXT DEFAULT '',
          effective_cache_size TEXT DEFAULT '',
          maintenance_work_mem TEXT DEFAULT '',
          checkpoint_completion_target TEXT DEFAULT '',
          wal_buffers TEXT DEFAULT '',
          default_statistics_target TEXT DEFAULT '',
          random_page_cost TEXT DEFAULT '',
          effective_io_concurrency TEXT DEFAULT '',
          work_mem TEXT DEFAULT '',
          huge_pages TEXT DEFAULT '',
          min_wal_size TEXT DEFAULT '',
          max_wal_size TEXT DEFAULT '',
          max_worker_processes TEXT DEFAULT '',
          max_parallel_workers_per_gather TEXT DEFAULT '',
          max_parallel_workers TEXT DEFAULT '',
          max_parallel_maintenance_workers TEXT DEFAULT '',
          install_package TEXT DEFAULT '',
          created_at TEXT DEFAULT (datetime('now','localtime')),
          updated_at TEXT DEFAULT (datetime('now','localtime'))
        );
    ''')

    conn.execute('''
        CREATE TABLE IF NOT EXISTS server_disks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          server_id INTEGER NOT NULL,
          disk_purpose TEXT DEFAULT '',
          device TEXT DEFAULT '',
          disk_type TEXT DEFAULT '',
          lvm TEXT DEFAULT '',
          logical_volume TEXT DEFAULT '',
          filesystem TEXT DEFAULT '',
          size TEXT DEFAULT '',
          mount_point TEXT DEFAULT '',
          disk_uuid TEXT DEFAULT '',
          data_dir TEXT DEFAULT '',
          disk_write_3k TEXT DEFAULT '',
          random_read_3k TEXT DEFAULT '',
          large_write_8m TEXT DEFAULT '',
          seq_read TEXT DEFAULT '',
          seq_write TEXT DEFAULT '',
          pgbench_latency TEXT DEFAULT '',
          pgbench_with_conn TEXT DEFAULT '',
          pgbench_without_conn TEXT DEFAULT '',
          pgbench200_latency TEXT DEFAULT '',
          pgbench200_with_conn TEXT DEFAULT '',
          pgbench200_without_conn TEXT DEFAULT ''
        );
    ''')

    # Priority criteria table
    conn.execute('''
        CREATE TABLE IF NOT EXISTS priority_criteria (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          reference_no INTEGER DEFAULT 0,
          name TEXT NOT NULL,
          options TEXT DEFAULT '',
          important TEXT DEFAULT '',
          not_important TEXT DEFAULT '',
          urgent TEXT DEFAULT '',
          not_urgent TEXT DEFAULT '',
          sort_order INTEGER DEFAULT 0
        );
    ''')

    # Typical issues / knowledge base
    conn.execute('''
        CREATE TABLE IF NOT EXISTS typical_issues (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          reference_no INTEGER DEFAULT 0,
          title TEXT NOT NULL,
          product1 TEXT DEFAULT '',
          product2 TEXT DEFAULT '',
          scenario TEXT DEFAULT '',
          impact TEXT DEFAULT '',
          found_by TEXT DEFAULT '',
          category TEXT DEFAULT '',
          service1 TEXT DEFAULT '',
          service2 TEXT DEFAULT '',
          service3 TEXT DEFAULT '',
          sort_order INTEGER DEFAULT 0
        );
    ''')

    # WBS (Work Breakdown Structure) tables
    conn.execute('''
        CREATE TABLE IF NOT EXISTS wbs_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT DEFAULT '',
          deadline TEXT DEFAULT '',
          weight INTEGER DEFAULT 0,
          recommend TEXT DEFAULT '',
          notes TEXT DEFAULT '',
          sort_order INTEGER DEFAULT 0
        );
    ''')

    conn.execute('''
        CREATE TABLE IF NOT EXISTS wbs_scenarios (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT DEFAULT '',
          sort_order INTEGER DEFAULT 0
        );
    ''')

    conn.execute('''
        CREATE TABLE IF NOT EXISTS wbs_scenario_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          scenario_id INTEGER NOT NULL,
          item_id INTEGER NOT NULL,
          custom_weight INTEGER DEFAULT 0,
          UNIQUE(scenario_id, item_id)
        );
    ''')

    # User persona table (per project)
    conn.execute('''
        CREATE TABLE IF NOT EXISTS personas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_name TEXT NOT NULL,
          business_profile TEXT DEFAULT '',
          technical_profile TEXT DEFAULT '',
          pain_points TEXT DEFAULT '',
          key_personnel TEXT DEFAULT '',
          expectations TEXT DEFAULT '',
          notes TEXT DEFAULT '',
          created_at TEXT DEFAULT (datetime('now','localtime')),
          updated_at TEXT DEFAULT (datetime('now','localtime'))
        );
    ''')

    # Product catalog (3-level hierarchy)
    conn.execute('''
        CREATE TABLE IF NOT EXISTS product_catalog (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          parent_id INTEGER DEFAULT 0,
          level INTEGER NOT NULL,
          name TEXT NOT NULL,
          description TEXT DEFAULT '',
          sort_order INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now','localtime')),
          UNIQUE(parent_id, name)
        );
    ''')

    # Product plans (map service plans to product catalog levels)
    conn.execute('''
        CREATE TABLE IF NOT EXISTS product_plans (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          product_l1 TEXT DEFAULT '',
          product_l2 TEXT DEFAULT '',
          product_l3 TEXT DEFAULT '',
          description TEXT DEFAULT '',
          status TEXT DEFAULT '规划中',
          created_at TEXT DEFAULT (datetime('now','localtime')),
          updated_at TEXT DEFAULT (datetime('now','localtime'))
        );
    ''')

    # Product releases (version releases linked to IP/certification)
    conn.execute('''
        CREATE TABLE IF NOT EXISTS product_releases (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          catalog_id INTEGER DEFAULT 0,
          product_path TEXT DEFAULT '',
          version TEXT NOT NULL,
          ip_name TEXT DEFAULT '',
          ip_type TEXT DEFAULT '',
          ip_number TEXT DEFAULT '',
          release_date TEXT DEFAULT '',
          description TEXT DEFAULT '',
          sales_count INTEGER DEFAULT 0,
          adapt_count INTEGER DEFAULT 0,
          status TEXT DEFAULT '在售',
          features TEXT DEFAULT '',
          rank_score INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now','localtime')),
          updated_at TEXT DEFAULT (datetime('now','localtime'))
        );
    ''')
    # Migration: add new columns if they don't exist
    for col, typ, default in [
        ('sales_count', 'INTEGER', '0'),
        ('adapt_count', 'INTEGER', '0'),
        ('status', 'TEXT', "'在售'"),
        ('features', 'TEXT', "''"),
        ('rank_score', 'INTEGER', '0'),
    ]:
        try:
            conn.execute(f"ALTER TABLE product_releases ADD COLUMN {col} {typ} DEFAULT {default}")
        except sqlite3.OperationalError:
            pass

    # Service catalog (separate from product, may have different hierarchy)
    conn.execute('''
        CREATE TABLE IF NOT EXISTS service_catalog (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          parent_id INTEGER DEFAULT 0,
          level INTEGER NOT NULL,
          name TEXT NOT NULL,
          description TEXT DEFAULT '',
          sort_order INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now','localtime')),
          UNIQUE(parent_id, name)
        );
    ''')

    # Overtime records
    conn.execute('''
        CREATE TABLE IF NOT EXISTS overtimer (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          sign_in TEXT DEFAULT '',
          sign_out TEXT DEFAULT '',
          hours REAL NOT NULL DEFAULT 0,
          comp_leave TEXT DEFAULT 'N',
          meal TEXT DEFAULT '20',
          transport TEXT DEFAULT '',
          content TEXT DEFAULT '',
          reimburse TEXT DEFAULT 'N',
          remark TEXT DEFAULT '',
          created_at TEXT DEFAULT (datetime('now','localtime'))
        );
    ''')

    # Compatibility certificates
    conn.execute('''
        CREATE TABLE IF NOT EXISTS compatibility_certs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project TEXT NOT NULL,
          app_system TEXT DEFAULT '',
          completed TEXT DEFAULT 'N',
          stage TEXT DEFAULT '',
          issue_date TEXT DEFAULT '',
          issued_by TEXT DEFAULT '',
          cert_count INTEGER DEFAULT 0,
          adapt_count INTEGER DEFAULT 0,
          adapted_by TEXT DEFAULT '',
          claimed_by TEXT DEFAULT '',
          remark TEXT DEFAULT '',
          created_at TEXT DEFAULT (datetime('now','localtime')),
          updated_at TEXT DEFAULT (datetime('now','localtime'))
        );
    ''')

    seed_dicts(conn)
    seed_projects(conn)
    seed_product_catalog(conn)
    seed_service_catalog(conn)
    conn.close()


def seed_projects(conn):
    seed_data = [
        ['hg45-大唐数科-雄安OA-冯燕N018450', '大唐数科', '冯燕', '企业版v9', '进行中', '冯燕'],
        ['hg45-德州市监局-中泽信-郭永康N020897', '德州市监局', '中泽信', '安全版v45', '进行中', '郭永康'],
        ['hg45-国泰新点-济宁行审局-王凯A018978', '济宁行审局', '国泰新点', '安全版v45', '进行中', '王凯'],
        ['hg457X-北京东润环能-蹇桂娟A016693', '北京东润环能', '蹇桂娟', '企业版v457', '进行中', '蹇桂娟'],
        ['部门内部事项', '', '', '', '进行中', ''],
    ]
    conn.executemany('INSERT OR IGNORE INTO projects (name, customer, isv, product_version, status, sales_person) VALUES (?,?,?,?,?,?)', seed_data)
    conn.commit()



def seed_product_catalog(conn):
    """Seed 3-level product catalog."""
    # Level 1: 大类
    l1 = [('数据库', 1), ('工具', 2), ('服务', 3)]
    for name, order in l1:
        conn.execute("INSERT OR IGNORE INTO product_catalog (parent_id, level, name, sort_order) VALUES (0, 1, ?, ?)", [name, order])

    # Get level-1 IDs
    db_id = conn.execute("SELECT id FROM product_catalog WHERE name='数据库' AND level=1").fetchone()
    tool_id = conn.execute("SELECT id FROM product_catalog WHERE name='工具' AND level=1").fetchone()
    svc_id = conn.execute("SELECT id FROM product_catalog WHERE name='服务' AND level=1").fetchone()

    # Level 2: 系列
    if db_id:
        for name, order in [('企业版', 1), ('安全版', 2), ('标准版', 3), ('单机版', 4)]:
            conn.execute("INSERT OR IGNORE INTO product_catalog (parent_id, level, name, sort_order) VALUES (?, 2, ?, ?)", [db_id['id'], name, order])
    if tool_id:
        for name, order in [('迁移工具', 1), ('备份工具', 2), ('监控工具', 3), ('同步工具', 4)]:
            conn.execute("INSERT OR IGNORE INTO product_catalog (parent_id, level, name, sort_order) VALUES (?, 2, ?, ?)", [tool_id['id'], name, order])
    if svc_id:
        for name, order in [('技术支持', 1), ('咨询规划', 2), ('驻场运维', 3), ('培训认证', 4)]:
            conn.execute("INSERT OR IGNORE INTO product_catalog (parent_id, level, name, sort_order) VALUES (?, 2, ?, ?)", [svc_id['id'], name, order])

    # Level 3: 版本
    for series_name, versions in [
        ('企业版', ['V9']),
        ('安全版', ['V4.5', 'V4.5.10', 'V4.5.10.3', 'V4.5.11.1']),
        ('标准版', ['V5', 'V4.5']),
    ]:
        row = conn.execute("SELECT id FROM product_catalog WHERE name=? AND level=2", [series_name]).fetchone()
        if row:
            for i, v in enumerate(versions, 1):
                conn.execute("INSERT OR IGNORE INTO product_catalog (parent_id, level, name, sort_order) VALUES (?, 3, ?, ?)", [row['id'], v, i])

    for series_name, versions in [
        ('迁移工具', ['V4.4.2', 'V4.4.1']),
        ('备份工具', ['V2.1', 'V2.0']),
    ]:
        row = conn.execute("SELECT id FROM product_catalog WHERE name=? AND level=2", [series_name]).fetchone()
        if row:
            for i, v in enumerate(versions, 1):
                conn.execute("INSERT OR IGNORE INTO product_catalog (parent_id, level, name, sort_order) VALUES (?, 3, ?, ?)", [row['id'], v, i])

    conn.commit()


def seed_service_catalog(conn):
    """Seed service catalog with flexible hierarchy."""
    # Level 1: 服务大类
    l1 = [('咨询规划', 1), ('数据库迁移', 2), ('运维支持', 3), ('性能优化', 4), ('培训认证', 5)]
    for name, order in l1:
        conn.execute("INSERT OR IGNORE INTO service_catalog (parent_id, level, name, sort_order) VALUES (0, 1, ?, ?)", [name, order])

    # Fetch IDs
    cats = {}
    for row in conn.execute("SELECT id, name FROM service_catalog WHERE level=1").fetchall():
        cats[row['name']] = row['id']

    # Level 2
    l2_map = {
        '咨询规划': ['技术选型', '架构设计', '合规评估'],
        '数据库迁移': ['Oracle迁移', 'MySQL迁移', 'SQLServer迁移', '其他数据库'],
        '运维支持': ['驻场运维', '远程支持', '7x24保障', '巡检服务'],
        '性能优化': ['SQL优化', '架构优化', '参数调优', '压测分析'],
        '培训认证': ['管理员培训', '开发培训', '认证考试'],
    }
    for l1_name, items in l2_map.items():
        if l1_name in cats:
            for i, name in enumerate(items, 1):
                conn.execute("INSERT OR IGNORE INTO service_catalog (parent_id, level, name, sort_order) VALUES (?, 2, ?, ?)",
                             [cats[l1_name], name, i])

    # Level 3 (only for some L2 items)
    l3_map = {
        'Oracle迁移': ['结构迁移', '数据迁移', '存储过程迁移', 'SQL兼容改造'],
        'MySQL迁移': ['结构迁移', '数据迁移', '函数过程迁移'],
        '驻场运维': ['日常巡检', '故障处理', '版本升级', '备份恢复'],
    }
    for l2_name, items in l3_map.items():
        row = conn.execute("SELECT id FROM service_catalog WHERE name=? AND level=2", [l2_name]).fetchone()
        if row:
            for i, name in enumerate(items, 1):
                conn.execute("INSERT OR IGNORE INTO service_catalog (parent_id, level, name, sort_order) VALUES (?, 3, ?, ?)",
                             [row['id'], name, i])

    conn.commit()


def seed_dicts(conn):
    seed_data = [
        ['env', '生产', 1], ['env', '开发测试', 2], ['env', '准生产', 3],
        ['stage', '前期沟通', 1], ['stage', '业务适配', 2], ['stage', '安装交付', 3], ['stage', '运维支持', 4],
        ['product1', '数据库', 1], ['product1', '工具', 2], ['product1', '服务', 3],
        ['service1', '数据库迁移', 1], ['service1', '安装交付', 2], ['service1', '运维支持', 3], ['service1', '技术咨询', 4], ['service1', '问题排查', 5],
        ['method', '远程', 1], ['method', '现场', 2], ['method', '电话', 3],
        ['status', '已完成', 1], ['status', '进行中', 2], ['status', '部分完成', 3], ['status', '待处理', 4],
        ['importance', '重要', 1], ['importance', '不重要', 2],
        ['urgency', '紧急', 1], ['urgency', '不紧急', 2],
        ['difficulty', '简单', 1], ['difficulty', '一般', 2], ['difficulty', '适中', 3], ['difficulty', '困难', 4],
        ['bsc', '常规', 1], ['bsc', '文章1', 2], ['bsc', '文章2', 3], ['bsc', '兼容证明', 4], ['bsc', '培训', 5], ['bsc', 'REVIEW', 6],
    ]
    conn.executemany('INSERT OR IGNORE INTO dictionaries (category, value, sort_order) VALUES (?,?,?)', seed_data)
    conn.commit()


app = FastAPI()


# ===== HTTP Request Logging Middleware =====
@app.middleware("http")
async def log_requests(request, call_next):
    start = time.time()
    try:
        response = await call_next(request)
        duration = (time.time() - start) * 1000
        status = response.status_code
        if status >= 500:
            app_logger.error(f"{request.method} {request.url.path} → {status} ({duration:.0f}ms)")
        elif status >= 400:
            app_logger.warning(f"{request.method} {request.url.path} → {status} ({duration:.0f}ms)")
        else:
            app_logger.info(f"{request.method} {request.url.path} → {status} ({duration:.0f}ms)")
        return response
    except Exception as e:
        duration = (time.time() - start) * 1000
        app_logger.exception(f"{request.method} {request.url.path} → EXCEPTION after {duration:.0f}ms")
        raise


class RecordCreate(BaseModel):
    date: str
    project: str
    env: str = ''
    stage: str = ''
    product1: str = ''
    product2: str = ''
    product3: str = ''
    service1: str = ''
    service2: str = ''
    service3: str = ''
    method: str = ''
    status: str = '进行中'
    importance: str = '重要'
    urgency: str = '不紧急'
    difficulty: str = '一般'
    bsc: str = '常规'
    hours: float = 0
    content: str = ''
    remark: str = ''
    todo: str = ''
    todo_done: int = 0
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class RecordUpdate(BaseModel):
    date: Optional[str] = None
    project: Optional[str] = None
    env: Optional[str] = None
    stage: Optional[str] = None
    product1: Optional[str] = None
    product2: Optional[str] = None
    product3: Optional[str] = None
    service1: Optional[str] = None
    service2: Optional[str] = None
    service3: Optional[str] = None
    method: Optional[str] = None
    status: Optional[str] = None
    importance: Optional[str] = None
    urgency: Optional[str] = None
    difficulty: Optional[str] = None
    bsc: Optional[str] = None
    hours: Optional[float] = None
    content: Optional[str] = None
    remark: Optional[str] = None
    todo: Optional[str] = None
    todo_done: Optional[int] = None
    updated_at: Optional[str] = None


class DictCreate(BaseModel):
    category: str = ''
    category_id: int = 0
    value: str
    description: str = ''


class BatchDelete(BaseModel):
    ids: List[str]


class ProjectCreate(BaseModel):
    code: str = ''
    name: str
    customer: str = ''
    isv: str = ''
    product_version: str = ''
    status: str = '进行中'
    sales_person: str = ''


class ProjectUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    customer: Optional[str] = None
    isv: Optional[str] = None
    product_version: Optional[str] = None
    status: Optional[str] = None
    sales_person: Optional[str] = None


# --- 项目状态达成条件相关模型 ---

class ConditionItem(BaseModel):
    """单条条件项"""
    condition_text: str
    sort_order: int = 0


class ConditionsSaveBody(BaseModel):
    """批量保存条件请求体"""
    target_status: str
    conditions: List[ConditionItem]


class ConditionUpdateBody(BaseModel):
    """更新单条条件请求体"""
    condition_text: Optional[str] = None
    is_met: Optional[int] = None
    met_by: Optional[str] = None


# --- Work Records APIs ---

@app.get("/api/records")
def get_records(date_from: str = '', date_to: str = '', project: str = ''):
    conn = get_db()
    sql = "SELECT * FROM work_records WHERE 1=1"
    params = []
    if date_from:
        sql += " AND date >= ?"
        params.append(date_from)
    if date_to:
        sql += " AND date <= ?"
        params.append(date_to)
    if project:
        sql += " AND project = ?"
        params.append(project)
    sql += " ORDER BY date DESC, created_at DESC"
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/records")
def create_record(record: RecordCreate):
    conn = get_db()
    rid = str(uuid.uuid4())
    now = record.created_at or datetime.datetime.now().isoformat()
    conn.execute('''INSERT INTO work_records (id,date,project,env,stage,product1,product2,product3,service1,service2,service3,method,status,importance,urgency,difficulty,bsc,hours,content,remark,todo,todo_done,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
        [rid, record.date, record.project, record.env, record.stage, record.product1, record.product2, record.product3 or '',
         record.service1, record.service2, record.service3 or '', record.method, record.status, record.importance,
         record.urgency, record.difficulty, record.bsc, record.hours, record.content,
         record.remark, record.todo, record.todo_done, now, now])
    conn.commit()
    row = conn.execute("SELECT * FROM work_records WHERE id = ?", [rid]).fetchone()
    conn.close()
    return dict(row)


@app.put("/api/records/{rid}")
def update_record(rid: str, record: RecordUpdate):
    conn = get_db()
    existing = conn.execute("SELECT * FROM work_records WHERE id = ?", [rid]).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(404, "Record not found")
    fields = record.model_dump(exclude_unset=True)
    if not fields:
        conn.close()
        return dict(existing)
    fields['updated_at'] = datetime.datetime.now().isoformat()
    set_clause = ', '.join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [rid]
    conn.execute(f"UPDATE work_records SET {set_clause} WHERE id = ?", values)
    conn.commit()
    row = conn.execute("SELECT * FROM work_records WHERE id = ?", [rid]).fetchone()
    conn.close()
    return dict(row)


@app.delete("/api/records/{rid}")
def delete_record(rid: str):
    conn = get_db()
    conn.execute("DELETE FROM work_records WHERE id = ?", [rid])
    conn.commit()
    conn.close()
    return {"ok": True}


@app.post("/api/records/batch-delete")
def batch_delete(body: BatchDelete):
    if not body.ids:
        return {"ok": True, "count": 0}
    conn = get_db()
    placeholders = ','.join('?' * len(body.ids))
    conn.execute(f"DELETE FROM work_records WHERE id IN ({placeholders})", body.ids)
    conn.commit()
    conn.close()
    return {"ok": True, "count": len(body.ids)}


# --- Statistics & Todos ---

@app.get("/api/stats")
def get_stats(date_from: str = '', date_to: str = ''):
    conn = get_db()
    sql = "SELECT project, SUM(hours) as total_hours, bsc FROM work_records WHERE 1=1"
    params = []
    if date_from:
        sql += " AND date >= ?"
        params.append(date_from)
    if date_to:
        sql += " AND date <= ?"
        params.append(date_to)
    sql += " GROUP BY project ORDER BY total_hours DESC"
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/api/todos")
def get_todos(project: str = ''):
    conn = get_db()
    sql = "SELECT * FROM work_records WHERE todo != ''"
    params = []
    if project:
        sql += " AND project = ?"
        params.append(project)
    sql += " ORDER BY date DESC"
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# --- Overtime API ---

class OvertimeCreate(BaseModel):
    date: str
    sign_in: str = ''
    sign_out: str = ''
    hours: float = 0
    comp_leave: str = 'N'
    meal: str = '20'
    transport: str = ''
    content: str = ''
    reimburse: str = 'N'
    remark: str = ''


@app.get("/api/overtime")
def get_overtime():
    conn = get_db()
    rows = conn.execute("SELECT * FROM overtimer ORDER BY date DESC, id DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/overtime")
def create_overtime(body: OvertimeCreate):
    conn = get_db()
    conn.execute("""INSERT INTO overtimer (date, sign_in, sign_out, hours, comp_leave, meal, transport, content, reimburse, remark)
        VALUES (?,?,?,?,?,?,?,?,?,?)""",
        [body.date, body.sign_in, body.sign_out, body.hours, body.comp_leave, body.meal, body.transport, body.content, body.reimburse, body.remark])
    conn.commit()
    row = conn.execute("SELECT * FROM overtimer WHERE rowid=last_insert_rowid()").fetchone()
    conn.close()
    return dict(row)


@app.put("/api/overtime/{oid}")
def update_overtime(oid: int, body: OvertimeCreate):
    conn = get_db()
    conn.execute("""UPDATE overtimer SET date=?, sign_in=?, sign_out=?, hours=?, comp_leave=?, meal=?, transport=?, content=?, reimburse=?, remark=? WHERE id=?""",
        [body.date, body.sign_in, body.sign_out, body.hours, body.comp_leave, body.meal, body.transport, body.content, body.reimburse, body.remark, oid])
    conn.commit()
    row = conn.execute("SELECT * FROM overtimer WHERE id=?", [oid]).fetchone()
    conn.close()
    return dict(row) if row else {}


@app.delete("/api/overtime/{oid}")
def delete_overtime(oid: int):
    conn = get_db()
    conn.execute("DELETE FROM overtimer WHERE id=?", [oid])
    conn.commit()
    conn.close()
    return {"ok": True}


# --- Compatibility Certs API ---

class CertCreate(BaseModel):
    project: str
    app_system: str = ''
    completed: str = 'N'
    stage: str = ''
    issue_date: str = ''
    issued_by: str = ''
    cert_count: int = 0
    adapt_count: int = 0
    adapted_by: str = ''
    claimed_by: str = ''
    remark: str = ''


@app.get("/api/compatibility-certs")
def get_certs():
    conn = get_db()
    rows = conn.execute("SELECT * FROM compatibility_certs ORDER BY completed ASC, issue_date DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/compatibility-certs")
def create_cert(body: CertCreate):
    conn = get_db()
    conn.execute("""INSERT INTO compatibility_certs
        (project, app_system, completed, stage, issue_date, issued_by, cert_count, adapt_count, adapted_by, claimed_by, remark)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
        [body.project, body.app_system, body.completed, body.stage, body.issue_date, body.issued_by,
         body.cert_count, body.adapt_count, body.adapted_by, body.claimed_by, body.remark])
    conn.commit()
    row = conn.execute("SELECT * FROM compatibility_certs WHERE rowid=last_insert_rowid()").fetchone()
    conn.close()
    return dict(row)


@app.put("/api/compatibility-certs/{cid}")
def update_cert(cid: int, body: CertCreate):
    conn = get_db()
    conn.execute("""UPDATE compatibility_certs SET project=?, app_system=?, completed=?, stage=?,
        issue_date=?, issued_by=?, cert_count=?, adapt_count=?, adapted_by=?, claimed_by=?,
        remark=?, updated_at=datetime('now','localtime') WHERE id=?""",
        [body.project, body.app_system, body.completed, body.stage, body.issue_date, body.issued_by,
         body.cert_count, body.adapt_count, body.adapted_by, body.claimed_by, body.remark, cid])
    conn.commit()
    row = conn.execute("SELECT * FROM compatibility_certs WHERE id=?", [cid]).fetchone()
    conn.close()
    return dict(row) if row else {}


@app.delete("/api/compatibility-certs/{cid}")
def delete_cert(cid: int):
    conn = get_db()
    conn.execute("DELETE FROM compatibility_certs WHERE id=?", [cid])
    conn.commit()
    conn.close()
    return {"ok": True}


# --- Backlog API ---

@app.get("/api/backlog")
def get_backlog():
    conn = get_db()
    # Per-project: count "进行中" items, open todos, recent hours
    rows = conn.execute("""
        SELECT project,
               COUNT(*) as total_records,
               SUM(CASE WHEN status='进行中' THEN 1 ELSE 0 END) as in_progress,
               SUM(CASE WHEN todo != '' AND todo_done=0 THEN 1 ELSE 0 END) as open_todos,
               SUM(CASE WHEN date >= date('now','-14 days') THEN hours ELSE 0 END) as recent_hours,
               MAX(date) as last_date
        FROM work_records
        WHERE project != '' AND project != '部门内部事项'
        GROUP BY project
        ORDER BY in_progress DESC, open_todos DESC
    """).fetchall()

    result = []
    for r in rows:
        project = r['project']
        in_progress = r['in_progress'] or 0
        open_todos = r['open_todos'] or 0
        recent_hours = r['recent_hours'] or 0
        total = r['total_records'] or 0
        last_date = r['last_date'] or ''

        # Backlog scoring
        score = 0
        if in_progress >= 3: score += 3
        elif in_progress >= 1: score += 1
        if open_todos >= 5: score += 3
        elif open_todos >= 2: score += 1
        if recent_hours >= 40: score += 2
        elif recent_hours >= 20: score += 1
        # Penalty: no activity in 7+ days with open items
        from datetime import datetime, timedelta
        if last_date and in_progress > 0:
            try:
                days_since = (datetime.now() - datetime.strptime(last_date, '%Y-%m-%d')).days
                if days_since > 7: score += 2
            except: pass

        if score >= 5:
            level = '严重积压'
            color = 'error'
        elif score >= 3:
            level = '有积压'
            color = 'warning'
        else:
            level = '正常'
            color = 'success'

        result.append({
            'project': project,
            'total_records': total,
            'in_progress': in_progress,
            'open_todos': open_todos,
            'recent_hours': round(recent_hours, 1),
            'last_date': last_date,
            'score': score,
            'level': level,
            'color': color,
        })
    conn.close()
    return result


# --- Dictionary APIs ---

@app.get("/api/dicts")
def get_all_dicts():
    conn = get_db()
    rows = conn.execute("SELECT * FROM dictionaries ORDER BY category, sort_order").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/dicts")
def create_dict_item(item: DictCreate):
    conn = get_db()
    # Resolve category from category_id
    cat = conn.execute("SELECT * FROM dict_categories WHERE id=?", [item.category_id]).fetchone()
    if not cat:
        conn.close()
        raise HTTPException(400, "无效的分类ID")
    category_key = item.category or cat['code']
    max_order = conn.execute("SELECT COALESCE(MAX(sort_order),0) FROM dictionaries WHERE category_id = ?", [cat['id']]).fetchone()[0]
    count = conn.execute("SELECT COUNT(*) FROM dictionaries WHERE category_id = ?", [cat['id']]).fetchone()[0]
    code = f"{cat['code']}{count + 1:02d}"
    conn.execute("INSERT OR IGNORE INTO dictionaries (category, value, sort_order, description, code, category_id) VALUES (?,?,?,?,?,?)",
        [category_key, item.value, max_order + 1, item.description, code, cat['id']])
    conn.commit()
    row = conn.execute("SELECT * FROM dictionaries WHERE code = ?", [code]).fetchone()
    conn.close()
    return dict(row) if row else {}


@app.get("/api/dict-categories")
def get_dict_categories():
    conn = get_db()
    rows = conn.execute("SELECT * FROM dict_categories ORDER BY sort_order").fetchall()
    conn.close()
    return [dict(r) for r in rows]


class DictCategoryBody(BaseModel):
    code: str
    name: str
    sort_order: int = 0
    description: str = ''


@app.post("/api/dict-categories")
def create_dict_category(body: DictCategoryBody):
    conn = get_db()
    conn.execute("INSERT INTO dict_categories (code, name, sort_order, description) VALUES (?,?,?,?)",
        [body.code, body.name, body.sort_order, body.description])
    conn.commit()
    row = conn.execute("SELECT * FROM dict_categories WHERE code=?", [body.code]).fetchone()
    conn.close()
    return dict(row) if row else {}


@app.put("/api/dict-categories/{cid}")
def update_dict_category(cid: int, body: DictCategoryBody):
    conn = get_db()
    conn.execute("UPDATE dict_categories SET code=?, name=?, sort_order=?, description=? WHERE id=?",
        [body.code, body.name, body.sort_order, body.description, cid])
    conn.commit()
    row = conn.execute("SELECT * FROM dict_categories WHERE id=?", [cid]).fetchone()
    conn.close()
    return dict(row) if row else {}


@app.delete("/api/dict-categories/{cid}")
def delete_dict_category(cid: int):
    conn = get_db()
    conn.execute("DELETE FROM dict_categories WHERE id=?", [cid])
    conn.commit()
    conn.close()
    return {"ok": True}


# check-value MUST be before /{category} to avoid {category} matching "check-value"
@app.get("/api/dicts/check-value")
def check_dict_usage(category: str, value: str):
    conn = get_db()
    valid_categories = ['env', 'stage', 'product1', 'product2', 'service1', 'service2', 'method', 'status', 'importance', 'urgency', 'difficulty', 'bsc', 'business']
    if category not in valid_categories:
        conn.close()
        return {"count": 0}
    try:
        count = conn.execute(f"SELECT COUNT(*) FROM work_records WHERE {category} = ?", [value]).fetchone()[0]
    except sqlite3.OperationalError:
        count = 0
    conn.close()
    return {"count": count}


@app.get("/api/dicts/{category}")
def get_dict_by_category(category: str):
    conn = get_db()
    rows = conn.execute("SELECT * FROM dictionaries WHERE category = ? ORDER BY sort_order", [category]).fetchall()
    conn.close()
    return [dict(r) for r in rows]


class DictUpdate(BaseModel):
    value: str = None
    sort_order: int = None
    description: str = None


@app.put("/api/dicts/{did}")
def update_dict_item(did: int, body: DictUpdate):
    conn = get_db()
    if body.value:
        conn.execute("UPDATE dictionaries SET value = ? WHERE id = ?", [body.value, did])
    if body.sort_order is not None:
        conn.execute("UPDATE dictionaries SET sort_order = ? WHERE id = ?", [body.sort_order, did])
    if body.description is not None:
        conn.execute("UPDATE dictionaries SET description = ? WHERE id = ?", [body.description, did])
    conn.commit()
    row = conn.execute("SELECT * FROM dictionaries WHERE id = ?", [did]).fetchone()
    conn.close()
    return dict(row) if row else {}


@app.delete("/api/dicts/{did}")
def delete_dict_item(did: int):
    conn = get_db()
    conn.execute("DELETE FROM dictionaries WHERE id = ?", [did])
    conn.commit()
    conn.close()
    return {"ok": True}


# --- Projects APIs ---

@app.get("/api/projects")
def get_projects():
    conn = get_db()
    rows = conn.execute("SELECT * FROM projects ORDER BY name").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/projects")
def create_project(body: ProjectCreate):
    conn = get_db()
    try:
        # Auto-generate code if not provided: HG-YYYY-NNN
        code = body.code.strip() if body.code else ''
        if not code:
            year = datetime.datetime.now().strftime('%Y')
            cnt = conn.execute("SELECT COUNT(*) FROM projects WHERE code LIKE ?", [f'HG-{year}-%']).fetchone()[0]
            code = f'HG-{year}-{cnt + 1:03d}'
        conn.execute("INSERT INTO projects (code, name, customer, isv, product_version, status, sales_person) VALUES (?,?,?,?,?,?,?)",
                     [code, body.name, body.customer, body.isv, body.product_version, body.status, body.sales_person])
        conn.commit()
        row = conn.execute("SELECT * FROM projects WHERE name = ?", [body.name]).fetchone()
        conn.close()
        return dict(row)
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(400, "项目名称已存在")


@app.put("/api/projects/{pid}")
def update_project(pid: int, body: ProjectUpdate):
    conn = get_db()
    existing = conn.execute("SELECT * FROM projects WHERE id = ?", [pid]).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(404, "项目不存在")

    fields = body.model_dump(exclude_unset=True)
    if not fields:
        conn.close()
        raise HTTPException(400, "No fields to update")

    # 如果状态变更为"已完成"，检查达成条件
    new_status = fields.get('status')
    old_status = existing['status']
    if new_status == '已完成' and old_status != '已完成':
        conditions = conn.execute(
            "SELECT * FROM project_status_conditions WHERE project_id = ? AND target_status = ? ORDER BY sort_order",
            [pid, '已完成']
        ).fetchall()
        total = len(conditions)
        if total == 0:
            conn.close()
            raise HTTPException(400, '该项目未配置"已完成"状态的达成条件，请先在"达成条件"页签中设置条件。')
        unmet = [c for c in conditions if not c['is_met']]
        if unmet:
            unmet_text = '、'.join(c['condition_text'] for c in unmet)
            conn.close()
            raise HTTPException(400, f"还有 {len(unmet)} 项条件未达成：{unmet_text}")

    set_clause = ', '.join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [pid]
    conn.execute(f"UPDATE projects SET {set_clause} WHERE id = ?", values)

    # 状态变更成功时记录日志
    if new_status and new_status != old_status:
        conn.execute(
            "INSERT INTO project_status_condition_logs (project_id, action, from_status, to_status, operator) VALUES (?, 'status_change', ?, ?, ?)",
            [pid, old_status, new_status, '']
        )

    conn.commit()
    row = conn.execute("SELECT * FROM projects WHERE id = ?", [pid]).fetchone()
    conn.close()
    return dict(row) if row else {}


@app.delete("/api/projects/{pid}")
def delete_project(pid: int):
    conn = get_db()
    conn.execute("DELETE FROM projects WHERE id = ?", [pid])
    conn.commit()
    conn.close()
    return {"ok": True}


# --- 项目状态达成条件 APIs ---

@app.get("/api/projects/{pid}/status-conditions")
def get_project_conditions(pid: int, target_status: str = '已完成'):
    """获取项目某目标状态的所有条件"""
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM project_status_conditions WHERE project_id = ? AND target_status = ? ORDER BY sort_order",
        [pid, target_status]
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/projects/{pid}/status-conditions")
def save_project_conditions(pid: int, body: ConditionsSaveBody):
    """批量替换某目标状态的条件（先删后插）"""
    conn = get_db()
    # 删除旧条件
    conn.execute(
        "DELETE FROM project_status_conditions WHERE project_id = ? AND target_status = ?",
        [pid, body.target_status]
    )
    # 插入新条件
    for item in body.conditions:
        conn.execute(
            "INSERT INTO project_status_conditions (project_id, target_status, condition_text, sort_order) VALUES (?, ?, ?, ?)",
            [pid, body.target_status, item.condition_text, item.sort_order]
        )
    conn.commit()
    # 返回保存后的条件列表
    rows = conn.execute(
        "SELECT * FROM project_status_conditions WHERE project_id = ? AND target_status = ? ORDER BY sort_order",
        [pid, body.target_status]
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.put("/api/projects/{pid}/status-conditions/{cid}")
def update_project_condition(pid: int, cid: int, body: ConditionUpdateBody):
    """更新单条条件（勾选/取消勾选/修改描述）"""
    conn = get_db()
    existing = conn.execute(
        "SELECT * FROM project_status_conditions WHERE id = ? AND project_id = ?",
        [cid, pid]
    ).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(404, "条件不存在")

    updates = {}
    if body.condition_text is not None:
        updates['condition_text'] = body.condition_text
    if body.is_met is not None:
        updates['is_met'] = body.is_met
        if body.is_met:
            updates['met_date'] = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        else:
            updates['met_date'] = ''
    if body.met_by is not None:
        updates['met_by'] = body.met_by

    if updates:
        updates['updated_at'] = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        set_clause = ', '.join(f"{k} = ?" for k in updates)
        values = list(updates.values()) + [cid]
        conn.execute(f"UPDATE project_status_conditions SET {set_clause} WHERE id = ?", values)

        # 记录勾选/取消操作日志
        if 'is_met' in updates:
            action = 'condition_met' if updates['is_met'] else 'condition_unmet'
            conn.execute(
                "INSERT INTO project_status_condition_logs (project_id, condition_id, action, operator, remark) VALUES (?, ?, ?, ?, ?)",
                [pid, cid, action, body.met_by or '', existing['condition_text']]
            )
        conn.commit()

    row = conn.execute("SELECT * FROM project_status_conditions WHERE id = ?", [cid]).fetchone()
    conn.close()
    return dict(row) if row else {}


@app.delete("/api/projects/{pid}/status-conditions/{cid}")
def delete_project_condition(pid: int, cid: int):
    """删除单条条件"""
    conn = get_db()
    existing = conn.execute(
        "SELECT * FROM project_status_conditions WHERE id = ? AND project_id = ?",
        [cid, pid]
    ).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(404, "条件不存在")
    conn.execute("DELETE FROM project_status_conditions WHERE id = ?", [cid])
    conn.commit()
    conn.close()
    return {"ok": True}


@app.get("/api/projects/{pid}/check-status")
def check_project_status(pid: int, target: str = '已完成'):
    """检查项目是否满足目标状态的条件"""
    conn = get_db()
    conditions = conn.execute(
        "SELECT * FROM project_status_conditions WHERE project_id = ? AND target_status = ? ORDER BY sort_order",
        [pid, target]
    ).fetchall()
    conn.close()

    total = len(conditions)
    met_count = sum(1 for c in conditions if c['is_met'])
    unmet_list = [c['condition_text'] for c in conditions if not c['is_met']]

    can_change = total > 0 and met_count == total
    return {
        "can_change": can_change,
        "met_count": met_count,
        "total_count": total,
        "unmet_list": unmet_list
    }


@app.get("/api/projects/{pid}/status-logs")
def get_project_status_logs(pid: int):
    """返回该项目所有状态变更日志"""
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM project_status_condition_logs WHERE project_id = ? ORDER BY created_at DESC",
        [pid]
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# --- 全局状态达成条件模板 APIs (project_id=0) ---

class ConditionTemplateUpdateBody(BaseModel):
    """更新单条模板请求体"""
    condition_text: Optional[str] = None
    sort_order: Optional[int] = None


class ApplyTemplateBody(BaseModel):
    """将模板应用到项目请求体"""
    target_status: str


@app.get("/api/status-conditions/templates")
def get_condition_templates(target_status: str = '已完成'):
    """获取全局条件模板列表（project_id=0）"""
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM project_status_conditions WHERE project_id = 0 AND target_status = ? ORDER BY sort_order",
        [target_status]
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/status-conditions/templates")
def save_condition_templates(body: ConditionsSaveBody):
    """批量保存/替换某目标状态的全局条件模板（project_id=0）"""
    conn = get_db()
    # 删除旧模板
    conn.execute(
        "DELETE FROM project_status_conditions WHERE project_id = 0 AND target_status = ?",
        [body.target_status]
    )
    # 插入新模板
    for item in body.conditions:
        conn.execute(
            "INSERT INTO project_status_conditions (project_id, target_status, condition_text, sort_order) VALUES (0, ?, ?, ?)",
            [body.target_status, item.condition_text, item.sort_order]
        )
    conn.commit()
    # 返回保存后的模板列表
    rows = conn.execute(
        "SELECT * FROM project_status_conditions WHERE project_id = 0 AND target_status = ? ORDER BY sort_order",
        [body.target_status]
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.put("/api/status-conditions/templates/{cid}")
def update_condition_template(cid: int, body: ConditionTemplateUpdateBody):
    """更新单条全局模板（condition_text, sort_order）"""
    conn = get_db()
    existing = conn.execute(
        "SELECT * FROM project_status_conditions WHERE id = ? AND project_id = 0",
        [cid]
    ).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(404, "模板不存在")

    updates = {}
    if body.condition_text is not None:
        updates['condition_text'] = body.condition_text
    if body.sort_order is not None:
        updates['sort_order'] = body.sort_order

    if updates:
        updates['updated_at'] = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        set_clause = ', '.join(f"{k} = ?" for k in updates)
        values = list(updates.values()) + [cid]
        conn.execute(f"UPDATE project_status_conditions SET {set_clause} WHERE id = ?", values)
        conn.commit()

    row = conn.execute("SELECT * FROM project_status_conditions WHERE id = ?", [cid]).fetchone()
    conn.close()
    return dict(row) if row else {}


@app.delete("/api/status-conditions/templates/{cid}")
def delete_condition_template(cid: int):
    """删除单条全局模板"""
    conn = get_db()
    existing = conn.execute(
        "SELECT * FROM project_status_conditions WHERE id = ? AND project_id = 0",
        [cid]
    ).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(404, "模板不存在")
    conn.execute("DELETE FROM project_status_conditions WHERE id = ?", [cid])
    conn.commit()
    conn.close()
    return {"ok": True}


@app.post("/api/projects/{pid}/apply-conditions-template")
def apply_conditions_template(pid: int, body: ApplyTemplateBody):
    """将全局模板（project_id=0）复制到指定项目"""
    conn = get_db()
    # 检查项目是否存在
    project = conn.execute("SELECT * FROM projects WHERE id = ?", [pid]).fetchone()
    if not project:
        conn.close()
        raise HTTPException(404, "项目不存在")
    # 删除该项目该目标状态的现有条件
    conn.execute(
        "DELETE FROM project_status_conditions WHERE project_id = ? AND target_status = ?",
        [pid, body.target_status]
    )
    # 从全局模板复制（project_id=0）
    templates = conn.execute(
        "SELECT * FROM project_status_conditions WHERE project_id = 0 AND target_status = ? ORDER BY sort_order",
        [body.target_status]
    ).fetchall()
    for tpl in templates:
        conn.execute(
            "INSERT INTO project_status_conditions (project_id, target_status, condition_text, is_met, sort_order) VALUES (?, ?, ?, 0, ?)",
            [pid, body.target_status, tpl['condition_text'], tpl['sort_order']]
        )
    conn.commit()
    # 返回复制后的条件列表
    rows = conn.execute(
        "SELECT * FROM project_status_conditions WHERE project_id = ? AND target_status = ? ORDER BY sort_order",
        [pid, body.target_status]
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# --- Trip Management (Financial Reimbursement) APIs ---

class TripCreate(BaseModel):
    code: str = ''
    project: str = ''
    location: str = ''
    start_time: str = ''
    end_time: str = ''
    total_amount: float = 0
    allowance: float = 0
    status: str = '未报销'
    year: int = 0
    remark: str = ''


class TripUpdate(BaseModel):
    code: Optional[str] = None
    project: Optional[str] = None
    location: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    total_amount: Optional[float] = None
    allowance: Optional[float] = None
    status: Optional[str] = None
    year: Optional[int] = None
    remark: Optional[str] = None


class TripExpenseCreate(BaseModel):
    trip_id: int
    category: str = ''
    amount: float = 0
    invoice_amount: float = 0
    invoice_count: int = 0
    tax_rate: str = ''
    start_time: str = ''
    end_time: str = ''
    location: str = ''
    from_place: str = ''
    to_place: str = ''
    description: str = ''
    fee_info: str = ''
    param: str = ''
    remark: str = ''


class TripExpenseUpdate(BaseModel):
    category: Optional[str] = None
    amount: Optional[float] = None
    invoice_amount: Optional[float] = None
    invoice_count: Optional[int] = None
    tax_rate: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    location: Optional[str] = None
    from_place: Optional[str] = None
    to_place: Optional[str] = None
    description: Optional[str] = None
    fee_info: Optional[str] = None
    param: Optional[str] = None
    remark: Optional[str] = None


@app.get("/api/trips")
def get_trips(year: int = 0, status: str = '', project: str = ''):
    conn = get_db()
    sql = "SELECT * FROM trips WHERE 1=1"
    params = []
    if year: sql += " AND year=?"; params.append(year)
    if status: sql += " AND status=?"; params.append(status)
    if project: sql += " AND project LIKE ?"; params.append(f'%{project}%')
    sql += " ORDER BY id DESC"
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    trips = [dict(r) for r in rows]
    return trips


@app.post("/api/trips")
def create_trip(body: TripCreate):
    conn = get_db()
    conn.execute('''INSERT INTO trips (code, project, location, start_time, end_time, total_amount, allowance, status, year, remark)
        VALUES (?,?,?,?,?,?,?,?,?,?)''',
        [body.code, body.project, body.location, body.start_time, body.end_time,
         body.total_amount, body.allowance, body.status, body.year, body.remark])
    conn.commit()
    row = conn.execute("SELECT * FROM trips ORDER BY id DESC LIMIT 1").fetchone()
    conn.close()
    return dict(row)


@app.put("/api/trips/{tid}")
def update_trip(tid: int, body: TripUpdate):
    conn = get_db()
    fields = body.model_dump(exclude_unset=True)
    if not fields:
        conn.close()
        raise HTTPException(400, "No fields to update")
    set_clause = ', '.join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [tid]
    conn.execute(f"UPDATE trips SET {set_clause} WHERE id = ?", values)
    conn.commit()
    row = conn.execute("SELECT * FROM trips WHERE id = ?", [tid]).fetchone()
    conn.close()
    return dict(row) if row else {}


@app.delete("/api/trips/{tid}")
def delete_trip(tid: int):
    conn = get_db()
    conn.execute("DELETE FROM trip_expenses WHERE trip_id = ?", [tid])
    conn.execute("DELETE FROM trips WHERE id = ?", [tid])
    conn.commit()
    conn.close()
    return {"ok": True}


@app.post("/api/trip-expenses")
def create_trip_expense(body: TripExpenseCreate):
    conn = get_db()
    # Auto-assign sort_order
    max_sort = conn.execute("SELECT COALESCE(MAX(sort_order), -1) FROM trip_expenses WHERE trip_id = ?", [body.trip_id]).fetchone()[0]
    conn.execute('''INSERT INTO trip_expenses (trip_id, category, amount, invoice_amount, invoice_count,
        tax_rate, start_time, end_time, location, from_place, to_place, description, fee_info, param, remark, sort_order)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
        [body.trip_id, body.category, body.amount, body.invoice_amount, body.invoice_count,
         body.tax_rate, body.start_time, body.end_time, body.location, body.from_place, body.to_place,
         body.description, body.fee_info, body.param, body.remark, max_sort + 1])
    conn.commit()
    # Recalculate trip total
    total = conn.execute("SELECT COALESCE(SUM(amount), 0) FROM trip_expenses WHERE trip_id = ?", [body.trip_id]).fetchone()[0]
    allowance = conn.execute("SELECT COALESCE(SUM(amount), 0) FROM trip_expenses WHERE trip_id = ? AND category = '出差补助'", [body.trip_id]).fetchone()[0]
    conn.execute("UPDATE trips SET total_amount = ?, allowance = ? WHERE id = ?", [total, allowance, body.trip_id])
    conn.commit()
    row = conn.execute("SELECT * FROM trip_expenses ORDER BY id DESC LIMIT 1").fetchone()
    conn.close()
    return dict(row)


@app.put("/api/trip-expenses/{eid}")
def update_trip_expense(eid: int, body: TripExpenseUpdate):
    conn = get_db()
    fields = body.model_dump(exclude_unset=True)
    if not fields:
        conn.close()
        raise HTTPException(400, "No fields to update")
    set_clause = ', '.join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [eid]
    conn.execute(f"UPDATE trip_expenses SET {set_clause} WHERE id = ?", values)
    conn.commit()
    # Recalculate trip total
    trip_id = conn.execute("SELECT trip_id FROM trip_expenses WHERE id = ?", [eid]).fetchone()
    if trip_id:
        tid = trip_id[0]
        total = conn.execute("SELECT COALESCE(SUM(amount), 0) FROM trip_expenses WHERE trip_id = ?", [tid]).fetchone()[0]
        allowance = conn.execute("SELECT COALESCE(SUM(amount), 0) FROM trip_expenses WHERE trip_id = ? AND category = '出差补助'", [tid]).fetchone()[0]
        conn.execute("UPDATE trips SET total_amount = ?, allowance = ? WHERE id = ?", [total, allowance, tid])
        conn.commit()
    row = conn.execute("SELECT * FROM trip_expenses WHERE id = ?", [eid]).fetchone()
    conn.close()
    return dict(row) if row else {}


@app.delete("/api/trip-expenses/{eid}")
def delete_trip_expense(eid: int):
    conn = get_db()
    trip_id = conn.execute("SELECT trip_id FROM trip_expenses WHERE id = ?", [eid]).fetchone()
    conn.execute("DELETE FROM trip_expenses WHERE id = ?", [eid])
    if trip_id:
        tid = trip_id[0]
        total = conn.execute("SELECT COALESCE(SUM(amount), 0) FROM trip_expenses WHERE trip_id = ?", [tid]).fetchone()[0]
        allowance = conn.execute("SELECT COALESCE(SUM(amount), 0) FROM trip_expenses WHERE trip_id = ? AND category = '出差补助'", [tid]).fetchone()[0]
        conn.execute("UPDATE trips SET total_amount = ?, allowance = ? WHERE id = ?", [total, allowance, tid])
    conn.commit()
    conn.close()
    return {"ok": True}


@app.get("/api/trips/stats")
def get_trip_stats(year: int = 0):
    conn = get_db()
    sql = "SELECT year, status, COUNT(*) as cnt, SUM(total_amount) as total, SUM(allowance) as allowance FROM trips"
    params = []
    if year: sql += " WHERE year=?"; params.append(year)
    sql += " GROUP BY year, status ORDER BY year DESC"
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/api/trips/{tid}")
def get_trip_detail(tid: int):
    conn = get_db()
    trip = conn.execute("SELECT * FROM trips WHERE id = ?", [tid]).fetchone()
    if not trip:
        conn.close()
        raise HTTPException(404, "Trip not found")
    expenses = conn.execute("SELECT * FROM trip_expenses WHERE trip_id = ? ORDER BY sort_order", [tid]).fetchall()
    conn.close()
    return {"trip": dict(trip), "expenses": [dict(e) for e in expenses]}


# --- Issue Records (problem/bug/best-practice tracking) ---

class IssueCreate(BaseModel):
    title: str
    type: str = 'bug'
    product_id: int = 0
    version: str = ''
    severity: str = '中'
    status: str = '未解决'
    description: str = ''
    solution: str = ''
    tags: str = ''


class IssueUpdate(BaseModel):
    title: Optional[str] = None
    type: Optional[str] = None
    product_id: Optional[int] = None
    version: Optional[str] = None
    severity: Optional[str] = None
    status: Optional[str] = None
    description: Optional[str] = None
    solution: Optional[str] = None
    tags: Optional[str] = None


@app.get("/api/issues")
def get_issues(type: str = '', status: str = '', product_id: int = 0, severity: str = ''):
    conn = get_db()
    sql = "SELECT i.*, p.name as product_name FROM issue_records i LEFT JOIN product_catalog p ON i.product_id = p.id WHERE 1=1"
    params = []
    if type: sql += " AND i.type=?"; params.append(type)
    if status: sql += " AND i.status=?"; params.append(status)
    if product_id: sql += " AND i.product_id=?"; params.append(product_id)
    if severity: sql += " AND i.severity=?"; params.append(severity)
    sql += " ORDER BY i.updated_at DESC"
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/api/issues/{iid}")
def get_issue(iid: int):
    conn = get_db()
    row = conn.execute("SELECT i.*, p.name as product_name FROM issue_records i LEFT JOIN product_catalog p ON i.product_id = p.id WHERE i.id = ?", [iid]).fetchone()
    conn.close()
    if not row: raise HTTPException(404, "Issue not found")
    return dict(row)


@app.post("/api/issues")
def create_issue(body: IssueCreate):
    conn = get_db()
    conn.execute('''INSERT INTO issue_records
        (title, type, product_id, version, severity, status, description, solution, tags)
        VALUES (?,?,?,?,?,?,?,?,?)''',
        [body.title, body.type, body.product_id, body.version, body.severity,
         body.status, body.description, body.solution, body.tags])
    conn.commit()
    row = conn.execute("SELECT i.*, p.name as product_name FROM issue_records i LEFT JOIN product_catalog p ON i.product_id = p.id ORDER BY i.id DESC LIMIT 1").fetchone()
    conn.close()
    return dict(row)


@app.put("/api/issues/{iid}")
def update_issue(iid: int, body: IssueUpdate):
    conn = get_db()
    fields = body.model_dump(exclude_unset=True)
    if not fields:
        conn.close()
        raise HTTPException(400, "No fields to update")
    fields['updated_at'] = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    set_clause = ', '.join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [iid]
    conn.execute(f"UPDATE issue_records SET {set_clause} WHERE id = ?", values)
    conn.commit()
    row = conn.execute("SELECT i.*, p.name as product_name FROM issue_records i LEFT JOIN product_catalog p ON i.product_id = p.id WHERE i.id = ?", [iid]).fetchone()
    conn.close()
    return dict(row) if row else {}


@app.delete("/api/issues/{iid}")
def delete_issue(iid: int):
    conn = get_db()
    conn.execute("DELETE FROM issue_records WHERE id = ?", [iid])
    conn.commit()
    conn.close()
    return {"ok": True}


# --- Sales APIs ---

@app.get("/api/sales")
def get_sales():
    conn = get_db()
    rows = conn.execute("SELECT * FROM sales ORDER BY name").fetchall()
    conn.close()
    return [dict(r) for r in rows]


class SaleCreate(BaseModel):
    name: str
    department: str = ''
    phone: str = ''
    notes: str = ''


@app.post("/api/sales")
def create_sale(body: SaleCreate):
    conn = get_db()
    try:
        conn.execute("INSERT INTO sales (name, department, phone, notes) VALUES (?,?,?,?)",
                     [body.name, body.department, body.phone, body.notes])
        conn.commit()
        row = conn.execute("SELECT * FROM sales WHERE name = ?", [body.name]).fetchone()
        conn.close()
        return dict(row)
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(400, "销售人员已存在")


class SaleUpdate(BaseModel):
    name: str = None
    department: str = None
    phone: str = None
    notes: str = None


@app.put("/api/sales/{sid}")
def update_sale(sid: int, body: SaleUpdate):
    conn = get_db()
    fields = {}
    if body.name is not None: fields['name'] = body.name
    if body.department is not None: fields['department'] = body.department
    if body.phone is not None: fields['phone'] = body.phone
    if body.notes is not None: fields['notes'] = body.notes
    if not fields:
        conn.close()
        raise HTTPException(400, "No fields to update")
    set_clause = ', '.join(f"{k} = ?" for k in fields)
    conn.execute(f"UPDATE sales SET {set_clause} WHERE id = ?", list(fields.values()) + [sid])
    conn.commit()
    row = conn.execute("SELECT * FROM sales WHERE id = ?", [sid]).fetchone()
    conn.close()
    return dict(row) if row else {}


@app.delete("/api/sales/{sid}")
def delete_sale(sid: int):
    conn = get_db()
    conn.execute("DELETE FROM sales WHERE id = ?", [sid])
    conn.commit()
    conn.close()
    return {"ok": True}


@app.get("/api/sales/stats")
def get_sales_stats():
    conn = get_db()
    rows = conn.execute("""
        SELECT s.id, s.name, s.department, s.phone,
               COUNT(p.id) as project_count,
               GROUP_CONCAT(p.name, '||') as project_names
        FROM sales s
        LEFT JOIN projects p ON p.sales_person = s.name
        GROUP BY s.id
        ORDER BY project_count DESC, s.name
    """).fetchall()
    conn.close()
    results = []
    for r in rows:
        d = dict(r)
        d['project_list'] = d['project_names'].split('||') if d['project_names'] else []
        del d['project_names']
        results.append(d)
    return results


# --- AI Analysis APIs ---

class AIAnalyzeRequest(BaseModel):
    mode: str
    project: str = ''
    date_from: str = ''
    date_to: str = ''
    question: str = ''
    profile_id: int = 0
    custom_prompt: str = ''


class AIProfile(BaseModel):
    name: str
    endpoint: str
    api_key: str = ''
    model: str = 'deepseek-chat'


class IdBody(BaseModel):
    pid: int = 0


class ClassifyBody(BaseModel):
    content: str
    profile_id: int = 0


# --- Profile CRUD ---

@app.get("/api/ai/profiles")
def list_profiles():
    conn = get_db()
    rows = conn.execute("SELECT * FROM llm_profiles ORDER BY id").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/ai/profiles")
def create_profile(p: AIProfile):
    conn = get_db()
    conn.execute("INSERT INTO llm_profiles (name, endpoint, api_key, model) VALUES (?,?,?,?)",
                 [p.name, p.endpoint, p.api_key, p.model])
    conn.commit()
    row = conn.execute("SELECT * FROM llm_profiles WHERE rowid=last_insert_rowid()").fetchone()
    conn.close()
    return dict(row)


@app.put("/api/ai/profiles/{pid}")
def update_profile(pid: int, p: AIProfile):
    conn = get_db()
    conn.execute("UPDATE llm_profiles SET name=?, endpoint=?, api_key=?, model=? WHERE id=?",
                 [p.name, p.endpoint, p.api_key, p.model, pid])
    conn.commit()
    row = conn.execute("SELECT * FROM llm_profiles WHERE id=?", [pid]).fetchone()
    conn.close()
    return dict(row) if row else {}


@app.delete("/api/ai/profiles/{pid}")
def delete_profile(pid: int):
    conn = get_db()
    conn.execute("DELETE FROM llm_profiles WHERE id=?", [pid])
    conn.commit()
    conn.close()
    return {"ok": True}


@app.post("/api/ai/profiles/{pid}/set-default")
def set_default_profile(pid: int):
    conn = get_db()
    conn.execute("UPDATE llm_profiles SET is_default=0")
    conn.execute("UPDATE llm_profiles SET is_default=1 WHERE id=?", [pid])
    conn.commit()
    conn.close()
    return {"ok": True}


@app.get("/api/ai/profiles/default")
def get_default_profile():
    conn = get_db()
    row = conn.execute("SELECT * FROM llm_profiles WHERE is_default=1 LIMIT 1").fetchone()
    if not row:
        row = conn.execute("SELECT * FROM llm_profiles ORDER BY id LIMIT 1").fetchone()
    conn.close()
    return dict(row) if row else {}


class TestConnBody(BaseModel):
    endpoint: str = ''
    api_key: str = ''
    model: str = ''
    pid: int = 0


class ListModelsBody(BaseModel):
    endpoint: str = ''
    api_key: str = ''


@app.post("/api/ai/test-connection")
def test_connection(body: TestConnBody):
    # Support direct form values {endpoint, api_key, model} or {pid}
    endpoint = body.endpoint
    api_key = body.api_key
    model = body.model
    pid = body.pid

    if pid:
        conn = get_db()
        row = conn.execute("SELECT * FROM llm_profiles WHERE id=?", [pid]).fetchone()
        conn.close()
        if not row:
            raise HTTPException(404, "模型配置不存在")
        endpoint = row['endpoint']
        api_key = row['api_key']
        model = row['model']

    if not endpoint:
        raise HTTPException(400, "缺少API端点")

    try:
        req_body = json_lib.dumps({
            "model": model,
            "messages": [{"role": "user", "content": "hi"}],
            "max_tokens": 10,
        }).encode('utf-8')
        req = Request(endpoint, data=req_body,
                      headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"}, method="POST")
        resp = urlopen(req, timeout=15)
        result = json_lib.loads(resp.read())
        if result.get("choices"):
            return {"ok": True, "message": f"连接成功！模型 {model} 响应正常"}
        err = result.get("error", {}).get("message", str(result)[:200])
        return {"ok": False, "message": f"连接成功但返回错误: {err}"}
    except URLError as e:
        raise HTTPException(500, f"无法连接: {e.reason}")
    except Exception as e:
        raise HTTPException(500, f"测试失败: {str(e)[:200]}")


@app.post("/api/ai/list-models")
def list_models(body: ListModelsBody):
    endpoint = body.endpoint
    api_key = body.api_key
    if not endpoint:
        raise HTTPException(400, "缺少API端点")

    try:
        models_url = endpoint.rstrip('/') + '/models'
        req = Request(models_url, headers={"Authorization": f"Bearer {api_key}"}, method="GET")
        resp = urlopen(req, timeout=10)
        data = json_lib.loads(resp.read())
        models = data.get('data', [])
        if models and isinstance(models, list):
            return {"ok": True, "models": [{"id": m.get('id', str(m))} for m in models]}
    except:
        pass

    return {"ok": False, "message": "无法获取模型列表，请手动输入"}  


@app.post("/api/ai/auto-classify")
def auto_classify(body: ClassifyBody):
    content = body.content.strip()
    profile_id = body.profile_id
    if not content:
        raise HTTPException(400, "请输入工作内容")
    if not profile_id:
        raise HTTPException(400, "请指定模型")

    conn = get_db()
    row = conn.execute("SELECT * FROM llm_profiles WHERE id=?", [profile_id]).fetchone()
    if not row:
        conn.close()
        raise HTTPException(400, "模型配置不存在")

    # Collect dict options with descriptions (Chinese category names after normalization)
    cats = {'环境': 'env', '阶段': 'stage', '方式': 'method', '状态': 'status',
            '重要': 'importance', '紧急': 'urgency', '难易': 'difficulty', 'BSC': 'bsc'}
    dict_options = {}
    for cn_name, key in cats.items():
        vals = conn.execute("SELECT value, description FROM dictionaries WHERE category=? ORDER BY sort_order", [cn_name]).fetchall()
        if vals:
            # Format as "value（说明）" if description exists, else just "value"
            dict_options[key] = [f"{v['value']}（{v['description']}）" if v['description'] else v['value'] for v in vals]
        else:
            dict_options[key] = []

    # Collect product catalog options (L1/L2/L3) — include descriptions
    prod_l1 = conn.execute("SELECT name, description FROM product_catalog WHERE level=1 ORDER BY id").fetchall()
    prod_l2 = conn.execute("SELECT name, description FROM product_catalog WHERE level=2 ORDER BY id").fetchall()
    prod_l3 = conn.execute("SELECT name, description FROM product_catalog WHERE level=3 ORDER BY id").fetchall()

    # Collect service catalog options (L1/L2/L3)
    svc_l1 = conn.execute("SELECT name, description FROM service_catalog WHERE level=1 ORDER BY id").fetchall()
    svc_l2 = conn.execute("SELECT name, description FROM service_catalog WHERE level=2 ORDER BY id").fetchall()
    svc_l3 = conn.execute("SELECT name, description FROM service_catalog WHERE level=3 ORDER BY id").fetchall()

    conn.close()

    options_str = "\n".join(f"- {k}: {', '.join(v)}" for k, v in dict_options.items() if v)
    def _fmt(items):
        return ', '.join(f"{i['name']}（{i['description']}）" if i['description'] else i['name'] for i in items)

    prod_str = f"\n产品目录：\n- 产品Ⅰ（大类）: {_fmt(prod_l1)}\n- 产品Ⅱ（系列）: {_fmt(prod_l2)}\n- 产品Ⅲ（版本）: {_fmt(prod_l3)}"
    svc_str = f"\n服务目录：\n- 服务Ⅰ（大类）: {_fmt(svc_l1)}\n- 服务Ⅱ（分类）: {_fmt(svc_l2)}\n- 服务Ⅲ（子项）: {_fmt(svc_l3)}"

    prompt = f"""根据工作内容，从每个分类中选择最合适的值，只返回 JSON。如果工作内容中提到了具体的产品名称/版本或服务类型，请优先匹配；如果无法确定，选择最合理的默认值。

分类选项：
{options_str}
{prod_str}
{svc_str}

工作内容：{content}

返回格式（严格JSON，所有字段必须有值，不确定的用空字符串）：
{{"env":"?","stage":"?","product1":"?","product2":"?","product3":"?","service1":"?","service2":"?","service3":"?","method":"?","bsc":"?","importance":"?","urgency":"?","difficulty":"?"}}"""

    try:
        req_body = json_lib.dumps({
            "model": row['model'],
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0,
            "max_tokens": 800,
            "thinking": {"type": "disabled"},   # Prevent think tags from reasoning models
        }).encode('utf-8')
        llm_req = Request(row['endpoint'], data=req_body,
                          headers={"Content-Type": "application/json", "Authorization": f"Bearer {row['api_key']}"}, method="POST")
        resp = urlopen(llm_req, timeout=30)
        result = json_lib.loads(resp.read())
        text = result.get("choices", [{}])[0].get("message", {}).get("content", "")
        # Robust JSON extraction from LLM response
        import re
        text = text.strip()
        # Strip thinking tags (used by reasoning models like deepseek-r1, MiniMax-M3)
        text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL)
        # Remove markdown code fences if present
        text = re.sub(r'^```(?:json)?\s*\n?', '', text)
        text = re.sub(r'\n?```\s*$', '', text)
        # Find JSON object boundaries
        start = text.find('{')
        end = text.rfind('}')
        if start >= 0 and end > start:
            json_str = text[start:end+1]
            try:
                classified = json_lib.loads(json_str)
                return {"ok": True, "classified": classified}
            except json_lib.JSONDecodeError:
                # Try fixing common LLM JSON issues: trailing commas, unquoted keys
                json_str = re.sub(r',\s*}', '}', json_str)
                json_str = re.sub(r',\s*]', ']', json_str)
                try:
                    classified = json_lib.loads(json_str)
                    return {"ok": True, "classified": classified}
                except json_lib.JSONDecodeError:
                    pass
        # Handle truncated JSON: try to auto-complete it
        if start >= 0 and end < start:
            json_str = text[start:] + '"}'
            # Close any unclosed string values
            depth = 0
            in_str = False
            fixed = ''
            for ch in json_str:
                if ch == '"' and (not fixed or fixed[-1] != '\\'):
                    in_str = not in_str
                if not in_str:
                    if ch == '{': depth += 1
                    elif ch == '}': depth -= 1
                fixed += ch
            while depth > 0:
                fixed += '}'
                depth -= 1
            try:
                classified = json_lib.loads(fixed)
                return {"ok": True, "classified": classified}
            except:
                pass
        return {"ok": False, "message": f"无法解析分类结果，LLM返回: {text[:200]}"}
    except Exception as e:
        raise HTTPException(500, f"智能分类失败: {str(e)[:200]}")


@app.post("/api/ai/auto-verify")
def auto_verify(body: ClassifyBody):
    """
    AI-powered content completeness verification.
    Analyzes work content and returns suggestions about missing/incomplete information.
    """
    content = body.content.strip()
    profile_id = body.profile_id
    if not content:
        raise HTTPException(400, "请输入工作内容")
    if not profile_id:
        raise HTTPException(400, "请指定模型")

    conn = get_db()
    row = conn.execute("SELECT * FROM llm_profiles WHERE id=?", [profile_id]).fetchone()
    conn.close()
    if not row:
        raise HTTPException(400, "模型配置不存在")

    prompt = f"""你是一个工作记录质量审查专家。请分析以下工作内容，找出信息不完整、不明确或缺失的地方，并用质疑的语气提出问题建议。

审查要点（请逐条检查）：
1. **人员信息完整性**：如果提到了人名（如"张工""李明""王经理"等），是否提供了其单位、职位或角色？如果缺少，请质疑。
2. **数量/规模信息**：如果提到了数据库迁移、表结构变更、脚本修改、可编程对象（存储过程、函数、触发器、视图等）等操作，是否提供了具体数量？如"迁移了20个存储过程"就应该质疑是否只有20个，若只说"迁移了存储过程"则缺少数量。
3. **问题描述**：如果提到了"问题""故障""异常""bug"等，是否具体描述了问题现象、原因或影响？如果笼统带过，请质疑。
4. **操作细节**：是否缺少操作的关键细节（如时间、操作对象、操作步骤、涉及范围等）？
5. **结果/效果**：是否说明了工作的结果或产出？如果只说做了什么但没说结果，请质疑。
6. **连贯性/逻辑**：描述是否有前后矛盾或逻辑不通之处？
7. **其他明显缺失**：任何其他导致记录不完整、难以理解的问题。

工作内容：
{content}

请逐条输出质疑结果。如果某项没问题，不输出该条。每一条的格式要求：
- issue: 问题的简短描述（必填）
- suggestion: 改进建议（必填）
- severity: 严重程度，"warning"（建议修改）或 "suggestion"（建议补充）之一（必填）

返回格式（严格 JSON）：
{{"questions": [{{"issue": "提到"王工"但没有说明其单位/职位", "suggestion": "请补充王工的单位和职位信息", "severity": "warning"}}]}}

如果没有发现任何问题，返回：{{"questions": []}}"""

    try:
        req_body = json_lib.dumps({
            "model": row['model'],
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0,
            "max_tokens": 2000,
            "thinking": {"type": "disabled"},
        }).encode('utf-8')
        llm_req = Request(row['endpoint'], data=req_body,
                          headers={"Content-Type": "application/json", "Authorization": f"Bearer {row['api_key']}"}, method="POST")
        resp = urlopen(llm_req, timeout=30)
        result = json_lib.loads(resp.read())
        text = result.get("choices", [{}])[0].get("message", {}).get("content", "")

        import re
        text = text.strip()
        # Strip thinking tags
        text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL)
        # Remove markdown code fences
        text = re.sub(r'^```(?:json)?\s*\n?', '', text)
        text = re.sub(r'\n?```\s*$', '', text)
        # Find JSON object
        start = text.find('{')
        end = text.rfind('}')
        if start >= 0 and end > start:
            json_str = text[start:end+1]
            try:
                data = json_lib.loads(json_str)
                questions = data.get("questions", [])
                if not isinstance(questions, list):
                    questions = []
                return {"ok": True, "questions": questions, "count": len(questions)}
            except json_lib.JSONDecodeError:
                json_str = re.sub(r',\s*}', '}', json_str)
                json_str = re.sub(r',\s*]', ']', json_str)
                try:
                    data = json_lib.loads(json_str)
                    questions = data.get("questions", [])
                    if not isinstance(questions, list):
                        questions = []
                    return {"ok": True, "questions": questions, "count": len(questions)}
                except json_lib.JSONDecodeError:
                    pass
        return {"ok": False, "message": f"无法解析分析结果: {text[:300]}"}
    except Exception as e:
        raise HTTPException(500, f"质疑分析失败: {str(e)[:200]}")

# --- Analysis ---

@app.post("/api/ai/analyze")
def ai_analyze(req: AIAnalyzeRequest):
    conn = get_db()
    # Get LLM profile
    if req.profile_id:
        row = conn.execute("SELECT * FROM llm_profiles WHERE id=?", [req.profile_id]).fetchone()
    else:
        row = conn.execute("SELECT * FROM llm_profiles ORDER BY id LIMIT 1").fetchone()
    if not row:
        conn.close()
        raise HTTPException(400, "请先配置至少一个 LLM 模型")
    endpoint, api_key, model = row['endpoint'], row['api_key'], row['model']

    context = _build_analysis_context(conn, req)
    conn.close()

    user_message = f"{_build_system_prompt(req.mode)}\n\n## 数据库上下文\n{context}\n\n"
    if req.question:
        user_message += f"## 用户问题\n{req.question}\n\n"
    if req.custom_prompt:
        user_message += f"## 自定义要求\n{req.custom_prompt}\n"

    try:
        body = json_lib.dumps({
            "model": model,
            "messages": [
                {"role": "system", "content": "你是一个数据库技术支持分析助手。基于提供的数据进行专业分析。使用中文回复。"},
                {"role": "user", "content": user_message}
            ],
            "temperature": 0.7, "max_tokens": 2000,
        }).encode('utf-8')
        llm_req = Request(endpoint, data=body, headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"}, method="POST")
        resp = urlopen(llm_req, timeout=60)
        result = json_lib.loads(resp.read())
        reply = result.get("choices", [{}])[0].get("message", {}).get("content", "")
        if not reply:
            err = result.get("error", {}).get("message", "")
            if err: raise HTTPException(500, f"LLM 返回错误: {err}")
            reply = str(result)
        return {"ok": True, "reply": reply}
    except URLError as e:
        raise HTTPException(500, f"无法连接到 {row['name']} ({endpoint}): {e.reason}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"AI 分析失败: {str(e)[:300]}")


def _build_analysis_context(conn, req: AIAnalyzeRequest) -> str:
    """Build a text context summary from the database based on request parameters."""
    sql = "SELECT * FROM work_records WHERE 1=1"
    params = []
    if req.project:
        sql += " AND project = ?"
        params.append(req.project)
    if req.date_from:
        sql += " AND date >= ?"
        params.append(req.date_from)
    if req.date_to:
        sql += " AND date <= ?"
        params.append(req.date_to)
    sql += " ORDER BY date DESC LIMIT 200"
    rows = conn.execute(sql, params).fetchall()

    if not rows:
        return "暂无匹配的工作记录。"

    projects = {}
    for r in rows:
        p = r['project']
        if p not in projects:
            projects[p] = {'total_hours': 0, 'records': [], 'bsc': set(), 'statuses': set()}
        projects[p]['total_hours'] += r['hours'] or 0
        projects[p]['records'].append(f"- {r['date']} [{r['status']}] {r['hours']}h: {r['content'][:100]}")
        if r['bsc'] and r['bsc'] != '常规':
            projects[p]['bsc'].add(r['bsc'])
        projects[p]['statuses'].add(r['status'])

    ctx = f"共 {len(rows)} 条记录，{len(projects)} 个项目。\n\n"
    for pname, pinfo in projects.items():
        ctx += f"### {pname}\n"
        ctx += f"- 总工时: {pinfo['total_hours']:.1f}h\n"
        if pinfo['bsc']:
            ctx += f"- BSC: {', '.join(pinfo['bsc'])}\n"
        ctx += f"- 状态: {', '.join(pinfo['statuses'])}\n"
        ctx += f"- 最近记录:\n" + "\n".join(pinfo['records'][:10]) + "\n\n"
    return ctx


def _build_system_prompt(mode: str) -> str:
    prompts = {
        "project_summary": """请对以下项目的工作记录进行专业分析，输出：
1. **项目概况**：项目名称、总工时、时间跨度
2. **工作重点**：有哪些核心工作模块，各占多少工时比例
3. **进展评估**：当前状态评估，完成的里程碑
4. **风险与问题**：识别出现的重复性问题或潜在风险
5. **下一步建议**：建议的后续重点工作""",
        "issue_analysis": """请分析以下工作记录中的问题模式，输出：
1. **问题分类**：将问题按类型归类（性能、兼容性、迁移、配置等）
2. **高频问题**：出现频率最高的问题及原因分析
3. **解决方案总结**：有效的解决方案和最佳实践
4. **预防建议**：如何避免类似问题""",
        "free_question": "请基于提供的数据库上下文，回答用户的问题。如果问题超出数据范围，诚实说明。",
    }
    return prompts.get(mode, prompts["free_question"])


# --- Frontend SPA serving ---
# Mount assets directory for static files (JS, CSS, etc.)
if (Path(__file__).parent / "dist" / "assets").exists():
    app.mount("/assets", StaticFiles(directory="dist/assets"), name="static_assets")


# --- Personas APIs ---

class PersonaCreate(BaseModel):
    project_name: str
    business_profile: str = ''
    technical_profile: str = ''
    pain_points: str = ''
    key_personnel: str = ''
    expectations: str = ''
    notes: str = ''


@app.get("/api/personas")
def get_personas(project_name: str = ''):
    conn = get_db()
    if project_name:
        rows = conn.execute("SELECT * FROM personas WHERE project_name = ? ORDER BY id", [project_name]).fetchall()
    else:
        rows = conn.execute("SELECT * FROM personas ORDER BY project_name, id").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/personas")
def create_persona(body: PersonaCreate):
    conn = get_db()
    conn.execute("""INSERT INTO personas (project_name, business_profile, technical_profile, pain_points, key_personnel, expectations, notes)
        VALUES (?,?,?,?,?,?,?)""",
        [body.project_name, body.business_profile, body.technical_profile, body.pain_points,
         body.key_personnel, body.expectations, body.notes])
    conn.commit()
    row = conn.execute("SELECT * FROM personas WHERE rowid=last_insert_rowid()").fetchone()
    conn.close()
    return dict(row)


@app.put("/api/personas/{pid}")
def update_persona(pid: int, body: PersonaCreate):
    conn = get_db()
    conn.execute("""UPDATE personas SET project_name=?, business_profile=?, technical_profile=?, pain_points=?,
        key_personnel=?, expectations=?, notes=?, updated_at=datetime('now','localtime') WHERE id=?""",
        [body.project_name, body.business_profile, body.technical_profile, body.pain_points,
         body.key_personnel, body.expectations, body.notes, pid])
    conn.commit()
    row = conn.execute("SELECT * FROM personas WHERE id=?", [pid]).fetchone()
    conn.close()
    return dict(row) if row else {}


@app.delete("/api/personas/{pid}")
def delete_persona(pid: int):
    conn = get_db()
    conn.execute("DELETE FROM personas WHERE id=?", [pid])
    conn.commit()
    conn.close()
    return {"ok": True}


# --- Risk Management APIs ---

class RiskCreate(BaseModel):
    project_name: str
    risk_type: str = '技术风险'
    risk_level: str = '中'
    description: str = ''
    impact: str = ''
    mitigation: str = ''
    status: str = '待处理'
    owner: str = ''


@app.get("/api/risks")
def get_risks(project_name: str = ''):
    conn = get_db()
    if project_name:
        rows = conn.execute("SELECT * FROM risks WHERE project_name = ? ORDER BY id", [project_name]).fetchall()
    else:
        rows = conn.execute("SELECT * FROM risks ORDER BY project_name, id").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/risks")
def create_risk(body: RiskCreate):
    conn = get_db()
    conn.execute("""INSERT INTO risks (project_name, risk_type, risk_level, description, impact, mitigation, status, owner)
        VALUES (?,?,?,?,?,?,?,?)""",
        [body.project_name, body.risk_type, body.risk_level, body.description,
         body.impact, body.mitigation, body.status, body.owner])
    conn.commit()
    row = conn.execute("SELECT * FROM risks WHERE rowid=last_insert_rowid()").fetchone()
    conn.close()
    return dict(row)


@app.put("/api/risks/{rid}")
def update_risk(rid: int, body: RiskCreate):
    conn = get_db()
    conn.execute("""UPDATE risks SET project_name=?, risk_type=?, risk_level=?, description=?,
        impact=?, mitigation=?, status=?, owner=?, updated_at=datetime('now','localtime') WHERE id=?""",
        [body.project_name, body.risk_type, body.risk_level, body.description,
         body.impact, body.mitigation, body.status, body.owner, rid])
    conn.commit()
    row = conn.execute("SELECT * FROM risks WHERE id=?", [rid]).fetchone()
    conn.close()
    return dict(row) if row else {}


@app.delete("/api/risks/{rid}")
def delete_risk(rid: int):
    conn = get_db()
    conn.execute("DELETE FROM risks WHERE id=?", [rid])
    conn.commit()
    conn.close()
    return {"ok": True}


# --- Server Management APIs ---

@app.get("/api/servers")
def get_servers(project_name: str = ''):
    conn = get_db()
    if project_name:
        rows = conn.execute("SELECT * FROM servers WHERE project_name = ? ORDER BY resource_id", [project_name]).fetchall()
    else:
        rows = conn.execute("SELECT * FROM servers ORDER BY project_name, resource_id").fetchall()
    # Attach disks to each server
    result = []
    for r in rows:
        srv = dict(r)
        disks = conn.execute("SELECT * FROM server_disks WHERE server_id = ?", [srv['id']]).fetchall()
        srv['disks'] = [dict(d) for d in disks]
        result.append(srv)
    conn.close()
    return result


class ServerCreate(BaseModel):
    project_name: str
    resource_id: str = ''
    node_name: str = ''
    eu: str = ''; isv: str = ''; purpose: str = ''; deploy_arch: str = ''
    master_slave: str = ''; install_date: str = ''; dbid: str = ''
    server_vendor: str = ''; vm_vendor: str = ''; cloud_vendor: str = ''
    nic_name: str = ''; ip: str = ''; mac: str = ''; nic_uuid: str = ''
    fip: str = ''; vip: str = ''; eip: str = ''
    cpu_vendor: str = ''; cpu_model: str = ''; cpu_arch: str = ''
    logical_cpus: str = ''; threads_per_core: str = ''; physical_cores: str = ''
    sockets: str = ''; numa_nodes: str = ''; max_freq: str = ''; min_freq: str = ''
    l1d: str = ''; l1i: str = ''; l2: str = ''; l3: str = ''
    byte_order: str = ''; virtualization: str = ''; hypervisor_vendor: str = ''; virtualization_type: str = ''
    memory_total: str = ''; memory_avail: str = ''; swap: str = ''
    os_version: str = ''; os_id: str = ''; hostname: str = ''; os_user: str = ''; os_password: str = ''; locale: str = ''
    db_version: str = ''; license_expiry: str = ''; extensions: str = ''
    ha_type: str = ''; ha_scope: str = ''; ha_last_tl: str = ''; read_write_split: str = ''; ha_port: str = ''
    backup_time: str = ''; backup_retention: str = ''; backup_script: str = ''
    max_connections: str = ''; shared_buffer: str = ''; effective_cache_size: str = ''
    maintenance_work_mem: str = ''; checkpoint_completion_target: str = ''; wal_buffers: str = ''
    default_statistics_target: str = ''; random_page_cost: str = ''; effective_io_concurrency: str = ''
    work_mem: str = ''; huge_pages: str = ''; min_wal_size: str = ''; max_wal_size: str = ''
    max_worker_processes: str = ''; max_parallel_workers_per_gather: str = ''
    max_parallel_workers: str = ''; max_parallel_maintenance_workers: str = ''
    install_package: str = ''


@app.post("/api/servers")
def create_server(body: ServerCreate):
    conn = get_db()
    cols = [k for k in ServerCreate.__fields__ if k != 'disks']
    vals = [getattr(body, k, '') for k in cols]
    placeholders = ','.join('?' * len(cols))
    sql = f"INSERT INTO servers ({','.join(cols)}) VALUES ({placeholders})"
    conn.execute(sql, vals)
    conn.commit()
    row = conn.execute("SELECT * FROM servers WHERE rowid=last_insert_rowid()").fetchone()
    conn.close()
    return dict(row) if row else {}


@app.put("/api/servers/{sid}")
def update_server(sid: int, body: ServerCreate):
    conn = get_db()
    cols = [k for k in ServerCreate.__fields__ if k != 'disks']
    vals = [getattr(body, k, '') for k in cols] + [sid]
    sets = ','.join(f"{c}=?" for c in cols)
    conn.execute(f"UPDATE servers SET {sets}, updated_at=datetime('now','localtime') WHERE id=?", vals)
    conn.commit()
    row = conn.execute("SELECT * FROM servers WHERE id=?", [sid]).fetchone()
    conn.close()
    return dict(row) if row else {}


@app.delete("/api/servers/{sid}")
def delete_server(sid: int):
    conn = get_db()
    conn.execute("DELETE FROM server_disks WHERE server_id=?", [sid])
    conn.execute("DELETE FROM servers WHERE id=?", [sid])
    conn.commit()
    conn.close()
    return {"ok": True}


class DiskCreate(BaseModel):
    server_id: int
    disk_purpose: str = ''; device: str = ''; disk_type: str = ''; lvm: str = ''
    logical_volume: str = ''; filesystem: str = ''; size: str = ''; mount_point: str = ''
    disk_uuid: str = ''; data_dir: str = ''
    disk_write_3k: str = ''; random_read_3k: str = ''; large_write_8m: str = ''
    seq_read: str = ''; seq_write: str = ''
    pgbench_latency: str = ''; pgbench_with_conn: str = ''; pgbench_without_conn: str = ''
    pgbench200_latency: str = ''; pgbench200_with_conn: str = ''; pgbench200_without_conn: str = ''


@app.post("/api/server-disks")
def create_disk(body: DiskCreate):
    conn = get_db()
    cols = list(DiskCreate.__fields__.keys())
    vals = [getattr(body, k, '') for k in cols]
    placeholders = ','.join('?' * len(cols))
    sql = f"INSERT INTO server_disks ({','.join(cols)}) VALUES ({placeholders})"
    conn.execute(sql, vals)
    conn.commit()
    row = conn.execute("SELECT * FROM server_disks WHERE rowid=last_insert_rowid()").fetchone()
    conn.close()
    return dict(row) if row else {}


@app.put("/api/server-disks/{did}")
def update_disk(did: int, body: DiskCreate):
    conn = get_db()
    cols = list(DiskCreate.__fields__.keys())
    vals = [getattr(body, k, '') for k in cols] + [did]
    sets = ','.join(f"{c}=?" for c in cols)
    conn.execute(f"UPDATE server_disks SET {sets} WHERE id=?", vals)
    conn.commit()
    row = conn.execute("SELECT * FROM server_disks WHERE id=?", [did]).fetchone()
    conn.close()
    return dict(row) if row else {}


@app.delete("/api/server-disks/{did}")
def delete_disk(did: int):
    conn = get_db()
    conn.execute("DELETE FROM server_disks WHERE id=?", [did])
    conn.commit()
    conn.close()
    return {"ok": True}


# --- Priority Criteria APIs ---

class CriteriaCreate(BaseModel):
    reference_no: int = 0
    name: str
    options: str = ''
    important: str = ''
    not_important: str = ''
    urgent: str = ''
    not_urgent: str = ''
    sort_order: int = 0


@app.get("/api/priority-criteria")
def get_priority_criteria():
    conn = get_db()
    rows = conn.execute("SELECT * FROM priority_criteria ORDER BY sort_order, reference_no").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/priority-criteria")
def create_criteria(body: CriteriaCreate):
    conn = get_db()
    conn.execute("""INSERT INTO priority_criteria (reference_no, name, options, important, not_important, urgent, not_urgent, sort_order)
        VALUES (?,?,?,?,?,?,?,?)""",
        [body.reference_no, body.name, body.options, body.important, body.not_important, body.urgent, body.not_urgent, body.sort_order])
    conn.commit()
    row = conn.execute("SELECT * FROM priority_criteria WHERE rowid=last_insert_rowid()").fetchone()
    conn.close()
    return dict(row)


@app.put("/api/priority-criteria/{cid}")
def update_criteria(cid: int, body: CriteriaCreate):
    conn = get_db()
    conn.execute("""UPDATE priority_criteria SET reference_no=?, name=?, options=?, important=?, not_important=?, urgent=?, not_urgent=?, sort_order=?
        WHERE id=?""",
        [body.reference_no, body.name, body.options, body.important, body.not_important, body.urgent, body.not_urgent, body.sort_order, cid])
    conn.commit()
    row = conn.execute("SELECT * FROM priority_criteria WHERE id=?", [cid]).fetchone()
    conn.close()
    return dict(row) if row else {}


@app.delete("/api/priority-criteria/{cid}")
def delete_criteria(cid: int):
    conn = get_db()
    conn.execute("DELETE FROM priority_criteria WHERE id=?", [cid])
    conn.commit()
    conn.close()
    return {"ok": True}


# --- Typical Issues APIs ---

class IssueCreate(BaseModel):
    reference_no: int = 0
    title: str
    product1: str = ''; product2: str = ''; scenario: str = ''; impact: str = ''
    found_by: str = ''; category: str = ''
    service1: str = ''; service2: str = ''; service3: str = ''
    sort_order: int = 0


@app.get("/api/typical-issues")
def get_typical_issues():
    conn = get_db()
    rows = conn.execute("SELECT * FROM typical_issues ORDER BY sort_order, reference_no").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/typical-issues")
def create_issue(body: IssueCreate):
    conn = get_db()
    conn.execute("""INSERT INTO typical_issues (reference_no, title, product1, product2, scenario, impact, found_by, category, service1, service2, service3, sort_order)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
        [body.reference_no, body.title, body.product1, body.product2, body.scenario, body.impact,
         body.found_by, body.category, body.service1, body.service2, body.service3, body.sort_order])
    conn.commit()
    row = conn.execute("SELECT * FROM typical_issues WHERE rowid=last_insert_rowid()").fetchone()
    conn.close()
    return dict(row)


@app.put("/api/typical-issues/{iid}")
def update_issue(iid: int, body: IssueCreate):
    conn = get_db()
    conn.execute("""UPDATE typical_issues SET reference_no=?, title=?, product1=?, product2=?, scenario=?, impact=?,
        found_by=?, category=?, service1=?, service2=?, service3=?, sort_order=? WHERE id=?""",
        [body.reference_no, body.title, body.product1, body.product2, body.scenario, body.impact,
         body.found_by, body.category, body.service1, body.service2, body.service3, body.sort_order, iid])
    conn.commit()
    row = conn.execute("SELECT * FROM typical_issues WHERE id=?", [iid]).fetchone()
    conn.close()
    return dict(row) if row else {}


@app.delete("/api/typical-issues/{iid}")
def delete_issue(iid: int):
    conn = get_db()
    conn.execute("DELETE FROM typical_issues WHERE id=?", [iid])
    conn.commit()
    conn.close()
    return {"ok": True}


# --- Script Templates (话术库) APIs ---

class ScriptCreate(BaseModel):
    script: str
    description: str = ''
    category: str = ''
    sort_order: int = 0


class ScriptUpdate(BaseModel):
    script: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    sort_order: Optional[int] = None


@app.get("/api/scripts")
def get_scripts(category: str = ''):
    conn = get_db()
    sql = "SELECT * FROM script_templates WHERE 1=1"
    params = []
    if category: sql += " AND category=?"; params.append(category)
    sql += " ORDER BY sort_order, id"
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/scripts")
def create_script(body: ScriptCreate):
    conn = get_db()
    conn.execute("INSERT INTO script_templates (script, description, category, sort_order) VALUES (?,?,?,?)",
                 [body.script, body.description, body.category, body.sort_order])
    conn.commit()
    row = conn.execute("SELECT * FROM script_templates ORDER BY id DESC LIMIT 1").fetchone()
    conn.close()
    return dict(row)


@app.put("/api/scripts/{sid}")
def update_script(sid: int, body: ScriptUpdate):
    conn = get_db()
    fields = body.model_dump(exclude_unset=True)
    if not fields:
        conn.close()
        raise HTTPException(400, "No fields to update")
    fields['updated_at'] = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    set_clause = ', '.join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [sid]
    conn.execute(f"UPDATE script_templates SET {set_clause} WHERE id = ?", values)
    conn.commit()
    row = conn.execute("SELECT * FROM script_templates WHERE id = ?", [sid]).fetchone()
    conn.close()
    return dict(row) if row else {}


@app.delete("/api/scripts/{sid}")
def delete_script(sid: int):
    conn = get_db()
    conn.execute("DELETE FROM script_templates WHERE id = ?", [sid])
    conn.commit()
    conn.close()
    return {"ok": True}


# --- Q2 Goals (Eisenhower Matrix — 重要但不紧急) APIs ---

class Q2GoalCreate(BaseModel):
    title: str
    description: str = ''
    weekly_schedule: str = ''
    active: int = 1
    sort_order: int = 0


class Q2GoalUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    weekly_schedule: Optional[str] = None
    active: Optional[int] = None
    sort_order: Optional[int] = None


@app.get("/api/q2-goals")
def get_q2_goals():
    conn = get_db()
    rows = conn.execute("SELECT * FROM q2_goals ORDER BY sort_order, id").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/q2-goals")
def create_q2_goal(body: Q2GoalCreate):
    conn = get_db()
    conn.execute("INSERT INTO q2_goals (title, description, weekly_schedule, active, sort_order) VALUES (?,?,?,?,?)",
                 [body.title, body.description, body.weekly_schedule, body.active, body.sort_order])
    conn.commit()
    row = conn.execute("SELECT * FROM q2_goals ORDER BY id DESC LIMIT 1").fetchone()
    conn.close()
    return dict(row)


@app.put("/api/q2-goals/{gid}")
def update_q2_goal(gid: int, body: Q2GoalUpdate):
    conn = get_db()
    fields = body.model_dump(exclude_unset=True)
    if not fields:
        conn.close()
        raise HTTPException(400, "No fields to update")
    fields['updated_at'] = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    set_clause = ', '.join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [gid]
    conn.execute(f"UPDATE q2_goals SET {set_clause} WHERE id = ?", values)
    conn.commit()
    row = conn.execute("SELECT * FROM q2_goals WHERE id = ?", [gid]).fetchone()
    conn.close()
    return dict(row) if row else {}


@app.delete("/api/q2-goals/{gid}")
def delete_q2_goal(gid: int):
    conn = get_db()
    conn.execute("DELETE FROM q2_goals WHERE id = ?", [gid])
    conn.commit()
    conn.close()
    return {"ok": True}


# --- Work Templates (录入工作模板) APIs ---

class TemplateCreate(BaseModel):
    name: str
    project: str = ''
    env: str = ''
    stage: str = ''
    product1: str = ''
    product2: str = ''
    product3: str = ''
    service1: str = ''
    service2: str = ''
    service3: str = ''
    method: str = ''
    status: str = '进行中'
    importance: str = '重要'
    urgency: str = '不紧急'
    difficulty: str = '一般'
    bsc: str = ''
    content: str = ''
    remark: str = ''
    hours: float = 0
    sort_order: int = 0


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    project: Optional[str] = None
    env: Optional[str] = None
    stage: Optional[str] = None
    product1: Optional[str] = None
    product2: Optional[str] = None
    product3: Optional[str] = None
    service1: Optional[str] = None
    service2: Optional[str] = None
    service3: Optional[str] = None
    method: Optional[str] = None
    status: Optional[str] = None
    importance: Optional[str] = None
    urgency: Optional[str] = None
    difficulty: Optional[str] = None
    bsc: Optional[str] = None
    content: Optional[str] = None
    remark: Optional[str] = None
    hours: Optional[float] = None
    sort_order: Optional[int] = None


@app.get("/api/templates")
def get_templates():
    conn = get_db()
    rows = conn.execute("SELECT * FROM work_templates ORDER BY sort_order, id").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/templates")
def create_template(body: TemplateCreate):
    conn = get_db()
    conn.execute('''INSERT INTO work_templates
        (name, project, env, stage, product1, product2, product3,
         service1, service2, service3, method, status, importance,
         urgency, difficulty, bsc, content, remark, hours, sort_order)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
        [body.name, body.project, body.env, body.stage,
         body.product1, body.product2, body.product3,
         body.service1, body.service2, body.service3,
         body.method, body.status, body.importance,
         body.urgency, body.difficulty, body.bsc,
         body.content, body.remark, body.hours, body.sort_order])
    conn.commit()
    row = conn.execute("SELECT * FROM work_templates ORDER BY id DESC LIMIT 1").fetchone()
    conn.close()
    return dict(row)


@app.put("/api/templates/{tid}")
def update_template(tid: int, body: TemplateUpdate):
    conn = get_db()
    fields = body.model_dump(exclude_unset=True)
    if not fields:
        conn.close()
        raise HTTPException(400, "No fields to update")
    set_clause = ', '.join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [tid]
    conn.execute(f"UPDATE work_templates SET {set_clause} WHERE id = ?", values)
    conn.commit()
    row = conn.execute("SELECT * FROM work_templates WHERE id = ?", [tid]).fetchone()
    conn.close()
    return dict(row) if row else {}


@app.delete("/api/templates/{tid}")
def delete_template(tid: int):
    conn = get_db()
    conn.execute("DELETE FROM work_templates WHERE id = ?", [tid])
    conn.commit()
    conn.close()
    return {"ok": True}


# --- WBS APIs ---

class WbsItemCreate(BaseModel):
    name: str
    description: str = ''
    deadline: str = ''
    weight: int = 0
    recommend: str = ''
    notes: str = ''
    sort_order: int = 0


class WbsScenarioCreate(BaseModel):
    name: str
    description: str = ''
    sort_order: int = 0
    items: list = []  # [{item_id, custom_weight}]


# WBS Items
@app.get("/api/wbs-items")
def get_wbs_items():
    conn = get_db()
    rows = conn.execute("SELECT * FROM wbs_items ORDER BY sort_order").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/wbs-items")
def create_wbs_item(body: WbsItemCreate):
    conn = get_db()
    conn.execute("INSERT INTO wbs_items (name, description, deadline, weight, recommend, notes, sort_order) VALUES (?,?,?,?,?,?,?)",
        [body.name, body.description, body.deadline, body.weight, body.recommend, body.notes, body.sort_order])
    conn.commit()
    row = conn.execute("SELECT * FROM wbs_items WHERE rowid=last_insert_rowid()").fetchone()
    conn.close()
    return dict(row)


@app.put("/api/wbs-items/{wid}")
def update_wbs_item(wid: int, body: WbsItemCreate):
    conn = get_db()
    conn.execute("UPDATE wbs_items SET name=?, description=?, deadline=?, weight=?, recommend=?, notes=?, sort_order=? WHERE id=?",
        [body.name, body.description, body.deadline, body.weight, body.recommend, body.notes, body.sort_order, wid])
    conn.commit()
    row = conn.execute("SELECT * FROM wbs_items WHERE id=?", [wid]).fetchone()
    conn.close()
    return dict(row) if row else {}


@app.delete("/api/wbs-items/{wid}")
def delete_wbs_item(wid: int):
    conn = get_db()
    conn.execute("DELETE FROM wbs_scenario_items WHERE item_id=?", [wid])
    conn.execute("DELETE FROM wbs_items WHERE id=?", [wid])
    conn.commit()
    conn.close()
    return {"ok": True}


# WBS Scenarios
@app.get("/api/wbs-scenarios")
def get_wbs_scenarios():
    conn = get_db()
    rows = conn.execute("SELECT * FROM wbs_scenarios ORDER BY sort_order").fetchall()
    result = []
    for r in rows:
        s = dict(r)
        items = conn.execute("""
            SELECT si.id as si_id, si.custom_weight, wi.*
            FROM wbs_scenario_items si
            JOIN wbs_items wi ON si.item_id = wi.id
            WHERE si.scenario_id = ?
            ORDER BY wi.sort_order
        """, [s['id']]).fetchall()
        s['items'] = [dict(i) for i in items]
        s['total_weight'] = sum(i['custom_weight'] or i['weight'] or 0 for i in s['items'])
        result.append(s)
    conn.close()
    return result


@app.post("/api/wbs-scenarios")
def create_wbs_scenario(body: WbsScenarioCreate):
    conn = get_db()
    conn.execute("INSERT INTO wbs_scenarios (name, description, sort_order) VALUES (?,?,?)",
        [body.name, body.description, body.sort_order])
    sid = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    for item in body.items:
        conn.execute("INSERT OR REPLACE INTO wbs_scenario_items (scenario_id, item_id, custom_weight) VALUES (?,?,?)",
            [sid, item.get('item_id', 0), item.get('custom_weight', 0)])
    conn.commit()
    row = conn.execute("SELECT * FROM wbs_scenarios WHERE id=?", [sid]).fetchone()
    conn.close()
    return dict(row) if row else {}


@app.put("/api/wbs-scenarios/{sid}")
def update_wbs_scenario(sid: int, body: WbsScenarioCreate):
    conn = get_db()
    conn.execute("UPDATE wbs_scenarios SET name=?, description=?, sort_order=? WHERE id=?",
        [body.name, body.description, body.sort_order, sid])
    conn.execute("DELETE FROM wbs_scenario_items WHERE scenario_id=?", [sid])
    for item in body.items:
        conn.execute("INSERT OR REPLACE INTO wbs_scenario_items (scenario_id, item_id, custom_weight) VALUES (?,?,?)",
            [sid, item.get('item_id', 0), item.get('custom_weight', 0)])
    conn.commit()
    row = conn.execute("SELECT * FROM wbs_scenarios WHERE id=?", [sid]).fetchone()
    conn.close()
    return dict(row) if row else {}


@app.delete("/api/wbs-scenarios/{sid}")
def delete_wbs_scenario(sid: int):
    conn = get_db()
    conn.execute("DELETE FROM wbs_scenario_items WHERE scenario_id=?", [sid])
    conn.execute("DELETE FROM wbs_scenarios WHERE id=?", [sid])
    conn.commit()
    conn.close()
    return {"ok": True}


# --- Product Catalog APIs ---

class CatalogCreate(BaseModel):
    parent_id: int = 0
    level: int
    name: str
    description: str = ''
    sort_order: int = 0


@app.get("/api/product-catalog")
def get_catalog(level: int = 0, parent_id: int = 0):
    conn = get_db()
    sql = "SELECT * FROM product_catalog WHERE 1=1"
    params = []
    if level: sql += " AND level=?"; params.append(level)
    if parent_id: sql += " AND parent_id=?"; params.append(parent_id)
    sql += " ORDER BY level, sort_order, id"
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/product-catalog")
def create_catalog_item(body: CatalogCreate):
    conn = get_db()
    try:
        conn.execute("INSERT INTO product_catalog (parent_id, level, name, description, sort_order) VALUES (?,?,?,?,?)",
                     [body.parent_id, body.level, body.name, body.description, body.sort_order])
        conn.commit()
        row = conn.execute("SELECT * FROM product_catalog WHERE rowid=last_insert_rowid()").fetchone()
        conn.close()
        return dict(row)
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(400, "该分类下已存在同名项")


class CatalogUpdate(BaseModel):
    name: str = None
    description: str = None
    sort_order: int = None


@app.put("/api/product-catalog/{cid}")
def update_catalog_item(cid: int, body: CatalogUpdate):
    conn = get_db()
    fields = {}
    if body.name is not None: fields['name'] = body.name
    if body.description is not None: fields['description'] = body.description
    if body.sort_order is not None: fields['sort_order'] = body.sort_order
    if not fields:
        conn.close()
        raise HTTPException(400, "No fields to update")
    set_clause = ', '.join(f"{k} = ?" for k in fields)
    conn.execute(f"UPDATE product_catalog SET {set_clause} WHERE id = ?", list(fields.values()) + [cid])
    conn.commit()
    row = conn.execute("SELECT * FROM product_catalog WHERE id = ?", [cid]).fetchone()
    conn.close()
    return dict(row) if row else {}


@app.delete("/api/product-catalog/{cid}")
def delete_catalog_item(cid: int):
    conn = get_db()
    conn.execute("DELETE FROM product_catalog WHERE id = ? OR parent_id = ?", [cid, cid])
    conn.commit()
    conn.close()
    return {"ok": True}


# --- Service Catalog APIs ---

@app.get("/api/service-catalog")
def get_service_catalog(level: int = 0, parent_id: int = 0):
    conn = get_db()
    sql = "SELECT * FROM service_catalog WHERE 1=1"
    params = []
    if level: sql += " AND level=?"; params.append(level)
    if parent_id: sql += " AND parent_id=?"; params.append(parent_id)
    sql += " ORDER BY level, sort_order, id"
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/service-catalog")
def create_service_item(cat: CatalogCreate):
    conn = get_db()
    try:
        conn.execute("INSERT INTO service_catalog (parent_id, level, name, description, sort_order) VALUES (?,?,?,?,?)",
                     [cat.parent_id, cat.level, cat.name, cat.description, cat.sort_order])
        conn.commit()
        row = conn.execute("SELECT * FROM service_catalog WHERE rowid=last_insert_rowid()").fetchone()
        conn.close()
        return dict(row)
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(400, "该分类下已存在同名项")


@app.put("/api/service-catalog/{cid}")
def update_service_item(cid: int, body: CatalogUpdate):
    conn = get_db()
    fields = {}
    if body.name is not None: fields['name'] = body.name
    if body.description is not None: fields['description'] = body.description
    if body.sort_order is not None: fields['sort_order'] = body.sort_order
    if not fields:
        conn.close()
        raise HTTPException(400, "No fields to update")
    set_clause = ', '.join(f"{k} = ?" for k in fields)
    conn.execute(f"UPDATE service_catalog SET {set_clause} WHERE id = ?", list(fields.values()) + [cid])
    conn.commit()
    row = conn.execute("SELECT * FROM service_catalog WHERE id = ?", [cid]).fetchone()
    conn.close()
    return dict(row) if row else {}


@app.delete("/api/service-catalog/{cid}")
def delete_service_item(cid: int):
    conn = get_db()
    conn.execute("DELETE FROM service_catalog WHERE id = ? OR parent_id = ?", [cid, cid])
    conn.commit()
    conn.close()
    return {"ok": True}


# --- Product Plans APIs ---

class PlanCreate(BaseModel):
    name: str
    product_l1: str = ''
    product_l2: str = ''
    product_l3: str = ''
    description: str = ''
    status: str = '规划中'


@app.get("/api/product-plans")
def get_product_plans():
    conn = get_db()
    rows = conn.execute("SELECT * FROM product_plans ORDER BY id DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/product-plans")
def create_product_plan(body: PlanCreate):
    conn = get_db()
    conn.execute("""INSERT INTO product_plans (name, product_l1, product_l2, product_l3, description, status)
        VALUES (?,?,?,?,?,?)""",
        [body.name, body.product_l1, body.product_l2, body.product_l3, body.description, body.status])
    conn.commit()
    row = conn.execute("SELECT * FROM product_plans WHERE rowid=last_insert_rowid()").fetchone()
    conn.close()
    return dict(row)


@app.put("/api/product-plans/{pid}")
def update_product_plan(pid: int, body: PlanCreate):
    conn = get_db()
    conn.execute("""UPDATE product_plans SET name=?, product_l1=?, product_l2=?, product_l3=?,
        description=?, status=?, updated_at=datetime('now','localtime') WHERE id=?""",
        [body.name, body.product_l1, body.product_l2, body.product_l3, body.description, body.status, pid])
    conn.commit()
    row = conn.execute("SELECT * FROM product_plans WHERE id=?", [pid]).fetchone()
    conn.close()
    return dict(row) if row else {}


@app.delete("/api/product-plans/{pid}")
def delete_product_plan(pid: int):
    conn = get_db()
    conn.execute("DELETE FROM product_plans WHERE id=?", [pid])
    conn.commit()
    conn.close()
    return {"ok": True}


# --- Product Releases APIs ---

class ReleaseCreate(BaseModel):
    catalog_id: int = 0
    product_path: str = ''
    version: str
    ip_name: str = ''
    ip_type: str = ''
    ip_number: str = ''
    release_date: str = ''
    description: str = ''
    sales_count: int = 0
    adapt_count: int = 0
    status: str = '在售'
    features: str = ''
    rank_score: int = 0


@app.get("/api/product-releases")
def get_product_releases():
    conn = get_db()
    rows = conn.execute("SELECT * FROM product_releases ORDER BY rank_score DESC, sales_count DESC, adapt_count DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/product-releases")
def create_release(body: ReleaseCreate):
    conn = get_db()
    conn.execute("""INSERT INTO product_releases (catalog_id, product_path, version, ip_name, ip_type, ip_number, release_date, description, sales_count, adapt_count, status, features, rank_score)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        [body.catalog_id, body.product_path, body.version, body.ip_name, body.ip_type, body.ip_number, body.release_date, body.description,
         body.sales_count, body.adapt_count, body.status, body.features, body.rank_score])
    conn.commit()
    row = conn.execute("SELECT * FROM product_releases WHERE rowid=last_insert_rowid()").fetchone()
    conn.close()
    return dict(row)


@app.put("/api/product-releases/{rid}")
def update_release(rid: int, body: ReleaseCreate):
    conn = get_db()
    conn.execute("""UPDATE product_releases SET catalog_id=?, product_path=?, version=?, ip_name=?,
        ip_type=?, ip_number=?, release_date=?, description=?, sales_count=?, adapt_count=?, status=?, features=?, rank_score=?, updated_at=datetime('now','localtime') WHERE id=?""",
        [body.catalog_id, body.product_path, body.version, body.ip_name, body.ip_type, body.ip_number,
         body.release_date, body.description, body.sales_count, body.adapt_count, body.status, body.features, body.rank_score, rid])
    conn.commit()
    row = conn.execute("SELECT * FROM product_releases WHERE id=?", [rid]).fetchone()
    conn.close()
    return dict(row) if row else {}


@app.delete("/api/product-releases/{rid}")
def delete_release(rid: int):
    conn = get_db()
    conn.execute("DELETE FROM product_releases WHERE id=?", [rid])
    conn.commit()
    conn.close()
    return {"ok": True}


# SPA catch-all: serve index.html for all non-API, non-asset paths
# ===== Frontend Error Logging =====

class FrontendError(BaseModel):
    message: str
    stack: str = ''
    url: str = ''
    component: str = ''


@app.post("/api/logs/frontend")
def log_frontend_error(body: FrontendError):
    fe_logger.error(
        f"[FRONTEND] url={body.url}\n"
        f"  component={body.component}\n"
        f"  error={body.message}\n"
        f"  stack={body.stack}"
    )
    return {"ok": True}


@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    dist_dir = Path(__file__).parent / "dist"
    file_path = dist_dir / full_path
    if file_path.is_file() and file_path.exists():
        return FileResponse(str(file_path))
    return FileResponse(str(dist_dir / "index.html"))


@app.on_event("startup")
def startup():
    db_file = Path(DB_PATH)
    if db_file.exists():
        size_kb = db_file.stat().st_size / 1024
        print(f"[DB] 数据库已存在 ({size_kb:.0f}KB)，已自动备份，保留数据。")
    else:
        print("[DB] 新数据库，首次初始化种子数据。")
    init_db()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8089)
