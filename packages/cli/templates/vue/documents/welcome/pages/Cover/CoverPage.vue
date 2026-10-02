<script setup lang="ts">
const props = defineProps<{ name: string }>()
</script>

<template>
	<section class='page hero-page'>
		<h1 class='hero-title'>
			Welcome to Format, <span>{{ props.name }}</span>.
		</h1>
		<p class='lead'>
			The developer-first platform for building pixel-perfect PDFs with web technology.
		</p>
		<p>
			You've created your account and installed Format Studio, nice work. This is a Format document, built with Vue
			and CSS. Studio renders it live from the code in <code>documents/welcome</code>. If you edit the code and save,
			the preview updates instantly.
		</p>
	</section>
</template>
