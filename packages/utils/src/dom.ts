// Tags we always remove
export const STUDIO_FORBID_TAGS = [
	'html',
	'head',
	'body',
	'title',
	'base',
	'meta',
	'script',
	'noscript',
	'iframe',
	'embed',
	'object',
	'param',
	'picture',
	'source',
	'track',
	'audio',
	'video',
	'canvas',
	'dialog',
	'meter',
	'fencedframe',
	'keygen',
	'geolocation',
	'applet',
	'frame',
	'frameset',
	'bgsound',
	'noframes',
	'noembed',
	'content',
	'shadow',
	'isindex',
	'marquee'
]

// Form elements are currently unsupported, but we are keeping them as a named
// group so a future engine version that supports PDF forms can omit this group from
// its sanitizer policy without Press needing to know which elements that means.
export const FORM_TAGS = ['form', 'input', 'button', 'textarea', 'select', 'option', 'optgroup', 'datalist']

// Tags we remove at render time only
export const FORBID_TAGS = [...STUDIO_FORBID_TAGS, ...FORM_TAGS]

// Tags the studio preview keeps visible but that won't render in the final PDF:
// form controls (dropped at render), plus deprecated and web-component tags the
// engine ignores. STUDIO_FORBID_TAGS are excluded — those are already removed
// from the preview and reported as "removed" elements. Kept in sync with the
// supported HTML elements reference (apps/web html-elements-table).
export const UNSUPPORTED_TAGS = [
	'form',
	'input',
	'button',
	'textarea',
	'select',
	'option',
	'optgroup',
	'datalist',
	'selectedcontent',
	'menuitem',
	'map',
	'area',
	'slot',
	'multicol',
	'blink',
	'spacer'
]
