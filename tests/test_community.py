"""Anonymous social API integration tests. Only Python standard library is required."""
import json
import os
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import server


class CommunityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory(prefix="memory-duet-test-")
        server.DB_FILE = server.Path(cls.tmp.name) / "test.sqlite3"
        server.initialize()
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.url = "http://127.0.0.1:%d" % cls.httpd.server_address[1]
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls.thread.join(timeout=5)
        cls.tmp.cleanup()

    def setUp(self):
        with server.LIMIT_LOCK:
            server.LIMITS.clear()

    def api(self, method, path, data=None, token=None, admin=None):
        headers = {"Accept": "application/json"}
        if data is not None:
            headers["Content-Type"] = "application/json"
        if token:
            headers["Authorization"] = "Bearer " + token
        if admin:
            headers["X-Admin-Token"] = admin
        req = Request(self.url + path, method=method, headers=headers,
                      data=json.dumps(data, ensure_ascii=False).encode() if data is not None else None)
        try:
            with urlopen(req, timeout=6) as res:
                return res.status, json.loads(res.read())
        except HTTPError as error:
            return error.code, json.loads(error.read())

    def guest(self, name="随便取个昵称", interests=None):
        status, data = self.api("POST", "/api/community/guest",
                                {"nickname": name, "interests": interests or []})
        self.assertEqual(status, 201, data)
        return data["token"], data["guest"]

    def bottle(self, token, kind="hard", title="这个知识点总是记不住"):
        status, data = self.api("POST", "/api/community/bottles",
                                {"kind": kind, "title": title, "content": "这是公开的原创教学求助与记忆线索",
                                 "subject": "英语", "method": "故事", "tags": ["易混词"]}, token)
        self.assertEqual(status, 201, data)
        return data["id"]

    def test_public_feed_and_config(self):
        code, cfg = self.api("GET", "/api/config")
        self.assertEqual(code, 200)
        self.assertTrue(cfg["community_online"])
        code, anon = self.api("GET", "/api/community/me")
        self.assertEqual(code, 200)
        self.assertIsNone(anon["guest"])
        _, before = self.api("GET", "/api/community/feed")
        self.assertIsInstance(before["items"], list)
        code, _ = self.api("POST", "/api/community/bottles", {"title":"没有身份"})
        self.assertEqual(code, 401)

    def test_any_nickname_no_password_and_distinct_identities(self):
        t1, u1 = self.guest("<我的昵称>")
        t2, u2 = self.guest("<我的昵称>")
        self.assertNotEqual(t1, t2)
        self.assertNotEqual(u1["id"], u2["id"])
        self.assertEqual(u1["nickname"], "<我的昵称>")
        code, me = self.api("GET", "/api/community/me", token=t1)
        self.assertEqual(code, 200)
        self.assertEqual(me["guest"]["id"], u1["id"])
        code, _ = self.api("POST", "/api/community/guest", {"nickname":""})
        self.assertEqual(code, 400)

    def test_two_bottles_replies_best_reactions_and_bookmarks(self):
        owner, _ = self.guest("瓶主")
        other, _ = self.guest("记忆搭子")
        hard = self.bottle(owner, "hard")
        secret = self.bottle(other, "secret", "分享一条好用的记忆秘诀")
        code, feed = self.api("GET", "/api/community/feed?kind=hard")
        self.assertEqual(code, 200)
        self.assertTrue(any(b["id"] == hard for b in feed["items"]))
        self.assertTrue(all(b["kind"]=="hard" for b in feed["items"]))
        code, detail = self.api("GET", "/api/community/bottles/"+hard, token=owner)
        self.assertEqual(code, 200)
        self.assertEqual(detail["item"]["kind"], "hard")
        code, reply = self.api("POST", "/api/community/replies",
                               {"bottle_id":hard,"content":"试试用借入和借出方向对照","method":"画面"}, other)
        self.assertEqual(code,201)
        reply_id = reply["id"]
        code, _ = self.api("POST", "/api/community/best", {"reply_id":reply_id}, other)
        self.assertEqual(code,403,"Non-owner cannot pick winner")
        code, chosen = self.api("POST", "/api/community/best", {"reply_id":reply_id}, owner)
        self.assertEqual(code,200)
        _, shown = self.api("GET", "/api/community/bottles/"+hard)
        self.assertEqual(shown["replies"][0]["is_best"],1)
        code, liked = self.api("POST","/api/community/reaction",
                               {"target_type":"bottle","target_id":hard,"kind":"like"},other)
        self.assertTrue(liked["active"])
        _, unliked = self.api("POST","/api/community/reaction",
                               {"target_type":"bottle","target_id":hard,"kind":"like"},other)
        self.assertFalse(unliked["active"])
        _, saved = self.api("POST","/api/community/reaction",
                            {"target_type":"bottle","target_id":secret,"kind":"save"},owner)
        self.assertTrue(saved["active"])
        _, collection = self.api("GET","/api/community/saved",token=owner)
        self.assertTrue(any(x["id"]==secret for x in collection["items"]))
        _, random_bottle = self.api("GET","/api/community/random?kind=secret",token=owner)
        self.assertEqual(random_bottle["item"]["kind"],"secret")

    def test_interest_matching_follow_privacy_and_messages(self):
        first, u1 = self.guest("爱英语", ["英语", "记忆训练"])
        second, u2 = self.guest("我也爱英语", ["英语"])
        _, matches = self.api("GET","/api/community/matches",token=first)
        matched = [x for x in matches["users"] if x["id"]==u2["id"]]
        self.assertEqual(matched[0]["common_interests"],["英语"])
        code, _ = self.api("POST","/api/community/messages",{"to":u2["id"],"content":"你好"},first)
        self.assertEqual(code,403)
        _, a = self.api("POST","/api/community/follow",{"user_id":u2["id"]},first)
        self.assertTrue(a["active"])
        _, b = self.api("POST","/api/community/follow",{"user_id":u1["id"]},second)
        self.assertTrue(b["active"])
        _, msg = self.api("POST","/api/community/messages",{"to":u2["id"],"content":"你好！一起记词语吧"},first)
        self.assertTrue(msg["ok"])
        _, inbox = self.api("GET","/api/community/inbox",token=second)
        self.assertIn(u1["id"],[x["id"] for x in inbox["users"]])
        _, history = self.api("GET","/api/community/messages?peer="+u2["id"],token=first)
        self.assertEqual(history["items"][-1]["content"],"你好！一起记词语吧")
        _, blocked = self.api("POST","/api/community/block",{"user_id":u2["id"]},first)
        self.assertTrue(blocked["active"])
        code, _ = self.api("POST","/api/community/messages",{"to":u2["id"],"content":"屏蔽后不应通过"},first)
        self.assertEqual(code,403)

    def test_challenges_leaderboard_and_reporting(self):
        token, user = self.guest("挑战者")
        self.bottle(token,"secret","我的复习秘诀")
        _, challenges = self.api("GET","/api/community/challenges",token=token)
        self.assertTrue(len(challenges["items"])>=3)
        cid=challenges["items"][0]["id"]
        _, join = self.api("POST","/api/community/challenge",{"id":cid,"action":"join"},token)
        self.assertEqual(join["status"],"joined")
        _, complete = self.api("POST","/api/community/challenge",{"id":cid,"action":"complete"},token)
        self.assertEqual(complete["status"],"self-reported")
        _, challenges = self.api("GET","/api/community/challenges",token=token)
        self.assertTrue(next(x for x in challenges["items"] if x["id"]==cid)["completed"])
        _, board = self.api("GET","/api/community/leaderboard")
        self.assertTrue(any(x["id"]==user["id"] for x in board["users"]))
        target = self.bottle(token, "hard", "被举报的测试求助")
        for i in range(3):
            reporter,_=self.guest("举报者"+str(i))
            code, _ = self.api("POST","/api/community/report",
                               {"target_type":"bottle","target_id":target,"reason":"测试举报"+str(i)},reporter)
            self.assertEqual(code,200)
        code, _ = self.api("GET","/api/community/bottles/"+target)
        self.assertEqual(code,404)
        os.environ["MEMORY_DUET_ADMIN_TOKEN"]="test-operator-key"
        try:
            code, _ = self.api("POST","/api/community/moderate",
                               {"type":"bottle","id":target,"action":"visible"},admin="invalid")
            self.assertEqual(code,403)
            code, _ = self.api("POST","/api/community/moderate",
                               {"type":"bottle","id":target,"action":"visible"},admin="test-operator-key")
            self.assertEqual(code,200)
            code, _ = self.api("GET","/api/community/bottles/"+target)
            self.assertEqual(code,200)
        finally:
            os.environ.pop("MEMORY_DUET_ADMIN_TOKEN",None)


    def test_shared_rooms_server_check_and_hint_outcomes(self):
        owner, creator = self.guest("共学发起者")
        friend, other = self.guest("一起练习")
        payload={"title":"词义方向挑战","subject":"英语",
                 "question":"请写出表示把东西借给别人的英文动词原形。",
                 "hint":"东西从你的手里交到朋友手里，英文是 lend。",
                 "answer":"lend"}
        code, created=self.api("POST","/api/community/rooms",payload,owner)
        self.assertEqual(code,201,created)
        rid=created["id"]
        code, rooms=self.api("GET","/api/community/rooms")
        self.assertTrue(any(r["id"]==rid for r in rooms["items"]))
        code, view=self.api("GET","/api/community/rooms/"+rid,token=friend)
        self.assertEqual(code,200)
        self.assertNotIn("reference_answer",view["room"])
        code, _=self.api("POST","/api/community/rooms/submit",
                           {"id":rid,"answer":"lend","hint_used":False},friend)
        self.assertEqual(code,403)
        code, _=self.api("POST","/api/community/rooms/join",{"id":rid},friend)
        self.assertEqual(code,200)
        code, result=self.api("POST","/api/community/rooms/submit",
                              {"id":rid,"answer":"lend","hint_used":False},friend)
        self.assertEqual(code,200)
        self.assertEqual(result["outcome"],"independent-correct")
        code, view=self.api("GET","/api/community/rooms/"+rid,token=friend)
        self.assertEqual(view["room"]["reference_answer"],"lend")
        code, _=self.api("POST","/api/community/rooms/submit",
                           {"id":rid,"answer":"lend","hint_used":True},friend)
        self.assertEqual(code,409,"Same round cannot count twice")
        code, result=self.api("POST","/api/community/rooms/submit",
                              {"id":rid,"answer":"lend","hint_used":True},owner)
        self.assertEqual(code,200)
        self.assertEqual(result["outcome"],"prompted-correct")
        payload["question"]="请写出 lend 这个单词"
        code, _=self.api("POST","/api/community/rooms",payload,owner)
        self.assertEqual(code,400,"Questions must not expose exact answers")

    def test_input_validation_static_and_private_files(self):
        guest,_=self.guest("验证")
        code,_=self.api("POST","/api/community/bottles",
                         {"kind":"bad","title":"标题","content":"正文","subject":"其他"},guest)
        self.assertEqual(code,400)
        code,_=self.api("POST","/api/community/bottles",
                         {"kind":"hard","title":"含无效图片","content":"正文","subject":"其他","image":"data:image/svg+xml;base64,AAA="},guest)
        self.assertEqual(code,400)
        with urlopen(self.url+"/",timeout=6) as res:
            data=res.read()
            self.assertEqual(res.status,200)
            self.assertIn(b"social.js",data)
        with urlopen(self.url+"/social.js",timeout=6) as res:
            self.assertIn("javascript",res.headers.get("Content-Type"))
        try:
            urlopen(self.url+"/%2e%2e/server.py",timeout=6)
        except HTTPError as e:
            self.assertIn(e.code,(400,403,404))
        else:
            self.fail("Traversal must not expose backend source")


if __name__ == "__main__":
    unittest.main()
