# 校园可信信息聚合助手

成都理工大学的前端。实习、校招和竞赛用同一套信息结构，手机上优先使用，界面是中文。

求职的官方来源是成都理工大学就业信息网。竞赛白名单包括教务处、管理科学学院、材料与化学化工学院，以及四川省高校学科竞赛平台（`scgxxkjs.moocollege.com` 与 `cp.moocollege.com`，同为校内渠道）。

根目录留给后端。这个目录单独安装、单独启动。

## 运行

先在仓库根目录准备后端，再开前端：

```bash
make seed
make run
```

另开一个终端：

```bash
cd frontend
npm i
npm run dev
```

前端默认请求 `http://127.0.0.1:8000`。开发服务器在 `5173`。

- 换地址：`VITE_API_BASE_URL=http://127.0.0.1:8000 npm run dev`
- 只用本地示例、不访问后端：`VITE_USE_MOCK=1 npm run dev`
- 后端没启动时，列表和详情会自动退回本地示例，页面上会写明。录入仍会提示连不上后端，避免把失败当成保存成功。

`npm test` 检查筛选、去重、中文错误提示和个人设置解析。`npm run build` 做类型检查并打包。

## 目录

```
frontend/
  src/api/          真实接口客户端，以及连不上时的本地回退
  src/data/seed.ts  本地示例。只写来源页里出现过的事实
  src/domain/       类型、筛选、去重、来源层级
  src/pages/        求职、竞赛、详情、录入、个人设置
  src/profile.ts    个人设置的本地读写
```

## 页面

| 路径 | 作用 |
| --- | --- |
| `/` | 求职。请求默认列表，只要进行中的实习和校招 |
| `/?kind=internship` | 只看实习 |
| `/?kind=campus_recruit` | 只看校招 |
| `/?status=expired` | 只看已截止。可与上面的类型一起用 |
| `/competitions` | 竞赛。请求 `?kind=competition` |
| `/opportunities/:id` | 详情。类型、层级、状态都用中文显示，来源和投递链接向外打开 |
| `/submit` | 录入。成功后，实习和校招回到对应求职列表，竞赛回到竞赛列表 |
| `/subscriptions` | 订阅占位。只在本地记下想关注的类型，不推送、不筛选、不重排 |
| `/settings` | 个人设置占位。学校、学院、专业、年级只存在这台浏览器 |

`/?kind=competition` 会转到竞赛页。

个人设置的示例是：成都理工大学、管理科学学院、大数据管理与应用、大二。保存之后不会参与排序，也不会做推荐。

## 接口

基址默认 `http://127.0.0.1:8000`，可用 `VITE_API_BASE_URL` 覆盖。

```
GET  /api/v1/opportunities
GET  /api/v1/opportunities?kind=competition
GET  /api/v1/opportunities/:id
POST /api/v1/opportunities
PATCH /api/v1/opportunities/:id
```

求职页不传 `kind`。后端因此返回进行中的实习和校招，不含竞赛。竞赛页只传 `kind=competition`。需要看已截止时再加 `status=expired`。单个类型用 `kind=internship` 或 `kind=campus_recruit`，不要重复传两个 `kind`。

列表响应是数组。时间是 ISO 字符串，页面按北京时间显示。

录入请求体：

```json
{
  "title": "标题",
  "kind": "internship",
  "company": "单位",
  "deadline_at": "2026-12-01T02:00:00.000Z",
  "source_url": "https://cdutjy.cdut.edu.cn/info/1.htm",
  "role_tags": [],
  "location": null,
  "apply_url": null,
  "summary": null
}
```

- 没有来源链接：后端 detail 为「source_url 不能为空」，页面显示「来源链接不能为空（后端返回 400）」。
- 来源链接不是完整的 http(s) 地址：detail 为「source_url 必须是绝对的 http(s) 地址」，同样是 `400`。
- 单位、标题和截止日期（按北京时间取日期）与一条进行中的记录相同：detail 为「已存在相同 dedupe_key 的有效记录」，页面说明是重复。
- 同一条来源链接已存在：detail 为「source_url 已存在」，页面显示「这条来源链接已经收录过（后端返回 409）」。
- 写入时和库里的记录冲突：detail 为「与已有记录冲突」，页面不会只写笼统的 409。
- 来源名称和可信层级由后端根据链接和类型填写，前端不提交这两项。

类型在界面上写成：实习、校招、竞赛。状态写成：进行中、已截止、重复、已撤回。层级写成：官方、校内渠道、同学提交、未核验。企业自己的校招页也记为校内渠道，来源名称是「企业校招」，不单独加一档枚举。转载站仍然是未核验。

`PATCH` 已接在客户端里，本周页面不提供编辑。

## 本地示例

后端没启动时，列表能看到仍在进行中的宣讲和双选会，它们来自转载，标成未核验。就业网和学院通知里已经写明、并且已经截止的内容，在「已截止」里。两条竞赛样例的报名截止也已经过去，所以竞赛默认列表是空的，打开「已截止」才能看到：

- `https://aao.cdut.edu.cn/info/1442/7000.htm`
- `https://cim.cdut.edu.cn/info/1098/6232.htm`

原文没有写截止日期的简章没有编进示例，避免编一个日期。接上后端并执行 `make seed` 之后，列表改由后端决定，其中的竞赛按种子数据是进行中的。
