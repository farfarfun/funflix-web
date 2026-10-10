<script setup lang="ts">
import { LogInOutline, PersonAddOutline } from '@vicons/ionicons5'
import { useMessage } from 'naive-ui'
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { isAdmin, login, register } from '@/api/auth'
import { ApiError, api } from '@/api/client'

const route = useRoute()
const router = useRouter()
const message = useMessage()

/** 默认停在「登录」—— 注册是少数情况。 */
const tab = ref<'login' | 'register'>('login')

// 只有一个登录入口：访客和管理员打的本来就是同一个 `POST /auth/login`，角色由账号
// 本身决定，不由入口决定。分成两个 tab 只会让人以为「选错 tab 会登不上」。
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

/** 登录后去哪儿：守卫带过来的 `redirect` 优先，否则给默认落地页。 */
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
    // 落地页按**登录后拿到的角色**定，不按入口定：admin 进大盘，其余进作品检索。
    land(isAdmin.value ? 'dashboard' : 'media')
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
        <n-tab-pane name="login" tab="登录">
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
          <n-text depth="3" class="hint">
            本站需要口令访问，口令由站点维护者提供。「运维」区（大盘 / 采集源 / 原始文本 /
            网盘资源）按账号角色开放，管理员登录后自动可见。
          </n-text>
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
