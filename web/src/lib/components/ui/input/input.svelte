<script lang="ts">
	import { cn, type WithElementRef } from "$lib/utils.js";
	import type { HTMLInputAttributes, HTMLInputTypeAttribute } from "svelte/elements";
	import XIcon from "@lucide/svelte/icons/x";
	import { t } from "$lib/i18n.svelte";

	type InputType = Exclude<HTMLInputTypeAttribute, "file">;

	type Props = WithElementRef<
		Omit<HTMLInputAttributes, "type"> &
			({ type: "file"; files?: FileList } | { type?: InputType; files?: undefined })
	> & { clearable?: boolean };

	let {
		ref = $bindable(null),
		value = $bindable(),
		type,
		files = $bindable(),
		class: className,
		"data-slot": dataSlot = "input",
		autocomplete: _autocomplete,
		clearable = true,
		onfocus,
		onblur,
		...restProps
	}: Props = $props();

	// ponytail: text-like types get a one-tap clear button so users don't have to
	// select-all + delete; numbers just clear their default 0 on focus instead, add
	// per-type opt-out if a caller needs neither.
	const TEXT_TYPES = new Set([undefined, "text", "search", "email", "tel", "url"]);
	const showClear = $derived(clearable && TEXT_TYPES.has(type) && value !== undefined && value !== "");

	function clear() {
		value = "";
		ref?.focus();
	}

	function handleFocus(event: FocusEvent & { currentTarget: HTMLInputElement }) {
		if (type === "number" && event.currentTarget.value === "0") event.currentTarget.value = "";
		onfocus?.(event);
	}

	function handleBlur(event: FocusEvent & { currentTarget: HTMLInputElement }) {
		if (type === "number" && event.currentTarget.value === "") event.currentTarget.value = String(value ?? 0);
		onblur?.(event);
	}
</script>

{#if type === "file"}
	<input
		bind:this={ref}
		data-slot={dataSlot}
		class={cn(
			"h-9 rounded-3xl border border-transparent bg-input/50 px-3 py-1 text-base transition-[color,box-shadow,background-color] file:h-7 file:text-sm file:font-medium focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 w-full min-w-0 outline-none file:inline-flex file:border-0 file:bg-transparent file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
			className
		)}
		type="file"
		autocomplete="off"
		data-1p-ignore="true"
		data-lpignore="true"
		bind:files
		bind:value
		{...restProps}
	/>
{:else if TEXT_TYPES.has(type)}
	<span class="relative block w-full">
		<input
			bind:this={ref}
			data-slot={dataSlot}
			class={cn(
				"h-9 rounded-3xl border border-transparent bg-input/50 px-3 py-1 text-base transition-[color,box-shadow,background-color] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 w-full min-w-0 outline-none placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
				showClear && "pr-9",
				className
			)}
			{type}
			autocomplete="new-password"
			data-1p-ignore="true"
			data-lpignore="true"
			bind:value
			{...restProps}
		/>
		{#if showClear}
			<button
				type="button"
				tabindex="-1"
				aria-label={t('clear')}
				onclick={clear}
				class="absolute top-1/2 right-1 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
			>
				<XIcon aria-hidden="true" class="size-4" />
			</button>
		{/if}
	</span>
{:else}
	<input
		bind:this={ref}
		data-slot={dataSlot}
		class={cn(
			"h-9 rounded-3xl border border-transparent bg-input/50 px-3 py-1 text-base transition-[color,box-shadow,background-color] file:h-7 file:text-sm file:font-medium focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 w-full min-w-0 outline-none file:inline-flex file:border-0 file:bg-transparent file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
			className
		)}
		{type}
		autocomplete="off"
		data-1p-ignore="true"
		data-lpignore="true"
		onfocus={handleFocus}
		onblur={handleBlur}
		bind:value
		{...restProps}
	/>
{/if}
