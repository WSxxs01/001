import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { registerSW } from 'virtual:pwa-register'
import App from './App.vue'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.mount('#app')

// PWA Service Worker 注册
const updateSW = registerSW({
  onNeedRefresh() {
    // 有新版本时显示提示
    console.log('有新版本可用，是否刷新？')
  },
  onOfflineReady() {
    console.log('应用已准备好离线使用')
  },
})
