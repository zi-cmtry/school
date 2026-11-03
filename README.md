# 成都理工大学校园可信信息

Campus trusted-info API for **成都理工大学**. It stores internships, campus recruiting, and competitions that come from the school channels listed in `backend/app/config/school.yaml`.

Records are written through this API or `make seed`. The service does not crawl pages and does not generate copy.

## Stack

Python 3.12, FastAPI, SQLAlchemy 2, SQLite, APScheduler.

## Layout

```
backend/app/main.py                 app and /api/v1/health
backend/app/models.py               Opportunity table
backend/app/schemas.py              request and response models
backend/app/db.py                   SQLite engine
backend/app/routers/opportunities.py
backend/app/services/dedupe.py      dedupe_key
backend/app/services/expire.py      deadline sweep
backend/app/services/sources.py     host → source_name / source_tier
backend/app/jobs/scheduler.py       hourly expire job
backend/app/config/school.yaml
backend/scripts/seed.py
backend/tests/
```

SQLite file: `backend/data/opportunities.db`.

## Opportunity

Required: `title`, `kind`, `company`, `deadline_at`, `source_url`, `source_name`, `source_tier`, `status`, `dedupe_key`, `published_at`, `updated_at`, `fetched_at`.

Optional: `role_tags[]`, `location`, `apply_url`, `summary`.

| Field | Values |
| --- | --- |
| kind | `internship`, `campus_recruit`, `competition` |
| status | `active`, `expired`, `duplicate`, `withdrawn` |
| source_tier | `official`, `campus_channel`, `student_submit`, `unverified` |

`source_name` and `source_tier` are taken from `school.yaml` using the `source_url` host and `kind`. A host is trusted only for the kinds in `applies_to`. Other hosts are `unverified`.

## Rules

- Missing or blank `source_url` → **400**. The URL must be absolute `http` or `https`.
- `dedupe_key` = `normalize(company)|normalize(title)|deadline YYYY-MM-DD` in **Asia/Shanghai**. Normalize means NFKC, lowercase, and drop whitespace and punctuation. A naive `deadline_at` is read as Shanghai local time.
- A second **active** row with the same `dedupe_key` → **409**. Expired, withdrawn, and duplicate rows do not block a new active row.
- `source_url` is unique → **409** on a repeat.
- `GET /api/v1/opportunities` returns `internship` and `campus_recruit` with `status=active`. Competitions stay off that list.
- `GET /api/v1/opportunities?kind=competition` returns active contests. `status` defaults to `active`; pass `status=expired` (or another status) to change it.
- `POST /api/v1/admin/jobs/expire` sets `active` rows whose `deadline_at` is in the past to `expired`. APScheduler runs the same sweep every hour while the server is up.

## School sources

`backend/app/config/school.yaml`:

- 学生就业指导中心 — `cdutjy.cdut.edu.cn` — official — internship, campus_recruit
- 教务处竞赛通知 — `aao.cdut.edu.cn` — campus_channel — competition
- 计算机学院竞赛 — `cim.cdut.edu.cn` — campus_channel — competition
- 材料与化学化工学院 — `cmcc.cdut.edu.cn` — campus_channel — competition
- 学科竞赛平台(moocollege) — `scgxxkjs.moocollege.com` — campus_channel — competition

## Run

```bash
pip install -r requirements.txt
make seed
make run
```

API docs: http://127.0.0.1:8000/docs

`make test` runs pytest. `make seed` is safe to repeat: it replaces the demo URLs. Deadlines are offsets from the time you seed (one campus-recruit notice is already past; the others are in the future), so the expire demo does not depend on the calendar date. Titles and links are real notices.

Seeded jobs (official, `cdutjy.cdut.edu.cn`):

- 叠拓 AI 实习生
- 海尔智家2026届校园招聘
- 海信集团全国营销中心2026届校园招聘
- 中伟集团2026届校园招聘
- 学大教育2026届校园招聘 — deadline already past

Seeded competitions:

- https://aao.cdut.edu.cn/info/1442/7000.htm — campus_channel
- https://cim.cdut.edu.cn/info/1098/6232.htm — campus_channel
- https://cp.moocollege.com/home/competition/details?competitionId=107706 — 第三届四川省大学生智能医学创新设计大赛. This detail host is `cp.moocollege.com`, so the row’s `source_tier` is `unverified`.

## curl

Health:

```bash
curl -s http://127.0.0.1:8000/api/v1/health
```

Default list (active internships and campus recruiting only):

```bash
curl -s http://127.0.0.1:8000/api/v1/opportunities
```

Contests, including the moocollege, 教务处, and 计算机学院 rows:

```bash
curl -s "http://127.0.0.1:8000/api/v1/opportunities?kind=competition"
```

Create. `source_tier` comes back as `official` because the host is `cdutjy.cdut.edu.cn`:

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

Same company, title, and Shanghai deadline date again → 409:

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

Missing `source_url` → 400:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:8000/api/v1/opportunities \
  -H 'Content-Type: application/json' \
  -d '{"title":"无来源","kind":"internship","company":"示例科技","deadline_at":"2027-06-01T18:00:00+08:00"}'
```

Expire the seeded 学大教育 row (and any other active row already past its deadline). The default list then drops it; `?status=expired` still returns it:

```bash
curl -s -X POST http://127.0.0.1:8000/api/v1/admin/jobs/expire
curl -s "http://127.0.0.1:8000/api/v1/opportunities?status=expired"
```

Update and delete use the `id` from a create or list response:

```bash
curl -s -X PATCH http://127.0.0.1:8000/api/v1/opportunities/1 \
  -H 'Content-Type: application/json' \
  -d '{"location":"绵阳"}'

curl -s -o /dev/null -w '%{http_code}\n' -X DELETE http://127.0.0.1:8000/api/v1/opportunities/1
```
