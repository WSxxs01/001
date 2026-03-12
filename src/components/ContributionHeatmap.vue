<script setup>
import { computed } from 'vue'
import { useStudyStore } from '../stores/useStudyStore'
import { getToday } from '../utils/sm2'

const store = useStudyStore()

// 统计数据：每日活动次数
const dailyActivityMap = computed(() => {
  const activityMap = {}

  Object.values(store.studyData).forEach(data => {
    if (!data) return

    // 统计学习日期
    if (data.learned && data.learnDate) {
      activityMap[data.learnDate] = (activityMap[data.learnDate] || 0) + 1
    }

    // 统计复习完成
    if (data.reviews && Array.isArray(data.reviews)) {
      data.reviews.forEach(review => {
        if (review.completed && review.completedDate) {
          activityMap[review.completedDate] = (activityMap[review.completedDate] || 0) + 1
        }
      })
    }
  })

  return activityMap
})

// 获取热力等级
function getLevel(count) {
  if (count === 0) return 0
  if (count <= 3) return 1
  if (count <= 7) return 2
  if (count <= 12) return 3
  return 4
}

// 颜色映射
const colorMap = {
  0: '#ebedf0',
  1: '#c3b3ea',
  2: '#9f81df',
  3: '#764ba2',
  4: '#5a3b8c'
}

// 生成过去180天的日期网格
const weeks = computed(() => {
  const today = new Date()
  const result = []

  // 计算从今天往前180天
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - 179)

  // 调整到周日开始
  const dayOfWeek = startDate.getDay()
  startDate.setDate(startDate.getDate() - dayOfWeek)

  // 生成周
  let currentDate = new Date(startDate)
  const todayDate = new Date(getToday())

  while (currentDate <= todayDate) {
    const week = []
    for (let i = 0; i < 7; i++) {
      const dateStr = formatDate(currentDate)
      const count = dailyActivityMap.value[dateStr] || 0
      const isFuture = currentDate > todayDate

      week.push({
        date: dateStr,
        count,
        level: isFuture ? -1 : getLevel(count),
        isToday: dateStr === getToday()
      })

      currentDate.setDate(currentDate.getDate() + 1)
    }
    result.push(week)
  }

  return result
})

// 格式化日期
function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 获取月份标签
const monthLabels = computed(() => {
  const labels = []
  let lastMonth = -1

  weeks.value.forEach((week, weekIndex) => {
    const firstDay = week[0]
    if (firstDay) {
      const date = new Date(firstDay.date)
      const month = date.getMonth()
      if (month !== lastMonth) {
        labels.push({
          month: date.getMonth() + 1,
          weekIndex,
          label: `${date.getMonth() + 1}月`
        })
        lastMonth = month
      }
    }
  })

  return labels
})

// 星期标签
const dayLabels = ['日', '一', '二', '三', '四', '五', '六']

// 总计统计
const totalStats = computed(() => {
  const counts = Object.values(dailyActivityMap.value)
  const total = counts.reduce((sum, c) => sum + c, 0)
  const activeDays = counts.filter(c => c > 0).length

  return { total, activeDays }
})
</script>

<template>
  <div class="heatmap-card">
    <div class="heatmap-header">
      <h3>🔥 过去 180 天复习足迹</h3>
      <div class="heatmap-stats">
        <span>总计 {{ totalStats.total }} 次</span>
        <span class="separator">|</span>
        <span>活跃 {{ totalStats.activeDays }} 天</span>
      </div>
    </div>

    <div class="heatmap-container">
      <!-- 月份标签 -->
      <div class="month-labels">
        <div
          v-for="item in monthLabels"
          :key="item.weekIndex"
          class="month-label"
          :style="{ gridColumn: item.weekIndex + 1 }"
        >
          {{ item.label }}
        </div>
      </div>

      <div class="heatmap-body">
        <!-- 星期标签 -->
        <div class="day-labels">
          <span v-for="(label, idx) in dayLabels" :key="idx" class="day-label">
            {{ idx % 2 === 1 ? label : '' }}
          </span>
        </div>

        <!-- 热力图网格 -->
        <div class="heatmap-grid">
          <div v-for="(week, weekIdx) in weeks" :key="weekIdx" class="week-column">
            <div
              v-for="(day, dayIdx) in week"
              :key="dayIdx"
              class="day-cell"
              :class="{
                'level-0': day.level === 0,
                'level-1': day.level === 1,
                'level-2': day.level === 2,
                'level-3': day.level === 3,
                'level-4': day.level === 4,
                'is-today': day.isToday,
                'is-future': day.level === -1
              }"
              :title="day.level >= 0 ? `${day.date}: 完成 ${day.count} 个任务` : ''"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 图例 -->
    <div class="heatmap-legend">
      <span class="legend-label">少</span>
      <div class="legend-cells">
        <div class="legend-cell level-0"></div>
        <div class="legend-cell level-1"></div>
        <div class="legend-cell level-2"></div>
        <div class="legend-cell level-3"></div>
        <div class="legend-cell level-4"></div>
      </div>
      <span class="legend-label">多</span>
    </div>
  </div>
</template>

<style scoped>
.heatmap-card {
  background: white;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
}

.heatmap-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  flex-wrap: wrap;
  gap: 10px;
}

.heatmap-header h3 {
  color: #333;
  font-size: 16px;
  margin: 0;
}

.heatmap-stats {
  font-size: 13px;
  color: #666;
}

.heatmap-stats .separator {
  margin: 0 8px;
  color: #ddd;
}

.heatmap-container {
  overflow-x: auto;
  padding-bottom: 10px;
}

.month-labels {
  display: flex;
  height: 20px;
  margin-left: 32px;
  margin-bottom: 5px;
}

.month-label {
  font-size: 11px;
  color: #666;
}

.heatmap-body {
  display: flex;
}

.day-labels {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-right: 5px;
}

.day-label {
  height: 12px;
  font-size: 10px;
  color: #999;
  line-height: 12px;
  width: 24px;
  text-align: right;
}

.heatmap-grid {
  display: flex;
  gap: 3px;
}

.week-column {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.day-cell {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  background: #ebedf0;
  transition: transform 0.1s;
}

.day-cell:hover {
  transform: scale(1.3);
  outline: 2px solid #667eea;
}

.day-cell.level-0 { background: #ebedf0; }
.day-cell.level-1 { background: #c3b3ea; }
.day-cell.level-2 { background: #9f81df; }
.day-cell.level-3 { background: #764ba2; }
.day-cell.level-4 { background: #5a3b8c; }

.day-cell.is-today {
  outline: 2px solid #667eea;
  outline-offset: 1px;
}

.day-cell.is-future {
  background: transparent;
  border: 1px dashed #eee;
}

.heatmap-legend {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 15px;
}

.legend-label {
  font-size: 11px;
  color: #999;
}

.legend-cells {
  display: flex;
  gap: 3px;
}

.legend-cell {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.legend-cell.level-0 { background: #ebedf0; }
.legend-cell.level-1 { background: #c3b3ea; }
.legend-cell.level-2 { background: #9f81df; }
.legend-cell.level-3 { background: #764ba2; }
.legend-cell.level-4 { background: #5a3b8c; }

@media (max-width: 768px) {
  .heatmap-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .day-cell, .legend-cell {
    width: 10px;
    height: 10px;
  }
}
</style>
