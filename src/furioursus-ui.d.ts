// @furioursus/ui doesn't ship type declarations yet. Delete this file once it does; the props mirror
// its docs/components.md.
declare module "@furioursus/ui/vue" {
	import type { DefineComponent } from "vue";

	export const ThemeToggle: DefineComponent<{ label?: string }>;
	export const PeriodTabs: DefineComponent<{
		options: { value: string | number; label: string }[];
		modelValue?: string | number;
		label: string;
		idPrefix?: string;
	}>;
	export const RankedList: DefineComponent<{
		title: string;
		headingLevel?: number;
		items: {
			name: string;
			subtitle?: string | undefined;
			count: number;
			url?: string | undefined;
		}[];
		emptyText?: string;
		newTab?: boolean;
	}>;
}
