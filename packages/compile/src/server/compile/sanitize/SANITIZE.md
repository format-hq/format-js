# HTML sanitisation

This document covers the sanitisation pipeline in `packages/compile/src/server/compile/sanitize/` and its counterpart in Studio's preview renderer (`sanitize-html.ts`). Both share the same core modules.

## Guiding principle

The sanitiser enforces security only, never structural validity. It is deliberately permissive (DOMPurify-style) — allow almost everything, remove the dangerous bits. It is not an allow-list of supported tags and it never rewrites HTML structure.

Format composes documents from fragments. A `<Flow>` can hold a `<table>` skeleton while a nested `<Flow>` streams bare `<tr>` rows through a `<template>`, stitched together later by the engine. Any element can legitimately appear without its usual parent, so the `ancestors` rule and the id/name clobbering protection in `rehype-sanitize` are explicitly disabled. Parentless fragments (a lone `<li>`, `<tr>`, or `<dd>`) must survive sanitisation. Do not add structural validation.

## Behavioural decisions

**Forbidden tags remove their entire subtree.** This is deliberately stricter than DOMPurify's default unwrapping. `<html>`, `<head>`, and `<body>` survive in practice because the parser unwraps them before sanitisation; they stay on the forbidden list as a defensive backstop.

**URL policy is asymmetric.** `href`/`xlink:href` use a blocklist (`javascript:`, `vbscript:`, `data:`, `file:`, `blob:`) because a PDF link is an inert annotation the OS opens later. `<img src>` uses a whitelist (`http`, `https`, `data:`, relative) because images should never reach arbitrary schemes. Scheme obfuscation (casing, embedded tabs and newlines) is normalised before checking.

**Attribute allow-list is observed, not hard-coded.** `buildObservedSchema` scans the actual HTML and permits every attribute found, minus `on*` and `srcdoc`. A new engine `data-*` attribute passes through automatically. The only constraints when naming one: must not start with `on`, must not be `srcdoc`, and URL-carrying attributes go through the URL policy.

## Compile vs preview split

The split is about render capability, never security. Every security-motivated removal is identical across both paths.

Studio's preview keeps form controls (forced `disabled`) and all `<link>` tags, and returns diagnostics. Compile removes form controls, keeps only local `.css` stylesheet links (compiled output must be hermetic — remote CSS is inlined via `inlineRemoteCss`, which also resolves `@import` inside CSS files, but not `<link>` tags), and strips non-stylesheet `<link>`s because the engine throws on any `rel` other than `stylesheet`.

## Performance

`rehype-parse` (via `hast-util-from-parse5`) degrades quadratically on deeply nested `<template>` elements. Fixed in `shared.ts` by reusing the parsed tree and swapping `<template>` subtrees for placeholders during the parse. Keep that in mind before restructuring the pipeline.

## Prebundle

The compile path runs a prebundled copy (`generated/sanitizeHtml.mjs`). After changing sanitiser source, run `pnpm prebundle` or production compiles keep the old behaviour.
