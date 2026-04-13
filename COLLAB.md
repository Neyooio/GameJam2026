# Collaboration Rules

These rules apply to everyone contributing to this repository.

## 1) Do not merge directly into main

- `main` is protected and treated as the stable branch.
- Do not push commits directly to `main`.
- Do not merge pull requests into `main` without review and approval.

## 2) Always work in your own branch

- Create a branch from `main` before starting any task.
- Use branch names like:
  - `feature/your-name-short-topic`
  - `fix/your-name-short-topic`
  - `chore/your-name-short-topic`

Example:

```bash
git checkout main
git pull origin main
git checkout -b feature/alex-player-movement
```

## 3) Polish your code before opening a PR

- Keep commits focused and descriptive.
- Run the project and verify your changes.
- Fix obvious issues before requesting review.

## 4) Open a Pull Request to main

- Push your branch and create a PR to `main`.
- Include a clear summary of what changed and why.
- Request review from at least one collaborator.

## 5) Merge policy

- PRs should be approved before merge.
- Prefer squash merge unless the team decides otherwise.
- Delete merged branches to keep the repo clean.

## 6) Emergency fixes

- If a hotfix is needed, still use a branch and PR whenever possible.
- Any exception should be documented in the PR description.
