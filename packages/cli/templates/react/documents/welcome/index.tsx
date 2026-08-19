import type { Data } from './types'

import { Document, Layout, Flow, PageBreak, PageNumber, PageCount, Footnotes } from '@format.dev/react'

import { CoverPage } from './pages/Cover/CoverPage'
import { NextStepsPage } from './pages/NextSteps/NextStepsPage'
import { FeatureShowcasePage } from './pages/FeatureShowcase/FeatureShowcasePage'
import { ClosePage } from './pages/Close/ClosePage'
import './styles.css'

const a4 = {
	width: 793.71,
	height: 1122.52
}

export default function Welcome({ data }: { data: Data }) {
	return (
		<Document title='Welcome to Format'>
			<Layout id='page' {...a4}>
				<Header />
				<main className='content'>
					<Flow splitGranularity='word'>
						<CoverPage name={data.name} />
						<PageBreak />
						<NextStepsPage />
						<PageBreak />
						<FeatureShowcasePage />
						<PageBreak />
						<ClosePage />
					</Flow>
				</main>
				<Footnotes />
				<Footer />
			</Layout>
		</Document>
	)
}

const Header = () => (
	<header className='header'>
		<small className='header-title'>Format Studio &ndash; Welcome document</small>
	</header>
)

const Footer = () => (
	<footer className='footer'>
		<div className='footer-stamp'>
			Created with
			<a href='https://format.dev'>
				<img src='./logo.svg' alt='Format logo' className='footer-logo' />
			</a>
		</div>
		<div className='page-numbers'>
			<PageNumber />
			of
			<PageCount />
		</div>
	</footer>
)
