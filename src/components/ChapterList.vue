<script setup>
import { ref } from 'vue'
import { useStudyStore } from '../stores/useStudyStore'
import { getSectionStatus, getToday } from '../utils/sm2'
import SectionItem from './SectionItem.vue'

const store = useStudyStore()

const emit = defineEmits(['reviewSubmitted'])

function onReviewSubmitted() {
  emit('reviewSubmitted')
}

// 展开的章节索引
const expandedChapters = ref([])

// 触摸移动检测变量
let touchStartY = 0
let hasMoved = false

// 切换章节展开/收起
function toggleChapter(index) {
  if (hasMoved) return

  const idx = expandedChapters.value.indexOf(index)
  if (idx === -1) {
    expandedChapters.value.push(index)
  } else {
    expandedChapters.value.splice(idx, 1)
  }
}

// 触摸开始
function handleTouchStart(e) {
  touchStartY = e.touches[0].clientY
  hasMoved = false
}

// 触摸移动
function handleTouchMove(e) {
  const touchY = e.touches[0].clientY
  if (Math.abs(touchY - touchStartY) > 10) {
    hasMoved = true
  }
}

// 计算章节进度
function getChapterProgress(chapter, chapterIndex) {
  if (!store.currentBookId) return { learned: 0, total: 0, percent: 0, status: '' }

  const total = chapter.sections.length
  if (total === 0) return { learned: 0, total: 0, percent: 0, status: '' }

  let learned = 0
  let hasToday = false
  let hasOverdue = false

  chapter.sections.forEach((_, sectionIdx) => {
    const key = `${store.currentBookId}_${chapterIndex}_${sectionIdx}`
    const data = store.getSectionData(key)
    const status = getSectionStatus(data, getToday())

    if (status !== 'unstarted') learned++
    if (status === 'today') hasToday = true
    if (status === 'overdue') hasOverdue = true
  })

  const percent = Math.round((learned / total) * 100)

  let status = ''
  if (hasOverdue) status = 'overdue'
  else if (hasToday) status = 'today-review'
  else if (learned === total) status = 'learned'

  return { learned, total, percent, status }
}

// 删除章节
function deleteChapter(chapterIndex) {
  const chapter = store.currentBookChapters[chapterIndex]
  if (confirm(`确定要删除章节「${chapter.name}」吗？该章节下的所有小节学习记录将被清除。`)) {
    store.deleteChapter(chapterIndex)
  }
}

// 获取状态徽章
function getStatusBadge(status) {
  const badges = {
    'overdue': { text: '逾期', class: 'badge-danger' },
    'today-review': { text: '待复习', class: 'badge-warning' },
    'learned': { text: '已完成', class: 'badge-success' }
  }
  return badges[status] || null
}
</script>

<template>
  <div class="chapter-list">
    <div
      v-for="(chapter, chapterIndex) in store.currentBookChapters"
      :key="chapterIndex"
      class="chapter-accordion"
      :class="[
        getChapterProgress(chapter, chapterIndex).status,
        { expanded: expandedChapters.includes(chapterIndex) }
      ]"
    >
      <div
        class="chapter-header"
        @click="toggleChapter(chapterIndex)"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
      >
        <div class="chapter-header-left">
          <div class="chapter-expand-icon">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M4 2L8 6L4 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <span class="chapter-name">{{ chapter.name }}</span>
          <span
            v-if="getStatusBadge(getChapterProgress(chapter, chapterIndex).status)"
            class="status-badge"
            :class="getStatusBadge(getChapterProgress(chapter, chapterIndex).status).class"
          >
            {{ getStatusBadge(getChapterProgress(chapter, chapterIndex).status).text }}
          </span>
        </div>

        <div class="chapter-progress-mini">
          <div class="chapter-progress-bar">
            <div
              class="chapter-progress-fill"
              :class="getChapterProgress(chapter, chapterIndex).status"
              :style="{ width: getChapterProgress(chapter, chapterIndex).percent + '%' }"
            ></div>
          </div>
          <span class="chapter-progress-text">
            {{ getChapterProgress(chapter, chapterIndex).learned }}/{{ getChapterProgress(chapter, chapterIndex).total }}
          </span>
        </div>

        <button
          class="chapter-delete-btn"
          @click.stop="deleteChapter(chapterIndex)"
          title="删除章节"
          aria-label="删除章节"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 4H14M12 4V13C12 13.5523 11.5523 14 11 14H5C4.44772 14 4 13.5523 4 13V4M6 4V3C6 2.44772 6.44772 2 7 2H9C9.55228 2 10 2.44772 10 3V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>

      <div class="section-list">
        <SectionItem
          v-for="(sectionName, sectionIndex) in chapter.sections"
          :key="`${chapterIndex}-${sectionIndex}`"
          :section-key="`${store.currentBookId}_${chapterIndex}_${sectionIndex}`"
          :section-name="sectionName"
          @reviewSubmitted="onReviewSubmitted"
        />
      </div>
    </div>

    <div v-if="store.currentBookChapters.length === 0" class="empty-state">
      <div class="empty-icon">📚</div>
      <p>暂无章节，请添加书籍或章节</p>
    </div>
  </div>
</template>

<style scoped>
.chapter-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 章节容器 - Linear 玻璃风格 */
.chapter-accordion {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: all var(--transition-normal);
}

.chapter-accordion:hover {
  border-color: var(--border-hover);
  box-shadow: var(--shadow-md);
}

.chapter-accordion.expanded {
  border-color: var(--border-hover);
}

/* 状态样式 */
.chapter-accordion.learned {
  border-color: var(--success);
  box-shadow: 0 0 0 1px var(--success);
}

.chapter-accordion.today-review {
  border-color: var(--warning);
  box-shadow: 0 0 0 1px var(--warning);
}

.chapter-accordion.overdue {
  border-color: var(--danger);
  box-shadow: 0 0 0 1px var(--danger);
}

.chapter-header {
  padding: 14px 16px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  user-select: none;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  transition: background var(--transition-fast);
}

.chapter-header:hover {
  background: var(--bg-hover);
}

.chapter-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.chapter-expand-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  transition: transform var(--transition-normal);
  flex-shrink: 0;
}

.chapter-accordion.expanded .chapter-expand-icon {
  transform: rotate(90deg);
}

.chapter-name {
  font-weight: 500;
  color: var(--text-primary);
  font-size: 14px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 状态徽章 */
.status-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.badge-danger {
  background: var(--danger-subtle);
  color: var(--danger);
  border: 1px solid rgba(229, 72, 77, 0.3);
}

.badge-warning {
  background: var(--warning-subtle);
  color: var(--warning);
  border: 1px solid rgba(226, 179, 64, 0.3);
}

.badge-success {
  background: var(--success-subtle);
  color: var(--success);
  border: 1px solid rgba(77, 175, 115, 0.3);
}

/* 进度条 */
.chapter-progress-mini {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.chapter-progress-bar {
  width: 60px;
  height: 4px;
  background: var(--bg-elevated);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.chapter-progress-fill {
  height: 100%;
  background: var(--primary);
  border-radius: var(--radius-full);
  transition: width var(--transition-normal);
}

.chapter-progress-fill.learned {
  background: var(--success);
}

.chapter-progress-fill.today-review {
  background: var(--warning);
}

.chapter-progress-fill.overdue {
  background: var(--danger);
}

.chapter-progress-text {
  font-size: 12px;
  color: var(--text-muted);
  min-width: 40px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

/* 删除按钮 */
.chapter-delete-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: var(--radius-md);
  opacity: 0;
  margin-left: 8px;
  transition: all var(--transition-fast);
}

.chapter-header:hover .chapter-delete-btn {
  opacity: 0.6;
}

.chapter-delete-btn:hover {
  background: var(--danger-subtle);
  color: var(--danger);
  opacity: 1;
}

/* 小节列表 */
.section-list {
  display: none;
  border-top: 1px solid var(--border-faint);
  background: var(--bg-elevated);
}

.chapter-accordion.expanded .section-list {
  display: block;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 48px 24px;
  color: var(--text-muted);
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.empty-state p {
  font-size: 14px;
}

/* 响应式 */
@media (max-width: 768px) {
  .chapter-header {
    padding: 12px 14px;
  }

  .chapter-name {
    font-size: 13px;
  }

  .chapter-progress-bar {
    width: 50px;
  }

  .chapter-progress-text {
    font-size: 11px;
  }

  .status-badge {
    display: none;
  }
}

/* 移动端触摸优化 */
@media (pointer: coarse) {
  .chapter-header:hover {
    background: transparent;
  }

  .chapter-delete-btn {
    opacity: 0.6;
  }
}
</style>
