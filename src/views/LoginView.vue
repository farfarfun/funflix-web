<script setup lang="ts">
import { LogInOutline } from '@vicons/ionicons5'
import { useMessage } from 'naive-ui'
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { login } from '@/api/auth'
import { ApiError } from '@/api/client'

const route = useRoute()
const router = useRouter()
const message = useMessage()

const username = ref('')
const password = ref('')
const submitting = ref(false)

async function submit() {
  if (!username.value || !password.value) {
    message.warning('请输入用户名和密码')
    return
  }
  submitting.value = true
  try {
    await login(username.value, password.value)
    const redirect = route.query.redirect
    void router.push(typeof redirect === 'string' ? redirect : { name: 'media' })
  } catch (e) {
    message.error(e instanceof ApiError ? e.message : '登录失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="wrap">
    <n-card size="large" class="card" title="登录">
      <n-form @submit.prevent="submit">
        <n-form-item label="用户名" :show-feedback="false">
          <n-input v-model:value="username" placeholder="用户名" @keyup.enter="submit" />
        </n-form-item>
        <n-form-item label="密码" :show-feedback="false" class="mt">
          <n-input
            v-model:value="password"
            type="password"
            show-password-on="click"
            placeholder="密码"
            @keyup.enter="submit"
          />
        </n-form-item>
        <n-button
          type="primary"
          block
          class="mt-lg"
          :loading="submitting"
          @click="submit"
        >
          <template #icon><n-icon><LogInOutline /></n-icon></template>
          登录
        </n-button>
      </n-form>
      <n-text depth="3" class="hint">
        「运维」区（大盘 / 采集源 / 原始文本 / 网盘资源）需要登录才能访问，账号由管理员在服务端创建。
      </n-text>
    </n-card>
  </div>
</template>

<style scoped>
.wrap {
  min-height: calc(100vh - 52px - 48px);
  display: flex;
  align-items: center;
  justify-content: center;
}
.card {
  width: 100%;
  max-width: 360px;
}
.mt {
  margin-top: 14px;
}
.mt-lg {
  margin-top: 20px;
}
.hint {
  display: block;
  margin-top: 16px;
  font-size: 12px;
  line-height: 1.6;
}
</style>
