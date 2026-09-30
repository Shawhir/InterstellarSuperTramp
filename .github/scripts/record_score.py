"""Check one submitted run and add it to scores.json.

Reads the run from the environment (see .github/workflows/score.yml), keeps each
name's best run per mode, and writes step outputs: ok, changed, name, message.
Everything a player sends is untrusted: it is parsed as JSON and validated here,
never passed to a shell.
"""
import json
import os
import re
import time
import unicodedata

BLOCKED = ["fuck", "shit", "cunt", "bitch", "bastard", "dick", "cock", "pussy", "wank", "twat",
           "slut", "whore", "nigg", "fag", "rape", "nazi", "hitler", "porn", "sex"]


def clean_name(raw):
    name = unicodedata.normalize("NFKC", str(raw or ""))
    name = re.sub(r"[^\w .'-]", "", name, flags=re.UNICODE)
    name = re.sub(r"\s+", " ", name).strip()[:16]
    squashed = re.sub(r"[^a-z]", "", name.lower().translate(str.maketrans("01345", "oieas")))
    if any(w in squashed for w in BLOCKED):
        return "Space Tramp"
    return name


def main():
    out = open(os.environ["GITHUB_OUTPUT"], "a")

    def finish(ok, message, changed=False, name=""):
        out.write(f"ok={'true' if ok else 'false'}\n")
        out.write(f"changed={'true' if changed else 'false'}\n")
        out.write(f"name={name}\n")
        out.write(f"message={message}\n")
        raise SystemExit(0)

    event = os.environ.get("EVENT", "")
    try:
        if event == "issues":
            m = re.search(r"```json\s*(\{.*?\})\s*```", os.environ.get("ISSUE_BODY", ""), re.S)
            if not m:
                finish(False, "I couldn't find the run details in this issue. Please post from the game's Moon screen.")
            run = json.loads(m.group(1))
            name = os.environ.get("ISSUE_AUTHOR", "")  # a real GitHub username
        else:
            raw = os.environ.get("DISPATCH_PAYLOAD") if event == "repository_dispatch" else os.environ.get("MANUAL_PAYLOAD")
            run = json.loads(raw or "{}")
            name = clean_name(run.get("name"))
    except ValueError:
        finish(False, "The run details aren't valid. Please post from the game's Moon screen.")

    if not isinstance(run, dict):
        finish(False, "The run details aren't valid.")
    if not name:
        finish(False, "A name is needed to post a score.")
    try:
        mode = run["mode"]
        entry = {
            "name": name,
            "time_ms": int(run["time_ms"]),
            "stars": int(run["stars"]),
            "total_stars": int(run["total_stars"]),
            "falls": int(run.get("falls", 0)),
            "at": int(time.time()),
        }
    except (KeyError, TypeError, ValueError):
        finish(False, "The run details are incomplete. Please post from the game's Moon screen.")
    if mode not in ("checkpoint", "uber") \
            or not 5000 <= entry["time_ms"] <= 3600000 \
            or not 1 <= entry["total_stars"] <= 100 \
            or not 0 <= entry["stars"] <= entry["total_stars"] \
            or not 0 <= entry["falls"] <= 1000:
        finish(False, "Those numbers don't look like a real run, so I haven't recorded it.")

    path = os.environ.get("SCORES_FILE", "scores.json")
    scores = json.load(open(path))
    rows = scores.setdefault(mode, [])

    def key(r):
        return (r["time_ms"], -r["stars"])

    same = lambda r: r["name"].lower() == name.lower()
    prev = next((r for r in rows if same(r)), None)
    improved = prev is None or key(entry) < key(prev)
    if improved:
        rows = [r for r in rows if not same(r)] + [entry]
    rows.sort(key=key)
    scores[mode] = rows[:200]
    with open(path, "w") as f:
        json.dump(scores, f, indent=2)
        f.write("\n")

    rank = next((i + 1 for i, r in enumerate(scores[mode]) if same(r)), None)
    label = "Checkpoint" if mode == "checkpoint" else "Uber Tramp"
    secs = entry["time_ms"] // 1000
    t = f"{secs // 60}:{secs % 60:02d}"
    if improved:
        msg = f"Recorded {name}: {t} with {entry['stars']}/{entry['total_stars']} stars, #{rank} of {len(scores[mode])} on the {label} board. It shows in the game in a minute or two."
    else:
        msg = f"Nice run ({t}), but {name}'s best on the {label} board is still faster, so the board keeps that one. #{rank} of {len(scores[mode])}."
    finish(True, msg, changed=improved, name=name)


if __name__ == "__main__":
    main()
