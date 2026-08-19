<script setup lang="ts">
import { Flow, Stream, Footnote, PageBreak } from '@format.dev/vue'

import ButtonLink from '../../components/ButtonLink.vue'
import { mountains } from './mountains'
import './feature-showcase.css'

const cssFeatures = [
	{ key: 'shadow', label: 'Drop shadow' },
	{ key: 'gradient', label: 'Gradients' },
	{ key: 'transform', label: 'Transforms' },
	{ key: 'grid', label: 'Grid' },
	{ key: 'flex', label: 'Flexbox' },
	{ key: 'radius', label: 'Rounded corners' },
	{ key: 'orphans', label: 'Orphans & widows' },
	{ key: 'breaks', label: 'Break before/after' },
	{ key: 'pattern', label: 'Repeating patterns' }
]

const tileSpanCounts: Record<string, number> = {
	grid: 7,
	flex: 3,
	orphans: 4,
	breaks: 5
}
</script>

<template>
	<section class='showcase-intro'>
		<h2>Made it this far?</h2>
		<p>You're clearly in the zone. Let's demonstrate a few stand out features.</p>
	</section>

	<section class='showcase-feature'>
		<h3 class='feature-heading'>Tables that paginate themselves</h3>
		<p>
			A long table is notoriously tricky to get right when you're making PDFs from HTML and CSS. Format flows the
			rows across as many pages as they need, and repeats the header row on each one. Remember, in the table example
			below, we haven't explicitly told Format where to split the table, it just flows across the two pages
			automatically.
		</p>
	</section>

	<Flow>
		<div class='feature-table'>
			<p class='feature-table-caption'>The world's highest mountains</p>
			<table>
				<thead>
					<tr>
						<th>Peak</th>
						<th class='height'>Height</th>
						<th>Range</th>
						<th>Country</th>
					</tr>
				</thead>
				<tbody>
					<Stream>
						<tr v-for="mountain in mountains" :key="mountain.peak">
							<td class='peak'>{{ mountain.peak }}</td>
							<td class='height'>{{ mountain.height }}</td>
							<td>{{ mountain.range }}</td>
							<td>{{ mountain.country }}</td>
						</tr>
					</Stream>
				</tbody>
			</table>
		</div>
	</Flow>

	<PageBreak />

	<section class='showcase-feature'>
		<h3 class='feature-heading'>Flowing prose and footnotes</h3>
		<p>
			Format's pagination model is very effective for long-form text that you want to flow naturally across pages.
			Choose your <code>splitGranularity</code> and let the engine do the rest. Check out the automatic
			<code>&lt;Footnote&gt;</code> system too.
		</p>
	</section>

	<Flow split-granularity='word'>
		<div class='feature-prose'>
			<svg class='fleuron' width='10' height='10' aria-hidden='true' xmlns='http://www.w3.org/2000/svg' viewBox='0 0 766 766' fill='currentColor'><path d='M157 675Q133 675 112 654Q91 633 91 609Q91 583 114 560Q131 543 152.5 530.0Q174 517 200 504Q223 492 248.0 477.0Q273 462 302 440Q289 422 285 400Q250 405 221.5 412.0Q193 419 168 427Q140 436 115.5 442.0Q91 448 68 448Q36 448 18.0 430.5Q0 413 0 383Q0 353 18.0 335.5Q36 318 68 318Q91 318 115.5 324.0Q140 330 168 339Q193 347 221.5 354.0Q250 361 286 367Q290 344 303 326Q274 304 248.5 289.0Q223 274 200 262Q174 248 152.5 235.0Q131 222 114 206Q91 183 91 157Q91 133 112 112Q133 91 157 91Q183 91 206 114Q223 130 236.0 152.0Q249 174 262 200Q274 223 289.0 248.5Q304 274 326 303Q344 289 367 286Q361 250 354.0 221.5Q347 193 339 168Q330 139 324.0 115.0Q318 91 318 68Q318 36 335.5 18.0Q353 0 383 0Q413 0 430.5 18.0Q448 36 448 68Q448 91 442.0 115.0Q436 139 427 168Q419 193 412.0 221.5Q405 250 400 285Q422 289 440 302Q462 273 477.0 248.0Q492 223 504 200Q518 174 531.0 152.0Q544 130 560 114Q583 91 609 91Q633 91 654 112Q675 133 675 157Q675 183 652 206Q636 222 614.0 235.0Q592 248 566 262Q543 274 518.0 289.0Q493 304 464 326Q477 344 481 367Q516 361 544.5 354.0Q573 347 598 339Q627 330 651.0 324.0Q675 318 698 318Q730 318 748.0 335.5Q766 353 766 383Q766 413 748.0 430.5Q730 448 698 448Q675 448 651.0 442.0Q627 436 598 427Q573 419 544.5 412.0Q516 405 481 400Q477 422 464 441Q493 462 518.0 477.0Q543 492 566 504Q592 517 614.0 530.0Q636 543 652 560Q675 583 675 609Q675 633 654 654Q633 675 609 675Q583 675 560 652Q544 635 531.0 613.5Q518 592 504 566Q492 543 477.0 518.0Q462 493 441 464Q422 477 400 481Q405 516 412.0 544.5Q419 573 427 598Q436 626 442.0 650.5Q448 675 448 698Q448 730 430.5 748.0Q413 766 383 766Q353 766 335.5 748.0Q318 730 318 698Q318 675 324.0 650.5Q330 626 339 598Q347 573 354.0 544.5Q361 516 367 481Q344 477 326 464Q304 493 289.0 518.0Q274 543 262 566Q249 592 236.0 613.5Q223 635 206 652Q183 675 157 675Z'/></svg>
			<p>
				In the early 1990s, digital documents were strangely unstable<Footnote>Format lifts this note to the foot of the page it lands on, and numbers it for you.</Footnote>.
				You could write something, send it across town, and see it return with different fonts, altered spacing, and
				page breaks that landed wherever they felt like. The text survived, but the layout, the thing that made it
				readable, often didn't.
			</p>
			<p>
				That wasn't because computers couldn't show text. It was because they all did it differently. Operating
				systems handled fonts in inconsistent ways, printers relied on varied drivers and defaults, and even similar
				setups could disagree on margins or letter widths. A document was less a finished object than a set of
				instructions open to interpretation.
			</p>
			<p>
				PDF showed up as a practical fix: a format designed to preserve the look of a page. Instead of depending on
				the recipient's computer to recreate the layout, a PDF includes what's needed to render the page
				consistently. It acted like digital paper, portable, stable, and reliable across devices.
			</p>
			<p>
				At first, that predictability was the whole pitch. Manuals, invoices, design proofs, anything official
				needed certainty, not improvisation. The promise was simple: what you see is what they will see, down to the
				last line break.
			</p>
			<p>
				Adoption took time, but PDFs fit into existing habits<Footnote>Format numbers footnotes continuously through the whole document.</Footnote>. They printed
				cleanly, handled images and typography well, and could be shared as a single file rather than a messy bundle
				of fonts and linked graphics. For organizations, that alone made exporting to PDF worth it.
			</p>
			<p>
				As the web became the main way information traveled, portability mattered even more. Documents weren't just
				moving between coworkers; they were crossing platforms, browsers, and devices that didn't share the same
				assumptions. A PDF offered a straightforward deal: you can view this without rebuilding it.
			</p>
			<p>
				PDF also changed how a file felt. Editable formats implied collaboration and revision; PDFs implied reading,
				signing, and completion. Even if the content could still change later, the format signaled intent: this is
				the document, not a draft.
			</p>
			<svg class='fleuron' width='10' height='10' aria-hidden='true' xmlns='http://www.w3.org/2000/svg' viewBox='0 0 766 766' fill='currentColor'><path d='M157 675Q133 675 112 654Q91 633 91 609Q91 583 114 560Q131 543 152.5 530.0Q174 517 200 504Q223 492 248.0 477.0Q273 462 302 440Q289 422 285 400Q250 405 221.5 412.0Q193 419 168 427Q140 436 115.5 442.0Q91 448 68 448Q36 448 18.0 430.5Q0 413 0 383Q0 353 18.0 335.5Q36 318 68 318Q91 318 115.5 324.0Q140 330 168 339Q193 347 221.5 354.0Q250 361 286 367Q290 344 303 326Q274 304 248.5 289.0Q223 274 200 262Q174 248 152.5 235.0Q131 222 114 206Q91 183 91 157Q91 133 112 112Q133 91 157 91Q183 91 206 114Q223 130 236.0 152.0Q249 174 262 200Q274 223 289.0 248.5Q304 274 326 303Q344 289 367 286Q361 250 354.0 221.5Q347 193 339 168Q330 139 324.0 115.0Q318 91 318 68Q318 36 335.5 18.0Q353 0 383 0Q413 0 430.5 18.0Q448 36 448 68Q448 91 442.0 115.0Q436 139 427 168Q419 193 412.0 221.5Q405 250 400 285Q422 289 440 302Q462 273 477.0 248.0Q492 223 504 200Q518 174 531.0 152.0Q544 130 560 114Q583 91 609 91Q633 91 654 112Q675 133 675 157Q675 183 652 206Q636 222 614.0 235.0Q592 248 566 262Q543 274 518.0 289.0Q493 304 464 326Q477 344 481 367Q516 361 544.5 354.0Q573 347 598 339Q627 330 651.0 324.0Q675 318 698 318Q730 318 748.0 335.5Q766 353 766 383Q766 413 748.0 430.5Q730 448 698 448Q675 448 651.0 442.0Q627 436 598 427Q573 419 544.5 412.0Q516 405 481 400Q477 422 464 441Q493 462 518.0 477.0Q543 492 566 504Q592 517 614.0 530.0Q636 543 652 560Q675 583 675 609Q675 633 654 654Q633 675 609 675Q583 675 560 652Q544 635 531.0 613.5Q518 592 504 566Q492 543 477.0 518.0Q462 493 441 464Q422 477 400 481Q405 516 412.0 544.5Q419 573 427 598Q436 626 442.0 650.5Q448 675 448 698Q448 730 430.5 748.0Q413 766 383 766Q353 766 335.5 748.0Q318 730 318 698Q318 675 324.0 650.5Q330 626 339 598Q347 573 354.0 544.5Q361 516 367 481Q344 477 326 464Q304 493 289.0 518.0Q274 543 262 566Q249 592 236.0 613.5Q223 635 206 652Q183 675 157 675Z'/></svg>
		</div>
		<div class='prose-learn-more'>
			<p>Learn more about how to split content across pages and how to work with footnotes.</p>
			<div class='button-row'>
				<ButtonLink href='https://format.dev/docs/document-model/types/flow'>Flow docs</ButtonLink>
				<ButtonLink href='https://format.dev/docs/document-model/types/footnote'>Footnote docs</ButtonLink>
			</div>
		</div>
	</Flow>

	<PageBreak />

	<section class='showcase-feature'>
		<h3 class='feature-heading'>Full support for modern CSS</h3>
		<p>
			You might have experienced other tools flattening or "rasterizing" certain CSS visuals such as box shadows,
			fancy borders or gradients. Format produces fully vector output, increasing fidelity, whilst decreasing
			filesize. Equally, all modern layout techniques are supported, like flexbox and grid.
		</p>
		<div class='css-demo'>
			<div v-for="feature in cssFeatures" :key="feature.key" :class="`css-demo-tile tile-${feature.key}`">
				<div class='tile-visual'>
					<span v-for="i in tileSpanCounts[feature.key] ?? 0" :key="i" />
				</div>
				<span class='tile-label'>{{ feature.label }}</span>
			</div>
		</div>

		<p>
			Take repeating backgrounds, for example. These are especially awkward in other tools, often either not
			displaying at all, or just getting rasterized, which, for anyone that wants quality will not be happy with. In
			Format, whether you're using <code>background-repeat</code> to tile an SVG or the <code>&lt;pattern&gt;</code>
			tag inside an SVG on the page, you'll get crisp pattern repeats and small PDF filesizes.
		</p>

		<div class='css-pattern-demo'>
			<svg class='css-pattern' aria-hidden='true'>
				<defs>
					<pattern
						id='fs-diagonal-stripes'
						width='14'
						height='14'
						fill='#999'
						patternUnits='userSpaceOnUse'
						patternTransform='rotate(-45)'>
						<rect class='css-pattern-stripe' width='6' height='14' />
					</pattern>
				</defs>
				<rect width='800' height='200' fill='url(#fs-diagonal-stripes)' />
			</svg>
			<span class='css-pattern-caption'>A seamless SVG &lt;pattern&gt;, kept as vector in the PDF</span>
		</div>

		<p>
			We've spent countless hours smoothing over CSS quirks and PDF-viewer edge cases, so your documents render the
			same everywhere, at the smallest file sizes, delivered fast over the wire.
		</p>
	</section>

	<section class='showcase-feature'>
		<h3 class='feature-heading'>And there's plenty more&hellip;</h3>
		<p>
			We're determined to conquer every feature and every edge-case in HTML and CSS, so you can build the very
			highest quality PDFs. Here are a few other features to read about.
		</p>
		<ul class='more-list'>
			<li>
				<strong>Automatic tables of contents.</strong> Built from your headings, with page numbers filled in after
				layout. Even use several ToCs in one document with no overlap.
				<ButtonLink inline href='https://format.dev/docs/document-model/types/table-of-contents'>
					ToC docs
				</ButtonLink>
			</li>
			<li>
				<strong>Page counters.</strong> Live page numbers and totals in any numbering style.
				<ButtonLink inline href='https://format.dev/docs/document-model/types/counter'>
					Counter docs
				</ButtonLink>
			</li>
			<li>
				<strong>Numbered figures and cross-references.</strong> Number a figure or heading, then point to it by
				name. "See Figure 3" resolves to the right number even as content reflows.
				<ButtonLink inline href='https://format.dev/docs/document-model/types/ref'>
					Ref docs
				</ButtonLink>
			</li>
			<li>
				<strong>Endnotes and references.</strong> Collect footnotes into an endnotes list, or output the page a
				target landed on once the layout settles.
				<ButtonLink inline href='https://format.dev/docs/document-model/types/footnotes'>
					Endnotes docs
				</ButtonLink>
			</li>
		</ul>
	</section>
</template>
