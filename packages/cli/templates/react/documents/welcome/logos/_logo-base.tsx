import type { ComponentProps } from 'react'

export function LogoSvg({ style, ...props }: ComponentProps<'svg'>) {
	return <svg {...props} style={{ display: 'block', transform: 'scale(var(--logo-scale, 1))', ...style }} />
}

export function LogoSvgInverted({ style, ...props }: ComponentProps<'svg'>) {
	return <svg {...props} style={{ display: 'block', transform: 'scale(var(--logo-scale, 1))', ...style }} />
}
