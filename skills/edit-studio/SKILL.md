---
name: edit-studio
description: >-
  DRAFT (in progress with Alysha, October 27th, 2026). Give every video one project: a name, one folder in the brain, and one card in the content studio where its takes, b-roll picks and edit versions all live as tabs. Use whenever someone starts working on a video, and every time a video editing skill has takes, b-roll picks or a new version to show. Runneth only.
---

# Edit studio

The goal: every video someone works on is one project. It has one name, one folder, and one card in the content studio. Every editing step adds to that same project. Nothing starts a second project for the same video.

This skill is built for **Runneth** only. It needs the `app` command, which only Runneth has.

## Step 1: Name the project

As soon as someone starts working on a video, name it, before any folder or studio card exists.

- **Folder name:** the date the project started, then the brand or topic, then what the video is, all lowercase with hyphens. Example: `2026-10-27-buoy-founder-ad-breakdown`.
- **Title:** the same words written plainly, for the studio card. Example: "Buoy founder ad breakdown".
- The folder name never changes once it's made, even if the video changes direction.
- When a project for this video already exists, use it. Every later step (takes, b-roll, each new version) goes into that same project.

## Step 2: Make the project folder

The `projects/` folder in the brain holds every project. It's made once, the first time, and reused after that.

Each project gets this folder:

```
projects/
  <project folder name>/
    raw/
      a-roll/
      b-roll/
    b-roll-picks/
    drafts/
    final/
    script.md
    version-log.md
```

What goes where:

- **raw/a-roll:** the original talking-head footage, untouched.
- **raw/b-roll:** the original full b-roll videos, untouched.
- **b-roll-picks:** only the cut b-roll clips that were kept.
- **drafts:** every in-between version and working file.
- **final:** the finished video(s).
- **script.md:** the script.
- **version-log.md:** every version and what changed in it.

## Step 3: The content studio

### The first time: make the studio

The studio is made once, the first time someone works on a video. After that, every new video just adds a card to it.

- It's a private Runneth app that needs a sign-in to open.
- The home page title says "Welcome to your content studio, <first name>", using the person's first name. Ask for it once if it isn't known.

### One card per project

- The card shows the plain title ("Buoy founder ad breakdown").
- The card is made at the same time as the folder, so it exists before any footage comes in.
- Opening the card shows three tabs: 🎬 Takes, 🎥 B-roll, 🎞️ Review edit. A tab with nothing in it yet says so ("No takes yet"). It opens on whichever tab has the newest work.

_Still to write with Alysha, one step at a time: the Takes tab, the B-roll tab, the Review edit tab, and sending picks and notes back._
