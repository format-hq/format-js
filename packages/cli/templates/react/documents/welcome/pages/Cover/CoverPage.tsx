export function CoverPage({ name }: { name: string }) {
	return (
		<section className='page hero-page'>
			<h1 className='hero-title'>
				Welcome to Format, <span>{name}</span>.
			</h1>
			<p className='lead'>
				The developer-first platform for building pixel-perfect PDFs with web technology.
			</p>
			<p>
				You've created your account and installed Format Studio, nice work. This is a Format document, built with React
				and CSS. Studio renders it live from the code in <code>documents/welcome</code>. If you edit the code and save,
				the preview updates instantly.
			</p>
		</section>
	)
}
