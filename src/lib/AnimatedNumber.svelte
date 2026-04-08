<script lang="ts">
	import { cubicOut } from 'svelte/easing';
	import { tweened } from 'svelte/motion';

	type Props = {
		value: number;
		duration?: number;
	};

	let { value, duration = 900 }: Props = $props();

	function getTweenOptions() {
		return {
			duration,
			easing: cubicOut
		};
	}

	const animatedValue = tweened(0, getTweenOptions());

	$effect(() => {
		animatedValue.set(value, getTweenOptions());
	});
</script>

{Math.round($animatedValue).toLocaleString()}