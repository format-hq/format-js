import type * as React from 'react'

export {}

type LooseAutocomplete<T extends string> = T | (string & {})

type MathMLBooleanish = boolean | 'true' | 'false'
type MathMLLength = number | string
type MathMLUnsignedInteger = number | `${number}` | (string & {})
type MathMLScriptLevel = number | `${number}` | `+${number}` | `-${number}` | (string & {})

type MathMLNamespaceURI = 'http://www.w3.org/1998/Math/MathML'

type MathMLOperatorForm = 'prefix' | 'infix' | 'postfix'

type MathMLFractionAlign = 'left' | 'center' | 'right'

type MathMLTableAlign = LooseAutocomplete<'axis' | 'baseline' | 'bottom' | 'center' | 'top'>

type MathMLTableColumnAlign = LooseAutocomplete<'left' | 'center' | 'right'>

type MathMLTableRowAlign = LooseAutocomplete<'axis' | 'baseline' | 'bottom' | 'center' | 'top'>

type MathMLTableLine = LooseAutocomplete<'none' | 'solid' | 'dashed'>

type MathMLMathVariant = LooseAutocomplete<
	| 'normal'
	| 'bold'
	| 'italic'
	| 'bold-italic'
	| 'double-struck'
	| 'bold-fraktur'
	| 'script'
	| 'bold-script'
	| 'fraktur'
	| 'sans-serif'
	| 'bold-sans-serif'
	| 'sans-serif-italic'
	| 'sans-serif-bold-italic'
	| 'monospace'
	| 'initial'
	| 'tailed'
	| 'looped'
	| 'stretched'
>

type MathMLMencloseNotation = LooseAutocomplete<
	| 'longdiv'
	| 'actuarial'
	| 'box'
	| 'roundedbox'
	| 'circle'
	| 'left'
	| 'right'
	| 'top'
	| 'bottom'
	| 'updiagonalstrike'
	| 'downdiagonalstrike'
	| 'verticalstrike'
	| 'horizontalstrike'
	| 'madruwb'
	| 'updiagonalarrow'
	| 'phasorangle'
>

type MathMLGlobalAttributes = {
	/**
	 * MathML/HTML global attribute.
	 * Prefer React's `autoFocus` prop in ordinary React code.
	 */
	autofocus?: boolean | ''

	/**
	 * MathML/HTML global attribute.
	 * Prefer React's `className` prop in ordinary React code.
	 */
	class?: string

	dir?: 'ltr' | 'rtl'
	displaystyle?: MathMLBooleanish

	/**
	 * Non-standard MathML hyperlink attribute documented by MDN.
	 */
	href?: string

	id?: string

	/**
	 * @deprecated Legacy MathML style attribute. Prefer CSS `background-color`.
	 */
	mathbackground?: string

	/**
	 * @deprecated Legacy MathML style attribute. Prefer CSS `color`.
	 */
	mathcolor?: string

	/**
	 * @deprecated Legacy MathML style attribute. Prefer CSS `font-size`.
	 */
	mathsize?: MathMLLength

	nonce?: string
	scriptlevel?: MathMLScriptLevel
	tabindex?: number | string

	/**
	 * Reserved by MathML Core / MathML 4.
	 */
	intent?: string

	/**
	 * Reserved by MathML Core / MathML 4.
	 */
	arg?: string

	[dataAttribute: `data-${string}`]: string | number | boolean | undefined
}

type MathMLProps<AdditionalProps = {}> = React.DetailedHTMLProps<
	React.HTMLAttributes<MathMLElement> & MathMLGlobalAttributes & AdditionalProps,
	MathMLElement
>

type MathAttributes = {
	display?: 'block' | 'inline'
	alttext?: string
	xmlns?: MathMLNamespaceURI | (string & {})
}

type AnnotationAttributes = {
	encoding?: string

	/**
	 * @deprecated External annotation sources are deprecated.
	 */
	src?: string
}

type AnnotationXmlAttributes = AnnotationAttributes

type MactionAttributes = {
	/**
	 * @deprecated Deprecated MathML element/attribute.
	 */
	actiontype?: string

	/**
	 * @deprecated Deprecated MathML element/attribute.
	 */
	selection?: MathMLUnsignedInteger
}

type MencloseAttributes = {
	/**
	 * Non-standard. Check browser support before using.
	 */
	notation?: MathMLMencloseNotation
}

type MfencedAttributes = {
	/**
	 * @deprecated Use explicit `<mrow>` and `<mo>` fences instead.
	 */
	close?: string

	/**
	 * @deprecated Use explicit `<mrow>` and `<mo>` fences instead.
	 */
	open?: string

	/**
	 * @deprecated Use explicit `<mrow>` and `<mo>` separators instead.
	 */
	separators?: string
}

type MfracAttributes = {
	linethickness?: MathMLLength

	/**
	 * @deprecated Legacy MathML alignment attribute.
	 */
	denomalign?: MathMLFractionAlign

	/**
	 * @deprecated Legacy MathML alignment attribute.
	 */
	numalign?: MathMLFractionAlign
}

type MiAttributes = {
	/**
	 * MathML Core gives observable browser behavior mainly to `mathvariant="normal"`,
	 * but the broader MathML value set is accepted here for compatibility.
	 */
	mathvariant?: MathMLMathVariant
}

type MoAttributes = {
	/**
	 * Non-standard on `<mo>`; supported by some browsers.
	 */
	accent?: MathMLBooleanish

	fence?: MathMLBooleanish
	form?: MathMLOperatorForm
	largeop?: MathMLBooleanish
	lspace?: MathMLLength
	maxsize?: MathMLLength
	minsize?: MathMLLength
	movablelimits?: MathMLBooleanish
	rspace?: MathMLLength
	separator?: MathMLBooleanish
	stretchy?: MathMLBooleanish
	symmetric?: MathMLBooleanish
}

type MoverAttributes = {
	accent?: MathMLBooleanish
}

type MunderAttributes = {
	accentunder?: MathMLBooleanish
}

type MunderoverAttributes = MoverAttributes & MunderAttributes

type MpaddedAttributes = {
	depth?: MathMLLength
	height?: MathMLLength
	lspace?: MathMLLength
	voffset?: MathMLLength
	width?: MathMLLength
}

type MspaceAttributes = {
	depth?: MathMLLength
	height?: MathMLLength
	width?: MathMLLength
}

type MsAttributes = {
	/**
	 * @deprecated Include quote characters in the text content instead.
	 */
	lquote?: string

	/**
	 * @deprecated Include quote characters in the text content instead.
	 */
	rquote?: string
}

type MstyleAttributes = {
	/**
	 * @deprecated Prefer CSS `background-color`.
	 */
	background?: string

	/**
	 * @deprecated Prefer CSS `color`.
	 */
	color?: string

	/**
	 * @deprecated Prefer CSS `font-family`.
	 */
	fontfamily?: string

	/**
	 * @deprecated Prefer CSS `font-size`.
	 */
	fontsize?: MathMLLength

	/**
	 * @deprecated Prefer CSS `font-style`.
	 */
	fontstyle?: string

	/**
	 * @deprecated Prefer CSS `font-weight`.
	 */
	fontweight?: string

	/**
	 * @deprecated Legacy MathML script sizing attribute.
	 */
	scriptminsize?: MathMLLength

	/**
	 * @deprecated Legacy MathML script sizing attribute.
	 */
	scriptsizemultiplier?: number | string
}

type MsubAttributes = {
	/**
	 * @deprecated Non-standard legacy MathML script shift attribute.
	 */
	subscriptshift?: MathMLLength
}

type MsupAttributes = {
	/**
	 * @deprecated Non-standard legacy MathML script shift attribute.
	 */
	superscriptshift?: MathMLLength
}

type MsubsupAttributes = MsubAttributes & MsupAttributes

type MmultiscriptsAttributes = MsubsupAttributes

type MtableAttributes = {
	/**
	 * Non-standard. Some browsers support values like `"axis 3"`.
	 */
	align?: MathMLTableAlign

	/**
	 * Non-standard. Can be a space-separated list.
	 */
	columnalign?: MathMLTableColumnAlign

	/**
	 * Non-standard. Can be a space-separated list.
	 */
	columnlines?: MathMLTableLine

	/**
	 * Non-standard. Can be a space-separated list.
	 */
	columnspacing?: MathMLLength

	/**
	 * Non-standard.
	 */
	frame?: MathMLTableLine

	/**
	 * Non-standard. Usually two lengths.
	 */
	framespacing?: string

	/**
	 * Non-standard. Can be a space-separated list.
	 */
	rowalign?: MathMLTableRowAlign

	/**
	 * Non-standard. Can be a space-separated list.
	 */
	rowlines?: MathMLTableLine

	/**
	 * Non-standard. Can be a space-separated list.
	 */
	rowspacing?: MathMLLength

	/**
	 * Non-standard.
	 */
	width?: MathMLLength
}

type MtrAttributes = {
	/**
	 * Non-standard. Can be a space-separated list.
	 */
	columnalign?: MathMLTableColumnAlign

	/**
	 * Non-standard. Can be a space-separated list.
	 */
	rowalign?: MathMLTableRowAlign
}

type MtdAttributes = MtrAttributes & {
	columnspan?: MathMLUnsignedInteger
	rowspan?: MathMLUnsignedInteger
}

declare namespace MathMLJSX {
	interface IntrinsicElements {
		annotation: MathMLProps<AnnotationAttributes>
		'annotation-xml': MathMLProps<AnnotationXmlAttributes>

		/**
		 * @deprecated Deprecated MathML element. Avoid for new content.
		 */
		maction: MathMLProps<MactionAttributes>

		math: MathMLProps<MathAttributes>

		/**
		 * Non-standard. Check browser support before using.
		 */
		menclose: MathMLProps<MencloseAttributes>

		merror: MathMLProps

		/**
		 * @deprecated Non-standard/deprecated. Use explicit `<mrow>` and `<mo>`.
		 */
		mfenced: MathMLProps<MfencedAttributes>

		mfrac: MathMLProps<MfracAttributes>
		mi: MathMLProps<MiAttributes>
		mmultiscripts: MathMLProps<MmultiscriptsAttributes>
		mn: MathMLProps
		mo: MathMLProps<MoAttributes>
		mover: MathMLProps<MoverAttributes>
		mpadded: MathMLProps<MpaddedAttributes>
		mphantom: MathMLProps
		mprescripts: MathMLProps
		mroot: MathMLProps
		mrow: MathMLProps
		ms: MathMLProps<MsAttributes>
		mspace: MathMLProps<MspaceAttributes>
		msqrt: MathMLProps
		mstyle: MathMLProps<MstyleAttributes>
		msub: MathMLProps<MsubAttributes>
		msubsup: MathMLProps<MsubsupAttributes>
		msup: MathMLProps<MsupAttributes>
		mtable: MathMLProps<MtableAttributes>
		mtd: MathMLProps<MtdAttributes>
		mtext: MathMLProps
		mtr: MathMLProps<MtrAttributes>
		munder: MathMLProps<MunderAttributes>
		munderover: MathMLProps<MunderoverAttributes>

		semantics: MathMLProps
	}
}

declare module 'react' {
	namespace JSX {
		interface IntrinsicElements extends MathMLJSX.IntrinsicElements {}
	}
}

declare module 'react/jsx-runtime' {
	namespace JSX {
		interface IntrinsicElements extends MathMLJSX.IntrinsicElements {}
	}
}

declare module 'react/jsx-dev-runtime' {
	namespace JSX {
		interface IntrinsicElements extends MathMLJSX.IntrinsicElements {}
	}
}

/**
 * Compatibility for older React/TypeScript JSX configurations that still
 * consult the global JSX namespace.
 */
declare global {
	namespace JSX {
		interface IntrinsicElements extends MathMLJSX.IntrinsicElements {}
	}
}
