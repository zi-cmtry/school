import type { ApiError } from "../domain/opportunity"

/**
 * 把接口 detail 转成页面上的中文。
 * 真实后端（PR#1）的 detail 已是中文，例如「source_url 不能为空」「source_url 已存在」。
 * 本地校验仍用英文句子。两种都按包含关系匹配，避免只剩笼统的 400/409。
 * 状态码保留，方便和接口对照。
 */
export function explainApiError(error: ApiError): string {
  const detail = error.message
  if (error.code === "network" || error.status === 0) {
    return "连不上后端。请先在仓库根目录执行 make seed，再执行 make run。"
  }

  let text = "请求没有成功"
  if (isEmptySourceUrl(detail)) text = "来源链接不能为空"
  else if (isBadSourceUrl(detail)) text = "来源链接必须是以 http 或 https 开头的完整地址"
  else if (/dedupe_key/i.test(detail)) text = "已有一条进行中的记录，单位、标题和截止日期相同"
  else if (isDuplicateSourceUrl(detail)) text = "这条来源链接已经收录过"
  else if (detail.includes("与已有记录冲突") || detail.includes("已存在")) text = "与已有记录冲突"
  else if (
    error.status === 422 ||
    /must not be blank/i.test(detail) ||
    /field required/i.test(detail) ||
    detail.includes("不能为空")
  ) {
    text = "有必填项没有填完整"
  } else if (error.status === 404 || detail.includes("未找到")) text = "没有找到这条信息"
  else if (error.status === 400) text = "提交内容没有通过校验"

  if (error.origin === "api" && error.status) return `${text}（后端返回 ${error.status}）`
  return text
}

/** 「source_url 不能为空」或本地的 source_url is required。 */
function isEmptySourceUrl(detail: string): boolean {
  if (!/source_url/i.test(detail)) return false
  return /不能为空/.test(detail) || /is required/i.test(detail)
}

/** 「source_url 必须是绝对的 http(s) 地址」或本地的 absolute http(s) URL。 */
function isBadSourceUrl(detail: string): boolean {
  return /absolute http/i.test(detail) || /http\(s\)/.test(detail) || detail.includes("必须是绝对")
}

/** 「source_url 已存在」或本地的 source_url already exists。 */
function isDuplicateSourceUrl(detail: string): boolean {
  if (!/source_url/i.test(detail)) return false
  return detail.includes("已存在") || /already exists/i.test(detail)
}

export function explainFieldError(field: string, message: string): string {
  if (field === "source_url" && (/required/i.test(message) || message.includes("不能为空"))) return "请填写来源链接"
  if (field === "source_url" && (/already exists/i.test(message) || message.includes("已存在"))) {
    return "这条来源链接已经收录过"
  }
  if (field === "source_url") return "来源链接必须是以 http 或 https 开头的完整地址"
  if (field === "title") return "请填写标题"
  if (field === "company") return "请填写单位或主办方"
  if (field === "deadline_at") return "请填写截止时间"
  if (field === "kind") return "请选择实习、校招或竞赛"
  return "请检查这一项"
}
