<script setup>
import { ref, computed, watch } from 'vue'
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
  // 如果触摸过程中有显著移动，则不触发展开/收起
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

// 触摸移动 - 检测是否在滚动
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
      <div class="chapter-header" @click="toggleChapter(chapterIndex)" @touchstart="handleTouchStart" @touchmove="handleTouchMove">
        <div class="chapter-header-left">
          <div class="chapter-expand-icon">▶</div>
          <span class="chapter-name">{{ chapter.name }}</span>
          <span v-if="getChapterProgress(chapter, chapterIndex).status === 'overdue'" class="chapter-alert-badge">
            逾期
          </span>
          <span v-else-if="getChapterProgress(chapter, chapterIndex).status === 'today-review'" class="chapter-alert-badge" style="background:#ff9800">
            待复习
          </span>
        </div>
        <div class="chapter-progress-mini">
          <div class="chapter-progress-bar">
            <div
              class="chapter-progress-fill"
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
        >
          🗑️
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
      <p>暂无章节，请添加书籍或章节</p>
    </div>
  </div>
</template>

<style scoped>
.chapter-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chapter-accordion {
  background: #fafafa;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s;
}

.chapter-accordion:hover {
  border-color: #667eea;
  box-shadow: 0 4px 15px rgba(102,126,234,0.1);
}

.chapter-accordion.learned {
  background: linear-gradient(135deg, #e8f5e9, #f1f8f1);
  border-color: #81c784;
}

.chapter-accordion.today-review {
  background: linear-gradient(135deg, #fff3e0, #fff8e8);
  border-color: #ffb74d;
}

.chapter-accordion.overdue {
  background: linear-gradient(135deg, #ffebee, #fff5f5);
  border-color: #ef5350;
}

.chapter-header {
  padding: 15px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  user-select: none;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.chapter-header:hover {
  background: rgba(102,126,234,0.05);
}

.chapter-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.chapter-expand-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e0e0e0;
  border-radius: 6px;
  transition: transform 0.3s;
  font-size: 12px;
  color: #666;
  flex-shrink: 0;
}

.chapter-accordion.expanded .chapter-expand-icon {
  transform: rotate(90deg);
}

.chapter-name {
  font-weight: 600;
  color: #333;
  font-size: 14px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chapter-alert-badge {
  background: #f44336;
  color: white;
  font-size: 10px;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 10px;
  animation: pulse-dot 1.5s infinite;
  flex-shrink: 0;
}

@keyframes pulse-dot {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.2); opacity: 0.8; }
}

.chapter-progress-mini {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.chapter-progress-bar {
  width: 80px;
  height: 6px;
  background: #e0e0e0;
  border-radius: 3px;
  overflow: hidden;
}

.chapter-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea, #764ba2);
  border-radius: 3px;
  transition: width 0.3s;
}

.chapter-progress-text {
  font-size: 12px;
  color: #666;
  min-width: 50px;
  text-align: right;
}

.chapter-delete-btn {
  background: transparent;
  border: none;
  color: #bbb;
  cursor: pointer;
  padding: 4px 8px;
  font-size: 16px;
  border-radius: 4px;
  transition: all 0.2s;
  opacity: 0;
  margin-left: 10px;
}

.chapter-header:hover .chapter-delete-btn {
  opacity: 1;
}

.chapter-delete-btn:hover {
  color: #f44336;
  background: #ffebee;
}

.section-list {
  display: none;
  border-top: 1px solid #e0e0e0;
  background: white;
}

.chapter-accordion.expanded .section-list {
  display: block;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #999;
  background: #fafafa;
  border-radius: 12px;
}

@media (max-width: 768px) {
  .chapter-header {
    padding: 12px 10px;
  }

  .chapter-expand-icon {
    width: 20px;
    height: 20px;
    font-size: 10px;
  }

  .chapter-name {
    font-size: 13px;
  }

  .chapter-progress-bar {
    width: 50px;
  }

  .chapter-progress-text {
    font-size: 11px;
    min-width: 40px;
  }
}
</style>
