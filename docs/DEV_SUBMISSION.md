---
title: "PhantomCommit AI: following the ghosts of deleted code"
published: false
tags: devchallenge, hf26challenge, ai, gemma
---

Built for DEV’s [Week 4 challenge](https://dev.to/challenges/hacktoberfest-week4-2026-10-26), with Google Gemma at the center of the investigation.

## What I Built

PhantomCommit AI explores the code that a repository has left behind. Its starting point is a practical question: when a feature stops working, can we find the historical change that deserves investigation without asking an AI to guess?

The ghost is forgotten functionality preserved in Git. Code Graveyard turns removals into inspectable artifacts; Ghost Replay connects commits and historical snapshots. AI Detective asks Gemma to explain selected evidence, identify possible consequences, and recommend the next useful check. The goal is a developer tool with a restrained haunting, grounded in real history.

## Demo

**Before publishing:** add a real successful deployment URL or an actual recorded demo. No public deployment has been verified yet.

Locally, `/demo` provides a visibly labeled synthetic repository with a removed session check, a retired payment validator, a renamed rate limiter and an audit addition. It does not manufacture AI responses. Live mode requires Supabase and Google AI Studio credentials.

Suggested recording: import a small public repository; inspect a commit; open its removed code; compare snapshots; ask Gemma about possible effects; inspect the evidence references; ask a follow-up; reopen the saved investigation and export Markdown.

## Code

[PhantomCommit AI on GitHub](https://github.com/Y-Udayanga/PhantomCommitAI). The local implementation must be pushed before publication; the configured remote is not proof that these changes have been published.

## How I Built It

Next.js handles the workspace and authenticated API. GitHub REST supplies metadata, parent SHAs and patches. Deterministic hunk parsing identifies removed lines and preserves the difference between deletion, rename and missing evidence. Supabase stores owned repositories, commits, runs, findings, conversations and reports, with row policies following parent ownership.

Gemma receives selected excerpts rather than entire repositories. Lexical ranking favors commit-message, path and patch matches to a developer’s question. The official Google SDK calls `gemma-4-26b-a4b-it` through the Gemini API. JSON output is checked with Zod, then references are matched against retrieved SHAs, paths and changed-line quotes. Unsupported references are marked insufficient.

This solves only part of AI reliability: matching a citation does not prove the interpretation. Possible regressions remain hypotheses until tested. Intent stays unknown unless the available history documents it. Restoration proposals are displayed for review; they are never committed or executed.

### Engineering challenges and testing

The implementation separates deterministic observations from model interpretation, bounds work for serverless requests, caches inspected details, and handles unavailable patches and provider quotas. One review caught that cached file evidence was being discarded by history pagination; another added public-visibility checks before a server token can retrieve repository content.

Tests cover URL normalization, diff behavior, evidence rejection, provider failures and response parsing. The local PostgreSQL policy suite runs the actual migration with separate identities. Playwright checks the synthetic browser flow and mobile navigation. Credential-gated suites exist for the full live investigation and Supabase isolation.

**Before publishing:** copy the final executed results from `VERIFICATION.md`. Do not present skipped live checks as passing. Add observations from an actual Gemma investigation and any failures encountered there.

### What the implementation teaches

The useful unit is a claim plus inspectable evidence. Bounded context makes the selected scope visible, but also makes omissions unavoidable. A missing patch must produce uncertainty, not a more confident story. The next improvements are AST-aware function tracking, stronger semantic claim validation, broader historical retrieval and transactional investigation persistence.

## Why Does Open Innovation Matter?

Gemma’s open weights make future inspection, evaluation and alternative hosting possible. This implementation uses Google’s hosted inference for a simple deployment; it does not claim offline execution, zero provider dependence or fully local privacy. Users explicitly consent to sending selected excerpts to Google.

The evidence pipeline is separate from the model service, so the method can be evaluated independently of a model’s fluent explanation. Open application source and reproducible fixtures let another developer inspect where certainty ends and hypothesis begins.

## Prize Categories

Intended category: **Best Use of Gemma**, after validating and demonstrating the live Gemma workflow.

Draft structure and required tags checked against the [official challenge announcement and linked template](https://dev.to/devteam/join-the-hacktoberfest-open-source-ai-challenge-ghost-in-the-machine-2850-in-prizes-across-21-3cho). Review current eligibility and submission rules before publishing. This draft has not been posted to DEV.
