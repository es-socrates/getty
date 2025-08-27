<template>
  <div class="os-table" role="table" :aria-label="ariaLabel">
    <div v-if="headers && headers.length" class="os-tr py-2" role="row">
      <div v-for="(h, i) in headers" :key="i" class="os-th" :class="colClass(i)" role="columnheader">{{ h }}</div>
    </div>
    <div v-for="(row, rIdx) in rows" :key="rIdx" class="os-tr py-2" role="row">
      <div v-for="(cell, cIdx) in row" :key="cIdx" class="os-td" :class="colClass(cIdx)" role="cell">
        <slot name="cell" :value="cell" :row-index="rIdx" :col-index="cIdx">{{ cell }}</slot>
      </div>
    </div>
  </div>
</template>
<script setup>
const props = defineProps({
  headers: { type: Array, default: () => [] },
  rows: { type: Array, default: () => [] },
  cols: { type: Array, default: () => [] },
  ariaLabel: { type: String, default: '' }
});
function colClass(i){ return props.cols?.[i] || 'col-span-1'; }
</script>
