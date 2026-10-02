import schema from './data/schema'
import * as v from 'valibot'

export type Data = v.InferOutput<typeof schema>
