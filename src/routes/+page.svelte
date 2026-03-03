<script>
	import calpolyplace from '$lib/assets/calpolyplace.png';
	import dpadlogo from '$lib/assets/dpad.svg';
	import button from '$lib/assets/button.svg';
</script>

<main class="min-h-screen bg-[#B8121E] text-white">
	<div class="mx-auto max-w-md">
		<header class="flex justify-center p-12">
			<img src={calpolyplace} alt="Cal Poly Place" class="w-60" />
		</header>

		<section
			class="flex h-110 w-full items-center justify-center rounded-4xl bg-radial from-[#B01116] to-[#A60B14] p-2"
		>
			<!-- canvas here -->
			<canvas
				id="canvas"
				class="h-full w-full rounded-3xl bg-white shadow-[inset_0px_4px_5px_5px_rgba(0,0,0,0.25)]"
			></canvas>
		</section>

		<section class="flex justify-center gap-12 p-12">
			<div class="flex flex-col items-center gap-4">
				<div
					class="relative
                "
				>
					<div
						class="absolute top-0 left-0 grid h-full w-full grid-cols-3 grid-rows-3 items-center justify-center"
					>
						<!-- up -->
						<div class="col-start-2 h-10 w-10 rounded-xl"></div>
						<!-- left -->
						<div class="col-start-1 row-start-2 h-10 w-10 rounded-xl"></div>
						<!-- right -->
						<div class="col-start-3 row-start-2 h-10 w-10 rounded-xl"></div>
						<!-- down -->
						<div class="col-start-2 row-start-3 h-10 w-10 rounded-xl"></div>
					</div>
					<img src={dpadlogo} alt="DPAD" class="w-30" />
				</div>
				<p>move</p>
			</div>

			<div class="my-auto flex flex-col items-center gap-4">
				<img src={button} alt="Button" class="w-10" />
				<p>start</p>
			</div>
		</section>
	</div>
</main>
