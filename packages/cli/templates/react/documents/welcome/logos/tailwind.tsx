import type { ComponentProps } from 'react'

export function TailwindIcon(props: ComponentProps<'svg'>) {
	return (
		<svg width='24' height='16' viewBox='0 0 12 8' fill='none' aria-hidden='true' {...props}>
			<g clipPath='url(#clip0_1_151)'>
				<mask
					id='mask0_1_151'
					style={{ maskType: 'luminance' }}
					maskUnits='userSpaceOnUse'
					x='0'
					y='0'
					width='12'
					height='8'>
					<path d='M0.000380516 0H11.9213V7.79447H0.000380516V0Z' fill='white' />
				</mask>
				<g mask='url(#mask0_1_151)'>
					<mask
						id='mask1_1_151'
						style={{ maskType: 'luminance' }}
						maskUnits='userSpaceOnUse'
						x='0'
						y='0'
						width='12'
						height='8'>
						<path d='M11.9211 0H0.000183105V7.65276H11.9211V0Z' fill='white' />
					</mask>
					<g mask='url(#mask1_1_151)'>
						<path
							fillRule='evenodd'
							clipRule='evenodd'
							d='M5.96066 0C7.55011 0 8.54353 0.850305 8.94091 2.55092C8.34484 1.70061 7.64946 1.38175 6.85473 1.59432C6.40128 1.71549 6.0772 2.06766 5.71848 2.45715C5.13415 3.0918 4.45775 3.82636 2.98042 3.82636C1.39096 3.82636 0.397549 2.97607 0.000183105 1.27546C0.596229 2.12576 1.29162 2.44463 2.08635 2.23205C2.53979 2.11088 2.86386 1.75872 3.22259 1.36923C3.80695 0.734571 4.48335 0 5.96066 0ZM8.94091 3.82636C10.5304 3.82636 11.5237 4.67669 11.9211 6.37727C11.3251 5.52698 10.6297 5.20811 9.83495 5.42069C9.38153 5.54211 9.05746 5.89404 8.69873 6.28353C8.11437 6.91818 7.43797 7.65276 5.96066 7.65276C4.3712 7.65276 3.37779 6.80244 2.98042 5.10182C3.57647 5.95215 4.27186 6.27102 5.06659 6.05844C5.52004 5.93727 5.84411 5.58509 6.20284 5.1956C6.78717 4.56095 7.46357 3.82636 8.94091 3.82636Z'
							fill='#4CA5CB'
						/>
					</g>
				</g>
			</g>
			<defs>
				<clipPath id='clip0_1_151'>
					<rect width='12' height='8' fill='white' />
				</clipPath>
			</defs>
		</svg>
	)
}
