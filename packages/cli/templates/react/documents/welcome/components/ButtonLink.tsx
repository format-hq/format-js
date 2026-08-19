import type { ReactNode } from 'react'

interface ButtonLinkProps {
	href: string
	inline?: boolean
	children: ReactNode
}

export function ButtonLink({ href, inline, children }: ButtonLinkProps) {
	return (
		<a className={inline ? 'button button-inline' : 'button'} href={href} target='_blank' rel='noopener noreferrer'>
			{children}
			<svg
				className='button-icon'
				width='11'
				height='11'
				viewBox='0 0 24 24'
				fill='none'
				stroke='currentColor'
				strokeWidth='2.5'
				strokeLinecap='round'
				strokeLinejoin='round'
				aria-hidden='true'>
				<path d='M7 17 17 7' />
				<path d='M8 7h9v9' />
			</svg>
		</a>
	)
}
