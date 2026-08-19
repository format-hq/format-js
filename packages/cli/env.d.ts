declare module '@format:*' {
	const mod: any
	export default mod
}

declare module '*.html' {
	const html: string
	export default html
}

declare module '*.module.css' {
	const classes: { readonly [className: string]: string }
	export default classes
}

declare module '*.module.scss' {
	const classes: { readonly [className: string]: string }
	export default classes
}

declare module '*.module.sass' {
	const classes: { readonly [className: string]: string }
	export default classes
}

declare module '*.css' {}

declare module '*.scss' {}

declare module '*.sass' {}

declare module '*.svg' {
	import type * as React from 'react'

	const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement> & { title?: string }>

	export default ReactComponent
	export { ReactComponent }
}

declare module '*.svg?raw' {
	const content: string
	export default content
}

declare module '*.png' {
	const src: string
	export default src
}

declare module '*.jpg' {
	const src: string
	export default src
}

declare module '*.jpeg' {
	const src: string
	export default src
}

declare module '*.gif' {
	const src: string
	export default src
}

declare module '*.webp' {
	const src: string
	export default src
}

declare module '*.avif' {
	const src: string
	export default src
}

declare module '*.woff' {
	const src: string
	export default src
}

declare module '*.woff2' {
	const src: string
	export default src
}

declare module '*.ttf' {
	const src: string
	export default src
}

declare module '*.otf' {
	const src: string
	export default src
}

declare module '*.eot' {
	const src: string
	export default src
}
