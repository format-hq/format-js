import { PageCounter, type PageCounterBaseProps } from './PageCounter'

export type PageCountProps = PageCounterBaseProps

export function PageCount(props: PageCountProps) {
	return <PageCounter {...props} type='page-count' />
}
