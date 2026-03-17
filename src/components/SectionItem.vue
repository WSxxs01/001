<script setup>
import { computed, ref } from 'vue'
import { useStudyStore } from '../stores/useStudyStore'

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

// 计算知识模块状态
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
      return { text: '开始学习', class: 'btn-primary', action: 'learn' }
    case 'learning':
    case 'today':
    case 'overdue':
      return { text: '复习', class: 'btn-warning', action: 'review' }
    case 'completed':
      return { text: '已完成', class: 'btn-ghost', action: 'done' }
    default:
      return { text: '开始学习', class: 'btn-primary', action: 'learn' }
  }
})

// 点击操作
function handleClick() {
  if (buttonConfig.value.action === 'done') return

  store.submitReview(props.sectionKey, 'normal')
  triggerFlash()
  emit('reviewSubmitted')
}

// 移动端触摸处理
function handleTouchEnd(e) {
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

// 删除知识模块
function handleDelete(e) {
  e.stopPropagation()

  if (confirm('确定要删除这个知识模块及其记忆调度记录吗？不可恢复（除非立即撤销）')) {
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
    <div class="section-main">
      <span class="status-dot" :class="status"></span>
      <span class="section-name">{{ sectionName }}</span>
    </div>

    <div class="section-actions">
      <span class="status-tag" :class="statusTag.class">
        {{ statusTag.text }}
      </span>

      <button
        class="action-btn delete-btn"
        title="删除知识模块"
        aria-label="删除知识模块"
        @click="handleDelete"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M2 4H14M12 4V13C12 13.5523 11.5523 14 11 14H5C4.44772 14 4 13.5523 4 13V4M6 4V3C6 2.44772 6.44772 2 7 2H9C9.55228 2 10 2.44772 10 3V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>

      <button
        class="action-btn"
        :class="buttonConfig.class"
        :disabled="buttonConfig.action === 'done'"
        @click="handleClick"
        @touchend.prevent="handleTouchEnd"
      >
        {{ buttonConfig.text }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.section-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-faint);
  transition: all var(--transition-fast);
  gap: 12px;
}

.section-item:last-child {
  border-bottom: none;
}

.section-item:hover {
  background: var(--bg-hover);
}

.section-item.completed-flash {
  animation: completeFlash 0.6s ease;
}

@keyframes completeFlash {
  0% { background: var(--success-subtle); }
  50% { background: rgba(77, 175, 115, 0.15); }
  100% { background: transparent; }
}

.section-main {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.status-dot.unstarted {
  background: var(--text-muted);
}

.status-dot.learning {
  background: var(--info);
  box-shadow: 0 0 6px rgba(94, 156, 230, 0.5);
}

.status-dot.today {
  background: var(--warning);
  box-shadow: 0 0 6px rgba(226, 179, 64, 0.5);
  animation: pulse 2s ease-in-out infinite;
}

.status-dot.overdue {
  background: var(--danger);
  box-shadow: 0 0 6px rgba(229, 72, 77, 0.5);
}

.status-dot.completed {
  background: var(--success);
  box-shadow: 0 0 6px rgba(77, 175, 115, 0.5);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.section-name {
  font-size: 13px;
  color: var(--text-primary);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.section-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.status-tag {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  white-space: nowrap;
}

.tag-unstarted {
  background: var(--bg-hover);
  color: var(--text-muted);
}

.tag-learning {
  background: var(--info-subtle);
  color: var(--info);
}

.tag-today {
  background: var(--warning-subtle);
  color: var(--warning);
}

.tag-overdue {
  background: var(--danger-subtle);
  color: var(--danger);
}

.tag-stable {
  background: var(--success-subtle);
  color: var(--success);
}

.tag-mastered {
  background: rgba(77, 175, 115, 0.2);
  color: #5EE4A0;
}

.tag-weak {
  background: rgba(229, 72, 77, 0.2);
  color: #FF7A7E;
}

.action-btn {
  padding: 6px 14px;
  border-radius: var(--radius-md);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  border: none;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  white-space: nowrap;
}

.action-btn:disabled {
  cursor: not-allowed;
}

.btn-warning {
  background: var(--warning);
  color: #1a1a1a;
}

.btn-warning:hover:not(:disabled) {
  background: #EEC050;
  box-shadow: 0 0 12px rgba(226, 179, 64, 0.4);
}

.btn-ghost {
  background: transparent;
  color: var(--text-muted);
  border: 1px solid var(--border-default);
}

.delete-btn {
  padding: 6px;
  background: transparent;
  color: var(--text-muted);
  border: none;
  opacity: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.section-item:hover .delete-btn {
  opacity: 0.6;
}

.delete-btn:hover {
  background: var(--danger-subtle);
  color: var(--danger);
  opacity: 1;
}

/* 响应式 */
@media (max-width: 640px) {
  .section-item {
    padding: 10px 12px;
  }

  .status-tag {
    display: none;
  }

  .delete-btn {
    opacity: 0.6;
  }
}

/* 移动端触摸优化 */
@media (pointer: coarse) {
  .section-item:hover {
    background: transparent;
  }

  .delete-btn {
    opacity: 0.6;
  }
}
</style>
