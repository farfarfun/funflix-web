<template>
  <div class="wrap">
    <n-result status="404" title="页面不存在" description="链接可能已经失效">
      <template #footer>
        <n-button type="primary" @click="$router.push({ name: 'media' })">回到首页</n-button>
      </template>
    </n-result>
  </div>
</template>

<style scoped>
.wrap {
  min-height: calc(100vh - 52px - 48px);
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
