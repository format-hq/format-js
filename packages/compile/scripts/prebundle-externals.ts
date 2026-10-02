/*
The single source of truth for what the prebundle is allowed to leave as a bare
`import` in the generated modules. Everything else is inlined (see prebundle.ts).

Shared with the guard test (test/unit/generated-modules-self-contained.test.ts)
so "what may stay external" is defined once. Adding a package here is a
deliberate act — it means the runtime is guaranteed to provide it.
*/

// Resolved from the user's own project at render time.
export const frameworkPackages = ['react', 'react-dom', 'vue']

// Placeholders that make-config's virtual-module plugin swaps in at compile time.
export const placeholderModules = [
	'FMT_USER_COMPONENT',
	'virtual:adaptor',
	'virtual:schema',
	'virtual:validate',
	'virtual:decode-style-entities',
	'virtual:sanitize-html'
]

function isFrameworkPackage(id: string) {
	return frameworkPackages.some(pkg => id === pkg || id.startsWith(`${pkg}/`))
}

export function isExternalModule(id: string) {
	// Provided by the runtime.
	if (id.startsWith('node:')) {
		return true
	}

	// Real modules would fail to resolve here; make-config resolves these.
	if (placeholderModules.includes(id)) {
		return true
	}

	return isFrameworkPackage(id)
}
