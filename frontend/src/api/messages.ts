import type { ApiError } from "../domain/opportunity"

/** 把后端的英文 detail 转成页面上的中文。状态码保留，方便和接口对照。 */
export function explainApiError(error: ApiError): string {
  const detail = error.message
  let text = "请求没有成功"
  if (error.code === "network" || error.status === 0) {
    return "连不上后端。请先在仓库根目录执行 make seed，再执行 make run。"
  }
  if (/source_url is required/i.test(detail)) text = "来源链接不能为空"
  else if (/absolute http/i.test(detail)) text = "来源链接必须是以 http 或 https 开头的完整地址"
  else if (/dedupe_key/i.test(detail)) text = "已有一条进行中的记录，单位、标题和截止日期相同"
  else if (/source_url already exists/i.test(detail)) text = "这条来源链接已经收录过"
  else if (error.status === 422 || /must not be blank/i.test(detail) || /field required/i.test(detail)) {
    text = "有必填项没有填完整"
  } else if (error.status === 404) text = "没有找到这条信息"
  else if (error.status === 400) text = "提交内容没有通过校验"

  if (error.origin === "api" && error.status) return `${text}（后端返回 ${error.status}）`
  return text
}

export function explainFieldError(field: string, message: string): string {
  if (field === "source_url" && /required/i.test(message)) return "请填写来源链接"
  if (field === "source_url") return "来源链接必须是以 http 或 https 开头的完整地址"
  if (field === "title") return "请填写标题"
  if (field === "company") return "请填写单位或主办方"
  if (field === "deadline_at") return "请填写截止时间"
  if (field === "kind") return "请选择实习、校招或竞赛"
  return "请检查这一项"
}
