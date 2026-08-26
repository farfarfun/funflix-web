<template>
  <n-result status="404" title="页面不存在" description="链接可能已经失效">
    <template #footer>
      <n-button @click="$router.push({ name: 'media' })">回到首页</n-button>
    </template>
  </n-result>
</template>
