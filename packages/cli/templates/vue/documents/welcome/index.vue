<script setup lang="ts">
import type { Data } from './types'

import { Document, Layout, Flow, PageBreak, PageNumber, PageCount, Footnotes, type RenderProps } from '@format.dev/vue'

import CoverPage from './pages/Cover/CoverPage.vue'
import NextStepsPage from './pages/NextSteps/NextStepsPage.vue'
import FeatureShowcasePage from './pages/FeatureShowcase/FeatureShowcasePage.vue'
import ClosePage from './pages/Close/ClosePage.vue'
import './styles.css'

const props = defineProps<RenderProps<Data>>()
</script>

<template>
	<Document title='Welcome to Format'>
		<Layout id='page' :width="793.71" :height="1122.52">
			<header class='header'>
				<small class='header-title'>Format Studio &ndash; Welcome document</small>
			</header>
			<main class='content'>
				<Flow split-granularity='word'>
					<CoverPage :name="props.data.name" />
					<PageBreak />
					<NextStepsPage />
					<PageBreak />
					<FeatureShowcasePage />
					<PageBreak />
					<ClosePage />
				</Flow>
			</main>
			<Footnotes />
			<footer class='footer'>
				<div class='footer-stamp'>
					Created with
					<a href='https://format.dev'>
						<img src='./logo.svg' alt='Format logo' class='footer-logo' />
					</a>
				</div>
				<div class='page-numbers'>
					<PageNumber />
					of
					<PageCount />
				</div>
			</footer>
		</Layout>
	</Document>
</template>
