#!/usr/bin/env python3
"""Content studio helper for the edit-studio skill (Runneth only).

  python3 studio.py install --name "Alysha"
      Puts the studio page into the app made by `app create content-studio`
      and sets the name in "Welcome to your content studio, <name>". Run once.

  python3 studio.py list
      Prints every project, so you can find the one a video already has.

  python3 studio.py new-project --title "Buoy founder ad breakdown"
      Makes the project folder in the brain and its card in the studio.
      If the video already has a project, prints that one instead.

  python3 studio.py add-takes --project <slug> --takes takes.json
      Fills the Takes tab: one row per script line, one clip per take.

  python3 studio.py add-broll --project <slug> --video raw/b-roll/broll-1.mov --desc "Unboxing"
      Adds one full b-roll video to the B-roll tab, ready to mark clips on.

  python3 studio.py add-broll-picks --project <slug> --video-id v1 --picks picks.json
      Shows the clips kept from one b-roll video in the B-roll tab.

  python3 studio.py approve-broll --project <slug> --video-id v1
      After the person approves the kept clips: deletes that b-roll video's
      original from raw/b-roll and its copy in the studio, to save space.
      Use --video-id all for every video with kept clips.

  python3 studio.py add-version --project <slug> --video drafts/cut.mp4 --label "First cut"
      Adds an edit to the Review edit tab as the next version.

Every command prints one line of JSON with the project slug and the studio link.
The app lives at /agent/apps/content-studio unless --app-dir says otherwise.
"""
import argparse
import datetime
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
TEMPLATE = HERE.parent / "app"
DEFAULT_APP = Path("/agent/apps/content-studio")
DEFAULT_PROJECTS = Path("/agent/brain/projects")
TABS = ("takes", "broll", "review")


# ---------- small helpers ----------

def read_json(path, empty):
    return json.loads(path.read_text()) if path.exists() else empty


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n")


def slugify(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:70] or "video"


def run(cmd):
    out = subprocess.run(cmd, capture_output=True, text=True)
    if out.returncode != 0:
        sys.exit(f"ffmpeg failed: {' '.join(cmd)}\n{out.stderr[-800:]}")
    return out


def probe(video):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
         "stream=width,height:stream_tags=rotate:format=duration", "-of", "json", str(video)],
        capture_output=True, text=True,
    )
    try:
        info = json.loads(out.stdout)
        st = info["streams"][0]
        w, h = st["width"], st["height"]
        if str(st.get("tags", {}).get("rotate", "0")) in ("90", "270", "-90"):
            w, h = h, w
        return float(info["format"]["duration"]), w, h
    except (KeyError, IndexError, ValueError, json.JSONDecodeError):
        sys.exit(f"Can't read this video: {video}")


def light_scale(w, h):
    """Small, smooth-scrubbing copy: 540 wide for tall video, 960 wide for wide video."""
    return "scale=540:-2" if h >= w else "scale=960:-2"


def poster(video, out, at):
    run(["ffmpeg", "-y", "-v", "error", "-ss", str(at), "-i", str(video), "-frames:v", "1",
         "-vf", "scale=540:-2", str(out)])


def fast_copy(src, out):
    """Copy a video with its playback info up front so it starts playing before it fully loads."""
    out.parent.mkdir(parents=True, exist_ok=True)
    ok = subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-c", "copy",
                         "-movflags", "+faststart", str(out)], capture_output=True)
    if ok.returncode != 0:
        run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-c:v", "libx264", "-crf", "20",
             "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", str(out)])


def load_index(app):
    path = app / "data" / "projects.json"
    if not path.exists():
        sys.exit("The studio isn't set up yet. Run: python3 studio.py install --name \"<first name>\"")
    return path, read_json(path, {"owner": "", "projects": []})


def find_project(index, slug):
    p = next((x for x in index["projects"] if x["slug"] == slug), None)
    if p is None:
        sys.exit(f"No project called {slug}. Run: python3 studio.py list")
    return p


def touch(app, index_path, index, project, tab):
    """Record which tab has the newest work, so the card opens there."""
    project["latest"] = tab
    project["updated"] = datetime.date.today().isoformat()
    write_json(index_path, index)


def done(project, tab, extra=None):
    out = {"project": project["slug"], "title": project["title"], "link": f"#/{project['slug']}/{tab}"}
    out.update(extra or {})
    print(json.dumps(out, ensure_ascii=False))


# ---------- commands ----------

def install(app, name):
    cfg = app / "buildeth.app.json"
    if not cfg.exists():
        sys.exit(f"No app at {app}. Run: app create content-studio --icon film-slate --colors \"#15161A,#CFFF5B\"")
    route = json.loads(cfg.read_text()).get("route", f"/{app.name}").rstrip("/")
    site = app / "site"
    site.mkdir(exist_ok=True)
    for f in ("app.js", "styles.css", "theme.css"):
        shutil.copyfile(TEMPLATE / f, site / f)
    (site / "index.html").write_text((TEMPLATE / "index.html").read_text().replace("{{ROUTE}}", route))
    path = app / "data" / "projects.json"
    index = read_json(path, {"owner": "", "projects": []})
    if name:
        index["owner"] = name.strip()
    write_json(path, index)
    print(json.dumps({"installed": str(site), "owner": index["owner"]}))


def list_projects(app):
    _, index = load_index(app)
    print(json.dumps([{k: p.get(k) for k in ("slug", "title", "created", "folder", "latest")}
                      for p in index["projects"]], indent=1, ensure_ascii=False))


def new_project(app, title, date, projects_dir, emoji, ptype, brand):
    index_path, index = load_index(app)
    date = date or datetime.date.today().isoformat()
    slug = f"{date}-{slugify(title)}"
    same = next((p for p in index["projects"]
                 if p["slug"] == slug or p["title"].strip().lower() == title.strip().lower()), None)
    if same:
        return done(same, same.get("latest") or "takes", {"existing": True, "folder": same.get("folder")})

    folder = Path(projects_dir) / slug
    for sub in ("raw/a-roll", "raw/b-roll", "b-roll-picks", "drafts", "final"):
        (folder / sub).mkdir(parents=True, exist_ok=True)
    if not (folder / "script.md").exists():
        (folder / "script.md").write_text(f"# {title}: script\n\n_No script yet._\n")
    if not (folder / "version-log.md").exists():
        (folder / "version-log.md").write_text(f"# {title}: version log\n\nEvery version and what changed in it, newest at the bottom.\n")

    project = {"slug": slug, "title": title.strip(), "created": date, "folder": str(folder)}
    for k, v in (("emoji", emoji), ("type", ptype), ("brand", brand)):
        if v:
            project[k] = v
    index["projects"].insert(0, project)
    (app / "data" / "projects" / slug).mkdir(parents=True, exist_ok=True)
    write_json(index_path, index)
    done(project, "takes", {"existing": False, "folder": str(folder)})


def add_takes(app, slug, takes_file):
    index_path, index = load_index(app)
    project = find_project(index, slug)
    src = json.loads(Path(takes_file).read_text())
    base = app / "data" / "projects" / slug
    for d in ("clips", "posters"):
        shutil.rmtree(base / d, ignore_errors=True)
        (base / d).mkdir(parents=True)

    names = {}
    lines_out = []
    for li, line in enumerate(src["lines"], 1):
        n = line.get("n", li)
        takes_out = []
        for ti, t in enumerate(line["takes"], 1):
            video = Path(t["video"])
            if not video.exists():
                sys.exit(f"Video not found: {video}")
            if str(video) not in names:
                names[str(video)] = f"Video {chr(65 + len(names))}" if len(names) < 26 else f"Video {len(names) + 1}"
            tid = f"L{n:02d}-T{ti:02d}"
            start, end = float(t["start"]), float(t["end"])
            _, w, h = probe(video)
            clip = base / "clips" / f"{tid}.mp4"
            run(["ffmpeg", "-y", "-v", "error", "-ss", f"{start}", "-to", f"{end}", "-i", str(video),
                 "-vf", light_scale(w, h), "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
                 "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(clip)])
            poster(clip, base / "posters" / f"{tid}.jpg", min(0.5, (end - start) / 2))
            takes_out.append({
                "id": tid, "source": names[str(video)], "file": video.name,
                "start": round(start, 2), "end": round(end, 2), "dur": round(end - start, 2),
                "text": t.get("text", ""), "links": t.get("links", []),
            })
        lines_out.append({"n": n, "script": line["script"], "takes": takes_out})

    write_json(base / "takes.json", {"lines": lines_out, "videos": {v: k for k, v in names.items()}})
    touch(app, index_path, index, project, "takes")
    done(project, "takes", {"lines": len(lines_out), "takes": sum(len(l["takes"]) for l in lines_out)})


def add_broll(app, slug, video, desc):
    index_path, index = load_index(app)
    project = find_project(index, slug)
    video = Path(video)
    if not video.exists():
        sys.exit(f"Video not found: {video}")
    base = app / "data" / "projects" / slug
    data = read_json(base / "broll.json", {"videos": []})
    existing = next((v for v in data["videos"] if v.get("source") == str(video)), None)
    if existing:
        return done(project, "broll", {"videoId": existing["id"], "existing": True})

    n = len(data["videos"]) + 1
    vid = f"v{n}"
    dur, w, h = probe(video)
    out = base / "videos" / f"{vid}.mp4"
    out.parent.mkdir(parents=True, exist_ok=True)
    run(["ffmpeg", "-y", "-v", "error", "-i", str(video), "-vf", light_scale(w, h), "-c:v", "libx264",
         "-preset", "veryfast", "-crf", "25", "-g", "15", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k",
         "-movflags", "+faststart", str(out)])
    poster(out, base / "videos" / f"{vid}.jpg", min(1.0, dur / 2))
    data["videos"].append({"id": vid, "name": f"B-roll video {n}", "desc": desc or video.stem,
                           "source": str(video), "dur": round(dur, 2), "done": False, "picks": []})
    write_json(base / "broll.json", data)
    touch(app, index_path, index, project, "broll")
    done(project, "broll", {"videoId": vid})


def add_broll_picks(app, slug, video_id, picks_file):
    index_path, index = load_index(app)
    project = find_project(index, slug)
    base = app / "data" / "projects" / slug
    data = read_json(base / "broll.json", {"videos": []})
    v = next((x for x in data["videos"] if x["id"] == video_id), None)
    if v is None:
        sys.exit(f"No b-roll video {video_id} in {slug}. Add it first with add-broll.")
    picks = json.loads(Path(picks_file).read_text())
    picks = picks.get("picks", picks) if isinstance(picks, dict) else picks
    out = []
    for i, c in enumerate(picks, 1):
        clip = Path(c["file"])
        if not clip.exists():
            sys.exit(f"Clip not found: {clip}")
        stem = clip.stem
        dest = base / "picks" / f"{stem}.mp4"
        fast_copy(clip, dest)
        dur, _, _ = probe(dest)
        poster(dest, base / "picks" / f"{stem}.jpg", min(1.0, dur / 2))
        out.append({"pick": c.get("pick", i), "start": float(c["start"]), "end": float(c["end"]),
                    "file": stem, "why": c.get("why", ""), "line": c.get("line")})
    v["picks"], v["done"] = out, True
    write_json(base / "broll.json", data)
    touch(app, index_path, index, project, "broll")
    done(project, "broll", {"videoId": video_id, "picks": len(out)})


def approve_broll(app, slug, video_id):
    index_path, index = load_index(app)
    project = find_project(index, slug)
    base = app / "data" / "projects" / slug
    data = read_json(base / "broll.json", {"videos": []})
    targets = [v for v in data["videos"] if v.get("done") and (video_id == "all" or v["id"] == video_id)]
    if not targets:
        sys.exit(f"No b-roll video with kept clips matches {video_id}. Cut and add the picks first.")
    raw = (Path(project.get("folder", "")) / "raw" / "b-roll").resolve()
    freed, deleted = 0, []
    for v in targets:
        src = Path(v.get("source", ""))
        # Only originals inside this project's raw/b-roll folder are deleted.
        if src.is_file() and raw in src.resolve().parents:
            freed += src.stat().st_size
            src.unlink()
            deleted.append(src.name)
        for f in (base / "videos" / f"{v['id']}.mp4", base / "videos" / f"{v['id']}.jpg"):
            if f.exists():
                freed += f.stat().st_size
                f.unlink()
        v["approved"] = True
    write_json(base / "broll.json", data)
    touch(app, index_path, index, project, "broll")
    done(project, "broll", {"approved": [v["id"] for v in targets], "deletedOriginals": deleted,
                            "freedMB": round(freed / 1e6, 1)})


def add_version(app, slug, video, label):
    index_path, index = load_index(app)
    project = find_project(index, slug)
    video = Path(video)
    if not video.exists():
        sys.exit(f"Video not found: {video}")
    base = app / "data" / "projects" / slug
    review = read_json(base / "review.json", {"versions": []})
    v = max((x["v"] for x in review["versions"]), default=0) + 1
    out = base / "review" / f"v{v}.mp4"
    fast_copy(video, out)
    dur, _, _ = probe(out)
    poster(out, base / "review" / f"v{v}.jpg", min(1.0, dur / 2))
    today = datetime.date.today().isoformat()
    label = label or f"Version {v}"
    review["versions"].append({"v": v, "label": label, "date": today, "file": f"v{v}", "dur": round(dur, 2)})
    write_json(base / "review.json", review)

    # Keep the version in the project's drafts folder and start its version log entry.
    folder = Path(project.get("folder", ""))
    if folder.is_dir():
        draft = folder / "drafts" / f"v{v}-{slugify(label)}{video.suffix or '.mp4'}"
        if video.resolve() != draft.resolve():
            shutil.copyfile(video, draft)
        with open(folder / "version-log.md", "a") as log:
            log.write(f"\n## V{v} · {today} · {label}\n\n- \n")
    touch(app, index_path, index, project, "review")
    done(project, "review", {"version": v, "link": f"#/{slug}/review?v={v}"})


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--app-dir", default=str(DEFAULT_APP))
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("install"); a.add_argument("--name", default="", help="First name for the welcome title")
    sub.add_parser("list")
    a = sub.add_parser("new-project")
    a.add_argument("--title", required=True, help="Plain title, like 'Buoy founder ad breakdown'")
    a.add_argument("--date", default="", help="Date the project started (YYYY-MM-DD). Defaults to today")
    a.add_argument("--projects-dir", default=str(DEFAULT_PROJECTS))
    a.add_argument("--emoji", default=""); a.add_argument("--type", default=""); a.add_argument("--brand", default="")
    a = sub.add_parser("add-takes"); a.add_argument("--project", required=True); a.add_argument("--takes", required=True)
    a = sub.add_parser("add-broll"); a.add_argument("--project", required=True); a.add_argument("--video", required=True); a.add_argument("--desc", default="")
    a = sub.add_parser("add-broll-picks"); a.add_argument("--project", required=True); a.add_argument("--video-id", required=True); a.add_argument("--picks", required=True)
    a = sub.add_parser("approve-broll"); a.add_argument("--project", required=True); a.add_argument("--video-id", required=True)
    a = sub.add_parser("add-version"); a.add_argument("--project", required=True); a.add_argument("--video", required=True); a.add_argument("--label", default="")
    args = ap.parse_args()
    app = Path(args.app_dir)
    if args.cmd == "install":
        install(app, args.name)
    elif args.cmd == "list":
        list_projects(app)
    elif args.cmd == "new-project":
        new_project(app, args.title, args.date, args.projects_dir, args.emoji, args.type, args.brand)
    elif args.cmd == "add-takes":
        add_takes(app, args.project, args.takes)
    elif args.cmd == "add-broll":
        add_broll(app, args.project, args.video, args.desc)
    elif args.cmd == "add-broll-picks":
        add_broll_picks(app, args.project, args.video_id, args.picks)
    elif args.cmd == "approve-broll":
        approve_broll(app, args.project, args.video_id)
    else:
        add_version(app, args.project, args.video, args.label)


if __name__ == "__main__":
    main()
