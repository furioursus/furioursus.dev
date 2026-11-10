<script setup lang="ts">
// The listening-stats tabs: the shared PeriodTabs switching panels that LastfmListeningStats.astro renders
// on the server, by id. Only this hydrates; the lists stay static HTML (see docs/components.md).
// biome-ignore lint/correctness/noUnusedImports: used in the template, which Biome doesn't read
import { PeriodTabs } from "@furioursus/ui/vue";
import { ref, watch } from "vue";

const props = defineProps<{ options: { value: string; label: string }[]; idPrefix: string }>();
const selected = ref(props.options[0]?.value);

watch(selected, (value) => {
	for (const option of props.options) {
		const panel = document.getElementById(`${props.idPrefix}-panel-${option.value}`);
		if (panel) panel.hidden = option.value !== value;
	}
});
</script>

<template>
	<PeriodTabs v-model="selected" :options="options" :id-prefix="idPrefix" label="Time range" />
</template>
