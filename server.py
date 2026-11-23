"""Memory Duet: static learning site + shared, guest-only social API.

Run: python3 server.py
Uses only Python standard library; SQLite persists public posts across browsers.
A nickname is *not* authentication. A random guest token protects only that session's
write permissions. Use HTTPS, a reverse proxy, human moderation and backups before
putting this demonstration on the public Internet.
"""
import base64
import hashlib
import hmac
import json
import mimetypes
import os
import re
import secrets
import sqlite3
import threading
import time
import uuid
from collections import defaultdict, deque
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit
from urllib.request import Request, urlopen

HOME = Path(__file__).resolve().parent
WEB = (HOME / "web").resolve()
DATA = Path(os.getenv("MEMORY_DUET_DATA_DIR", str(HOME / "data"))).resolve()
DATA.mkdir(parents=True, exist_ok=True)
DB_FILE = DATA / "community.sqlite3"
PORT = int(os.getenv("MEMORY_DUET_PORT", "8765"))
HOST = os.getenv("MEMORY_DUET_HOST", "127.0.0.1")
MAX_BODY = 900_000
LOCK = threading.RLock()
LIMIT_LOCK = threading.Lock()
LIMITS = defaultdict(deque)

def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")

def connect():
    db = sqlite3.connect(DB_FILE, timeout=15, isolation_level=None)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA busy_timeout=15000")
    db.execute("PRAGMA foreign_keys=ON")
    return db

def initialize():
    with LOCK, connect() as db:
        db.execute("PRAGMA journal_mode=WAL")
        db.executescript("""
            CREATE TABLE IF NOT EXISTS guests(
              id TEXT PRIMARY KEY, nickname TEXT NOT NULL, interests TEXT NOT NULL DEFAULT '[]',
              created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions(
              digest TEXT PRIMARY KEY, guest_id TEXT NOT NULL REFERENCES guests(id),
              created_at TEXT NOT NULL, expires INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS bottles(
              id TEXT PRIMARY KEY, guest_id TEXT NOT NULL REFERENCES guests(id),
              kind TEXT NOT NULL CHECK(kind IN ('hard','secret')),
              title TEXT NOT NULL, content TEXT NOT NULL, subject TEXT NOT NULL,
              method TEXT NOT NULL DEFAULT '', tags TEXT NOT NULL DEFAULT '[]',
              image TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'visible'
            );
            CREATE TABLE IF NOT EXISTS replies(
              id TEXT PRIMARY KEY, bottle_id TEXT NOT NULL REFERENCES bottles(id),
              guest_id TEXT NOT NULL REFERENCES guests(id), content TEXT NOT NULL,
              method TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL,
              is_best INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'visible'
            );
            CREATE TABLE IF NOT EXISTS reactions(
              guest_id TEXT NOT NULL REFERENCES guests(id), target_type TEXT NOT NULL,
              target_id TEXT NOT NULL, kind TEXT NOT NULL,
              PRIMARY KEY (guest_id,target_type,target_id,kind)
            );
            CREATE TABLE IF NOT EXISTS follows(
              follower TEXT NOT NULL REFERENCES guests(id), followee TEXT NOT NULL REFERENCES guests(id),
              PRIMARY KEY(follower,followee)
            );
            CREATE TABLE IF NOT EXISTS blocks(
              blocker TEXT NOT NULL REFERENCES guests(id), blocked TEXT NOT NULL REFERENCES guests(id),
              PRIMARY KEY(blocker,blocked)
            );
            CREATE TABLE IF NOT EXISTS messages(
              id TEXT PRIMARY KEY, sender TEXT NOT NULL REFERENCES guests(id),
              receiver TEXT NOT NULL REFERENCES guests(id), content TEXT NOT NULL,
              created_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'visible'
            );
            CREATE TABLE IF NOT EXISTS challenges(
              id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, category TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS study_rooms(
              id TEXT PRIMARY KEY, creator TEXT NOT NULL REFERENCES guests(id),
              title TEXT NOT NULL, subject TEXT NOT NULL, question TEXT NOT NULL,
              hint TEXT NOT NULL, answer TEXT NOT NULL, created_at TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'visible'
            );
            CREATE TABLE IF NOT EXISTS room_members(
              room_id TEXT NOT NULL REFERENCES study_rooms(id), guest_id TEXT NOT NULL REFERENCES guests(id),
              joined_at TEXT NOT NULL, PRIMARY KEY(room_id,guest_id)
            );
            CREATE TABLE IF NOT EXISTS room_attempts(
              room_id TEXT NOT NULL REFERENCES study_rooms(id), guest_id TEXT NOT NULL REFERENCES guests(id),
              answer TEXT NOT NULL, outcome TEXT NOT NULL, submitted_at TEXT NOT NULL,
              PRIMARY KEY(room_id,guest_id)
            );
            CREATE TABLE IF NOT EXISTS challenge_entries(
              guest_id TEXT NOT NULL REFERENCES guests(id), challenge_id TEXT NOT NULL REFERENCES challenges(id),
              joined_at TEXT NOT NULL, completed_at TEXT,
              PRIMARY KEY(guest_id, challenge_id)
            );
            CREATE TABLE IF NOT EXISTS reports(
              id TEXT PRIMARY KEY, reporter TEXT NOT NULL REFERENCES guests(id),
              target_type TEXT NOT NULL, target_id TEXT NOT NULL, reason TEXT NOT NULL,
              created_at TEXT NOT NULL, reviewed INTEGER NOT NULL DEFAULT 0,
              UNIQUE(reporter,target_type,target_id)
            );
            CREATE TABLE IF NOT EXISTS moderation(
              id TEXT PRIMARY KEY, target_type TEXT NOT NULL, target_id TEXT NOT NULL,
              action TEXT NOT NULL, at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_bottles_feed ON bottles(status,kind,created_at);
            CREATE INDEX IF NOT EXISTS idx_reply_bottle ON replies(bottle_id,created_at);
            CREATE INDEX IF NOT EXISTS idx_message_pair ON messages(sender,receiver,created_at);
            CREATE INDEX IF NOT EXISTS idx_rooms_status ON study_rooms(status,created_at);
        """)
        for ident, title, desc, category in [
            ("c-daily","七日无提示回忆","每天选择一道知识点，先遮住提示再回答。打卡为自报完成，不代表已掌握。","回忆"),
            ("c-help","三次记忆互助","接三个太难记漂流瓶，为别人提出具体的记忆方法。","交友"),
            ("c-secret","分享一条记忆秘诀","发布一条含有实际示例和核对方法的记忆秘诀瓶。","共创"),
        ]:
            db.execute("INSERT OR IGNORE INTO challenges(id,title,description,category) VALUES(?,?,?,?)",
                       (ident,title,desc,category))

def clean(value, field, max_length, required=True):
    if not isinstance(value,str):
        raise ValueError(field+"必须是文字")
    s = value.strip()
    if (required and not s) or len(s)>max_length or "\x00" in s:
        raise ValueError(field+"内容长度不符合要求")
    return s

def list_strings(value, maximum=8):
    if not isinstance(value,list) or len(value)>maximum:
        raise ValueError("标签格式不合法")
    return list(dict.fromkeys(clean(v,"标签",24) for v in value))

def image_data_url(s):
    if not s:
        return ""
    if not isinstance(s,str):
        raise ValueError("图片格式不合法")
    match=re.fullmatch(r"data:image/(png|jpeg|webp);base64,([a-zA-Z0-9+/=]+)",s)
    if not match or len(s)>710_000:
        raise ValueError("仅支持 500KB 以内的 PNG/JPEG/WebP 图片")
    try:
        raw=base64.b64decode(match.group(2),validate=True)
    except Exception:
        raise ValueError("图片数据不合法") from None
    kind=match.group(1)
    valid=(kind=="png" and raw.startswith(b"\x89PNG\r\n\x1a\n")
        or kind=="jpeg" and raw.startswith(b"\xff\xd8\xff")
        or kind=="webp" and raw.startswith(b"RIFF") and raw[8:12]==b"WEBP")
    if len(raw)>500_000 or not valid:
        raise ValueError("图片格式或大小不合法")
    return s

def normalized_recall(text):
    return re.sub(r"[\s。！!，,、.]","",str(text)).casefold()


def rate_ok(key, maximum, period=60):
    with LIMIT_LOCK:
        timeline=LIMITS[key]
        current=time.monotonic()
        while timeline and current-timeline[0]>period:
            timeline.popleft()
        if len(timeline)>=maximum:
            return False
        timeline.append(current)
        return True

def obj(row):
    return dict(row) if row else None

def get_user(db, token):
    if not token or len(token)>200:
        return None
    row=db.execute("""SELECT g.* FROM sessions s JOIN guests g ON g.id=s.guest_id
        WHERE s.digest=? AND s.expires>?""",(hashlib.sha256(token.encode()).hexdigest(),int(time.time()))).fetchone()
    return obj(row)

def bottle_summary(db, row, user_id=None, detail=False):
    result=dict(row)
    result["tags"]=json.loads(result.pop("tags"))
    result["author"]=db.execute("SELECT id,nickname,interests FROM guests WHERE id=?",
                                (result.pop("guest_id"),)).fetchone()
    result["author"]={"id":result["author"]["id"],"nickname":result["author"]["nickname"]}
    result["replies"]=db.execute("SELECT COUNT(*) FROM replies WHERE bottle_id=? AND status='visible'",
                                 (result["id"],)).fetchone()[0]
    result["likes"]=db.execute("SELECT COUNT(*) FROM reactions WHERE target_type='bottle' AND target_id=? AND kind='like'",
                               (result["id"],)).fetchone()[0]
    if user_id:
        result["liked"]=bool(db.execute("SELECT 1 FROM reactions WHERE guest_id=? AND target_type='bottle' AND target_id=? AND kind='like'",
                                        (user_id,result["id"])).fetchone())
        result["saved"]=bool(db.execute("SELECT 1 FROM reactions WHERE guest_id=? AND target_type='bottle' AND target_id=? AND kind='save'",
                                        (user_id,result["id"])).fetchone())
    result["has_image"]=bool(result["image"])
    if not detail:
        result.pop("image",None)
    return result

def user_public(db, guest_id, current_id=None):
    u=db.execute("SELECT id,nickname,interests,created_at FROM guests WHERE id=?",(guest_id,)).fetchone()
    if not u:
        return None
    d=dict(u);d["interests"]=json.loads(d["interests"])
    d["posts"]=db.execute("SELECT COUNT(*) FROM bottles WHERE guest_id=? AND status='visible'",(guest_id,)).fetchone()[0]
    d["followers"]=db.execute("SELECT COUNT(*) FROM follows WHERE followee=?",(guest_id,)).fetchone()[0]
    d["following"]=db.execute("SELECT COUNT(*) FROM follows WHERE follower=?",(guest_id,)).fetchone()[0]
    d["followed"]=bool(current_id and db.execute("SELECT 1 FROM follows WHERE follower=? AND followee=?",(current_id,guest_id)).fetchone())
    d["mutual"]=bool(current_id and d["followed"] and db.execute("SELECT 1 FROM follows WHERE follower=? AND followee=?",(guest_id,current_id)).fetchone())
    return d

class Handler(BaseHTTPRequestHandler):
    server_version="MemoryDuet/3"
    def respond(self, status, payload, cache=False):
        data=json.dumps(payload,ensure_ascii=False,separators=(",",":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type","application/json; charset=utf-8")
        self.send_header("Content-Length",str(len(data)))
        self.send_header("Cache-Control","public,max-age=30" if cache else "no-store")
        self.send_header("X-Content-Type-Options","nosniff")
        self.send_header("Referrer-Policy","same-origin")
        self.send_header("X-Frame-Options","DENY")
        self.send_header("Content-Security-Policy","default-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'")
        self.end_headers()
        self.wfile.write(data)

    def error_json(self, status, error):
        self.respond(status,{"ok":False,"error":error})

    def read_json(self):
        try:
            length=int(self.headers.get("Content-Length","0"))
        except ValueError:
            raise ValueError("请求长度不正确")
        if length<=0 or length>MAX_BODY:
            raise ValueError("请求体为空或过大")
        try:
            data=json.loads(self.rfile.read(length).decode("utf-8"))
        except (ValueError,UnicodeError):
            raise ValueError("无效 JSON") from None
        if not isinstance(data,dict):
            raise ValueError("请求必须是 JSON 对象")
        return data

    def authorization(self):
        header=self.headers.get("Authorization","")
        return header[7:] if header.startswith("Bearer ") else None

    def require_user(self,db):
        guest=get_user(db,self.authorization())
        if guest is None:
            raise PermissionError("请先输入任意昵称，以游客身份进入。")
        return guest

    def do_GET(self):
        parsed=urlsplit(self.path)
        path=parsed.path
        if path=="/api/config":
            self.respond(200,{"image_provider_configured":bool(os.getenv("RIRIXIN_API_KEY") and os.getenv("RIRIXIN_IMAGE_ENDPOINT")),
                              "community_online":True,"auth":"guest-nickname-no-password"})
            return
        if path.startswith("/api/community"):
            self.community_get(path,parse_qs(parsed.query))
            return
        if path.startswith("/api/"):
            self.error_json(404,"接口不存在")
            return
        candidate=unquote(path)
        if "\x00" in candidate or "\\" in candidate:
            self.send_error(400)
            return
        file=(WEB / candidate.lstrip("/")).resolve() if candidate!="/" else WEB/"index.html"
        if not file.is_relative_to(WEB) or not file.is_file():
            self.send_error(404)
            return
        data=file.read_bytes()
        mime=mimetypes.guess_type(file.name)[0] or "application/octet-stream"
        if file.suffix==".js": mime="application/javascript"
        if file.suffix==".webmanifest": mime="application/manifest+json"
        self.send_response(200)
        self.send_header("Content-Type",mime+("; charset=utf-8" if file.suffix in (".js",".html",".css",".json",".webmanifest") else ""))
        self.send_header("Content-Length",str(len(data)))
        self.send_header("Cache-Control","no-cache")
        self.send_header("X-Content-Type-Options","nosniff")
        self.send_header("Referrer-Policy","same-origin")
        self.send_header("X-Frame-Options","DENY")
        self.send_header("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'")
        self.end_headers()
        self.wfile.write(data)

    def community_get(self,path,query):
        def queryval(k, default=""):
            return query.get(k,[default])[0][:180]
        with LOCK,connect() as db:
            guest=get_user(db,self.authorization());uid=guest["id"] if guest else None
            if path=="/api/community/me":
                self.respond(200,{"ok":True,"guest":user_public(db,uid,uid) if uid else None})
                return
            if path=="/api/community/feed" or path=="/api/community/saved":
                kind=queryval("kind","all")
                if kind not in ("all","hard","secret"):kind="all"
                search=queryval("search").strip()
                try:page=max(1,min(500,int(queryval("page","1"))))
                except ValueError:page=1
                where=["b.status='visible'"]
                params=[]
                if kind!="all":where.append("b.kind=?");params.append(kind)
                if path.endswith("saved"):
                    if not uid:
                        self.error_json(401,"游客身份尚未创建");return
                    where.append("EXISTS(SELECT 1 FROM reactions r WHERE r.guest_id=? AND r.target_type='bottle' AND r.target_id=b.id AND r.kind='save')");params.append(uid)
                if search:
                    where.append("(b.title LIKE ? OR b.content LIKE ? OR b.subject LIKE ?)")
                    params.extend(["%"+search+"%"]*3)
                if uid:
                    where.append("NOT EXISTS (SELECT 1 FROM blocks bl WHERE bl.blocker=? AND bl.blocked=b.guest_id)")
                    params.append(uid)
                sort=queryval("sort","new")
                order="b.created_at DESC" if sort!="popular" else "(SELECT COUNT(*) FROM reactions r WHERE r.target_id=b.id AND r.kind='like' AND r.target_type='bottle') DESC, b.created_at DESC"
                rows=db.execute("SELECT b.* FROM bottles b WHERE "+" AND ".join(where)+" ORDER BY "+order+" LIMIT 20 OFFSET ?",
                                params+[(page-1)*20]).fetchall()
                self.respond(200,{"ok":True,"items":[bottle_summary(db,b,uid) for b in rows],"page":page,"has_more":len(rows)==20})
                return
            if path=="/api/community/random":
                kind=queryval("kind","all");w="status='visible'";p=[]
                if kind in ("hard","secret"):w+=" AND kind=?";p.append(kind)
                if uid:w+=" AND guest_id<>? AND guest_id NOT IN (SELECT blocked FROM blocks WHERE blocker=?)";p.extend([uid,uid])
                row=db.execute("SELECT * FROM bottles WHERE "+w+" ORDER BY RANDOM() LIMIT 1",p).fetchone()
                self.respond(200,{"ok":True,"item":bottle_summary(db,row,uid,True) if row else None})
                return
            if path.startswith("/api/community/bottles/"):
                bottle_id=path.rsplit("/",1)[-1]
                row=db.execute("SELECT * FROM bottles WHERE id=? AND status='visible'",(bottle_id,)).fetchone()
                if not row:
                    self.error_json(404,"漂流瓶不存在或已被隐藏");return
                if uid and db.execute("SELECT 1 FROM blocks WHERE blocker=? AND blocked=?",(uid,row["guest_id"])).fetchone():
                    self.error_json(404,"已屏蔽该发布者");return
                replies=[]
                for r in db.execute("""SELECT r.*,g.nickname FROM replies r JOIN guests g ON g.id=r.guest_id
                    WHERE r.bottle_id=? AND r.status='visible' ORDER BY r.is_best DESC,r.created_at ASC""",(bottle_id,)):
                    reply=dict(r);reply["author"]={"id":reply.pop("guest_id"),"nickname":reply.pop("nickname")}
                    reply["likes"]=db.execute("SELECT COUNT(*) FROM reactions WHERE target_type='reply' AND target_id=? AND kind='like'",(reply["id"],)).fetchone()[0]
                    replies.append(reply)
                self.respond(200,{"ok":True,"item":bottle_summary(db,row,uid,True),"replies":replies})
                return
            if path.startswith("/api/community/users/"):
                ident=path.rsplit("/",1)[-1]
                u=user_public(db,ident,uid)
                if not u:self.error_json(404,"该游客不存在");return
                self.respond(200,{"ok":True,"user":u})
                return
            if path=="/api/community/matches":
                if not uid:self.error_json(401,"先输入游客昵称");return
                own=set(json.loads(guest["interests"]))
                profiles=[user_public(db,r["id"],uid) for r in db.execute("SELECT id FROM guests WHERE id<>? ORDER BY created_at DESC LIMIT 100",(uid,))]
                profiles=[p for p in profiles if not db.execute("SELECT 1 FROM blocks WHERE blocker=? AND blocked=?",(uid,p["id"])).fetchone()]
                for p in profiles:p["common_interests"]=sorted(own.intersection(p["interests"]))
                profiles.sort(key=lambda p:(len(p["common_interests"]),p["followers"],p["posts"]),reverse=True)
                self.respond(200,{"ok":True,"users":profiles[:20]})
                return
            if path=="/api/community/rooms":
                rows=db.execute("""SELECT r.id,r.creator,r.title,r.subject,r.question,r.created_at,
                    (SELECT COUNT(*) FROM room_members m WHERE m.room_id=r.id) AS members,
                    (SELECT COUNT(*) FROM room_attempts a WHERE a.room_id=r.id) AS attempts
                    FROM study_rooms r WHERE r.status='visible' ORDER BY r.created_at DESC LIMIT 60""").fetchall()
                result=[]
                for row in rows:
                    item=dict(row)
                    owner=db.execute("SELECT nickname FROM guests WHERE id=?",(item["creator"],)).fetchone()
                    item["creator_name"]=owner["nickname"]
                    result.append(item)
                self.respond(200,{"ok":True,"items":result,"note":"学习室结果只能证明服务端核对了输入；提示使用仍由客户端申报。"})
                return
            if path.startswith("/api/community/rooms/"):
                ident=path.rsplit("/",1)[-1]
                room=db.execute("SELECT * FROM study_rooms WHERE id=? AND status='visible'",(ident,)).fetchone()
                if not room:self.error_json(404,"共学室不存在");return
                item={k:room[k] for k in ("id","title","subject","question","hint","creator","created_at")}
                item["members"]=[dict(r) for r in db.execute("""SELECT g.id,g.nickname,a.outcome,a.submitted_at
                    FROM room_members m JOIN guests g ON g.id=m.guest_id
                    LEFT JOIN room_attempts a ON a.room_id=m.room_id AND a.guest_id=m.guest_id
                    WHERE m.room_id=? ORDER BY m.joined_at""",(ident,))]
                attempt=db.execute("SELECT * FROM room_attempts WHERE room_id=? AND guest_id=?",
                                    (ident,uid)).fetchone() if uid else None
                item["my_attempt"]={k:attempt[k] for k in ("answer","outcome","submitted_at")} if attempt else None
                if attempt:item["reference_answer"]=room["answer"]
                self.respond(200,{"ok":True,"room":item})
                return
            if path=="/api/community/leaderboard":
                rows=db.execute("""SELECT g.id,g.nickname,COUNT(DISTINCT b.id) AS posts,
                        (SELECT COUNT(*) FROM replies r WHERE r.guest_id=g.id AND r.status='visible') AS replies
                        FROM guests g LEFT JOIN bottles b ON b.guest_id=g.id AND b.status='visible'
                        GROUP BY g.id ORDER BY (COUNT(DISTINCT b.id)*2+replies) DESC LIMIT 20""").fetchall()
                self.respond(200,{"ok":True,"users":[dict(row) for row in rows],"metric":"公开贡献数量（非学习能力）"})
                return
            if path=="/api/community/challenges":
                rows=db.execute("""SELECT c.*, (SELECT COUNT(*) FROM challenge_entries e WHERE e.challenge_id=c.id) AS participants
                    FROM challenges c""").fetchall()
                joined=set()
                completed=set()
                if uid:
                    for row in db.execute("SELECT challenge_id,completed_at FROM challenge_entries WHERE guest_id=?",(uid,)):
                        joined.add(row["challenge_id"])
                        if row["completed_at"]:completed.add(row["challenge_id"])
                self.respond(200,{"ok":True,"items":[dict(r,joined=r["id"] in joined,completed=r["id"] in completed) for r in rows]})
                return
            if path=="/api/community/inbox":
                if not uid:self.error_json(401,"先输入游客昵称");return
                peers=db.execute("""SELECT DISTINCT CASE WHEN sender=? THEN receiver ELSE sender END AS peer
                    FROM messages WHERE sender=? OR receiver=? LIMIT 100""",(uid,uid,uid)).fetchall()
                self.respond(200,{"ok":True,"users":[user_public(db,x["peer"],uid) for x in peers]})
                return
            if path=="/api/community/messages":
                if not uid:self.error_json(401,"先输入游客昵称");return
                peer=queryval("peer")
                rows=db.execute("""SELECT m.id,m.sender,m.receiver,m.content,m.created_at FROM messages m
                    WHERE m.status='visible' AND ((m.sender=? AND m.receiver=?) OR (m.receiver=? AND m.sender=?))
                    ORDER BY m.created_at ASC LIMIT 100""",(uid,peer,uid,peer)).fetchall()
                self.respond(200,{"ok":True,"items":[dict(r) for r in rows],"peer":user_public(db,peer,uid)})
                return
            if path=="/api/community/admin/reports":
                if not self.admin_ok():
                    self.error_json(403,"无权限");return
                rows=db.execute("SELECT * FROM reports ORDER BY created_at DESC LIMIT 200").fetchall()
                self.respond(200,{"ok":True,"items":[dict(r) for r in rows]})
                return
            self.error_json(404,"社区接口不存在")

    def admin_ok(self):
        token=os.getenv("MEMORY_DUET_ADMIN_TOKEN")
        provided=self.headers.get("X-Admin-Token","")
        return bool(token and provided and hmac.compare_digest(token,provided))

    def do_POST(self):
        path=urlsplit(self.path).path
        if path=="/api/generate-image":
            return self.image_proxy()
        if not path.startswith("/api/community/"):
            self.error_json(404,"接口不存在");return
        client_ip=self.client_address[0]
        limit=5 if path.endswith("/guest") else 18 if path.endswith("/messages") else 12
        if not rate_ok((client_ip,path),limit):
            self.error_json(429,"操作过于频繁，请稍后再试");return
        try:
            payload=self.read_json()
            if path=="/api/community/guest":
                nick=clean(payload.get("nickname"),"游客昵称",30)
                with LOCK,connect() as db:
                    user_id=uuid.uuid4().hex
                    interests=list_strings(payload.get("interests",[]))
                    db.execute("INSERT INTO guests(id,nickname,interests,created_at) VALUES(?,?,?,?)",
                               (user_id,nick,json.dumps(interests,ensure_ascii=False),now()))
                    token=secrets.token_urlsafe(32)
                    db.execute("INSERT INTO sessions(digest,guest_id,created_at,expires) VALUES(?,?,?,?)",
                               (hashlib.sha256(token.encode()).hexdigest(),user_id,now(),int(time.time())+90*86400))
                    self.respond(201,{"ok":True,"token":token,"guest":user_public(db,user_id,user_id),
                                      "note":"游客昵称不是身份验证；保存浏览器数据才能保留此游客身份。"})
                return
            with LOCK,connect() as db:
                if path=="/api/community/moderate":
                    if not self.admin_ok():
                        self.error_json(403,"无权限");return
                    target=clean(payload.get("type"),"类型",10)
                    ident=clean(payload.get("id"),"记录 ID",60)
                    action=clean(payload.get("action"),"操作",20)
                    if target not in ("bottle","reply","room") or action not in ("visible","hidden"):
                        raise ValueError("审核操作不合法")
                    table={"bottle":"bottles","reply":"replies","room":"study_rooms"}[target]
                    if not db.execute(f"SELECT 1 FROM {table} WHERE id=?",(ident,)).fetchone():
                        self.error_json(404,"记录不存在");return
                    db.execute(f"UPDATE {table} SET status=? WHERE id=?",(action,ident))
                    db.execute("UPDATE reports SET reviewed=1 WHERE target_type=? AND target_id=?",(target,ident))
                    db.execute("INSERT INTO moderation VALUES(?,?,?,?,?)",(uuid.uuid4().hex,target,ident,action,now()))
                    self.respond(200,{"ok":True});return
                guest=self.require_user(db)
                uid=guest["id"]
                if path=="/api/community/profile":
                    nickname=clean(payload.get("nickname",guest["nickname"]),"游客昵称",30)
                    interests=list_strings(payload.get("interests",json.loads(guest["interests"])))
                    db.execute("UPDATE guests SET nickname=?,interests=? WHERE id=?",
                               (nickname,json.dumps(interests,ensure_ascii=False),uid))
                    self.respond(200,{"ok":True,"guest":user_public(db,uid,uid)});return
                if path=="/api/community/bottles":
                    kind=payload.get("kind")
                    if kind not in ("hard","secret"):
                        raise ValueError("必须选择太难记或记忆秘诀类型")
                    title=clean(payload.get("title"),"标题",90)
                    content=clean(payload.get("content"),"内容",1500)
                    subject=clean(payload.get("subject","其他学习"),"学科",40)
                    method=clean(payload.get("method",""),"记忆方法",60,False)
                    tags=list_strings(payload.get("tags",[]))
                    photo=image_data_url(payload.get("image",""))
                    ident=uuid.uuid4().hex
                    db.execute("""INSERT INTO bottles(id,guest_id,kind,title,content,subject,method,tags,image,created_at)
                        VALUES(?,?,?,?,?,?,?,?,?,?)""",(ident,uid,kind,title,content,subject,method,
                        json.dumps(tags,ensure_ascii=False),photo,now()))
                    self.respond(201,{"ok":True,"id":ident});return
                if path=="/api/community/rooms":
                    title=clean(payload.get("title"),"共学标题",90)
                    subject=clean(payload.get("subject","记忆训练"),"学科",40)
                    question=clean(payload.get("question"),"无提示问题",500)
                    hint=clean(payload.get("hint"),"学习提示",1000)
                    answer=clean(payload.get("answer"),"参考答案",250)
                    if len(normalized_recall(answer))>=3 and normalized_recall(answer) in normalized_recall(question):
                        raise ValueError("无提示题目不能直接泄露参考答案")
                    room_id=uuid.uuid4().hex
                    db.execute("""INSERT INTO study_rooms(id,creator,title,subject,question,hint,answer,created_at)
                        VALUES(?,?,?,?,?,?,?,?)""",(room_id,uid,title,subject,question,hint,answer,now()))
                    db.execute("INSERT INTO room_members(room_id,guest_id,joined_at) VALUES(?,?,?)",(room_id,uid,now()))
                    self.respond(201,{"ok":True,"id":room_id})
                    return
                if path=="/api/community/rooms/join":
                    room_id=clean(payload.get("id"),"共学室 ID",60)
                    room=db.execute("SELECT 1 FROM study_rooms WHERE id=? AND status='visible'",(room_id,)).fetchone()
                    if not room:self.error_json(404,"共学室不存在");return
                    exists=db.execute("SELECT 1 FROM room_members WHERE room_id=? AND guest_id=?",(room_id,uid)).fetchone()
                    count=db.execute("SELECT COUNT(*) FROM room_members WHERE room_id=?",(room_id,)).fetchone()[0]
                    if not exists and count>=8:self.error_json(409,"共学室最多 8 人");return
                    db.execute("INSERT OR IGNORE INTO room_members(room_id,guest_id,joined_at) VALUES(?,?,?)",
                               (room_id,uid,now()))
                    self.respond(200,{"ok":True})
                    return
                if path=="/api/community/rooms/submit":
                    room_id=clean(payload.get("id"),"共学室 ID",60)
                    entered=clean(payload.get("answer"),"回忆答案",500)
                    prompted=payload.get("hint_used")
                    if not isinstance(prompted,bool):
                        raise ValueError("请明确提交是否查看过提示")
                    room=db.execute("SELECT answer FROM study_rooms WHERE id=? AND status='visible'",(room_id,)).fetchone()
                    if not room:self.error_json(404,"共学室不存在");return
                    if not db.execute("SELECT 1 FROM room_members WHERE room_id=? AND guest_id=?",(room_id,uid)).fetchone():
                        self.error_json(403,"请先加入共学室");return
                    previous=db.execute("SELECT 1 FROM room_attempts WHERE room_id=? AND guest_id=?",(room_id,uid)).fetchone()
                    if previous:self.error_json(409,"本轮已作答；如需再练，请开启另一轮共学。");return
                    correct=normalized_recall(entered)==normalized_recall(room["answer"])
                    outcome=("prompted-correct" if prompted else "independent-correct") if correct else "incorrect"
                    db.execute("INSERT INTO room_attempts(room_id,guest_id,answer,outcome,submitted_at) VALUES(?,?,?,?,?)",
                               (room_id,uid,entered,outcome,now()))
                    self.respond(200,{"ok":True,"outcome":outcome,"reference_answer":room["answer"],
                                      "note":"核对为精确文本匹配；是否看提示由参与者自报，不能作为经监管的成绩。"})
                    return
                if path=="/api/community/replies":
                    bottle_id=clean(payload.get("bottle_id"),"瓶子 ID",60)
                    row=db.execute("SELECT guest_id FROM bottles WHERE id=? AND status='visible'",(bottle_id,)).fetchone()
                    if not row:self.error_json(404,"漂流瓶不存在");return
                    content=clean(payload.get("content"),"回信内容",800)
                    method=clean(payload.get("method",""),"记忆方法",60,False)
                    ident=uuid.uuid4().hex
                    db.execute("INSERT INTO replies(id,bottle_id,guest_id,content,method,created_at) VALUES(?,?,?,?,?,?)",
                               (ident,bottle_id,uid,content,method,now()))
                    self.respond(201,{"ok":True,"id":ident});return
                if path=="/api/community/best":
                    reply_id=clean(payload.get("reply_id"),"回信 ID",60)
                    row=db.execute("""SELECT r.bottle_id,b.guest_id FROM replies r JOIN bottles b ON b.id=r.bottle_id
                        WHERE r.id=? AND r.status='visible'""",(reply_id,)).fetchone()
                    if not row:self.error_json(404,"回信不存在");return
                    if row["guest_id"]!=uid:self.error_json(403,"只能精选自己漂流瓶收到的回信");return
                    db.execute("UPDATE replies SET is_best=0 WHERE bottle_id=?",(row["bottle_id"],))
                    db.execute("UPDATE replies SET is_best=1 WHERE id=?",(reply_id,))
                    self.respond(200,{"ok":True});return
                if path=="/api/community/reaction":
                    target=clean(payload.get("target_type"),"对象",12)
                    kind=clean(payload.get("kind"),"互动类型",10)
                    ident=clean(payload.get("target_id"),"记录 ID",60)
                    if kind not in ("like","save") or target not in ("bottle","reply") or (target=="reply" and kind=="save"):
                        raise ValueError("操作不支持")
                    table="bottles" if target=="bottle" else "replies"
                    if not db.execute(f"SELECT 1 FROM {table} WHERE id=? AND status='visible'",(ident,)).fetchone():
                        self.error_json(404,"目标不存在");return
                    if db.execute("SELECT 1 FROM reactions WHERE guest_id=? AND target_type=? AND target_id=? AND kind=?",
                                  (uid,target,ident,kind)).fetchone():
                        db.execute("DELETE FROM reactions WHERE guest_id=? AND target_type=? AND target_id=? AND kind=?",
                                   (uid,target,ident,kind));active=False
                    else:
                        db.execute("INSERT INTO reactions(guest_id,target_type,target_id,kind) VALUES(?,?,?,?)",
                                   (uid,target,ident,kind));active=True
                    self.respond(200,{"ok":True,"active":active});return
                if path in ("/api/community/follow","/api/community/block"):
                    target=clean(payload.get("user_id"),"游客 ID",60)
                    if target==uid:raise ValueError("不能对自己执行这个操作")
                    if not db.execute("SELECT 1 FROM guests WHERE id=?",(target,)).fetchone():
                        self.error_json(404,"游客不存在");return
                    table,cols=("follows",("follower","followee")) if path.endswith("/follow") else ("blocks",("blocker","blocked"))
                    if db.execute(f"SELECT 1 FROM {table} WHERE {cols[0]}=? AND {cols[1]}=?",(uid,target)).fetchone():
                        db.execute(f"DELETE FROM {table} WHERE {cols[0]}=? AND {cols[1]}=?",(uid,target));active=False
                    else:
                        db.execute(f"INSERT INTO {table}({cols[0]},{cols[1]}) VALUES(?,?)",(uid,target));active=True
                        if table=="blocks":db.execute("DELETE FROM follows WHERE follower=? AND followee=?",(uid,target))
                    self.respond(200,{"ok":True,"active":active});return
                if path=="/api/community/messages":
                    target=clean(payload.get("to"),"收件游客 ID",60)
                    if target==uid:raise ValueError("不能给自己发送消息")
                    followed=db.execute("SELECT 1 FROM follows WHERE follower=? AND followee=?",(uid,target)).fetchone()
                    reverse=db.execute("SELECT 1 FROM follows WHERE follower=? AND followee=?",(target,uid)).fetchone()
                    blocked=db.execute("SELECT 1 FROM blocks WHERE (blocker=? AND blocked=?) OR (blocker=? AND blocked=?)",
                                       (uid,target,target,uid)).fetchone()
                    if not followed or not reverse or blocked:
                        self.error_json(403,"只有互相关注且未屏蔽的搭子才能私信");return
                    content=clean(payload.get("content"),"消息内容",500)
                    ident=uuid.uuid4().hex
                    db.execute("INSERT INTO messages VALUES(?,?,?,?,?,?)",(ident,uid,target,content,now(),"visible"))
                    self.respond(201,{"ok":True,"id":ident});return
                if path=="/api/community/challenge":
                    ident=clean(payload.get("id"),"挑战",40)
                    if not db.execute("SELECT 1 FROM challenges WHERE id=?",(ident,)).fetchone():
                        self.error_json(404,"挑战不存在");return
                    action=payload.get("action","join")
                    if action not in ("join","complete"):raise ValueError("无效的挑战操作")
                    db.execute("INSERT OR IGNORE INTO challenge_entries(guest_id,challenge_id,joined_at) VALUES(?,?,?)",
                               (uid,ident,now()))
                    if action=="complete":
                        db.execute("UPDATE challenge_entries SET completed_at=? WHERE guest_id=? AND challenge_id=?",
                                   (now(),uid,ident))
                    self.respond(200,{"ok":True,"status":"self-reported" if action=="complete" else "joined"});return
                if path=="/api/community/report":
                    target=clean(payload.get("target_type"),"举报对象",12)
                    ident=clean(payload.get("target_id"),"举报对象 ID",60)
                    reason=clean(payload.get("reason"),"原因",220)
                    if target not in ("bottle","reply","user","room"):raise ValueError("不支持的举报对象")
                    table={"bottle":"bottles","reply":"replies","user":"guests","room":"study_rooms"}[target]
                    if not db.execute(f"SELECT 1 FROM {table} WHERE id=?",(ident,)).fetchone():
                        self.error_json(404,"举报对象不存在");return
                    db.execute("INSERT OR IGNORE INTO reports(id,reporter,target_type,target_id,reason,created_at) VALUES(?,?,?,?,?,?)",
                               (uuid.uuid4().hex,uid,target,ident,reason,now()))
                    count=db.execute("SELECT COUNT(*) FROM reports WHERE target_type=? AND target_id=?",(target,ident)).fetchone()[0]
                    if count>=3 and target in ("bottle","reply","room"):
                        table={"bottle":"bottles","reply":"replies","room":"study_rooms"}[target]
                        db.execute(f"UPDATE {table} SET status='hidden' WHERE id=?",(ident,))
                    self.respond(200,{"ok":True,"note":"举报已记录；达到阈值的内容会临时隐藏，仍需人工审核。"});return
                self.error_json(404,"操作不存在")
        except PermissionError as exc:
            self.error_json(401,str(exc))
        except ValueError as exc:
            self.error_json(400,str(exc))
        except sqlite3.Error:
            self.error_json(500,"数据库操作失败")

    def image_proxy(self):
        if not rate_ok((self.client_address[0],"image-generate"),2):
            self.error_json(429,"生图操作过于频繁");return
        with LOCK,connect() as db:
            if not get_user(db,self.authorization()):
                self.error_json(401,"需先进入游客身份，才能请求生成图片");return
        key=os.getenv("RIRIXIN_API_KEY")
        endpoint=os.getenv("RIRIXIN_IMAGE_ENDPOINT")
        if not key or not endpoint:
            self.error_json(503,"日日新服务尚未配置");return
        target=urlsplit(endpoint)
        if target.scheme!="https" or not target.hostname or target.username or target.password:
            self.error_json(503,"图像服务必须使用可信 HTTPS 地址");return
        try:
            payload=self.read_json()
            request=Request(endpoint,data=json.dumps(payload).encode(),method="POST",
                            headers={"Authorization":"Bearer "+key,"Content-Type":"application/json"})
            with urlopen(request,timeout=60) as reply:
                raw=reply.read(MAX_BODY+1)
            if len(raw)>MAX_BODY:raise ValueError("响应过大")
            self.respond(200,{"ok":True,"provider_response":json.loads(raw)})
        except Exception:
            self.error_json(502,"图片服务调用失败")

if __name__=="__main__":
    initialize()
    print("Memory Duet: http://%s:%s"%(HOST,PORT))
    ThreadingHTTPServer((HOST,PORT),Handler).serve_forever()
