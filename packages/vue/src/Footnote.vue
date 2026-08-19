<!--
	A footnote. Write the note's text as the children, at the point it's
	referenced; Format leaves a numbered marker inline and moves the text to the
	footer of whichever page the marker lands on. Footnotes are numbered
	continuously through the document.

	Pair it with a `<Footnotes />` region in the Layout to control where the notes
	sit; without one, Format adds a footer area to each page that needs it.

		<p>The result holds<Footnote>under the stated assumptions</Footnote>.</p>
-->
<script setup lang="ts">
import Template from './Template.vue'
</script>

<template>
	<!-- a template so the note's text stays inert and out of the inline flow until
		the engine moves it to the footer, leaving just the marker behind -->
	<Template data-type="footnote">
		<slot></slot>
	</Template>
</template>
