# Pawrent — Context Index

Navigation hub for all project context artifacts. Read this first in any session.

## Quick Links

| Artifact                                                                   | Purpose                                                    | Read When                                     |
| -------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------- |
| [product.md](product.md)                                                   | What we're building and why                                | Starting a new feature                        |
| [tech-stack.md](tech-stack.md)                                             | Technology choices and rationale                           | Adding dependencies or architecture decisions |
| [workflow.md](workflow.md)                                                 | How to work — session protocol, TDD, commits               | Starting any coding session                   |
| [agent-teams.md](agent-teams.md)                                           | Multi-agent coordination, topologies, file ownership       | Running agent team sessions                   |
| [code_styleguides/typescript.md](code_styleguides/typescript.md)           | Specific code patterns for this repo                       | Writing any TypeScript/React code             |
| [state.md](state.md)                                                       | Dynamic project state — active PRPs, blockers              | Every session start                           |
| [active-tasks.md](active-tasks.md)                                         | Task claiming — who's working on what                      | Before starting any task                      |
| [decisions.md](decisions.md)                                               | Architecture decision log                                  | Before making arch decisions                  |
| [../PRPs/ROADMAP.md](../PRPs/ROADMAP.md)                                   | Feature roadmap, execution order                           | Planning features                             |
| [../PRPs/00-tdd-quality-framework.md](../PRPs/00-tdd-quality-framework.md) | Quality gates, coverage rules, PDPA                        | Before every PR                               |
| [pipeline.md](pipeline.md)                                                 | PRP development pipeline — gates, steps, commands          | Running `/ship-prp` or any pipeline step      |
| [pipeline-status.md](pipeline-status.md)                                   | Active pipeline state — enables session resume             | Every session start                           |
| [../CLAUDE.md](../CLAUDE.md)                                               | Claude Code instructions — commands, conventions, warnings | Every session (auto-loaded)                   |
| [../.env.example](../.env.example)                                         | Required environment variables                             | Setting up environment                        |

## Current Status

- **Platform**: Line OA / LIFF web app for pet owners in Thailand
- **Version**: v0.2.x (PRPs 01-09 complete)
- **Next**: PRP-10 — Social Features
- **Stack**: Next.js 16 + Supabase + Vercel
- **Agent Mode**: Claude Code Agent Teams (tmux split panes)
