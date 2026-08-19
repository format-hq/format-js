import * as v from 'valibot'

const schema = v.object({
	name: v.pipe(v.string(), v.minLength(1, 'Name is required'))
})

export default schema
