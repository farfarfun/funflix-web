import { ref } from 'vue'

/**
 * 详情类页面用它把「当前看的是哪一条」同步给顶部面包屑。
 * 面包屑本身在 AppShell 里，不认识具体业务数据，所以由页面主动上报。
 */
export const pageHeading = ref<string | null>(null)
