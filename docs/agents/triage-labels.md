# Triage Labels

The skills speak in terms of five canonical triage roles. This repo tracks issues in **tally**, which
has no labels — it has **tags**. Each role maps to a tag string of the same name.

| Label in mattpocock/skills | Tag in our tracker | Meaning                                  |
| -------------------------- | ------------------ | ---------------------------------------- |
| `needs-triage`             | `needs-triage`     | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`       | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`  | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`  | Requires human implementation            |
| `wontfix`                  | `wontfix`          | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding tag
string from this table.

## Applying them

Add and remove one at a time so the rest of a todo's tags survive:

```bash
tally todos add-tag <id> --tag ready-for-agent
tally todos remove-tag <id> --tag needs-triage
tally todos list --status open --tag needs-triage     # the triage queue
tally todos tags                                      # tags actually in use
```

`tally todos update <id> --tags a,b` **replaces** the whole tag list — avoid it for triage.

## Triage state vs priority

These five are a workflow state and are mutually exclusive: a todo carries exactly one of them at a
time. Urgency is a separate axis — tally's own `--priority p0`…`p3` — so `wontfix` and `p0` are not
contradictory records, and moving a todo through triage never rewrites its priority.

Edit the middle column to match whatever vocabulary you actually use.
