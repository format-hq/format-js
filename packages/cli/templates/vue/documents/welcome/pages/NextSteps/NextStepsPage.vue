<script setup lang="ts">
import type { Component } from 'vue'

import { Flow, Stream } from '@format.dev/vue'

import ButtonLink from '../../components/ButtonLink.vue'
import CssOfficialIcon from '../../logos/css-official.vue'
import SassIcon from '../../logos/sass.vue'
import TailwindIcon from '../../logos/tailwind.vue'
import CssModulesIcon from '../../logos/css-modules.vue'
import PandaCssIcon from '../../logos/panda-css.vue'
import LinariaIcon from '../../logos/linaria.vue'
import VanillaExtractIcon from '../../logos/vanilla-extract.vue'
import NodeIcon from '../../logos/node.vue'
import BunIcon from '../../logos/bun.vue'
import DenoIcon from '../../logos/deno.vue'
import VercelIcon from '../../logos/vercel.vue'
import CloudflareWorkersIcon from '../../logos/cloudflare-workers.vue'
import AwsLambdaIcon from '../../logos/aws-lambda.vue'
import './next-steps.css'

interface Logo {
	name: string
	icon: Component
}

const stylingLogos: Logo[] = [
	{ name: 'CSS', icon: CssOfficialIcon },
	{ name: 'Sass', icon: SassIcon },
	{ name: 'Tailwind', icon: TailwindIcon },
	{ name: 'CSS Modules', icon: CssModulesIcon },
	{ name: 'Panda', icon: PandaCssIcon },
	{ name: 'Linaria', icon: LinariaIcon },
	{ name: 'Vanilla Extract', icon: VanillaExtractIcon }
]

const deployLogos: Logo[] = [
	{ name: 'Node', icon: NodeIcon },
	{ name: 'Bun', icon: BunIcon },
	{ name: 'Deno', icon: DenoIcon },
	{ name: 'Vercel', icon: VercelIcon },
	{ name: 'Cloudflare', icon: CloudflareWorkersIcon },
	{ name: 'AWS Lambda', icon: AwsLambdaIcon }
]
</script>

<template>
	<section class='next-steps-page'>
		<h2>Your next steps</h2>
		<p>Here's the path from here to your first production PDF.</p>
	</section>

	<Flow>
		<ol class='next-steps'>
			<Stream>
				<li class='next-steps-step'>
					<span class='next-steps-marker'>1</span>
					<div class='next-steps-content'>
						<h3 class='next-steps-title'>Explore this document's code</h3>
						<p class='next-steps-body'>
							Open <code>documents/welcome</code> to see the source code for this document. It's purposely simple,
							using just a few Format primitives like <code>&lt;Layout&gt;</code> and <code>&lt;Flow&gt;</code>.
							It's also styled with plain CSS and uses Format's out the box fonts. Have a play with the code and see
							how the document changes.
						</p>
					</div>
				</li>
				<li class='next-steps-step'>
					<span class='next-steps-marker'>2</span>
					<div class='next-steps-content'>
						<h3 class='next-steps-title'>Create your own document</h3>
						<p class='next-steps-body'>
							Hit the
							<span class='plus-key' aria-hidden='true'>
								<svg
									width='13'
									height='13'
									viewBox='0 0 24 24'
									fill='none'
									stroke='currentColor'
									stroke-width='2.2'
									stroke-linecap='round'>
									<path d='M12 5v14' />
									<path d='M5 12h14' />
								</svg>
							</span>
							button in the sidebar to scaffold a new document and see some of the options available.
						</p>
					</div>
				</li>
				<li class='next-steps-step'>
					<span class='next-steps-marker'>3</span>
					<div class='next-steps-content'>
						<h3 class='next-steps-title'>Build your first paged document</h3>
						<p class='next-steps-body'>Follow our step-by-step guide. You'll learn how to:</p>
						<ul class='learn-list'>
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
				<li class='next-steps-step'>
					<span class='next-steps-marker'>4</span>
					<div class='next-steps-content'>
						<h3 class='next-steps-title'>Test your favorite frameworks</h3>
						<p class='next-steps-body'>
							Styling on the web brings out some pretty strong opinions! Format supports a wide range of popular
							frameworks so you can make fast progress without learning any new frameworks or syntax.
						</p>
						<div class='logos-row'>
							<span class='logo-item' v-for="logo in stylingLogos" :key="logo.name">
								<component :is="logo.icon" />
								{{ logo.name }}
							</span>
						</div>
						<ButtonLink href='https://format.dev/docs/studio/styling'>Explore styling</ButtonLink>
					</div>
				</li>
				<li class='next-steps-step'>
					<span class='next-steps-marker'>5</span>
					<div class='next-steps-content'>
						<h3 class='next-steps-title'>Deploy and generate at runtime</h3>
						<p class='next-steps-body'>
							Once you've designed and built your documents, you will need to select the right approach for
							deployment, so you can generate PDFs at runtime. Format supports many popular frameworks, bundlers and
							runtimes and we recommend taking a look at the docs to see how you might deploy your creations to
							production.
						</p>
						<div class='logos-row'>
							<span class='logo-item' v-for="logo in deployLogos" :key="logo.name">
								<component :is="logo.icon" />
								{{ logo.name }}
							</span>
						</div>
						<ButtonLink href='https://format.dev/docs/studio/deployment/overview'>Explore deployment</ButtonLink>
					</div>
				</li>
			</Stream>
		</ol>
	</Flow>
</template>
