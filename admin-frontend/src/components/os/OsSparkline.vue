<template>
  <svg :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" class="block">
    <defs v-if="fill">
      <linearGradient :id="gradId" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" :stop-color="color" :stop-opacity="0.28" />
        <stop offset="100%" :stop-color="color" :stop-opacity="0" />
      </linearGradient>
    </defs>
    <polygon v-if="fill && polygonPoints" :points="polygonPoints" :fill="`url(#${gradId})`" />
    <polyline :points="points" fill="none" :stroke="color" :stroke-width="1.5" />
  </svg>
</template>
<script setup>
import { computed } from 'vue';
const props = defineProps({ data: { type: Array, default: () => [] }, width: { type: Number, default: 120 }, height: { type: Number, default: 30 }, color: { type: String, default: '#5eead4' }, fill: { type: Boolean, default: true } });
const points = computed(()=>{
  const d = props.data || [];
  if (!d.length) return '';
  const min = Math.min(...d);
  const max = Math.max(...d);
  const range = (max - min) || 1;
  const stepX = props.width / Math.max(d.length - 1, 1);
  return d.map((v,i)=>`${(i*stepX).toFixed(2)},${(props.height - ((v - min)/range)*props.height).toFixed(2)}`).join(' ');
});
const uid = Math.random().toString(36).slice(2);
const gradId = computed(()=>`spark-grad-${uid}`);
const polygonPoints = computed(()=>{
  if (!points.value) return '';
  return `0,${props.height} ${points.value} ${props.width},${props.height}`;
});
</script>
<style scoped>
svg { opacity: 0.9 }
</style>
