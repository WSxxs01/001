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
  border-bottom: 1px solid #f0f0f0;
  transition: background 0.2s, opacity 0.3s;
}

.section-item:last-child {
  border-bottom: none;
}

.section-item:hover {
  background: #f9f9f9;
}

.section-item.completed-flash {
  animation: completeFlash 0.6s ease;
}

@keyframes completeFlash {
  0% { background: #c8e6c9; }
  50% { background: #a5d6a7; }
  100% { background: transparent; }
}

.section-name {
  font-size: 13px;
  color: #333;
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

.mastery-learning { background: #1976d2; }
.mastery-stable { background: #4caf50; }
.mastery-mastered { background: #2e7d32; box-shadow: 0 0 4px rgba(46, 125, 50, 0.5); }
.mastery-weak { background: #f44336; }

.section-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.section-status-tag {
  padding: 3px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}

.tag-unstarted { background: #f5f5f5; color: #999; }
.tag-learning { background: #e3f2fd; color: #1976d2; }
.tag-today { background: #fff3e0; color: #f57c00; animation: glow 1.5s infinite; }
.tag-overdue { background: #ffebee; color: #d32f2f; }
.tag-stable { background: #c8e6c9; color: #2e7d32; }
.tag-mastered { background: #a5d6a7; color: #1b5e20; }
.tag-weak { background: #ffcdd2; color: #c62828; }

@keyframes glow {
  0%, 100% { box-shadow: 0 0 3px rgba(255, 152, 0, 0.3); }
  50% { box-shadow: 0 0 8px rgba(255, 152, 0, 0.6); }
}

.section-btn {
  padding: 6px 14px;
  border: none;
  border-radius: 15px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s;
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
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.section-btn.btn-review {
  background: linear-gradient(135deg, #ff6b6b, #ff8e53);
  color: white;
}

.section-btn.btn-done {
  background: #e0e0e0;
  color: #999;
  cursor: not-allowed;
}

.section-btn:hover:not(.btn-done) {
  transform: translateY(-1px);
  box-shadow: 0 3px 10px rgba(0,0,0,0.15);
}

.section-delete-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 14px;
  padding: 4px 8px;
  border-radius: 4px;
  opacity: 0;
  transition: all 0.2s;
  margin-right: 8px;
  flex-shrink: 0;
}

.section-item:hover .section-delete-btn {
  opacity: 1;
}

.section-delete-btn:hover {
  background: #ffebee;
  transform: scale(1.1);
}
</style>
