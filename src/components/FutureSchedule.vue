<script setup>
import { computed } from 'vue'
import { useStudyStore } from '../stores/useStudyStore'

const store = useStudyStore()

// 使用 store 中的 futureSchedule getter
const scheduleGroups = computed(() => store.futureSchedule)

// 判断是否有未来任务
const hasFutureTasks = computed(() => scheduleGroups.value.length > 0)

// 获取标签的颜色类
function getLabelClass(label) {
  if (label === '明天') return 'tomorrow'
  if (label === '后天') return 'day-after'
  return 'future'
}

// 获取书籍名称的简称（用于标签显示）
function getBookShortName(name) {
  // 取前两个字符或根据常见缩写规则
  if (name.length <= 4) return name
  const shortMap = {
    '计算机组成原理': '计组',
    '数据结构': ' DS ',
    '操作系统': ' OS ',
    '计算机网络': '计网',
    '数据库': 'DB'
  }
  return shortMap[name] || name.slice(0, 2)
}
</script>

<template>
  <div class="future-schedule glass-panel">
    <header class="schedule-header">
      <h3>
        <span class="header-icon">🎯</span>
        <span>未来预测时间轴</span>
      </h3>
      <span class="task-count" v-if="hasFutureTasks">
        {{ scheduleGroups.reduce((sum, g) => sum + g.items.length, 0) }} 个待复习
      </span>
    </header>

    <!-- 时间轴主体 -->
    <div class="timeline-container" v-if="hasFutureTasks">
      <div class="timeline">
        <div
          v-for="(group, index) in scheduleGroups"
          :key="group.fullDate"
          class="timeline-node"
          :class="{ 'first-node': index === 0, 'last-node': index === scheduleGroups.length - 1 }"
        >
          <!-- 时间节点指示器 -->
          <div class="node-marker">
            <div class="marker-glow"></div>
            <div class="marker-dot" :class="getLabelClass(group.label)"></div>
          </div>

          <!-- 节点内容 -->
          <div class="node-content">
            <!-- 日期标签 -->
            <div class="date-header">
              <span class="date-label" :class="getLabelClass(group.label)">
                {{ group.label }}
              </span>
              <span class="date-str">{{ group.dateStr }}</span>
              <span class="item-count">{{ group.items.length }} 项</span>
            </div>

            <!-- 任务卡片列表 -->
            <div class="task-cards">
              <div
                v-for="item in group.items"
                :key="item.key"
                class="task-card"
                :title="`${item.bookName} - ${item.chapterName} - ${item.sectionName}`"
              >
                <div class="card-main">
                  <span class="book-tag">[{{ getBookShortName(item.bookName) }}]</span>
                  <span class="section-name">{{ item.sectionName }}</span>
                </div>
                <div class="card-meta">
                  <span class="chapter-name">{{ item.chapterName }}</span>
                  <span class="time-badge">
                    <span class="time-icon">🕐</span>
                    {{ item.time }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <div class="empty-icon">✨</div>
      <div class="empty-title">处于记忆稳固期</div>
      <div class="empty-desc">未来几天暂无复习任务，好好休息吧</div>
    </div>
  </div>
</template>

<style scoped>
/* ============================================
   未来预测时间轴 - Linear 暗黑极光风格
   ============================================ */

.future-schedule {
  padding: 24px;
  margin-bottom: 24px;
}

/* 头部样式 */
.schedule-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-faint);
}

.schedule-header h3 {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 500;
  letter-spacing: -0.01em;
}

.header-icon {
  font-size: 18px;
  filter: drop-shadow(0 0 8px rgba(94, 106, 210, 0.4));
}

.task-count {
  font-size: 12px;
  color: var(--text-muted);
  background: var(--glass-bg);
  padding: 4px 12px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-faint);
}

/* 时间轴容器 */
.timeline-container {
  position: relative;
  overflow-x: hidden;
}

.timeline {
  position: relative;
  padding-left: 32px;
}

/* 极光渐变垂直轴线 */
.timeline::before {
  content: '';
  position: absolute;
  left: 8px;
  top: 12px;
  bottom: 12px;
  width: 2px;
  background: linear-gradient(
    180deg,
    rgba(94, 106, 210, 0.8) 0%,
    rgba(139, 92, 246, 0.6) 25%,
    rgba(94, 156, 230, 0.6) 50%,
    rgba(77, 175, 115, 0.5) 75%,
    rgba(94, 106, 210, 0.4) 100%
  );
  border-radius: var(--radius-full);
  box-shadow:
    0 0 6px rgba(94, 106, 210, 0.4),
    0 0 12px rgba(139, 92, 246, 0.2),
    0 0 20px rgba(94, 156, 230, 0.15);
}

/* 时间节点 */
.timeline-node {
  position: relative;
  padding-bottom: 28px;
  display: flex;
  gap: 20px;
}

.timeline-node.last-node {
  padding-bottom: 0;
}

/* 节点指示器 */
.node-marker {
  position: absolute;
  left: -32px;
  top: 4px;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.marker-glow {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(94, 106, 210, 0.4) 0%, transparent 70%);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 0.6;
  }
  50% {
    transform: scale(1.5);
    opacity: 0.3;
  }
}

.marker-dot {
  position: relative;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--primary);
  border: 2px solid var(--bg-elevated);
  box-shadow: 0 0 8px rgba(94, 106, 210, 0.6);
  transition: all var(--transition-fast);
}

.marker-dot.tomorrow {
  background: #f472b6;
  box-shadow: 0 0 10px rgba(244, 114, 182, 0.6), 0 0 20px rgba(244, 114, 182, 0.3);
}

.marker-dot.day-after {
  background: #fb923c;
  box-shadow: 0 0 10px rgba(251, 146, 60, 0.6), 0 0 20px rgba(251, 146, 60, 0.3);
}

.marker-dot.future {
  background: #22d3ee;
  box-shadow: 0 0 10px rgba(34, 211, 238, 0.6), 0 0 20px rgba(34, 211, 238, 0.3);
}

.timeline-node:hover .marker-dot {
  transform: scale(1.2);
}

/* 节点内容 */
.node-content {
  flex: 1;
  min-width: 0;
}

/* 日期头部 */
.date-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.date-label {
  font-size: 14px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: var(--radius-md);
  background: var(--glass-bg);
  border: 1px solid var(--border-faint);
  transition: all var(--transition-fast);
}

.date-label.tomorrow {
  color: #f472b6;
  background: rgba(244, 114, 182, 0.1);
  border-color: rgba(244, 114, 182, 0.3);
}

.date-label.day-after {
  color: #fb923c;
  background: rgba(251, 146, 60, 0.1);
  border-color: rgba(251, 146, 60, 0.3);
}

.date-label.future {
  color: #22d3ee;
  background: rgba(34, 211, 238, 0.1);
  border-color: rgba(34, 211, 238, 0.3);
}

.date-str {
  font-size: 13px;
  color: var(--text-muted);
  font-family: 'SF Mono', Monaco, monospace;
}

.item-count {
  font-size: 11px;
  color: var(--text-muted);
  margin-left: auto;
  background: var(--bg-hover);
  padding: 2px 8px;
  border-radius: var(--radius-full);
}

/* 任务卡片列表 */
.task-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-card {
  background: var(--glass-bg);
  border: 1px solid var(--border-faint);
  border-radius: var(--radius-lg);
  padding: 12px 16px;
  transition: all var(--transition-fast);
  cursor: pointer;
}

.task-card:hover {
  background: var(--glass-bg-hover);
  border-color: var(--border-hover);
  transform: translateX(4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.card-main {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.book-tag {
  font-size: 11px;
  font-weight: 600;
  color: var(--primary);
  background: rgba(94, 106, 210, 0.15);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  white-space: nowrap;
  font-family: 'SF Mono', Monaco, monospace;
}

.section-name {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.chapter-name {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.time-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-secondary);
  background: var(--bg-hover);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  white-space: nowrap;
}

.time-icon {
  font-size: 10px;
  opacity: 0.7;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 48px 24px;
  color: var(--text-muted);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.6;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

.empty-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.empty-desc {
  font-size: 13px;
  color: var(--text-muted);
}

/* ============================================
   响应式设计
   ============================================ */

@media (max-width: 768px) {
  .future-schedule {
    padding: 16px;
  }

  .schedule-header {
    margin-bottom: 20px;
    padding-bottom: 12px;
  }

  .schedule-header h3 {
    font-size: 14px;
  }

  .timeline {
    padding-left: 24px;
  }

  .timeline::before {
    left: 6px;
  }

  .node-marker {
    left: -24px;
    width: 16px;
    height: 16px;
  }

  .marker-dot {
    width: 8px;
    height: 8px;
  }

  .timeline-node {
    gap: 12px;
    padding-bottom: 20px;
  }

  .date-header {
    gap: 8px;
    margin-bottom: 10px;
  }

  .date-label {
    font-size: 12px;
    padding: 3px 10px;
  }

  .date-str {
    font-size: 12px;
  }

  .task-card {
    padding: 10px 12px;
  }

  .card-main {
    margin-bottom: 4px;
  }

  .section-name {
    font-size: 12px;
  }

  .book-tag {
    font-size: 10px;
  }

  .chapter-name {
    font-size: 10px;
    max-width: 120px;
  }
}

@media (max-width: 480px) {
  .timeline {
    padding-left: 20px;
  }

  .timeline::before {
    left: 5px;
    width: 1.5px;
  }

  .node-marker {
    left: -20px;
    width: 14px;
    height: 14px;
  }

  .marker-dot {
    width: 7px;
    height: 7px;
    border-width: 1.5px;
  }

  .timeline-node {
    gap: 10px;
  }

  .card-meta {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .chapter-name {
    max-width: 100%;
  }

  .time-badge {
    align-self: flex-end;
  }
}
</style>
