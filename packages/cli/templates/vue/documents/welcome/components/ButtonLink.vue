<script setup lang="ts">
interface ButtonLinkProps {
	href: string
	inline?: boolean
}

const props = defineProps<ButtonLinkProps>()
</script>

<template>
	<a :class="props.inline ? 'button button-inline' : 'button'" :href="props.href" target='_blank' rel='noopener noreferrer'>
		<slot></slot>
		<svg
			class='button-icon'
			width='11'
			height='11'
			viewBox='0 0 24 24'
			fill='none'
			stroke='currentColor'
			stroke-width='2.5'
			stroke-linecap='round'
			stroke-linejoin='round'
			aria-hidden='true'>
			<path d='M7 17 17 7' />
			<path d='M8 7h9v9' />
		</svg>
	</a>
</template>
