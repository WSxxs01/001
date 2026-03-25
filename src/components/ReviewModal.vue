<script setup>
import { ref, computed } from 'vue'
import { Rating } from 'ts-fsrs'
import { useStudyStore } from '../stores/useStudyStore'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'reviewComplete'])

const store = useStudyStore()
const modalVisible = ref(false)

// 本地复习列表快照（修复响应式跳项问题）
const localReviewList = ref([])

// 打开弹窗
function openModal() {
  // 深拷贝当时的复习队列，避免打卡后 store.dueQueue 变化导致跳项
  localReviewList.value = [...store.dueQueue]
  currentIndex.value = 0
  feedbackStatus.value = null
  modalVisible.value = true
}

// 关闭弹窗
function closeModal() {
  modalVisible.value = false
  emit('close')
}

// 暴露方法给父组件
defineExpose({
  openModal
})

// 当前复习索引
const currentIndex = ref(0)

// 复习反馈状态
const feedbackStatus = ref(null) // 'success' | null

// 当前复习项（从本地快照获取）
const currentItem = computed(() => {
  return localReviewList.value[currentIndex.value] || null
})

// 是否全部完成（基于本地快照）
const isAllDone = computed(() => {
  return localReviewList.value.length > 0 && currentIndex.value >= localReviewList.value.length
})

// 进度文本（基于本地快照）
const progressText = computed(() => {
  if (localReviewList.value.length === 0) return '0 / 0'
  return `${currentIndex.value + 1} / ${localReviewList.value.length}`
})

// FSRS Rating 映射
const ratingMap = {
  'again': Rating.Again,
  'good': Rating.Good,
  'easy': Rating.Easy
}

// 处理打卡
function handleReview(feedback) {
  // 从本地快照获取当前项
  const item = localReviewList.value[currentIndex.value]
  if (!item) return

  // 调用 store 提交复习（使用本地快照中的 key，传入 FSRS Rating）
  store.submitReview(item.key, feedback)

  // 显示成功动画
  feedbackStatus.value = 'success'

  // 延迟后切换到下一个
  setTimeout(() => {
    feedbackStatus.value = null
    currentIndex.value++

    // 如果全部完成，通知父组件
    if (isAllDone.value) {
      emit('reviewComplete')
    }
  }, 600)
}

// 关闭弹窗
function handleClose() {
  currentIndex.value = 0
  feedbackStatus.value = null
  modalVisible.value = false
  emit('close')
}

// 重新开始
function handleRestart() {
  // 重新获取当前队列的快照
  localReviewList.value = [...store.dueQueue]
  currentIndex.value = 0
}

// ==================== 逃生舱机制 ====================

/**
 * 【稍后再看】将当前卡片移到队列末尾
 * 注意：由于数组移位，不要执行 currentIndex.value++
 */
function skipToBottom() {
  const item = localReviewList.value[currentIndex.value]
  if (!item) return

  // 从当前位置移除
  localReviewList.value.splice(currentIndex.value, 1)
  // 推入数组末尾
  localReviewList.value.push(item)

  console.log('[skipToBottom] 卡片已移到队列末尾:', item.sectionName)
}

/**
 * 【搁置到明天】调用 Store 方法推迟到明天
 * 然后进入下一张卡片
 */
function buryCard() {
  const item = localReviewList.value[currentIndex.value]
  if (!item) return

  // 调用 Store 方法推迟复习时间
  const success = store.buryUntilTomorrow(item.key)

  if (success) {
    // 从本地队列中移除（因为已经推迟到明天，不再属于今日队列）
    localReviewList.value.splice(currentIndex.value, 1)

    console.log('[buryCard] 卡片已搁置到明天:', item.sectionName)

    // 检查是否全部完成
    if (isAllDone.value) {
      emit('reviewComplete')
    }
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modalVisible" class="review-modal-overlay" @click.self="handleClose">
        <div class="review-modal" :class="{ 'success-flash': feedbackStatus === 'success' }">

          <!-- 关闭按钮 -->
          <button class="close-btn" @click="handleClose">✕</button>

          <!-- 进度条 -->
          <div class="progress-header">
            <div class="progress-bar">
              <div
                class="progress-fill"
                :style="{ width: localReviewList.length ? (currentIndex / localReviewList.length * 100) + '%' : '0%' }"
              ></div>
            </div>
            <div class="progress-text">
              复习进度: {{ progressText }}
            </div>
          </div>

          <!-- 复习内容区域 -->
          <div class="review-content" v-if="!isAllDone && currentItem">
            <div class="book-label">{{ currentItem.bookName }}</div>
            <div class="chapter-section">
              <span class="chapter-name">{{ currentItem.chapterName }}</span>
              <span class="section-name">{{ currentItem.sectionName }}</span>
            </div>
            <div class="due-info" :class="currentItem.status">
              {{ currentItem.status === 'overdue' ? '⚠️ 已逾期' : '📅 今日复习' }}
            </div>
          </div>

          <!-- 完成画面 -->
          <div class="complete-content" v-else-if="isAllDone">
            <div class="celebration-icon">🎉</div>
            <div class="celebration-title">恭喜！今日复习任务全部完成！</div>
            <div class="celebration-subtitle">太棒了，你已完成 {{ localReviewList.length }} 个复习任务</div>
            <button class="restart-btn" @click="handleRestart">再复习一遍</button>
          </div>

          <!-- 空队列提示 -->
          <div class="empty-content" v-else-if="localReviewList.length === 0">
            <div class="empty-icon">☕</div>
            <div class="empty-title">今日复习已清空</div>
            <div class="empty-subtitle">好好休息吧，明天再接再厉！</div>
          </div>

          <!-- 打卡按钮 - FSRS 标准 Rating -->
          <div class="action-buttons" v-if="!isAllDone && currentItem">
            <button class="review-btn hard" @click="handleReview('again')">
              <span class="btn-icon">😓</span>
              <span class="btn-text">忘记</span>
              <span class="btn-hint">Again</span>
            </button>
            <button class="review-btn normal" @click="handleReview('good')">
              <span class="btn-icon">😊</span>
              <span class="btn-text">良好</span>
              <span class="btn-hint">Good</span>
            </button>
            <button class="review-btn easy" @click="handleReview('easy')">
              <span class="btn-icon">😎</span>
              <span class="btn-text">简单</span>
              <span class="btn-hint">Easy</span>
            </button>
          </div>

          <!-- 逃生舱控制区 - 幽灵按钮 -->
          <div class="escape-hatch" v-if="!isAllDone && currentItem">
            <button class="ghost-btn skip-btn" @click="skipToBottom">
              <span class="ghost-icon">⏭️</span>
              <span class="ghost-text">稍后再看</span>
            </button>
            <button class="ghost-btn bury-btn" @click="buryCard">
              <span class="ghost-icon">📅</span>
              <span class="ghost-text">搁置到明天</span>
            </button>
          </div>

          <!-- 完成时的关闭按钮 -->
          <div class="complete-actions" v-if="isAllDone">
            <button class="done-btn" @click="handleClose">返回主页</button>
          </div>

          <!-- 空队列时显示返回按钮 -->
          <div class="complete-actions" v-if="localReviewList.length === 0">
            <button class="done-btn" @click="handleClose">返回主页</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.review-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.review-modal {
  width: 100%;
  max-width: 500px;
  background: rgba(14, 14, 16, 0.95);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-xl);
  padding: 30px;
  position: relative;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.06),
    0 8px 40px rgba(0, 0, 0, 0.5),
    0 0 60px rgba(94, 106, 210, 0.15);
  min-height: 400px;
  display: flex;
  flex-direction: column;
}

.review-modal.success-flash {
  animation: flashSuccess 0.6s ease;
}

@keyframes flashSuccess {
  0% { box-shadow: 0 0 60px rgba(139, 92, 246, 0.3), 0 0 100px rgba(6, 182, 212, 0.2); }
  50% { box-shadow: 0 0 80px rgba(52, 211, 153, 0.6), 0 0 120px rgba(52, 211, 153, 0.4); }
  100% { box-shadow: 0 0 60px rgba(139, 92, 246, 0.3), 0 0 100px rgba(6, 182, 212, 0.2); }
}

/* 关闭按钮 */
.close-btn {
  position: absolute;
  top: 15px;
  right: 15px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
  color: var(--text-muted);
  font-size: 18px;
  cursor: pointer;
  transition: all var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: var(--danger-subtle);
  border-color: var(--danger);
  color: var(--danger);
}

/* 进度条 */
.progress-header {
  margin-bottom: 30px;
}

.progress-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-full);
  overflow: hidden;
  margin-bottom: 10px;
}

.progress-fill {
  height: 100%;
  background: #5E6AD2;
  border-radius: var(--radius-full);
  transition: width 0.3s ease;
  box-shadow: 0 0 10px rgba(94, 106, 210, 0.5);
}

.progress-text {
  text-align: center;
  color: var(--text-secondary);
  font-size: 14px;
}

/* 复习内容 */
.review-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 20px 0;
}

.book-label {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 15px;
  padding: 4px 16px;
  background: var(--primary-subtle);
  border-radius: var(--radius-full);
  border: 1px solid rgba(94, 106, 210, 0.3);
}

.chapter-section {
  margin-bottom: 20px;
}

.chapter-name {
  display: block;
  font-size: 16px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.section-name {
  display: block;
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
}

.due-info {
  font-size: 14px;
  padding: 6px 16px;
  border-radius: var(--radius-full);
  margin-top: 15px;
}

.due-info.overdue {
  background: var(--danger-subtle);
  color: var(--danger);
  border: 1px solid rgba(229, 72, 77, 0.3);
}

.due-info.today {
  background: var(--warning-subtle);
  color: var(--warning);
  border: 1px solid rgba(226, 179, 64, 0.3);
}

/* 打卡按钮 */
.action-buttons {
  display: flex;
  gap: 15px;
  justify-content: center;
  margin-top: auto;
  padding-top: 20px;
}

.review-btn {
  flex: 1;
  max-width: 130px;
  padding: 15px 10px;
  border: none;
  border-radius: 16px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.review-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 100%);
  pointer-events: none;
}

.review-btn.hard {
  background: var(--danger-subtle);
  border: 1px solid rgba(229, 72, 77, 0.4);
  box-shadow: 0 4px 20px rgba(229, 72, 77, 0.15);
  color: var(--danger);
}

.review-btn.hard:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 30px rgba(229, 72, 77, 0.25);
  background: rgba(229, 72, 77, 0.2);
}

.review-btn.normal {
  background: var(--warning-subtle);
  border: 1px solid rgba(226, 179, 64, 0.4);
  box-shadow: 0 4px 20px rgba(226, 179, 64, 0.15);
  color: var(--warning);
}

.review-btn.normal:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 30px rgba(226, 179, 64, 0.25);
  background: rgba(226, 179, 64, 0.2);
}

.review-btn.easy {
  background: var(--success-subtle);
  border: 1px solid rgba(77, 175, 115, 0.4);
  box-shadow: 0 4px 20px rgba(77, 175, 115, 0.15);
  color: var(--success);
}

.review-btn.easy:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 30px rgba(77, 175, 115, 0.25);
  background: rgba(77, 175, 115, 0.2);
}

.review-btn:active {
  transform: scale(0.95);
}

.btn-icon {
  font-size: 24px;
}

.btn-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.btn-hint {
  font-size: 11px;
  color: var(--text-muted);
}

/* ==================== 逃生舱 - 幽灵按钮 ==================== */
.escape-hatch {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px dashed var(--border-faint);
}

.ghost-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  background: transparent;
  border: 1px dashed rgba(255, 255, 255, 0.15);
  border-radius: var(--radius-lg);
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  position: relative;
  overflow: hidden;
}

.ghost-btn::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  background: radial-gradient(circle, rgba(94, 106, 210, 0.2) 0%, transparent 70%);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  transition: all 0.4s ease;
}

.ghost-btn:hover::before {
  width: 150%;
  height: 150%;
}

.ghost-btn:hover {
  border-color: rgba(94, 106, 210, 0.4);
  color: rgba(255, 255, 255, 0.7);
  background: rgba(94, 106, 210, 0.08);
  box-shadow: 0 0 20px rgba(94, 106, 210, 0.15);
}

.ghost-btn:active {
  transform: scale(0.96);
}

.ghost-icon {
  font-size: 14px;
  opacity: 0.6;
  transition: all var(--transition-fast);
}

.ghost-btn:hover .ghost-icon {
  opacity: 1;
  transform: scale(1.1);
}

.ghost-text {
  position: relative;
  z-index: 1;
}

/* 跳过按钮 - 偏冷色调 */
.ghost-btn.skip-btn:hover {
  border-color: rgba(94, 156, 230, 0.4);
  background: rgba(94, 156, 230, 0.08);
  box-shadow: 0 0 20px rgba(94, 156, 230, 0.15);
}

/* 搁置按钮 - 偏暖色调 */
.ghost-btn.bury-btn:hover {
  border-color: rgba(251, 146, 60, 0.4);
  background: rgba(251, 146, 60, 0.08);
  box-shadow: 0 0 20px rgba(251, 146, 60, 0.15);
}

/* 完成画面 */
.complete-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 40px 0;
}

.celebration-icon {
  font-size: 80px;
  margin-bottom: 20px;
  animation: bounce 1s ease infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-15px); }
}

.celebration-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 10px;
}

.celebration-subtitle {
  font-size: 16px;
  color: var(--text-secondary);
  margin-bottom: 30px;
}

.restart-btn {
  padding: 12px 30px;
  background: var(--primary-subtle);
  border: 1px solid rgba(94, 106, 210, 0.4);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-normal);
}

.restart-btn:hover {
  transform: translateY(-2px);
  background: rgba(94, 106, 210, 0.2);
  box-shadow: 0 8px 25px rgba(94, 106, 210, 0.2);
}

/* 空队列画面 */
.empty-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 40px 0;
}

.empty-icon {
  font-size: 80px;
  margin-bottom: 20px;
}

.empty-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 10px;
}

.empty-subtitle {
  font-size: 16px;
  color: var(--text-secondary);
}

/* 底部操作区 */
.complete-actions {
  display: flex;
  justify-content: center;
  margin-top: auto;
  padding-top: 20px;
}

.done-btn {
  padding: 14px 40px;
  background: #5E6AD2;
  border: none;
  border-radius: var(--radius-lg);
  color: white;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-normal);
  box-shadow:
    0 0 0 1px rgba(94, 106, 210, 0.5),
    0 4px 12px rgba(94, 106, 210, 0.3),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.2);
}

.done-btn:hover {
  transform: translateY(-2px);
  box-shadow:
    0 0 0 1px rgba(104, 114, 217, 0.6),
    0 6px 16px rgba(94, 106, 210, 0.4),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.25);
}

/* Transition */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .review-modal,
.modal-leave-to .review-modal {
  transform: scale(0.9) translateY(20px);
}

/* 响应式 */
@media (max-width: 480px) {
  .review-modal {
    padding: 20px;
    min-height: 350px;
  }

  .section-name {
    font-size: 22px;
  }

  .action-buttons {
    flex-direction: column;
    gap: 10px;
  }

  .review-btn {
    max-width: 100%;
    flex-direction: row;
    justify-content: center;
    padding: 12px 20px;
    gap: 10px;
  }

  .btn-icon {
    font-size: 20px;
  }

  .btn-hint {
    display: none;
  }

  .escape-hatch {
    gap: 8px;
  }

  .ghost-btn {
    padding: 8px 14px;
    font-size: 12px;
  }
}
</style>
