<script setup lang="ts">
import { LogInOutline, PersonAddOutline } from '@vicons/ionicons5'
import { useMessage } from 'naive-ui'
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { login, register } from '@/api/auth'
import { ApiError, api } from '@/api/client'

const route = useRoute()
const router = useRouter()
const message = useMessage()

/** 默认停在「访客登录」—— 进这页的绝大多数是来看作品的，不是来登运维的。 */
const tab = ref<'guest' | 'register' | 'admin'>('guest')

// 访客 / 管理两个 tab 共用一份表单：打的是同一个 `POST /auth/login`，差别只在文案
// 和登录后的落地页。后端不按 tab 发角色，角色由账号本身决定 —— guest 在「管理登录」
// 里输对密码也只是正常进站。
const username = ref('')
const password = ref('')

const regUsername = ref('')
const regPassword = ref('')
const regInviteCode = ref('')

const submitting = ref(false)

/**
 * 注册开关关着时连 tab 都不渲染。拿不到配置（后端挂了 / 网络不通）就按**不开放**
 * 处理：渲染出一个必然 403 的表单比少一个 tab 更难解释。
 */
const registrationEnabled = ref(false)

onMounted(async () => {
  try {
    registrationEnabled.value = (await api.authConfig()).registration_enabled
  } catch {
    registrationEnabled.value = false
  }
})

/** 登录后去哪儿：守卫带过来的 `redirect` 优先，否则按 tab 给默认落地页。 */
function land(fallback: 'media' | 'dashboard') {
  const redirect = route.query.redirect
  void router.push(typeof redirect === 'string' ? redirect : { name: fallback })
}

async function submitLogin() {
  if (!username.value || !password.value) {
    message.warning('请输入用户名和密码')
    return
  }
  submitting.value = true
  try {
    await login(username.value, password.value)
    land(tab.value === 'admin' ? 'dashboard' : 'media')
  } catch (e) {
    message.error(e instanceof ApiError ? e.message : '登录失败')
  } finally {
    submitting.value = false
  }
}

async function submitRegister() {
  if (!regUsername.value || !regPassword.value || !regInviteCode.value) {
    message.warning('请填写用户名、密码和邀请码')
    return
  }
  submitting.value = true
  try {
    // 注册成功即已登录，直接进站，不用再登一次。
    await register(regUsername.value, regPassword.value, regInviteCode.value)
    land('media')
  } catch (e) {
    message.error(e instanceof ApiError ? e.message : '注册失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="wrap">
    <n-card size="large" class="card">
      <n-tabs v-model:value="tab" type="line" animated>
        <n-tab-pane name="guest" tab="访客登录">
          <n-form @submit.prevent="submitLogin">
            <n-form-item label="用户名" :show-feedback="false">
              <n-input
                v-model:value="username"
                placeholder="用户名"
                :input-props="{ autocomplete: 'username' }"
              />
            </n-form-item>
            <n-form-item label="密码" :show-feedback="false" class="mt">
              <n-input
                v-model:value="password"
                type="password"
                show-password-on="click"
                placeholder="密码"
                :input-props="{ autocomplete: 'current-password' }"
              />
            </n-form-item>
            <n-button type="primary" attr-type="submit" block class="mt-lg" :loading="submitting">
              <template #icon><n-icon><LogInOutline /></n-icon></template>
              进入站点
            </n-button>
          </n-form>
          <n-text depth="3" class="hint"> 本站需要口令访问，口令由站点维护者提供。 </n-text>
        </n-tab-pane>

        <n-tab-pane v-if="registrationEnabled" name="register" tab="注册">
          <n-form @submit.prevent="submitRegister">
            <n-form-item label="用户名" :show-feedback="false">
              <n-input
                v-model:value="regUsername"
                placeholder="用户名"
                :input-props="{ autocomplete: 'username' }"
              />
            </n-form-item>
            <n-form-item label="密码" :show-feedback="false" class="mt">
              <n-input
                v-model:value="regPassword"
                type="password"
                show-password-on="click"
                placeholder="至少 6 位"
                :input-props="{ autocomplete: 'new-password' }"
              />
            </n-form-item>
            <n-form-item label="邀请码" :show-feedback="false" class="mt">
              <n-input
                v-model:value="regInviteCode"
                placeholder="邀请码"
                :input-props="{ autocomplete: 'off' }"
              />
            </n-form-item>
            <n-button type="primary" attr-type="submit" block class="mt-lg" :loading="submitting">
              <template #icon><n-icon><PersonAddOutline /></n-icon></template>
              注册并进入
            </n-button>
          </n-form>
          <n-text depth="3" class="hint"> 注册需要邀请码，向站点维护者索取。 </n-text>
        </n-tab-pane>

        <n-tab-pane name="admin" tab="管理登录">
          <n-form @submit.prevent="submitLogin">
            <n-form-item label="用户名" :show-feedback="false">
              <n-input
                v-model:value="username"
                placeholder="用户名"
                :input-props="{ autocomplete: 'username' }"
              />
            </n-form-item>
            <n-form-item label="密码" :show-feedback="false" class="mt">
              <n-input
                v-model:value="password"
                type="password"
                show-password-on="click"
                placeholder="密码"
                :input-props="{ autocomplete: 'current-password' }"
              />
            </n-form-item>
            <n-button type="primary" attr-type="submit" block class="mt-lg" :loading="submitting">
              <template #icon><n-icon><LogInOutline /></n-icon></template>
              登录
            </n-button>
          </n-form>
          <n-text depth="3" class="hint">
            「运维」区（大盘 / 采集源 / 原始文本 / 网盘资源）需要管理员账号，账号由管理员在服务端创建。
          </n-text>
        </n-tab-pane>
      </n-tabs>
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
