<script setup>
import { ref, onMounted } from 'vue'
import { useStudyStore } from './stores/useStudyStore'
import BookTabs from './components/BookTabs.vue'
import ChapterList from './components/ChapterList.vue'
import StatisticsCharts from './components/StatisticsCharts.vue'
import ContributionHeatmap from './components/ContributionHeatmap.vue'
import AddBookModal from './components/AddBookModal.vue'
import DataManagement from './components/DataManagement.vue'
import SettingsModal from './components/SettingsModal.vue'

const store = useStudyStore()
const addBookModal = ref(null)
const settingsModal = ref(null)

// PWA 安装提示
const deferredPrompt = ref(null)
const showInstallPrompt = ref(false)

// 撤销 Snackbar
const showUndoSnackbar = ref(false)
let undoSnackbarTimer = null

function showUndoNotification() {
  showUndoSnackbar.value = true
  // 4秒后自动关闭
  if (undoSnackbarTimer) clearTimeout(undoSnackbarTimer)
  undoSnackbarTimer = setTimeout(() => {
    showUndoSnackbar.value = false
  }, 4000)
}

function handleUndo() {
  if (store.canUndo) {
    store.undoLastAction()
    showUndoSnackbar.value = false
    // 刷新界面
    store.initStore()
  }
}

onMounted(async () => {
  store.initStore()

  // 监听键盘 Ctrl+Z 撤销
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault()
      handleUndo()
    }
  })

  // 监听 PWA 安装事件
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt.value = e
    // 只有在非 PWA 模式下才显示
    if (!window.matchMedia('(display-mode: standalone)').matches) {
      showInstallPrompt.value = true
    }
  })

  // 检查是否已经以 PWA 模式运行
  if (window.matchMedia('(display-mode: standalone)').matches) {
    showInstallPrompt.value = false
  }
})

async function installPWA() {
  if (!deferredPrompt.value) return

  deferredPrompt.value.prompt()
  const { outcome } = await deferredPrompt.value.userChoice

  if (outcome === 'accepted') {
    showInstallPrompt.value = false
  }
  deferredPrompt.value = null
}

function dismissInstallPrompt() {
  showInstallPrompt.value = false
}

function openAddBookModal() {
  addBookModal.value?.openModal()
}
</script>

<template>
  <div class="app">
    <h1>
      📚 艾宾浩斯复习打卡系统
      <button class="settings-btn" @click="settingsModal?.openModal()" title="同步设置">⚙️</button>
    </h1>

    <!-- 顶部统计卡片 -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="number">{{ store.totalSections }}</div>
        <div class="label">总小节</div>
      </div>
      <div class="stat-card success">
        <div class="number">{{ store.learnedCount }}</div>
        <div class="label">已学习</div>
      </div>
      <div class="stat-card warning">
        <div class="number">{{ store.todayReviewCount }}</div>
        <div class="label">今日待复习</div>
      </div>
      <div class="stat-card danger">
        <div class="number">{{ store.overdueCount }}</div>
        <div class="label">已逾期</div>
      </div>
      <div class="stat-card" style="background: linear-gradient(135deg, #e3f2fd, #f1f8f1);">
        <div class="number" style="color: #1976d2">{{ store.reviewQueue.length }}</div>
        <div class="label">复习队列</div>
      </div>
    </div>

    <!-- 学习进度条 -->
    <div class="progress-section">
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{ width: store.totalSections ? (store.learnedCount / store.totalSections * 100) + '%' : '0%' }"
        ></div>
      </div>
      <div class="progress-text">
        学习进度：{{ store.totalSections ? Math.round(store.learnedCount / store.totalSections * 100) : 0 }}%
        ({{ store.learnedCount }}/{{ store.totalSections }}小节)
      </div>
    </div>

    <!-- 今日待复习提示 -->
    <div v-if="store.todayReviewCount > 0" class="today-alert">
      <h3>🔔 今日待复习 ({{ store.todayReviewCount }}个)</h3>
    </div>

    <!-- 学习热力图 -->
    <ContributionHeatmap />

    <!-- 图表区域 -->
    <StatisticsCharts />

    <!-- 书籍章节区域 -->
    <div class="panel">
      <h2>📖 书籍章节</h2>
      <div class="tab-actions">
        <BookTabs />
        <button class="add-btn" @click="openAddBookModal">
          + 添加书籍/科目
        </button>
      </div>
      <ChapterList @reviewSubmitted="showUndoNotification" />
    </div>

    <!-- 添加书籍弹窗 -->
    <AddBookModal ref="addBookModal" />

    <!-- 撤销提示 Snackbar -->
    <Transition name="slide">
      <div v-if="showUndoSnackbar" class="undo-snackbar">
        <span>✅ 打卡成功</span>
        <button class="undo-btn" @click="handleUndo">撤销</button>
        <button class="undo-dismiss" @click="showUndoSnackbar = false">×</button>
      </div>
    </Transition>

    <!-- 同步设置弹窗 -->
    <SettingsModal ref="settingsModal" />

    <!-- 数据管理 -->
    <DataManagement />

    <!-- PWA 安装提示 -->
    <div v-if="showInstallPrompt" class="pwa-install-banner">
      <span>📲 添加到手机桌面，随时随地复习！</span>
      <div class="pwa-actions">
        <button class="pwa-install-btn" @click="installPWA">安装</button>
        <button class="pwa-dismiss-btn" @click="dismissInstallPrompt">×</button>
      </div>
    </div>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.app {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  text-align: center;
  color: var(--text-primary);
  margin-bottom: 25px;
  font-size: 28px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.settings-btn {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  font-size: 20px;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  margin-left: 15px;
  vertical-align: middle;
  transition: all 0.3s ease;
  backdrop-filter: var(--glass-blur);
}

.settings-btn:hover {
  background: var(--glass-bg-hover);
  border-color: var(--glass-border-hover);
  transform: rotate(30deg);
}

/* 统计卡片 */
.stats-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 15px;
  margin-bottom: 20px;
}

.stat-card {
  background: var(--card-bg);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-lg);
  padding: 20px 15px;
  text-align: center;
  box-shadow: var(--glass-shadow);
  transition: all 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-5px);
  border-color: var(--glass-border-hover);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
}

.stat-card .number {
  font-size: 36px;
  font-weight: bold;
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.stat-card.success .number {
  background: var(--gradient-success);
  -webkit-background-clip: text;
  background-clip: text;
}

.stat-card.warning .number {
  background: var(--gradient-warning);
  -webkit-background-clip: text;
  background-clip: text;
}

.stat-card.danger .number {
  background: var(--gradient-danger);
  -webkit-background-clip: text;
  background-clip: text;
}

.stat-card .label {
  color: var(--text-secondary);
  margin-top: 5px;
  font-size: 13px;
}

/* 进度条 */
.progress-section {
  background: var(--card-bg);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-lg);
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: var(--glass-shadow);
}

.progress-bar {
  height: 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--gradient-primary);
  transition: width 0.5s ease;
  border-radius: 6px;
  box-shadow: 0 0 20px rgba(129, 140, 248, 0.5);
}

.progress-text {
  text-align: center;
  margin-top: 10px;
  color: var(--text-secondary);
  font-size: 14px;
}

/* 今日提醒 */
.today-alert {
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(245, 158, 11, 0.1));
  border-left: 4px solid var(--warning);
  padding: 15px 20px;
  border-radius: var(--radius-md);
  margin-bottom: 20px;
  backdrop-filter: var(--glass-blur);
}

.today-alert h3 {
  color: var(--warning-light);
  font-size: 16px;
}

/* 面板 */
.panel {
  background: var(--card-bg);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-lg);
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: var(--glass-shadow);
}

.panel h2 {
  color: var(--text-primary);
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--card-border);
  font-size: 18px;
  font-weight: 500;
}

.tab-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.add-btn {
  padding: 10px 20px;
  background: var(--gradient-success);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: white;
  transition: all 0.3s ease;
  white-space: nowrap;
  box-shadow: 0 4px 15px rgba(52, 211, 153, 0.3);
}

.add-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(52, 211, 153, 0.4);
}

/* 响应式 */
@media (max-width: 768px) {
  .app {
    padding: 10px;
  }

  h1 {
    font-size: 22px;
    margin-bottom: 15px;
  }

  .stats-row {
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .stat-card {
    padding: 12px 8px;
  }

  .stat-card .number {
    font-size: 24px;
  }

  .stat-card .label {
    font-size: 11px;
  }

  .tab-actions {
    flex-direction: column;
    align-items: stretch;
  }
}

@media (max-width: 480px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* PWA 安装提示 */
.pwa-install-banner {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--card-bg);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
  padding: 12px 20px;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  gap: 15px;
  box-shadow: var(--glass-shadow);
  z-index: 1000;
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from { transform: translateX(-50%) translateY(100%); opacity: 0; }
  to { transform: translateX(-50%) translateY(0); opacity: 1; }
}

.pwa-install-banner span {
  font-size: 14px;
}

.pwa-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pwa-install-btn {
  background: var(--gradient-primary);
  color: white;
  border: none;
  padding: 6px 16px;
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.pwa-install-btn:hover {
  transform: scale(1.05);
}

.pwa-dismiss-btn {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--glass-border);
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.pwa-dismiss-btn:hover {
  background: var(--glass-bg-hover);
  color: var(--text-primary);
}

/* 撤销 Snackbar */
.undo-snackbar {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--card-bg);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--card-border);
  color: var(--text-primary);
  padding: 12px 20px;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  gap: 15px;
  box-shadow: var(--glass-shadow);
  z-index: 1001;
}

.undo-snackbar span {
  font-size: 14px;
}

.undo-btn {
  background: var(--gradient-warning);
  color: #1a1a1a;
  border: none;
  padding: 6px 16px;
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.undo-btn:hover {
  transform: scale(1.05);
}

.undo-dismiss:hover {
  color: var(--text-primary);
}

/* Transition */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(-50%) translateY(100%);
  opacity: 0;
}
</style>
