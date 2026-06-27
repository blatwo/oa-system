import { apiGet, apiPost, apiPut, apiDelete } from './database';

export async function getAllProjects() {
  return apiGet('/projects');
}

export async function addProject(name, customer = '', isv = '', productVersion = '', status = '进行中', salesPerson = '', code = '') {
  return apiPost('/projects', { name, code, customer, isv, product_version: productVersion, status, sales_person: salesPerson });
}

export async function updateProject(id, data) {
  return apiPut(`/projects/${id}`, data);
}

export async function deleteProject(id) {
  return apiDelete(`/projects/${id}`);
}

// ===== 项目状态达成条件 API =====

/**
 * 获取项目某目标状态的所有条件
 * @param {number} projectId - 项目ID
 * @param {string} targetStatus - 目标状态，如"已完成"
 * @returns {Promise<Array>} 条件列表
 */
export async function getProjectConditions(projectId, targetStatus = '已完成') {
  return apiGet(`/projects/${projectId}/status-conditions?target_status=${encodeURIComponent(targetStatus)}`);
}

/**
 * 批量保存/替换某目标状态的条件
 * @param {number} projectId - 项目ID
 * @param {string} targetStatus - 目标状态
 * @param {Array} conditions - 条件列表 [{condition_text, sort_order}]
 * @returns {Promise<Array>} 保存后的条件列表
 */
export async function saveProjectConditions(projectId, targetStatus, conditions) {
  return apiPost(`/projects/${projectId}/status-conditions`, {
    target_status: targetStatus,
    conditions,
  });
}

/**
 * 更新单条条件（勾选/取消勾选/修改描述）
 * @param {number} projectId - 项目ID
 * @param {number} conditionId - 条件ID
 * @param {Object} data - {condition_text, is_met, met_by}
 * @returns {Promise<Object>} 更新后的条件记录
 */
export async function updateProjectCondition(projectId, conditionId, data) {
  return apiPut(`/projects/${projectId}/status-conditions/${conditionId}`, data);
}

/**
 * 删除单条条件
 * @param {number} projectId - 项目ID
 * @param {number} conditionId - 条件ID
 * @returns {Promise<Object>} {ok: true}
 */
export async function deleteProjectCondition(projectId, conditionId) {
  return apiDelete(`/projects/${projectId}/status-conditions/${conditionId}`);
}

/**
 * 检查项目是否满足目标状态的条件
 * @param {number} projectId - 项目ID
 * @param {string} targetStatus - 目标状态，如"已完成"
 * @returns {Promise<Object>} {can_change, met_count, total_count, unmet_list}
 */
export async function checkProjectStatus(projectId, targetStatus = '已完成') {
  return apiGet(`/projects/${projectId}/check-status?target=${encodeURIComponent(targetStatus)}`);
}

/**
 * 获取项目状态变更日志
 * @param {number} projectId - 项目ID
 * @returns {Promise<Array>} 日志列表
 */
export async function getProjectStatusLogs(projectId) {
  return apiGet(`/projects/${projectId}/status-logs`);
}

// ===== 全局状态达成条件模板 API（project_id=0）=====

/**
 * 获取全局条件模板列表
 * @param {string} targetStatus - 目标状态，如"已完成"
 * @returns {Promise<Array>} 模板列表
 */
export async function getConditionTemplates(targetStatus = '已完成') {
  return apiGet(`/status-conditions/templates?target_status=${encodeURIComponent(targetStatus)}`);
}

/**
 * 批量保存/替换某目标状态的全局条件模板
 * @param {string} targetStatus - 目标状态
 * @param {Array} conditions - 条件列表 [{condition_text, sort_order}]
 * @returns {Promise<Array>} 保存后的模板列表
 */
export async function saveConditionTemplates(targetStatus, conditions) {
  return apiPost('/status-conditions/templates', {
    target_status: targetStatus,
    conditions,
  });
}

/**
 * 更新单条全局模板
 * @param {number} conditionId - 条件ID
 * @param {Object} data - {condition_text, sort_order}
 * @returns {Promise<Object>} 更新后的模板记录
 */
export async function updateConditionTemplate(conditionId, data) {
  return apiPut(`/status-conditions/templates/${conditionId}`, data);
}

/**
 * 删除单条全局模板
 * @param {number} conditionId - 条件ID
 * @returns {Promise<Object>} {ok: true}
 */
export async function deleteConditionTemplate(conditionId) {
  return apiDelete(`/status-conditions/templates/${conditionId}`);
}

/**
 * 将全局模板应用到指定项目（从 project_id=0 复制到指定项目）
 * @param {number} projectId - 项目ID
 * @param {string} targetStatus - 目标状态，如"已完成"
 * @returns {Promise<Array>} 复制后的条件列表
 */
export async function applyTemplateToProject(projectId, targetStatus = '已完成') {
  return apiPost(`/projects/${projectId}/apply-conditions-template`, {
    target_status: targetStatus,
  });
}
