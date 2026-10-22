# -*- coding: utf-8 -*-
"""三国登录界面 · 写接口端到端测试（运行后自动清理演示数据）"""
import json
import urllib.request
import urllib.error

BASE = "http://127.0.0.1:8081"

def req(method, path, data=None, params=""):
    url = BASE + path + params
    body = json.dumps(data).encode("utf-8") if data is not None else None
    r = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method=method)
    try:
        with urllib.request.urlopen(r, timeout=15) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8") or "{}")

results = []
def check(name, cond, detail=""):
    results.append(("PASS" if cond else "FAIL", name, detail))
    print(("✓" if cond else "✗"), name, "|", detail)

# ---------- 烽火快报 ----------
st, r = req("POST", "/api/news", {"content": "测试快报：吉时已到", "category": "战报"})
nid = r.get("data", {}).get("id")
check("快报·发布 POST /api/news", st == 200 and r.get("success") and nid, f"id={nid}")

st, r = req("PUT", f"/api/news/{nid}", {"content": "测试快报：已修订", "category": "密报"})
check("快报·编辑 PUT /api/news/{id}", st == 200 and r.get("success") and r.get("data", {}).get("category") == "密报", r.get("message", ""))

st, r = req("GET", "/api/news", params="?keyword=" + urllib.parse.quote("已修订"))
check("快报·读回验证", any(n.get("id") == nid for n in r.get("data", [])), f"命中{len(r.get('data', []))}条")

st, r = req("DELETE", f"/api/news/{nid}")
check("快报·删除 DELETE /api/news/{id}", st == 200 and r.get("success"), r.get("message", ""))

st, r = req("POST", "/api/news", {"content": "", "category": "战报"})
check("快报·空内容被拒", st == 200 and not r.get("success"), r.get("message", ""))

# ---------- 军机要务 ----------
st, r = req("POST", "/api/tasks", {"title": "测试要务：传令各营", "category": "军机", "priority": "急"})
tid = r.get("data", {}).get("id")
check("要务·新增 POST /api/tasks", st == 200 and r.get("success") and tid, f"id={tid}")

st, r = req("PATCH", f"/api/tasks/{tid}/done", params="?done=true")
check("要务·标记完成 PATCH done=true", st == 200 and r.get("success") and r.get("data", {}).get("done") is True, r.get("message", ""))

st, r = req("PUT", f"/api/tasks/{tid}", {"priority": "缓", "title": "测试要务：修订"})
check("要务·编辑优先级+内容 PUT", st == 200 and r.get("success") and r.get("data", {}).get("priority") == "缓", r.get("message", ""))

st, r = req("DELETE", f"/api/tasks/{tid}")
check("要务·删除 DELETE", st == 200 and r.get("success"), r.get("message", ""))

# ---------- 武将 ----------
st, r = req("POST", "/api/heroes", {"name": "测试校尉", "faction": "wei", "type": "猛将", "power": 88, "leadership": 70, "intelligence": 60})
hid = r.get("data", {}).get("id")
check("武将·录入 POST /api/heroes", st == 200 and r.get("success") and hid, f"id={hid}")

st, r = req("PUT", f"/api/heroes/{hid}", {"power": 99, "intelligence": 150})
check("武将·编辑 PUT（智力150应收敛到100）", st == 200 and r.get("success") and r.get("data", {}).get("power") == 99 and r.get("data", {}).get("intelligence") == 100, f"power={r.get('data',{}).get('power')} intel={r.get('data',{}).get('intelligence')}")

st, r = req("DELETE", f"/api/heroes/{hid}")
check("武将·删除 DELETE", st == 200 and r.get("success"), r.get("message", ""))

st, r = req("POST", "/api/heroes", {"name": "", "faction": "wei"})
check("武将·空名被拒", st == 200 and not r.get("success"), r.get("message", ""))

# ---------- 个人中心：阵营 ----------
st, r = req("PUT", "/api/user/profile", {"username": "云长", "faction": "wei"})
check("个人·改阵营 shu->wei", st == 200 and r.get("success") and r.get("data", {}).get("faction") == "wei", r.get("data", {}).get("factionName", ""))
req("PUT", "/api/user/profile", {"username": "云长", "faction": "shu"})  # 还原
st, r = req("PUT", "/api/user/profile", {"username": "云长", "faction": "xxx"})
check("个人·非法阵营被拒", st == 200 and not r.get("success"), r.get("message", ""))

# ---------- 个人中心：密令（改后还原） ----------
st, r = req("PUT", "/api/user/password", {"username": "云长", "oldPassword": "danfeng123", "newPassword": "tmp123456"})
check("个人·改密令", st == 200 and r.get("success"), r.get("message", ""))
st, r = req("POST", "/api/login", {"username": "云长", "password": "tmp123456"})
check("个人·新密令可登录", st == 200 and r.get("success"), r.get("message", ""))
st, r = req("PUT", "/api/user/password", {"username": "云长", "oldPassword": "tmp123456", "newPassword": "danfeng123"})
check("个人·密令已还原", st == 200 and r.get("success"), r.get("message", ""))
st, r = req("PUT", "/api/user/password", {"username": "云长", "oldPassword": "wrong", "newPassword": "abc12345"})
check("个人·原密令错误被拒", st == 200 and not r.get("success"), r.get("message", ""))

# ---------- 回归：只读接口未受影响 ----------
st, r = req("GET", "/api/stats")
check("回归·GET /api/stats", st == 200 and r.get("success") and r.get("data", {}).get("total") == 1, f"total={r.get('data',{}).get('total')}")
st, r = req("GET", "/api/heroes", params="?faction=shu")
check("回归·GET /api/heroes?faction=shu", st == 200 and len(r.get("data", [])) >= 5, f"{len(r.get('data',[]))}员")

print("\n===== 汇总 =====")
fails = [x for x in results if x[0] == "FAIL"]
print(f"共 {len(results)} 项，通过 {len(results)-len(fails)}，失败 {len(fails)}")
for f in fails:
    print("FAIL:", f[1], f[2])
