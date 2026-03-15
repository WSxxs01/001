<script setup>
import { ref, onMounted } from 'vue'
import { getSyncConfig, saveSyncConfig, testConnection } from '../utils/sync'

const visible = ref(false)
const config = ref({
  serverUrl: 'https://dav.jianguoyun.com/dav/',
  username: '',
  password: '',
  enabled: false
})
const testing = ref(false)
const testResult = ref(null)

function openModal() {
  // 加载配置
  const saved = getSyncConfig()
  config.value = {
    serverUrl: saved.serverUrl,
    username: saved.username,
    password: '', // 不显示已保存的密码
    enabled: saved.enabled
  }
  testResult.value = null
  visible.value = true
}

function closeModal() {
  visible.value = false
}

async function handleTest() {
  testing.value = true
  testResult.value = null

  const result = await testConnection(config.value)
  testResult.value = result

  testing.value = false
}

function handleSave() {
  if (!config.value.serverUrl || !config.value.username || !config.value.password) {
    alert('请填写完整的配置信息')
    return
  }

  saveSyncConfig(config.value)
  alert('配置已保存！')
  closeModal()

  // 触发同步
  window.dispatchEvent(new CustomEvent('sync-config-changed'))
}

defineExpose({
  openModal
})
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <div class="modal-icon">⚙️</div>
        <div class="modal-title">同步设置</div>

        <div class="form-group">
          <label>
            <input type="checkbox" v-model="config.enabled" />
            启用云同步
          </label>
        </div>

        <div class="form-group">
          <label>WebDAV 服务器地址</label>
          <input
            v-model="config.serverUrl"
            type="text"
            placeholder="https://dav.jianguoyun.com/dav/"
            :disabled="!config.enabled"
          />
        </div>

        <div class="form-group">
          <label>账号</label>
          <input
            v-model="config.username"
            type="text"
            placeholder="坚果云账号"
            :disabled="!config.enabled"
          />
        </div>

        <div class="form-group">
          <label>应用密码</label>
          <input
            v-model="config.password"
            type="password"
            placeholder="坚果云应用密码（非登录密码）"
            :disabled="!config.enabled"
          />
          <div class="hint">
            应用密码需要在坚果云官网 → 安全 → 应用管理 中创建
          </div>
        </div>

        <div v-if="testResult" class="test-result" :class="{ success: testResult.success, error: !testResult.success }">
          {{ testResult.success ? '✅ 连接成功！' : '❌ 连接失败: ' + testResult.reason }}
        </div>

        <div class="modal-buttons">
          <button class="btn btn-secondary" @click="handleTest" :disabled="testing || !config.enabled">
            {{ testing ? '测试中...' : '测试连接' }}
          </button>
          <button class="btn btn-secondary" @click="closeModal">取消</button>
          <button class="btn btn-primary" @click="handleSave" :disabled="!config.enabled">保存</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(5px);
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: center;
}

.modal-content {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  border-left: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-xl);
  padding: 30px;
  max-width: 450px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.05);
}

.modal-icon {
  font-size: 48px;
  text-align: center;
  margin-bottom: 15px;
}

.modal-title {
  font-size: 22px;
  text-align: center;
  margin-bottom: 20px;
  color: var(--text-primary);
  font-weight: 600;
}

.form-group {
  margin-bottom: 20px;
  text-align: left;
}

.form-group label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-secondary);
  font-weight: 500;
}

.form-group label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--primary);
}

.form-group input {
  width: 100%;
  padding: 12px 15px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-md);
  font-size: 14px;
  margin-top: 8px;
  background: rgba(0, 0, 0, 0.2);
  color: var(--text-primary);
  transition: all 0.3s ease;
}

.form-group input::placeholder {
  color: var(--text-muted);
}

.form-group input:focus {
  outline: none;
  border-color: var(--primary);
  background: rgba(0, 0, 0, 0.3);
  box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.2);
}

.form-group input:disabled {
  background: rgba(0, 0, 0, 0.1);
  cursor: not-allowed;
  opacity: 0.5;
}

.hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 5px;
}

.test-result {
  padding: 10px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  margin-bottom: 15px;
}

.test-result.success {
  background: rgba(52, 211, 153, 0.15);
  color: var(--success-light);
  border: 1px solid rgba(52, 211, 153, 0.3);
}

.test-result.error {
  background: rgba(248, 113, 113, 0.15);
  color: var(--danger-light);
  border: 1px solid rgba(248, 113, 113, 0.3);
}

.modal-buttons {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 20px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 100%);
  border: 1px solid rgba(255,255,255,0.25);
  color: var(--primary-light);
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.05) 100%);
  transform: translateY(-1px);
}

.btn-primary:active:not(:disabled) {
  transform: scale(0.96);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-secondary);
}

.btn-secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
}
</style>
