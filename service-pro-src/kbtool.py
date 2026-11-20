"""iCOOL Service Pro — knowledge-base source tool (used by the weekly supervising engineer).
The KB sources (guides, model catalogue, academy courses, build script, site.html) are kept here ENCRYPTED
(kb-src.tar.gz.enc) because the repo is public. The key is the platform data key: Supabase project
yjsaudrftboqnoqgfkfh, `select v from cmp.settings where k='dk'` (base64). Never print or commit it.

  python3 kbtool.py unpack <dk_file> <out_dir>    # decrypt sources into out_dir (contains kb/, build_kb.py, site.html, logo_s.png)
  python3 kbtool.py pack   <dk_file> <src_dir>    # re-encrypt sources from src_dir into kb-src.tar.gz.enc
Build: in <out_dir> put the key in dk.txt, run `python3 -I build_kb.py` (writes ../compressor-guide/kb.enc via the path inside
build_kb.py — adjust OUT if needed) and paste the printed acad_courses.sql into Supabase when courses/lessons change.
"""
import sys, os, io, tarfile, base64, json
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
HERE = os.path.dirname(os.path.abspath(__file__)); BLOB = os.path.join(HERE, "kb-src.tar.gz.enc")
def key(p): return base64.b64decode(open(p).read().strip())
cmd, kf, d = sys.argv[1], sys.argv[2], sys.argv[3]
if cmd == "pack":
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as t:
        for n in ["kb", "build_kb.py", "site.html", "logo_s.png"]:
            t.add(os.path.join(d, n), arcname=n, filter=lambda ti: None if ti.name.endswith(("dk.txt", ".pyc")) else ti)
    iv = os.urandom(12); ct = AESGCM(key(kf)).encrypt(iv, buf.getvalue(), None)
    json.dump({"iv": base64.b64encode(iv).decode(), "ct": base64.b64encode(ct).decode()}, open(BLOB, "w"))
    print("packed", len(buf.getvalue()) // 1024, "KB")
elif cmd == "unpack":
    j = json.load(open(BLOB)); raw = AESGCM(key(kf)).decrypt(base64.b64decode(j["iv"]), base64.b64decode(j["ct"]), None)
    os.makedirs(d, exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(raw), mode="r:gz") as t: t.extractall(d, filter="data")
    print("unpacked into", d)
