import { PageCounter, type PageCounterBaseProps } from './PageCounter'

export type PageNumberProps = PageCounterBaseProps

export function PageNumber(props: PageNumberProps) {
	return <PageCounter {...props} type='page-number' />
}
