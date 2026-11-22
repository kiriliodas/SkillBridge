# Hygienic Git Workflow

Use when committing, branching, preparing a pull request, resolving a conflict, or
recovering from a Git mistake.

## Committing

A commit is a reviewable unit that builds and passes tests on its own.

- **One logical change per commit.** A rename and a behaviour change belong in separate commits, so a revert of one does not take the other.
- **Message states the why, not the what.** The diff already shows the what.

```
fix(cache): scope entries by repository and revision

Keys were derived from the path alone, so two repositories holding the
same path shared cached bytes, and a new commit could serve stale content.

- Key on owner/repo/revision/path
- Treat unreadable storage as a miss instead of failing the build
- Add regression tests for cross-repository isolation
```

- Subject under ~72 characters, imperative mood, no trailing period. Body wrapped at ~72 columns.
- Reference the issue or motivation in the body. Never write "fixes stuff".

## Before pushing

Run the checks the project defines, not the ones you remember. Then confirm the working
tree is clean and the branch is what you think it is:

```
git status                     # nothing unexpected is staged
git log --oneline origin/main..HEAD   # only your intended commits
git diff origin/main...HEAD --stat    # the change is the size you expect
```

State the actual result of the checks. "Should pass" is not a verification.

## Branching

- Branch from the branch you will merge into, and keep it short-lived.
- Rebase onto the target while the branch is yours and unpushed; merge or rebase — never both — once it is shared.
- Never force-push a branch someone else may have based work on. `--force-with-lease` at minimum, and only on your own branch.

## Conflict resolution

1. Understand both sides before resolving: `git log --merge -p <file>` shows the commits that touched the conflicting lines.
2. Resolve by intent, not by deleting markers until it compiles. A syntactically valid but semantically wrong merge is the classic failure.
3. After resolving, run the tests. A conflict resolution is a code change and needs verification like any other.
4. If a merge is going badly, `git merge --abort` costs nothing; a corrupted history costs a lot.

## Recovery

| Mistake | Safe action |
|---|---|
| Wrong commit message, not pushed | `git commit --amend` |
| Forgot a file in the last commit | `git add <file> && git commit --amend --no-edit` |
| Committed to the wrong branch, not pushed | Create the right branch at HEAD, reset the wrong one back |
| Need to undo a pushed commit | `git revert <sha>` — never rewrite shared history |
| Accidentally discarded uncommitted work | `git fsck --lost-found`, then inspect dangling commits |
| Want to unstage but keep changes | `git restore --staged <file>` |

`git reset --hard`, `git clean -fdx` and `git push --force` destroy work that is not
recoverable from the history. Before any of them, confirm what would be lost with
`git status` and `git stash list`, and say so if you are running them on someone's behalf.

## Pull requests

- Title states the outcome; body states motivation, what changed, how it was verified, and what is deliberately out of scope.
- Keep the diff limited to the stated change. Unrelated drive-by edits make review harder and reverts riskier.
- List the verification commands and their real results, including anything that could not be run.
