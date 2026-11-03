def sample(**overrides):
    body = {
        "title": "后端开发实习生",
        "kind": "internship",
        "company": "示例科技",
        "deadline_at": "2027-06-01T18:00:00+08:00",
        "source_url": "https://cdutjy.cdut.edu.cn/info/demo/1.htm",
        "role_tags": ["后端"],
        "location": "成都",
        "summary": "示例岗位",
    }
    body.update(overrides)
    return body
