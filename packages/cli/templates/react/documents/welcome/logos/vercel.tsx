import type { ComponentProps } from 'react'
import { LogoSvgInverted } from './_logo-base'

export function VercelIcon(props: ComponentProps<'svg'>) {
	return (
		<LogoSvgInverted viewBox='0 0 35 30' width='35' height='30' fill='none' xmlns='http://www.w3.org/2000/svg' aria-hidden='true' {...props}>
			<g clipPath="url(#clip0_1_1089)">
			<path d="M17.2965 0L34.5939 29.9601H-0.000732422L17.2965 0Z" fill="black"/>
			</g>
			<defs>
			<clipPath id="clip0_1_1089">
			<rect width="34.5946" height="30" fill="white"/>
			</clipPath>
			</defs>
		</LogoSvgInverted>
	)
}
