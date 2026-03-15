<script setup>
import { computed, ref } from 'vue'
import { useStudyStore } from '../stores/useStudyStore'
import { getSectionStatus, getToday } from '../utils/sm2'

const props = defineProps({
  sectionKey: {
    type: String,
    required: true
  },
  sectionName: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['reviewSubmitted'])

const store = useStudyStore()
const isFlashing = ref(false)

// 计算小节状态
const status = computed(() => {
  return store.getSectionStatus(props.sectionKey)
})

// 状态标签显示
const statusTag = computed(() => {
  const data = store.getSectionData(props.sectionKey)
  switch (status.value) {
    case 'unstarted':
      return { text: '未开始', class: 'tag-unstarted' }
    case 'learning':
      return { text: '学习中', class: 'tag-learning' }
    case 'today':
      return { text: '今日复习', class: 'tag-today' }
    case 'overdue':
      return { text: '已逾期', class: 'tag-overdue' }
    case 'completed':
      const mastery = data?.masteryLevel || 'learning'
      const tags = {
        learning: { text: '学习中', class: 'tag-learning' },
        stable: { text: '已掌握', class: 'tag-stable' },
        mastered: { text: '已精通', class: 'tag-mastered' },
        weak: { text: '需加强', class: 'tag-weak' }
      }
      return tags[mastery] || tags.learning
    default:
      return { text: '未开始', class: 'tag-unstarted' }
  }
})

// 按钮显示
const buttonConfig = computed(() => {
  switch (status.value) {
    case 'unstarted':
      return { text: '开始学习', class: 'btn-learn', action: 'learn' }
    case 'learning':
    case 'today':
    case 'overdue':
      return { text: '复习', class: 'btn-review', action: 'review' }
    case 'completed':
      return { text: '已完成', class: 'btn-done', action: 'done' }
    default:
      return { text: '开始学习', class: 'btn-learn', action: 'learn' }
  }
})

// 点击操作
function handleClick() {
  if (buttonConfig.value.action === 'done') return

  // 调用 store 方法
  store.submitReview(props.sectionKey, 'normal')

  // 触发闪烁动画
  triggerFlash()

  // 通知父组件
  emit('reviewSubmitted')
}

// 移动端触摸处理
function handleTouchEnd(e) {
  // 防止触摸触发两次点击事件
  e.preventDefault()
  e.stopPropagation()
  handleClick()
}

function triggerFlash() {
  isFlashing.value = true
  setTimeout(() => {
    isFlashing.value = false
  }, 600)
}

// 删除小节
function handleDelete(e) {
  e.stopPropagation()

  if (confirm('确定要删除这个小节及其复习进度吗？不可恢复（除非立即撤销）')) {
    store.deleteSection(props.sectionKey)
    emit('reviewSubmitted')
  }
}
</script>

<template>
  <div
    class="section-item"
    :class="{ 'completed-flash': isFlashing }"
  >
    <div class="section-name">
      <span class="mastery-indicator" :class="`mastery-${status === 'completed' ? (store.getSectionData(sectionKey)?.masteryLevel || 'learning') : 'learning'}`"></span>
      {{ sectionName }}
    </div>
    <button
      class="section-delete-btn"
      title="删除"
      @click="handleDelete"
    >
      🗑️
    </button>
    <div class="section-right">
      <span class="section-status-tag" :class="statusTag.class">
        {{ statusTag.text }}
      </span>
      <button
        class="section-btn"
        :class="buttonConfig.class"
        :disabled="buttonConfig.action === 'done'"
        @click="handleClick"
        @touchend.prevent="handleTouchEnd"
      >
        <span class="btn-text">{{ buttonConfig.text }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.section-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 15px 12px 25px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.2s ease;
  background: rgba(0, 0, 0, 0.15);
}

.section-item:last-child {
  border-bottom: none;
}

.section-item:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
}

.section-item.completed-flash {
  animation: completeFlash 0.6s ease;
}

@keyframes completeFlash {
  0% { background: rgba(52, 211, 153, 0.3); }
  50% { background: rgba(52, 211, 153, 0.2); }
  100% { background: rgba(0, 0, 0, 0.15); }
}

.section-name {
  font-size: 13px;
  color: var(--text-primary);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: flex;
  align-items: center;
}

.mastery-indicator {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 8px;
  flex-shrink: 0;
}

.mastery-learning { background: var(--info); box-shadow: 0 0 6px rgba(56, 189, 248, 0.5); }
.mastery-stable { background: var(--success); box-shadow: 0 0 6px rgba(52, 211, 153, 0.5); }
.mastery-mastered { background: var(--success-light); box-shadow: 0 0 8px rgba(110, 231, 183, 0.6); }
.mastery-weak { background: var(--danger); box-shadow: 0 0 6px rgba(248, 113, 113, 0.5); }

.section-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.section-status-tag {
  padding: 3px 8px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 500;
}

.tag-unstarted { background: var(--glass-bg); color: var(--text-muted); }
.tag-learning { background: rgba(56, 189, 248, 0.15); color: var(--info); }
.tag-today { background: rgba(251, 191, 36, 0.15); color: var(--warning); animation: glow 1.5s infinite; }
.tag-overdue { background: rgba(248, 113, 113, 0.15); color: var(--danger); }
.tag-stable { background: rgba(52, 211, 153, 0.15); color: var(--success); }
.tag-mastered { background: rgba(52, 211, 153, 0.2); color: var(--success-light); }
.tag-weak { background: rgba(248, 113, 113, 0.2); color: var(--danger-light); }

@keyframes glow {
  0%, 100% { box-shadow: 0 0 3px rgba(251, 191, 36, 0.3); }
  50% { box-shadow: 0 0 8px rgba(251, 191, 36, 0.6); }
}

.section-btn {
  padding: 6px 14px;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
  white-space: nowrap;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;
  user-select: none;
  position: relative;
  overflow: hidden;
}

.section-btn .btn-text {
  pointer-events: none;
  display: inline-block;
}

.section-btn.btn-learn {
  background: linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 100%);
  border: 1px solid rgba(255,255,255,0.2);
  color: var(--primary-light);
  backdrop-filter: blur(10px);
}

.section-btn.btn-review {
  background: linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 100%);
  border: 1px solid rgba(255,255,255,0.2);
  color: var(--chart-orange);
  backdrop-filter: blur(10px);
}

.section-btn.btn-done {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-muted);
  cursor: not-allowed;
  border: 1px solid rgba(255,255,255,0.05);
}

.section-btn:hover:not(.btn-done) {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  background: linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 100%);
}

.section-btn:active:not(.btn-done) {
  transform: scale(0.96);
}

.section-delete-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 14px;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  opacity: 0;
  transition: all 0.2s ease;
  margin-right: 8px;
  flex-shrink: 0;
}

.section-item:hover .section-delete-btn {
  opacity: 0.5;
}

.section-delete-btn:hover {
  background: rgba(248, 113, 113, 0.2);
  color: var(--danger);
  opacity: 1;
  transform: scale(1.1);
}
</style>
