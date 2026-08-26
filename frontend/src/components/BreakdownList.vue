<script setup lang="ts">
import { computed } from 'vue'

export interface BreakdownRow {
  key: string
  label: string
  value: number
}

const props = defineProps<{ rows: BreakdownRow[] }>()

// 条形按当前组内最大值归一，而不是按总和 —— 分布里常有一个压倒性的类别，
// 按总和归一的话其余类别全挤成看不见的一条。
const max = computed(() => Math.max(...props.rows.map((r) => r.value), 1))
</script>

<template>
  <n-text v-if="rows.length === 0" depth="3">（无记录）</n-text>
  <div v-for="row in rows" v-else :key="row.key" class="row">
    <span class="label" :title="row.label">{{ row.label }}</span>
    <n-progress
      type="line"
      :percentage="(row.value / max) * 100"
      :show-indicator="false"
      :height="6"
      class="bar"
    />
    <strong class="value">{{ row.value }}</strong>
  </div>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
  font-size: 13px;
}
.label {
  width: 96px;
  flex: none;
  opacity: 0.75;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bar {
  flex: 1;
}
.value {
  width: 52px;
  flex: none;
  text-align: right;
}
</style>
