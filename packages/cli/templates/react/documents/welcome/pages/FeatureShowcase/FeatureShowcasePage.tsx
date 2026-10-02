import { Flow, Stream, Footnote, PageBreak } from '@format.dev/react'
import { ButtonLink } from '../../components/ButtonLink'
import Fleuron from '../../icons/propeller-asterisk.svg'
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

export function FeatureShowcasePage() {
	return (
		<>
			<section className='showcase-intro'>
				<h2>Made it this far?</h2>
				<p>You're clearly in the zone. Let's demonstrate a few stand out features.</p>
			</section>

			<section className='showcase-feature'>
				<h3 className='feature-heading'>Tables that paginate themselves</h3>
				<p>
					A long table is notoriously tricky to get right when you're making PDFs from HTML and CSS. Format flows the
					rows across as many pages as they need, and repeats the header row on each one. Remember, in the table example
					below, we haven't explicitly told Format where to split the table, it just flows across the two pages
					automatically.
				</p>
			</section>

			<Flow>
				<div className='feature-table'>
					<p className='feature-table-caption'>The world's highest mountains</p>
					<table>
						<thead>
							<tr>
								<th>Peak</th>
								<th className='height'>Height</th>
								<th>Range</th>
								<th>Country</th>
							</tr>
						</thead>
						<tbody>
							<Stream>
								{mountains.map(mountain => (
									<tr key={mountain.peak}>
										<td className='peak'>{mountain.peak}</td>
										<td className='height'>{mountain.height}</td>
										<td>{mountain.range}</td>
										<td>{mountain.country}</td>
									</tr>
								))}
							</Stream>
						</tbody>
					</table>
				</div>
			</Flow>

			<PageBreak />

			<section className='showcase-feature'>
				<h3 className='feature-heading'>Flowing prose and footnotes</h3>
				<p>
					Format's pagination model is very effective for long-form text that you want to flow naturally across pages.
					Choose your <code>splitGranularity</code> and let the engine do the rest. Check out the automatic{' '}
					<code>&lt;Footnote&gt;</code> system too.
				</p>
			</section>

			<Flow splitGranularity='word'>
				<div className='feature-prose'>
					<Fleuron className='fleuron' width={10} height={10} />
					<p>
						In the early 1990s, digital documents were strangely unstable
						<Footnote>Format lifts this note to the foot of the page it lands on, and numbers it for you.</Footnote>.
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
						Adoption took time, but PDFs fit into existing habits
						<Footnote>Format numbers footnotes continuously through the whole document.</Footnote>. They printed
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
					<Fleuron className='fleuron' width={10} height={10} />
				</div>
				<div className='prose-learn-more'>
					<p>Learn more about how to split content across pages and how to work with footnotes.</p>
					<div className='button-row'>
						<ButtonLink href='https://format.dev/docs/document-model/types/flow'>Flow docs</ButtonLink>
						<ButtonLink href='https://format.dev/docs/document-model/types/footnote'>Footnote docs</ButtonLink>
					</div>
				</div>
			</Flow>

			<PageBreak />

			<section className='showcase-feature'>
				<h3 className='feature-heading'>Full support for modern CSS</h3>
				<p>
					You might have experienced other tools flattening or "rasterizing" certain CSS visuals such as box shadows,
					fancy borders or gradients. Format produces fully vector output, increasing fidelity, whilst decreasing
					filesize. Equally, all modern layout techniques are supported, like flexbox and grid.
				</p>
				<div className='css-demo'>
					{cssFeatures.map(({ key, label }) => (
						<div className={`css-demo-tile tile-${key}`} key={key}>
							<div className='tile-visual'>
								{key === 'grid' && Array.from({ length: 7 }, (_, i) => <span key={i} />)}
								{key === 'flex' && Array.from({ length: 3 }, (_, i) => <span key={i} />)}
								{key === 'orphans' && Array.from({ length: 4 }, (_, i) => <span key={i} />)}
								{key === 'breaks' && Array.from({ length: 5 }, (_, i) => <span key={i} />)}
							</div>
							<span className='tile-label'>{label}</span>
						</div>
					))}
				</div>

				<p>
					Take repeating backgrounds, for example. These are especially awkward in other tools, often either not
					displaying at all, or just getting rasterized, which, for anyone that wants quality will not be happy with. In
					Format, whether you're using <code>background-repeat</code> to tile an SVG or the <code>{'<pattern>'}</code>{' '}
					tag inside an SVG on the page, you'll get crisp pattern repeats and small PDF filesizes.
				</p>

				<div className='css-pattern-demo'>
					<svg className='css-pattern' aria-hidden='true'>
						<defs>
							<pattern
								id='fs-diagonal-stripes'
								width='14'
								height='14'
								fill='#999'
								patternUnits='userSpaceOnUse'
								patternTransform='rotate(-45)'>
								<rect className='css-pattern-stripe' width='6' height='14' />
							</pattern>
						</defs>
						<rect width='800' height='200' fill='url(#fs-diagonal-stripes)' />
					</svg>
					<span className='css-pattern-caption'>A seamless SVG &lt;pattern&gt;, kept as vector in the PDF</span>
				</div>

				<p>
					We've spent countless hours smoothing over CSS quirks and PDF-viewer edge cases, so your documents render the
					same everywhere, at the smallest file sizes, delivered fast over the wire.
				</p>
			</section>

			<section className='showcase-feature'>
				<h3 className='feature-heading'>And there's plenty more&hellip;</h3>
				<p>
					We're determined to conquer every feature and every edge-case in HTML and CSS, so you can build the very
					highest quality PDFs. Here are a few other features to read about.
				</p>
				<ul className='more-list'>
					<li>
						<strong>Automatic tables of contents.</strong> Built from your headings, with page numbers filled in after
						layout. Even use several ToCs in one document with no overlap.{' '}
						<ButtonLink inline href='https://format.dev/docs/document-model/types/table-of-contents'>
							ToC docs
						</ButtonLink>
					</li>
					<li>
						<strong>Page counters.</strong> Live page numbers and totals in any numbering style.{' '}
						<ButtonLink inline href='https://format.dev/docs/document-model/types/counter'>
							Counter docs
						</ButtonLink>
					</li>
					<li>
						<strong>Numbered figures and cross-references.</strong> Number a figure or heading, then point to it by
						name. "See Figure 3" resolves to the right number even as content reflows.{' '}
						<ButtonLink inline href='https://format.dev/docs/document-model/types/ref'>
							Ref docs
						</ButtonLink>
					</li>
					<li>
						<strong>Endnotes and references.</strong> Collect footnotes into an endnotes list, or output the page a
						target landed on once the layout settles.{' '}
						<ButtonLink inline href='https://format.dev/docs/document-model/types/footnotes'>
							Endnotes docs
						</ButtonLink>
					</li>
				</ul>
			</section>
		</>
	)
}
