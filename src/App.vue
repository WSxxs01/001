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
import ReviewModal from './components/ReviewModal.vue'

const store = useStudyStore()
const addBookModal = ref(null)
const settingsModal = ref(null)
const reviewModal = ref(null)

// PWA 安装提示
const deferredPrompt = ref(null)
const showInstallPrompt = ref(false)

// 撤销 Snackbar
const showUndoSnackbar = ref(false)
let undoSnackbarTimer = null

function showUndoNotification() {
  showUndoSnackbar.value = true
  if (undoSnackbarTimer) clearTimeout(undoSnackbarTimer)
  undoSnackbarTimer = setTimeout(() => {
    showUndoSnackbar.value = false
  }, 4000)
}

function handleUndo() {
  if (store.canUndo) {
    store.undoLastAction()
    showUndoSnackbar.value = false
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
    <!-- 页面顶部光晕效果 -->
    <div class="ambient-light"></div>

    <!-- 标题区域 -->
    <header class="app-header">
      <h1>
        <span class="title-icon">📚</span>
        <span class="title-text">艾宾浩斯复习打卡系统</span>
      </h1>
      <button
        class="settings-btn"
        @click="settingsModal?.openModal()"
        title="同步设置"
        aria-label="同步设置"
      >
        <span class="btn-icon">⚙️</span>
      </button>
    </header>

    <!-- 顶部统计卡片 -->
    <section class="stats-row">
      <div class="stat-card glass-panel" v-for="(stat, index) in [
        { label: '总小节', value: store.totalSections, key: 'total' },
        { label: '已学习', value: store.learnedCount, key: 'success' },
        { label: '今日待复习', value: store.todayReviewCount, key: 'warning' },
        { label: '已逾期', value: store.overdueCount, key: 'danger' },
        { label: '复习队列', value: store.reviewQueue.length, key: 'info' }
      ]" :key="stat.key" :class="stat.key">
        <div class="number">{{ stat.value }}</div>
        <div class="label">{{ stat.label }}</div>
      </div>
    </section>

    <!-- 学习进度条 -->
    <section class="progress-section glass-panel">
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{ width: store.totalSections ? (store.learnedCount / store.totalSections * 100) + '%' : '0%' }"
        ></div>
      </div>
      <div class="progress-text">
        学习进度：{{ store.totalSections ? Math.round(store.learnedCount / store.totalSections * 100) : 0 }}%
        <span class="progress-detail">({{ store.learnedCount }}/{{ store.totalSections }} 小节)</span>
      </div>
    </section>

    <!-- 专注复习模式按钮 -->
    <section class="focus-review-section">
      <button
        class="focus-review-btn"
        :class="{ disabled: store.dueQueue.length === 0 }"
        @click="reviewModal?.openModal()"
        :aria-disabled="store.dueQueue.length === 0"
      >
        <span class="focus-icon">{{ store.dueQueue.length > 0 ? '🚀' : '☕' }}</span>
        <span class="focus-text" v-if="store.dueQueue.length > 0">
          开始今日复习 <span class="count-badge">{{ store.dueQueue.length }}</span>
        </span>
        <span class="focus-text" v-else>今日复习已清空，好好休息吧</span>
      </button>
    </section>

    <!-- 今日待复习提示 -->
    <aside v-if="store.todayReviewCount > 0" class="today-alert">
      <span class="alert-icon">🔔</span>
      <span class="alert-text">今日待复习 {{ store.todayReviewCount }} 个任务</span>
    </aside>

    <!-- 图表区域 -->
    <StatisticsCharts />

    <!-- 学习热力图 -->
    <ContributionHeatmap />

    <!-- 书籍章节区域 -->
    <section class="panel glass-panel">
      <header class="panel-header">
        <h2>
          <span class="panel-icon">📖</span>
          <span>书籍章节</span>
        </h2>
      </header>
      <div class="tab-actions">
        <BookTabs />
        <button class="add-btn" @click="openAddBookModal">
          <span class="btn-icon">+</span>
          <span>添加书籍/科目</span>
        </button>
      </div>
      <ChapterList @reviewSubmitted="showUndoNotification" />
    </section>

    <!-- 添加书籍弹窗 -->
    <AddBookModal ref="addBookModal" />

    <!-- 撤销提示 Snackbar -->
    <Transition name="slide">
      <div v-if="showUndoSnackbar" class="undo-snackbar">
        <span class="snackbar-icon">✅</span>
        <span class="snackbar-text">打卡成功</span>
        <button class="undo-btn" @click="handleUndo">撤销</button>
        <button class="snackbar-dismiss" @click="showUndoSnackbar = false">✕</button>
      </div>
    </Transition>

    <!-- 同步设置弹窗 -->
    <SettingsModal ref="settingsModal" />

    <!-- 专注复习弹窗 -->
    <ReviewModal ref="reviewModal" />

    <!-- 数据管理 -->
    <DataManagement />

    <!-- PWA 安装提示 -->
    <Transition name="slideUp">
      <div v-if="showInstallPrompt" class="pwa-install-banner">
        <span class="pwa-icon">📲</span>
        <span class="pwa-text">添加到手机桌面，随时随地复习！</span>
        <div class="pwa-actions">
          <button class="pwa-install-btn" @click="installPWA">安装</button>
          <button class="pwa-dismiss-btn" @click="dismissInstallPrompt" aria-label="关闭">✕</button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style>
/* ============================================
   APP 全局布局
   ============================================ */
.app {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
  position: relative;
  min-height: 100vh;
}

/* 环境光效 */
.ambient-light {
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 800px;
  height: 400px;
  background: radial-gradient(ellipse at center, rgba(94, 106, 210, 0.08) 0%, transparent 70%);
  pointer-events: none;
  z-index: -1;
}

/* ============================================
   应用标题
   ============================================ */
.app-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 32px;
  position: relative;
}

h1 {
  text-align: center;
  color: var(--text-primary);
  font-size: 26px;
  font-weight: 600;
  letter-spacing: -0.02em;
  display: flex;
  align-items: center;
  gap: 10px;
}

.title-icon {
  font-size: 28px;
  filter: drop-shadow(0 0 8px rgba(94, 106, 210, 0.4));
}

.title-text {
  background: linear-gradient(135deg, var(--text-primary) 0%, var(--primary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.settings-btn {
  position: absolute;
  right: 0;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-normal);
  display: flex;
  align-items: center;
  justify-content: center;
}

.settings-btn:hover {
  background: var(--bg-hover);
  border-color: var(--border-hover);
  color: var(--text-primary);
  transform: rotate(30deg);
}

.settings-btn .btn-icon {
  font-size: 18px;
  pointer-events: none;
}

/* ============================================
   统计卡片网格
   ============================================ */
.stats-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  padding: 20px 16px;
  text-align: center;
}

.stat-card.total:hover {
  border-color: var(--primary);
  box-shadow: 0 8px 24px rgba(94, 106, 210, 0.2);
}

.stat-card.success:hover {
  border-color: var(--success);
  box-shadow: 0 8px 24px rgba(77, 175, 115, 0.2);
}

.stat-card.warning:hover {
  border-color: var(--warning);
  box-shadow: 0 8px 24px rgba(226, 179, 64, 0.2);
}

.stat-card.danger:hover {
  border-color: var(--danger);
  box-shadow: 0 8px 24px rgba(229, 72, 77, 0.2);
}

.stat-card.info:hover {
  border-color: var(--info);
  box-shadow: 0 8px 24px rgba(94, 156, 230, 0.2);
}

.stat-card .number {
  font-size: 32px;
  font-weight: 700;
  line-height: 1;
  margin-bottom: 8px;
  letter-spacing: -0.02em;
  /* 纵向渐变文字效果 */
  background: linear-gradient(to bottom, #ffffff 0%, rgba(255, 255, 255, 0.6) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.stat-card.total .number {
  text-shadow: 0 0 20px rgba(94, 106, 210, 0.3);
}

.stat-card.success .number {
  text-shadow: 0 0 20px rgba(77, 175, 115, 0.3);
}

.stat-card.warning .number {
  text-shadow: 0 0 20px rgba(226, 179, 64, 0.3);
}

.stat-card.danger .number {
  text-shadow: 0 0 20px rgba(229, 72, 77, 0.3);
}

.stat-card.info .number {
  text-shadow: 0 0 20px rgba(94, 156, 230, 0.3);
}

.stat-card .label {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* ============================================
   进度条
   ============================================ */
.progress-section {
  padding: 24px;
  margin-bottom: 24px;
}

.progress-bar {
  height: 10px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-full);
  overflow: hidden;
  position: relative;
}

.progress-fill {
  height: 100%;
  background: #5E6AD2;
  border-radius: var(--radius-full);
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  box-shadow: 0 0 10px rgba(94, 106, 210, 0.5);
}

.progress-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.progress-text {
  text-align: center;
  margin-top: 14px;
  color: var(--text-secondary);
  font-size: 14px;
}

.progress-detail {
  color: var(--text-muted);
  margin-left: 8px;
}

/* ============================================
   专注复习按钮
   ============================================ */
.focus-review-section {
  margin-bottom: 24px;
}

.focus-review-btn {
  width: 100%;
  padding: 20px 32px;
  background: linear-gradient(135deg, var(--primary) 0%, #8B5CF6 100%);
  border: none;
  border-radius: var(--radius-xl);
  color: white;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  transition: all var(--transition-normal);
  box-shadow: 0 4px 20px rgba(94, 106, 210, 0.3), 0 0 0 1px rgba(255,255,255,0.1) inset;
  position: relative;
  overflow: hidden;
}

.focus-review-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  transition: left 0.6s ease;
}

.focus-review-btn:hover::before {
  left: 100%;
}

.focus-review-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(94, 106, 210, 0.4), 0 0 0 1px rgba(255,255,255,0.15) inset;
}

.focus-review-btn:active {
  transform: scale(0.98);
}

.focus-review-btn.disabled {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  color: var(--text-muted);
  cursor: not-allowed;
  box-shadow: none;
}

.focus-review-btn.disabled:hover {
  transform: none;
}

.focus-review-btn.disabled::before {
  display: none;
}

.focus-icon {
  font-size: 22px;
}

.focus-text {
  display: flex;
  align-items: center;
  gap: 8px;
}

.count-badge {
  background: rgba(255,255,255,0.2);
  padding: 2px 10px;
  border-radius: var(--radius-full);
  font-size: 14px;
  font-weight: 700;
}

/* ============================================
   今日提醒
   ============================================ */
.today-alert {
  background: var(--warning-subtle);
  border: 1px solid rgba(226, 179, 64, 0.2);
  border-radius: var(--radius-lg);
  padding: 14px 18px;
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--warning);
  font-size: 14px;
  font-weight: 500;
}

.alert-icon {
  font-size: 16px;
}

/* ============================================
   主面板
   ============================================ */
.panel {
  padding: 24px;
  margin-bottom: 24px;
}

.panel-header {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-faint);
}

.panel h2 {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.panel-icon {
  font-size: 20px;
}

.tab-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.add-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-normal);
  white-space: nowrap;
}

.add-btn:hover {
  background: var(--bg-hover);
  border-color: var(--border-hover);
}

.add-btn .btn-icon {
  font-size: 16px;
  pointer-events: none;
}

/* ============================================
   Snackbar
   ============================================ */
.undo-snackbar {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  padding: 14px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: var(--shadow-xl);
  z-index: 9999;
}

.snackbar-icon {
  font-size: 16px;
}

.snackbar-text {
  font-size: 14px;
  font-weight: 500;
}

.undo-btn {
  padding: 6px 14px;
  background: var(--warning-subtle);
  border: 1px solid rgba(226, 179, 64, 0.3);
  border-radius: var(--radius-md);
  color: var(--warning);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.undo-btn:hover {
  background: rgba(226, 179, 64, 0.25);
}

.snackbar-dismiss {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 14px;
  cursor: pointer;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.snackbar-dismiss:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* ============================================
   PWA 安装提示
   ============================================ */
.pwa-install-banner {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-xl);
  color: var(--text-primary);
  padding: 16px 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: var(--shadow-xl);
  z-index: 1000;
}

.pwa-icon {
  font-size: 24px;
}

.pwa-text {
  font-size: 14px;
  white-space: nowrap;
}

.pwa-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pwa-install-btn {
  padding: 8px 18px;
  background: var(--primary);
  border: none;
  border-radius: var(--radius-md);
  color: white;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.pwa-install-btn:hover {
  background: var(--primary-hover);
  transform: scale(1.02);
}

.pwa-dismiss-btn {
  width: 28px;
  height: 28px;
  border: 1px solid var(--border-default);
  background: transparent;
  border-radius: var(--radius-full);
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.pwa-dismiss-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-hover);
}

/* ============================================
   过渡动画
   ============================================ */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(-50%) translateY(100%);
  opacity: 0;
}

.slideUp-enter-active,
.slideUp-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slideUp-enter-from,
.slideUp-leave-to {
  transform: translateX(-50%) translateY(100%);
  opacity: 0;
}

/* ============================================
   响应式
   ============================================ */
@media (max-width: 1024px) {
  .stats-row {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .app {
    padding: 16px;
  }

  h1 {
    font-size: 20px;
  }

  .title-text {
    display: none;
  }

  .title-icon {
    font-size: 24px;
  }

  .settings-btn {
    width: 36px;
    height: 36px;
  }

  .stats-row {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .stat-card {
    padding: 16px 12px;
  }

  .stat-card .number {
    font-size: 24px;
  }

  .stat-card .label {
    font-size: 11px;
  }

  .focus-review-btn {
    padding: 16px 20px;
    font-size: 14px;
  }

  .tab-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .add-btn {
    justify-content: center;
  }

  .panel {
    padding: 16px;
  }

  .pwa-install-banner {
    flex-direction: column;
    text-align: center;
    padding: 16px;
    max-width: 90%;
  }

  .undo-snackbar {
    flex-direction: column;
    gap: 10px;
    padding: 16px;
    text-align: center;
  }
}

@media (max-width: 480px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }

  .stat-card:nth-child(5) {
    grid-column: span 2;
  }
}

/* ============================================
   移动端触摸优化（核心修复保留）
   ============================================ */
@media (pointer: coarse) {
  button:hover {
    /* 触摸设备禁用 hover 效果 */
  }

  button:active {
    opacity: 0.8;
  }
}

button {
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;
  user-select: none;
  -webkit-user-select: none;
}

button * {
  pointer-events: none !important;
}
</style>
