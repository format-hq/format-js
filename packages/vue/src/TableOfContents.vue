<script lang="ts">
import type { TocLeader } from './types'

export interface TableOfContentsProps {
	/**
	 * CSS selector for the headings to list. Defaults to `h1, h2, h3`.
	 */
	collect?: string
	/**
	 * The dot leader between each entry's title and its page number. The default,
	 * `dots`, draws it; `none` leaves the run between them blank.
	 */
	leader?: TocLeader
	/**
	 * Repeat the leading content with the nav on every page the contents spans, like a
	 * running header. Off by default: the leading content shows once, above the entries.
	 */
	repeatHead?: boolean
}
</script>

<!--
	A table of contents. Format fills it after laying out the document: one entry per
	heading the `collect` selector matches, each with the heading's number, its
	title, and the page it landed on.

	The entries are flat anchors in a `<div data-type="toc-entries">` inside a
	`<nav data-type="toc">`: each is an `<a data-type="toc-entry" data-depth="N">`
	(depth 0 at the top of the outline) holding `toc-number`, `toc-title`, and
	`toc-page` spans. Depth is data, not nesting, so the stylesheet indents and sizes
	by depth and a long contents paginates by breaking between anchors. Style it through
	the `data-type` hooks and the `--toc-*` custom properties (root size, per-depth size
	and indent, page-number size, leader, and vertical rhythm). A `class` or `style` set
	on `<TableOfContents>` carries onto the nav. Set `leader="none"` to omit the dot leader
	entirely, so no leader is drawn between a title and its page number.

	The default slot is leading content shown above the entries — put a "Contents" heading
	there. It shows once by default; set `repeatHead` to repeat it with the nav per page.

		<TableOfContents collect="h1, h2">
			<h2>Contents</h2>
		</TableOfContents>

	Give a collected heading a `data-toc-description` and its entry gains a
	`toc-description` line under the title:

		<h1 data-toc-description="Defining the studio's personality and direction.">
			Visual Positioning
		</h1>
-->
<script setup lang="ts">
import { type VNode } from 'vue'
import Template from './Template.vue'

withDefaults(defineProps<TableOfContentsProps>(), { repeatHead: undefined })
defineSlots<{
	/** Leading content shown once above the entries, e.g. a "Contents" heading. */
	default?: () => VNode[]
}>()
</script>

<template>
	<Template
		data-type="toc"
		:data-collect="collect"
		:data-leader="leader"
		:data-repeat-head="repeatHead === undefined ? undefined : repeatHead ? 'true' : 'false'">
		<slot></slot>
	</Template>
</template>
