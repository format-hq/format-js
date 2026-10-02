import type { PropsWithChildren } from 'react'
import { Template } from './Template'

/**
 * A Stream marks where a scaffolded Flow's items land. Use it when a Flow wraps
 * its content in repeating scaffolding (a table's header and footer, a titled
 * panel) and you need to say where in that scaffolding the stream flows in:
 *
 * ```tsx
 * <Flow>
 *   <table>
 *     <thead>…</thead>
 *     <Stream>{rows}</Stream>
 *     <tfoot>…</tfoot>
 *   </table>
 * </Flow>
 * ```
 *
 * Omit it for a bare Flow, where the Flow's own children are the stream.
 */
export function Stream({ children }: PropsWithChildren) {
	return <Template data-type='stream'>{children}</Template>
}
