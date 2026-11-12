# 成都理工大学校园可信信息

汇总**成都理工大学**渠道上的实习、校招和竞赛。来源白名单在 `backend/app/config/school.yaml`。

记录可以由接口、种子或白名单采集写入。采集只摘录原文，不补写岗位或竞赛。

前端在 `frontend/`。先在本目录执行 `make seed` 和 `make run`，再另开终端进入 `frontend` 执行 `npm i` 和 `npm run dev`。页面说明见 `frontend/README.md`。

## 技术栈

Python 3.12、FastAPI、SQLAlchemy 2、SQLite、APScheduler。

## 目录

```
backend/app/main.py                 应用入口与 /api/v1/health
backend/app/models.py               Opportunity 表
backend/app/schemas.py              请求与响应模型
backend/app/db.py                   SQLite 引擎
backend/app/routers/opportunities.py
backend/app/services/dedupe.py      计算 dedupe_key
backend/app/services/expire.py      按截止时间过期
backend/app/services/sources.py     根据链接和类别得到 source_name / source_tier
backend/app/services/collect.py     白名单页面摘录
backend/app/services/ingest.py      增量写入，并做过去重
backend/app/jobs/scheduler.py       每小时过期，每 6 小时采集
backend/app/config/school.yaml
backend/scripts/seed.py
backend/tests/
```

数据库文件：`backend/data/opportunities.db`。

## 机会字段

必填：`title`、`kind`、`company`、`deadline_at`、`source_url`、`source_name`、`source_tier`、`status`、`dedupe_key`、`published_at`、`updated_at`、`fetched_at`。

选填：`role_tags[]`、`location`、`apply_url`、`summary`。

列表和详情还会返回摘录字段。原文没有写成「未提供」，专业对不上写成「通用」：

| 字段 | 含义 |
| --- | --- |
| work_location | 工作地，如成都、绵阳 |
| responsibilities | 岗位职责 |
| requirements | 任职要求 |
| major_requirements | 专业要求 |
| major_tags | 专业标签，只来自专业要求或任职要求里的专业名 |

| 字段 | 取值 |
| --- | --- |
| kind | `internship`、`campus_recruit`、`competition` |
| status | `active`、`expired`、`duplicate`、`withdrawn` |
| source_tier | `official`、`campus_channel`、`student_submit`、`unverified` |

`source_name` 与 `source_tier` 由 `source_url` 和 `kind` 对照 `school.yaml` 得出，不采用客户端提交的级别。精确主机只在 `applies_to` 列出的类别上可信。企业自己的校招或招聘页在 `internship`、`campus_recruit` 上复用 `campus_channel`（不新增枚举，来源名称记为「企业校招」）。其余为 `unverified`。

## 规则

- 缺少或空白的 `source_url` 返回 **400**。地址必须是绝对的 `http` 或 `https`。
- `dedupe_key` = `normalize(company)|normalize(title)|截止日 YYYY-MM-DD`，日期按**亚洲/上海**。规范化会做 NFKC、转小写，并去掉空白和标点。不带时区的 `deadline_at` 按上海本地时间理解。
- 已有一条 **active** 记录使用相同 `dedupe_key` 时返回 **409**。`expired`、`withdrawn`、`duplicate` 不挡住新的有效记录。
- `source_url` 唯一，重复时返回 **409**。
- `GET /api/v1/opportunities` 只返回 `status=active` 的 `internship` 与 `campus_recruit`。竞赛不在这个默认列表里。实习和校招默认把成都市岗排在前面，其他省内岗留在后面，不隐藏。
- `GET /api/v1/opportunities?major=大数据管理与应用` 仍返回当前列表的全部记录。专业要求或 `major_tags` 对得上的排在前面，其余留在后面。`通用` 不算对口，也不按职位名匹配。
- `GET /api/v1/opportunities?kind=competition` 返回有效竞赛。`status` 默认 `active`，可传 `status=expired` 或其他状态。竞赛不因没有 `work_location` 被丢掉。
- `POST /api/v1/admin/jobs/expire` 把截止时间已过的 `active` 记录标为 `expired`。服务运行期间，APScheduler 每小时做同样的扫描。
- `POST /api/v1/admin/jobs/ingest` 按白名单做增量采集，可重复执行。定时任务每 6 小时跑一次，顺序是先成都、再四川省内其他城市。不访问 Boss 直聘、智联、前程无忧等聚合站。

## 学校来源

`backend/app/config/school.yaml`：

- 学生就业指导中心 — `cdutjy.cdut.edu.cn` — `official` — `internship`、`campus_recruit`
- 教务处竞赛通知 — `aao.cdut.edu.cn` — `campus_channel` — `competition`
- 计算机学院竞赛 — `cim.cdut.edu.cn` — `campus_channel` — `competition`
- 材料与化学化工学院 — `cmcc.cdut.edu.cn` — `campus_channel` — `competition`
- 学科竞赛平台(moocollege) — `scgxxkjs.moocollege.com`、`cp.moocollege.com` — `campus_channel` — `competition`
- 企业校招 — 企业自己的招聘页 — `campus_channel` — `internship`、`campus_recruit`

企业校招不新写枚举，和竞赛白名单一样落在 `campus_channel`。链接满足下面任一条件，且类别是实习或校招时，来源名称写「企业校招」：

- 主机名第一段是 `jobs`、`zhaopin`、`maker`、`careers`、`campus`（比较前去掉开头的 `www`）。例如 `jobs.hisense.com`、`maker.haier.net`、`campus.mihoyo.com`。
- 路径段是 `campus`，或以 `campus-`、`campus_` 开头（例如 `/campus`、`/campus-recruit`）。只出现在查询串里不算。`campuses`、`mycampus` 这类更长的单词不算。
- 主机写在 `school.yaml` 的企业招聘名单里，或是 `hotjob.cn`、`zhiye.com` 上的企业子域（如 `cngr.hotjob.cn`、`vistar.zhiye.com`、`job.sinopec.com`、`xz.duoyi.com`）。`www` 和裸域不算，所以 `www.hotjob.cn`、`zhiye.com` 仍是未核验。

以下仍是 `unverified`：二手聚合或转载站（应届生求职网、E职科技、智联、前程无忧、Boss 直聘等）即使路径里带 `campus` 或主机以 `jobs.` 开头；空白或缺失的 `source_url`（接口返回 400）；主机和类别对不上，例如就业网上的竞赛、竞赛白名单站点上的岗位。采集不把这些聚合站当来源，也不编造原文里没有的职责或专业。

## 运行

```bash
pip install -r requirements.txt
make seed
make run
```

接口文档：http://127.0.0.1:8000/docs

`make test` 运行 pytest。`make seed` 可以重复执行，会按演示用的 `source_url` 替换原记录。截止时间相对执行时刻计算（一条校招已经过期，其余在未来），因此过期演示不依赖当天日期。标题和链接来自已发布通知。

种子中的岗位（`official`，主机 `cdutjy.cdut.edu.cn`）。列表按全校专业混排，不按管理科学学院或「大数据管理与应用」过滤。该专业只出现在前端个人设置的示例里。

- 叠拓 AI 实习生 — 计算机、软件
- 成都辰显光电有限公司2027届应届毕业生招聘简章 — 光电、微电子、材料
- 中国电建集团成都院2027届校园招聘公告 — 土木、水利水电、地质
- 中伟集团2026届校园招聘 — 材料、矿业
- 海信集团全国营销中心2026届校园招聘 — 营销、经管
- 华润数科2025届校园招聘 — 数据分析、咨询、运营
- 昆仑数智科技有限责任公司校园招聘简章 — 原文专业要求含计算机、电子信息、数学、大数据管理与应用，以及石油工程、地质工程、油气储运工程。部分岗位写明工作地点成都
- 中石化胜利石油工程有限公司2027年度校园招聘简章 — 石油工程、地质；截止时间已过

种子中的竞赛：

- https://aao.cdut.edu.cn/info/1442/7000.htm — `campus_channel`
- https://cim.cdut.edu.cn/info/1098/6232.htm — `campus_channel`
- https://cp.moocollege.com/home/competition/details?competitionId=107706 — 第三届四川省大学生智能医学创新设计大赛，`campus_channel`。这是带 `competitionId` 的赛事详情页。

## curl 示例

健康检查：

```bash
curl -s http://127.0.0.1:8000/api/v1/health
```

默认列表（只含有效的实习和校招）：

```bash
curl -s http://127.0.0.1:8000/api/v1/opportunities
```

同一列表里，专业要求对得上「大数据管理与应用」的排在前面，其余岗位仍返回：

```bash
curl -s --get http://127.0.0.1:8000/api/v1/opportunities --data-urlencode "major=大数据管理与应用"
```

手动跑一遍白名单采集：

```bash
curl -s -X POST http://127.0.0.1:8000/api/v1/admin/jobs/ingest
```

竞赛，含 moocollege 详情、教务处和计算机学院通知：

```bash
curl -s "http://127.0.0.1:8000/api/v1/opportunities?kind=competition"
```

新建。主机是 `cdutjy.cdut.edu.cn`，返回的 `source_tier` 为 `official`：

```bash
curl -s -X POST http://127.0.0.1:8000/api/v1/opportunities \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "示例软件实习生",
    "kind": "internship",
    "company": "示例科技",
    "deadline_at": "2027-06-01T18:00:00+08:00",
    "source_url": "https://cdutjy.cdut.edu.cn/info/example/1.htm",
    "role_tags": ["后端"],
    "location": "成都",
    "apply_url": "https://cdutjy.cdut.edu.cn/info/example/1.htm",
    "summary": "手工录入示例"
  }'
```

单位、标题和上海时区的截止日期相同，再次提交返回 409：

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:8000/api/v1/opportunities \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "示例软件实习生",
    "kind": "internship",
    "company": "示例科技",
    "deadline_at": "2027-06-01T09:00:00+08:00",
    "source_url": "https://cdutjy.cdut.edu.cn/info/example/2.htm"
  }'
```

缺少 `source_url` 返回 400：

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:8000/api/v1/opportunities \
  -H 'Content-Type: application/json' \
  -d '{"title":"无来源","kind":"internship","company":"示例科技","deadline_at":"2027-06-01T18:00:00+08:00"}'
```

把种子里的中石化胜利石油工程（以及其它已过截止时间的有效记录）标为过期。默认列表不再返回它，`?status=expired` 仍能查到：

```bash
curl -s -X POST http://127.0.0.1:8000/api/v1/admin/jobs/expire
curl -s "http://127.0.0.1:8000/api/v1/opportunities?status=expired"
```

更新和删除使用列表或创建响应里的 `id`：

```bash
curl -s -X PATCH http://127.0.0.1:8000/api/v1/opportunities/1 \
  -H 'Content-Type: application/json' \
  -d '{"location":"绵阳"}'

curl -s -o /dev/null -w '%{http_code}\n' -X DELETE http://127.0.0.1:8000/api/v1/opportunities/1
```
