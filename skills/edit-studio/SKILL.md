---
name: edit-studio
description: >-
  Give every video one project: a name, one folder in the brain, and one card in the content studio app where its takes, b-roll and edit versions all live as tabs. Runneth only. Use whenever someone starts working on a video, uploads footage, and every time a video editing skill (a-roll, b-roll processing, b-roll selection, any edit or render) has takes, b-roll or a new version to show. Also use when someone asks for "the studio", "my content studio", "my projects", or pastes picks, notes or an approval copied from the studio.
---

# Edit studio

The goal: every video someone works on is one project. It has one name, one folder, and one card in the content studio. Every editing step adds to that same project: the takes go in its Takes tab, the b-roll goes in its B-roll tab, and every edit goes in its Review edit tab. Each video gets exactly one project, from the first upload to the final.

This skill is built for **Runneth** only. It needs the `app` command, which only Runneth has.

All commands below run the helper script in this skill's folder: `python3 scripts/studio.py <command>`. Each one prints one line with the project's slug and its studio link.

## Step 1: Find the project or name a new one

Every video gets its project before any editing starts. This runs first, every time footage comes in or someone starts on a video, before the a-roll, b-roll or any other editing skill.

Before anything else, run `python3 scripts/studio.py list` and look for a project that is this video.

- **This video already has a project** → use it. Every step from here goes into that project, including b-roll, new takes and new versions.
- **It's a new video** → name it:
  - **Title:** the brand or topic, then what the video is, written plainly. Example: "Buoy founder ad breakdown".
  - **Folder name:** the script adds the date the project started in front: `2026-10-27-buoy-founder-ad-breakdown`. The folder name stays the same for the life of the project, even if the video changes direction.

When it's unclear whether footage belongs to an existing project, ask in one line, naming the project you think it is.

## Step 2: Make the project

```bash
python3 scripts/studio.py new-project --title "Buoy founder ad breakdown"
```

Add `--brand "Buoy"`, `--emoji "💧"` or `--type "Short form"` when known; they show on the card. If a project with that title already exists, the script hands back that one and says `"existing": true`.

**Notion:** the project page shows "🔗 Open in Notion" only when the project has a Notion link. Add one only when Notion is connected to their Runneth and the video has its own Notion page (for example a row in their content board): pass `--notion "<page link>"` here, or later with `python3 scripts/studio.py set-notion --project <slug> --url "<page link>"`. Without Notion, leave it out and the studio shows no Notion link.

This makes the folder in the brain and the card in the studio together, so the card exists before any footage comes in:

```
projects/
  <project folder name>/
    raw/
      a-roll/
      b-roll/
    b-roll-picks/
    drafts/
    final/
    info.md
    script.md
    version-log.md
```

The `projects/` folder sits in the brain and is made once, the first time. Its `index.md` lists every project with a link to its info document; the script adds each new project to it.

What goes where:

- **raw/a-roll:** the original talking-head footage, untouched.
- **raw/b-roll:** the original full b-roll videos, untouched, until the person approves the kept clips. Then they're deleted to save space (see "Approving the kept clips").
- **b-roll-picks:** only the cut b-roll clips that were kept.
- **drafts:** every in-between version and working file.
- **final:** the finished video(s).
- **info.md:** the project's info document, kept short: what the video is, where its files are, the caption, what's said with times in the raw footage, and moments worth reusing as b-roll. The script makes it with these headings; fill each one in as that part exists (what it is right away, what's said after the first cut, the caption and final files when it's done).
- **script.md:** the script. Put it in as soon as there is one.
- **version-log.md:** every version and what changed in it.

As footage comes in, save each file straight into `raw/a-roll` or `raw/b-roll` before any editing skill runs, so every skill works from the project folder.

## Step 3: The first time, make the studio

The studio is made once, the first time someone works on a video. Do this only when `/agent/apps/content-studio` doesn't exist yet. Run from this skill's folder:

1. `app create content-studio --icon film-slate --colors "#15161A,#CFFF5B"`
2. Ask two things in one short message: their first name (for the welcome title, "Welcome to your content studio, <first name>"), and one accent color for their studio, as a color name or hex code. Turn a color name into a hex code. Then run `python3 scripts/studio.py install --name "<first name>" --accent "<#hex>"`.
3. `app check content-studio`. It should say no violations.

The studio needs a sign-in to open, so only people with access to this Runneth workspace can see the videos. Keep it that way unless the person asks for a public link.

Tell the person once, in one short line, that every video they work on now gets its own card in their content studio.

### The look

The studio is dark with two colors, each with one job:

- **Lime** is Runneth's color and is the same for everyone. It marks what's done or picked: the hearted take, approved versions, kept clips, the open tab.
- **The accent** is the person's own color. It's on the main buttons (Copy my notes, Save note, Copy my picks, Save this clip), the info tags and the Open in Notion link.

To change the accent later: `python3 scripts/studio.py set-accent --color "<#hex>"`.

## Step 4: Fill the tabs as the editing skills run

Opening a project shows three tabs: 🎬 Takes, 🎥 B-roll, 🎞️ Review edit. It opens on the tab with the newest work. An empty tab says so.

### 🎬 Takes

When the a-roll has been sorted into takes (every take of every line, from the a-roll skill), write them to a small file and load them:

```json
{"lines": [
  {"n": 1, "script": "I slept like garbage last night.",
   "takes": [
     {"video": "<project>/raw/a-roll/video-a.mov", "start": 2.76, "end": 7.52, "text": "I slept like garbage last night."},
     {"video": "<project>/raw/a-roll/video-b.mov", "start": 0.64, "end": 4.82, "text": "I slept like garbage last night."}
   ]}
]}
```

```bash
python3 scripts/studio.py add-takes --project <slug> --takes takes.json
```

Times are seconds in the original file. The script cuts a small clip of every take. The person hearts one take per line, plays their cut start to finish, and copies their picks back. Loading takes again replaces the last round.

### 🎥 B-roll

There are two ways b-roll lands here, matching the b-roll skill's opening question:

- **They want to pick the moments themselves:** add each full b-roll video from `raw/b-roll`:
  ```bash
  python3 scripts/studio.py add-broll --project <slug> --video <project>/raw/b-roll/broll-1-unboxing.mov --desc "Unboxing"
  ```
  They scrub it, mark a start and an end, say why, and copy their clips back. Their times match the original file, so cut from the original in `raw/b-roll`.
- **The clips are cut (by their picks or the AI's):** save the clips in `b-roll-picks`, then show them under their video:
  ```bash
  python3 scripts/studio.py add-broll-picks --project <slug> --video-id v1 --picks picks.json
  ```
  with `picks.json` like `[{"pick": 1, "start": 3.6, "end": 5.6, "file": "<project>/b-roll-picks/2026-10-27-v1-1-tired-sigh.mp4", "why": "The cat in the back makes it feel real.", "line": 5}]`. Run `add-broll` for that video first if it isn't in the tab yet (it prints the video id). `line` is optional.

### Approving the kept clips

Once clips are kept, ask the person to check them in the B-roll tab and approve them. They approve by saying so in the chat or with the tab's **Approve kept clips** button, which copies `✅ Approved b-roll clips: <title> · <videos>. You can delete the full videos.` Then run:

```bash
python3 scripts/studio.py approve-broll --project <slug> --video-id all
```

(or `--video-id v1` for one video). This deletes each approved video's original from `raw/b-roll` and its full copy in the studio, to save space. The kept clips in `b-roll-picks` and in the tab stay. Say in one line how much space it freed. The originals are deleted only after the person approves; until then they stay, so any clip can be recut.

### 🎞️ Review edit

Every time a video should be watched (a first cut, a round of fixes, b-roll added, headline and captions, the final), add it as the next version:

```bash
python3 scripts/studio.py add-version --project <slug> --video <path to the render> --label "First cut"
```

- **Label:** a few plain words about this version, like "First cut", "Tighter hook" or "B-roll added".
- The script keeps every earlier version, copies this one into `drafts/`, and starts its entry in `version-log.md`. Fill that entry in with what changed, one line per change.

## Step 5: Hand over the link

Get the studio's address from `app list` (the `url` for `content-studio`) and add the `link` the script printed, for example `#/2026-10-27-buoy-founder-ad-breakdown/review?v=2`. Hand it over with the app link and one line on what's new in it.

## When the person sends something back

Every tab has a copy button. Each pasted message names the project, so match it to that project:

- **Take picks** (`<title> take picks`, one line per script line, like `1. Take 2 · Video B 0:07.0-0:10.2 · L01-T02`): build the cut from those takes, then add it as a version.
- **B-roll clips** (`<title> b-roll picks`, grouped by video, each with a start, end, optional line and why): cut each clip from the original in `raw/b-roll`, save it in `b-roll-picks`, run `add-broll-picks`, pass the reasons to the b-roll skill so it learns from them, and ask them to approve the kept clips.
- **B-roll approval** (`✅ Approved b-roll clips: ...`): run `approve-broll` for those videos.
- **Notes** (`<title> · V2 (label) notes`, each with a time or "Whole video"): work through every note, render, add the result as the next version with a label saying what changed, and say which notes are done in the same order they wrote them.
- **Approval** (`✅ Approved: <title> · V3 (label).`): that version is the one they want. Carry on with the next editing step on it, or, if it's the final, copy it into `final/` and call it done.

Picks, clips, notes and approvals are saved in the person's browser until they copy them back.

## Keep it plain

The studio shows only the projects and their videos. It stays exactly as the install made it unless the person asks for a change.
