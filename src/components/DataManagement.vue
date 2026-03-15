<script setup>
import { ref } from 'vue'
import { useStudyStore } from '../stores/useStudyStore'

const store = useStudyStore()
const fileInput = ref(null)

// 导出数据
function exportData() {
  const jsonStr = store.exportData()
  const blob = new Blob([jsonStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = 'ebbinghaus_backup.json'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  alert('数据导出成功！')
}

// 触发文件选择
function triggerImport() {
  fileInput.value?.click()
}

// 导入数据
function handleImport(event) {
  const file = event.target.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    const content = e.target?.result
    if (typeof content !== 'string') {
      alert('读取文件失败')
      return
    }

    if (confirm('导入数据将覆盖当前所有学习记录，确定要继续吗？')) {
      const success = store.importData(content)
      if (success) {
        alert('数据导入成功！')
        // 刷新页面重新加载
        window.location.reload()
      } else {
        alert('数据格式错误，导入失败')
      }
    }
  }

  reader.readAsText(file)

  // 清空 input，允许重复选择同一文件
  event.target.value = ''
}
</script>

<template>
  <div class="data-management">
    <h3>⚙️ 数据管理</h3>
    <div class="data-actions">
      <button class="btn btn-primary" @click="exportData">
        📤 导出数据
      </button>
      <button class="btn btn-secondary" @click="triggerImport">
        📥 导入数据
      </button>
      <input
        ref="fileInput"
        type="file"
        accept=".json"
        style="display: none"
        @change="handleImport"
      />
    </div>
  </div>
</template>

<style scoped>
.data-management {
  /* 应用 .glass-panel 样式 */
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  border-left: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: var(--radius-xl);
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3), inset 0 0 0 1px rgba(255, 255, 255, 0.02);
}

.data-management:hover {
  background: rgba(255, 255, 255, 0.05);
}

.data-management h3 {
  color: var(--text-primary);
  margin-bottom: 15px;
  font-size: 16px;
  font-weight: 500;
}

.data-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.3s ease;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.btn-primary {
  background: linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 100%);
  border: 1px solid rgba(255,255,255,0.2);
  color: var(--primary-light);
  backdrop-filter: blur(10px);
}

.btn-primary:hover {
  transform: translateY(-2px);
  background: linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.05) 100%);
  box-shadow: 0 4px 15px rgba(129, 140, 248, 0.3);
}

.btn-primary:active {
  transform: scale(0.96);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-secondary);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.15);
}
</style>
