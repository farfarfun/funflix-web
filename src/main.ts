import { createApp } from 'vue'

import App from './App.vue'
import { router } from './router'
import './styles/tokens.css'

// 组件由 unplugin-vue-components 按需注入，这里不做全量注册
createApp(App).use(router).mount('#app')
