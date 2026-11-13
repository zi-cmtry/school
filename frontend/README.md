# 校园可信信息聚合助手

成都理工大学的前端。实习、校招和竞赛分开浏览，手机上优先使用，界面是中文。

校招对应后端的 `campus_recruit`。竞赛白名单包括教务处、管理科学学院、材料与化学化工学院，以及四川省高校学科竞赛平台（`scgxxkjs.moocollege.com` 与 `cp.moocollege.com`，同为校内渠道）。

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
npm test
npm run dev
```

前端默认请求 `http://127.0.0.1:8000`。开发服务器在 `5173`。

- 换地址：`VITE_API_BASE_URL=http://127.0.0.1:8000 npm run dev`
- 只用本地示例、不访问后端：`VITE_USE_MOCK=1 npm run dev`
- 后端没启动时，列表和详情会自动退回本地示例，页面上会写明。`/submit` 仍会提示连不上后端，避免把失败当成保存成功。

`npm test` 检查三个入口的 `kind`、已截止筛选、有专业时请求带 `major`、无专业时不传 `major`、成都不传 `region`、省内传 `region=sichuan`、竞赛不被地点筛掉、详情里的「未提供」、首访跳过、不感兴趣、去重和中文错误提示。`npm run build` 做类型检查并打包。

## 目录

```
frontend/
  src/api/          真实接口客户端，以及连不上时的本地回退
  src/data/seed.ts  本地示例。只写来源页里出现过的事实
  src/domain/       类型、筛选、去重、来源层级
  src/pages/        实习、校招、竞赛、详情、订阅、设置；录入页不进导航
  src/profile.ts    学院、专业、年级的本地读写
  src/hidden.ts     不感兴趣的本地编号
```

## 页面

| 路径 | 作用 |
| --- | --- |
| `/` | 按旧的 `kind` 参数转到对应列表；没有参数时进入实习 |
| `/internships` | 实习。请求 `GET /api/v1/opportunities?kind=internship` |
| `/campus` | 校招。请求 `GET /api/v1/opportunities?kind=campus_recruit` |
| `/competitions` | 竞赛。请求 `GET /api/v1/opportunities?kind=competition` |
| 地点「成都」 | 实习和校招的默认列表，不传 `region`。省外就业岗不出现 |
| 地点「省内」 | 实习和校招改传 `region=sichuan`。省外就业岗同样不出现，绵阳、宜宾等仍在 |
| `?status=expired` | 只看已截止，可以和上面的类型一起用 |
| `/opportunities/:id` | 详情。岗位职责、任职要求、专业要求按原文显示；没有则写「未提供」。来源链接可点 |
| `/subscriptions` | 订阅占位。只在本地记下想关注的类型，不推送、不筛选、不重排 |
| `/settings` | 修改学院、专业、年级；解除「不感兴趣」 |
| `/submit` | 录入仍保留，但不出现在顶栏或底栏 |

顶栏是实习、校招、竞赛。底栏是订阅和设置。

第一次进入会弹出学院、专业、年级。可以跳过，跳过也能看列表。画像存在这台浏览器的 `localStorage`。已经填写的专业会作为 `major` 传给实习、校招和竞赛：对口的排在前面，其余仍显示，不另开栏目，也不改写标题。跳过画像，或专业是空的，就不传 `major`。设置页仍可修改。

实习和校招可以在「成都」和「省内」之间切换。成都是默认列表，不传 `region`。省内传 `region=sichuan`。两种请求都不包含工作地已经写明、且不在四川省的就业岗；工作地里写了成都的多地岗位两种视图都保留。没有全国列表，前端也不另写一套工作地过滤。竞赛不出现地点切换，不按工作地筛选，没写 `work_location` 的竞赛也保留。

列表每一条都显示来源名称、中文来源层级、工作地，以及可点的 `source_url`。点「不感兴趣」只按机会 `id` 在本地隐藏这条的列表和详情，设置页可以解除。不会删除服务器上的记录，也不会按公司拉黑。

## 接口

基址默认 `http://127.0.0.1:8000`，可用 `VITE_API_BASE_URL` 覆盖。

```
GET  /api/v1/opportunities?kind=internship
GET  /api/v1/opportunities?kind=campus_recruit
GET  /api/v1/opportunities?kind=competition
GET  /api/v1/opportunities?kind=campus_recruit&major=大数据管理与应用
GET  /api/v1/opportunities?kind=internship&region=sichuan
GET  /api/v1/opportunities/:id
POST /api/v1/opportunities
PATCH /api/v1/opportunities/:id
```

三个列表都会带 `kind`。需要看已截止时再加 `status=expired`。不要重复传两个 `kind`。

已保存专业时再加 `major`，只影响顺序。实习和校招切到省内再加 `region=sichuan`；默认的成都视图不传 `region`。竞赛不传 `region`。详情里的 `responsibilities`、`requirements`、`major_requirements` 原样显示，空白或「未提供」都显示「未提供」。

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

后端没启动时，校招列表能看到仍在进行中的宣讲和双选会，它们来自转载，标成未核验。本地示例也能看到电建、海信和昆仑数智：电建、海信的岗位职责和任职要求是「未提供」；填了「大数据管理与应用」时，昆仑数智排在校招前面，其余校招仍在。成都和省内都不出现中伟、多益、胜利石油；海信的工作地名单里有成都，所以仍在。竞赛不按工作地过滤，智能医学创新设计大赛没有 `work_location` 也会留在竞赛列表。打开「已截止」还能看到这两条竞赛：

- `https://aao.cdut.edu.cn/info/1442/7000.htm`
- `https://cim.cdut.edu.cn/info/1098/6232.htm`

原文没有写截止日期的简章没有编进示例，避免编一个日期。接上后端并执行 `make seed` 之后，列表改由后端决定，其中的竞赛按种子数据是进行中的。
