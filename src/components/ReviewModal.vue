<script setup>
import { ref, computed } from 'vue'
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

// 打开弹窗
function openModal() {
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

// 当前复习项
const currentItem = computed(() => {
  return store.dueQueue[currentIndex.value] || null
})

// 是否全部完成
const isAllDone = computed(() => {
  return store.dueQueue.length > 0 && currentIndex.value >= store.dueQueue.length
})

// 进度文本
const progressText = computed(() => {
  if (store.dueQueue.length === 0) return '0 / 0'
  return `${currentIndex.value + 1} / ${store.dueQueue.length}`
})

// 处理打卡
function handleReview(feedback) {
  if (!currentItem.value) return

  // 调用 store 提交复习
  store.submitReview(currentItem.value.key, feedback)

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
  currentIndex.value = 0
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
                :style="{ width: store.dueQueue.length ? (currentIndex / store.dueQueue.length * 100) + '%' : '0%' }"
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
            <div class="celebration-subtitle">太棒了，你已完成 {{ store.dueQueue.length }} 个复习任务</div>
            <button class="restart-btn" @click="handleRestart">再复习一遍</button>
          </div>

          <!-- 空队列提示 -->
          <div class="empty-content" v-else-if="store.dueQueue.length === 0">
            <div class="empty-icon">☕</div>
            <div class="empty-title">今日复习已清空</div>
            <div class="empty-subtitle">好好休息吧，明天再接再厉！</div>
          </div>

          <!-- 打卡按钮 -->
          <div class="action-buttons" v-if="!isAllDone && currentItem">
            <button class="review-btn hard" @click="handleReview('hard')">
              <span class="btn-icon">😓</span>
              <span class="btn-text">困难</span>
              <span class="btn-hint">较短间隔</span>
            </button>
            <button class="review-btn normal" @click="handleReview('normal')">
              <span class="btn-icon">😊</span>
              <span class="btn-text">一般</span>
              <span class="btn-hint">标准间隔</span>
            </button>
            <button class="review-btn easy" @click="handleReview('easy')">
              <span class="btn-icon">😎</span>
              <span class="btn-text">简单</span>
              <span class="btn-hint">较长间隔</span>
            </button>
          </div>

          <!-- 完成时的关闭按钮 -->
          <div class="complete-actions" v-if="isAllDone">
            <button class="done-btn" @click="handleClose">返回主页</button>
          </div>

          <!-- 空队列时显示返回按钮 -->
          <div class="complete-actions" v-if="store.dueQueue.length === 0">
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
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 24px;
  padding: 30px;
  position: relative;
  box-shadow:
    0 0 60px rgba(139, 92, 246, 0.3),
    0 0 100px rgba(6, 182, 212, 0.2),
    inset 0 0 0 1px rgba(255, 255, 255, 0.05);
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
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.7);
  font-size: 18px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: rgba(248, 113, 113, 0.2);
  border-color: rgba(248, 113, 113, 0.5);
  color: #f87171;
}

/* 进度条 */
.progress-header {
  margin-bottom: 30px;
}

.progress-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 10px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #06b6d4, #8b5cf6);
  border-radius: 3px;
  transition: width 0.3s ease;
  box-shadow: 0 0 10px rgba(6, 182, 212, 0.5);
}

.progress-text {
  text-align: center;
  color: rgba(255, 255, 255, 0.6);
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
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 15px;
  padding: 4px 16px;
  background: rgba(139, 92, 246, 0.2);
  border-radius: 20px;
  border: 1px solid rgba(139, 92, 246, 0.3);
}

.chapter-section {
  margin-bottom: 20px;
}

.chapter-name {
  display: block;
  font-size: 16px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 8px;
}

.section-name {
  display: block;
  font-size: 28px;
  font-weight: 700;
  color: #f1f5f9;
  text-shadow: 0 0 20px rgba(255, 255, 255, 0.3);
}

.due-info {
  font-size: 14px;
  padding: 6px 16px;
  border-radius: 20px;
  margin-top: 15px;
}

.due-info.overdue {
  background: rgba(248, 113, 113, 0.2);
  color: #f87171;
  border: 1px solid rgba(248, 113, 113, 0.3);
}

.due-info.today {
  background: rgba(251, 191, 36, 0.2);
  color: #fbbf24;
  border: 1px solid rgba(251, 191, 36, 0.3);
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
  background: linear-gradient(135deg, rgba(248, 113, 113, 0.3), rgba(239, 68, 68, 0.2));
  border: 1px solid rgba(248, 113, 113, 0.4);
  box-shadow: 0 4px 20px rgba(248, 113, 113, 0.2);
}

.review-btn.hard:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 30px rgba(248, 113, 113, 0.4);
}

.review-btn.normal {
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.3), rgba(245, 158, 11, 0.2));
  border: 1px solid rgba(251, 191, 36, 0.4);
  box-shadow: 0 4px 20px rgba(251, 191, 36, 0.2);
}

.review-btn.normal:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 30px rgba(251, 191, 36, 0.4);
}

.review-btn.easy {
  background: linear-gradient(135deg, rgba(52, 211, 153, 0.3), rgba(16, 185, 129, 0.2));
  border: 1px solid rgba(52, 211, 153, 0.4);
  box-shadow: 0 4px 20px rgba(52, 211, 153, 0.2);
}

.review-btn.easy:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 30px rgba(52, 211, 153, 0.4);
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
  color: #f1f5f9;
}

.btn-hint {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
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
  color: #f1f5f9;
  margin-bottom: 10px;
}

.celebration-subtitle {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 30px;
}

.restart-btn {
  padding: 12px 30px;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(99, 102, 241, 0.2));
  border: 1px solid rgba(139, 92, 246, 0.4);
  border-radius: 12px;
  color: #f1f5f9;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.restart-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(139, 92, 246, 0.3);
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
  color: #f1f5f9;
  margin-bottom: 10px;
}

.empty-subtitle {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.6);
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
  background: linear-gradient(135deg, #8b5cf6, #6366f1);
  border: none;
  border-radius: 12px;
  color: white;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 20px rgba(139, 92, 246, 0.3);
}

.done-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(139, 92, 246, 0.4);
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
}
</style>
