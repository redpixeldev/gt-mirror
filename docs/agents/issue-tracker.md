# Issue tracker: tally

Issues, specs and working notes for this repo live in **tally**, not in GitHub Issues. Drive it with
the `tally` CLI (`~/.local/bin/tally`); the human watches the same store live in a `tally tui` pane.

Three record kinds, and the distinction matters:

| Kind           | What it holds                                                       | Use it for                                             |
| -------------- | ------------------------------------------------------------------- | ------------------------------------------------------ |
| **todo**       | one discrete unit of work — title, body, status, priority, tags      | a ticket                                               |
| **scratchpad** | a long revision-guarded markdown document                            | a spec, a plan, a handoff — anything too big for a body |
| **comment**    | a margin note against a todo or scratchpad (the _why_, not a state) | reasoning, findings, an answer                         |

A ticket is a **todo**. When its body outgrows a paragraph, put the prose in a **scratchpad** and
reference the scratchpad id from the todo body — don't inflate the todo.

## Scoping

The store is keyed to the project, inferred from the repo directory — every command run inside this
clone reads and writes the `gt-mirror` project (list output is headed `# gt-mirror — todos`). Pass
`--project <name>` only to reach across projects; normally never.

## Conventions

### Todos

```bash
# Create — --body-file <path> for multi-line bodies instead of --body
tally todos create --title "..." --body "..." --priority p1 --tag needs-triage

# Read one, with its comments
tally todos get <id>
tally comments list <id>

# List — human-readable markdown by default, --json for parsing
tally todos list --status open --tag ready-for-agent
tally todos list --json

# Update; omitted fields are preserved
tally todos update <id> --title "..." --body "..." --priority p0 --status open

# Tags: add/remove one at a time without clobbering the rest
tally todos add-tag <id> --tag needs-info
tally todos remove-tag <id> --tag needs-triage
tally todos tags            # distinct tags in use

# Finish / reopen / drop
tally todos complete <id>
tally todos incomplete <id>
tally todos delete <id>     # no --confirm, no revision guard — irreversible
```

`--priority` is `p0`|`p1`|`p2`|`p3` (p0 critical … p3 low); anything else is rejected. `--status` is
`open`|`in_progress`|`completed`. Other filters on `list`: `--query`, `--is-blocked <bool>`,
`--blocker <id>`, `--limit`, `--offset`.

**Never delete the human's todos.** Complete the ones you finish; leave the rest.

### Blockers and locks

Blocking is native — use it instead of writing "blocked by" into a body.

```bash
tally todos add-blocker <id> --blocker <blocker-id>
tally todos remove-blocker <id> --blocker <blocker-id>
tally todos set-blockers <id> --blocker <id> --blocker <id>   # replaces the whole list
```

Before editing a todo you're actively working, lock it; the owner is your agent identity and pid, so
the command takes no owner argument:

```bash
tally todos lock <id>
tally todos unlock <id>
tally todos update <id> --body "..." --release-lock   # write and release in one step
```

### Scratchpads

Writes are **revision-guarded**: every read reports a `revision`, and every write must pass the
revision it expects. On a mismatch the write is refused — re-read and reapply rather than forcing.

```bash
# Create with content in one step: title comes from the file's H1
tally scratchpads load-from-file --path <file.md>

# Or create empty, then name and fill it
tally scratchpads create
tally scratchpads rename <id> --name "..." --expected-revision <rev>

tally scratchpads read <id>                     # also --section-heading, --lines, --limit
tally scratchpads update <id> --content "..." --expected-revision <rev>   # replaces the body
tally scratchpads append <id> --content "..." --expected-revision <rev>
tally scratchpads append-section <id> --heading "..." --content "..." --expected-revision <rev>
tally scratchpads find <id> --query "..." --context-lines 3
tally scratchpads list                          # --query, --tag
tally scratchpads archive <id> --expected-revision <rev>
```

`--content-file <path>` takes the body from a file. **Archive, never delete**, a scratchpad the human
may still want; `delete` demands both `--expected-revision` and `--confirm`.

### Comments

```bash
tally comments add <target-id> --body "..." [--section <heading>]
tally comments list <target-id>
tally comments recent
tally comments targets
```

`<target-id>` is a todo id or a scratchpad id. A comment records reasoning; it does not change state
— flip status or tags on the todo itself.

## MCP

`tally mcp` speaks MCP over stdio and exposes the same operations as tools (`todo_create`,
`todo_list`, `todo_update`, `scratchpad_read`, `scratchpad_write`, `scratchpad_append_section`,
`comment_add`, …). When those tools are mounted in the session, prefer them over shelling out — they
return structured records directly. Falling back to the CLI is always correct.

## Optional GitHub mirror

Off by default. tally is the source of truth; a single todo can be opted into syncing with a real
GitHub issue on `redpixeldev/gt-mirror`:

```bash
tally todos update <id> --github on     # on|off; omitted leaves it unchanged
tally sync                              # push/pull linked todos ("nothing to sync" when none are linked)
```

This needs an authenticated `gh`. Don't enable it for a ticket unless the human asks — an unlinked
todo is the normal case.

## When a skill says "publish to the issue tracker"

Create a tally todo, tagged `needs-triage`. If the write-up is longer than a paragraph, put it in a
scratchpad and cite the scratchpad id in the todo body.

## When a skill says "fetch the relevant ticket"

`tally todos get <id>`, then `tally comments list <id>` for the discussion, then read any scratchpad
the body points at.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a scratchpad; **tickets** are todos.

- **Map**: a scratchpad tagged `wayfinder:map`, holding the Notes / Decisions-so-far / Fog sections.
  Grow it with `append-section`, not by rewriting the whole body.
- **Child ticket**: a todo tagged `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`) whose
  body opens with the map's scratchpad id.
- **Blocking**: `tally todos add-blocker <child> --blocker <blocker>`. A ticket is unblocked when
  every blocker is completed.
- **Frontier query**: `tally todos list --status open --is-blocked false --json`, filtered to the
  map's `wayfinder:*` tags, skipping any todo that already holds a lock; first in map order wins.
- **Claim**: `tally todos lock <id>` — the session's first write.
- **Resolve**: `tally comments add <id> --body "<answer>"`, then `tally todos complete <id>`, then
  `append-section` the decision onto the map's Decisions-so-far.
