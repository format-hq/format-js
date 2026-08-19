import type { ComponentProps, ComponentType } from 'react'
import { Flow, Stream } from '@format.dev/react'
import { ButtonLink } from '../../components/ButtonLink'
import { CssOfficialIcon } from '../../logos/css-official'
import { SassIcon } from '../../logos/sass'
import { TailwindIcon } from '../../logos/tailwind'
import { CssModulesIcon } from '../../logos/css-modules'
import { PandaCssIcon } from '../../logos/panda-css'
import { LinariaIcon } from '../../logos/linaria'
import { VanillaExtractIcon } from '../../logos/vanilla-extract'
import { NodeIcon } from '../../logos/node'
import { BunIcon } from '../../logos/bun'
import { DenoIcon } from '../../logos/deno'
import { VercelIcon } from '../../logos/vercel'
import { CloudflareWorkersIcon } from '../../logos/cloudflare-workers'
import { AwsLambdaIcon } from '../../logos/aws-lambda'
import './next-steps.css'

type Logo = { name: string; Icon: ComponentType<ComponentProps<'svg'>> }

const stylingLogos: Logo[] = [
	{ name: 'CSS', Icon: CssOfficialIcon },
	{ name: 'Sass', Icon: SassIcon },
	{ name: 'Tailwind', Icon: TailwindIcon },
	{ name: 'CSS Modules', Icon: CssModulesIcon },
	{ name: 'Panda', Icon: PandaCssIcon },
	{ name: 'Linaria', Icon: LinariaIcon },
	{ name: 'Vanilla Extract', Icon: VanillaExtractIcon }
]

const deployLogos: Logo[] = [
	{ name: 'Node', Icon: NodeIcon },
	{ name: 'Bun', Icon: BunIcon },
	{ name: 'Deno', Icon: DenoIcon },
	{ name: 'Vercel', Icon: VercelIcon },
	{ name: 'Cloudflare', Icon: CloudflareWorkersIcon },
	{ name: 'AWS Lambda', Icon: AwsLambdaIcon }
]

function Logos({ items }: { items: Logo[] }) {
	return (
		<div className='logos-row'>
			{items.map(({ name, Icon }) => (
				<span className='logo-item' key={name}>
					<Icon />
					{name}
				</span>
			))}
		</div>
	)
}

export function NextStepsPage() {
	return (
		<>
			<section className='next-steps-page'>
				<h2>Your next steps</h2>
				<p>Here's the path from here to your first production PDF.</p>
			</section>

			<Flow>
				<ol className='next-steps'>
					<Stream>
						<li className='next-steps-step'>
							<span className='next-steps-marker'>1</span>
							<div className='next-steps-content'>
								<h3 className='next-steps-title'>Explore this document's code</h3>
								<p className='next-steps-body'>
									Open <code>documents/welcome</code> to see the source code for this document. It's purposely simple,
									using just a few Format primitives like <code>&lt;Layout&gt;</code> and <code>&lt;Flow&gt;</code>.
									It's also styled with plain CSS and uses Format's out the box fonts. Have a play with the code and see
									how the document changes.
								</p>
							</div>
						</li>
						<li className='next-steps-step'>
							<span className='next-steps-marker'>2</span>
							<div className='next-steps-content'>
								<h3 className='next-steps-title'>Create your own document</h3>
								<p className='next-steps-body'>
									Hit the{' '}
									<span className='plus-key' aria-hidden='true'>
										<svg
											width='13'
											height='13'
											viewBox='0 0 24 24'
											fill='none'
											stroke='currentColor'
											strokeWidth='2.2'
											strokeLinecap='round'>
											<path d='M12 5v14' />
											<path d='M5 12h14' />
										</svg>
									</span>{' '}
									button in the sidebar to scaffold a new document and see some of the options available.
								</p>
							</div>
						</li>
						<li className='next-steps-step'>
							<span className='next-steps-marker'>3</span>
							<div className='next-steps-content'>
								<h3 className='next-steps-title'>Build your first paged document</h3>
								<p className='next-steps-body'>Follow our step-by-step guide. You'll learn how to:</p>
								<ul className='learn-list'>
									<li>Use the document model</li>
									<li>Add repeating headers and footers</li>
									<li>Paginate content with page numbers</li>
									<li>Pass in dynamic data</li>
								</ul>
								<ButtonLink href='https://format.dev/docs/introduction/build-your-first-pdf'>
									Build your first PDF
								</ButtonLink>
							</div>
						</li>
						<li className='next-steps-step'>
							<span className='next-steps-marker'>4</span>
							<div className='next-steps-content'>
								<h3 className='next-steps-title'>Test your favorite frameworks</h3>
								<p className='next-steps-body'>
									Styling on the web brings out some pretty strong opinions! Format supports a wide range of popular
									frameworks so you can make fast progress without learning any new frameworks or syntax.
								</p>
								<Logos items={stylingLogos} />
								<ButtonLink href='https://format.dev/docs/studio/styling'>Explore styling</ButtonLink>
							</div>
						</li>
						<li className='next-steps-step'>
							<span className='next-steps-marker'>5</span>
							<div className='next-steps-content'>
								<h3 className='next-steps-title'>Deploy and generate at runtime</h3>
								<p className='next-steps-body'>
									Once you've designed and built your documents, you will need to select the right approach for
									deployment, so you can generate PDFs at runtime. Format supports many popular frameworks, bundlers and
									runtimes and we recommend taking a look at the docs to see how you might deploy your creations to
									production.
								</p>
								<Logos items={deployLogos} />
								<ButtonLink href='https://format.dev/docs/studio/deployment/overview'>Explore deployment</ButtonLink>
							</div>
						</li>
					</Stream>
				</ol>
			</Flow>
		</>
	)
}
