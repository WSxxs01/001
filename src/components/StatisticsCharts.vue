<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'
import { Chart, registerables } from 'chart.js'
import { useStudyStore } from '../stores/useStudyStore'
import { getToday } from '../utils/sm2'

Chart.register(...registerables)

const store = useStudyStore()

const memoryChartRef = ref(null)
const reviewChartRef = ref(null)
let memoryChart = null
let reviewChart = null

// 计算未来7天复习统计（支持 FSRS 算法）
function getReviewStatsForNext7Days() {
  const today = getToday()
  const stats = []

  for (let i = 0; i < 7; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() + i)
    const dateStr = formatDate(date)

    let completed = 0
    let todayReview = 0
    let overdue = 0
    let pending = 0

    Object.values(store.studyData).forEach(data => {
      if (!data || !data.learned) return

      // FSRS 算法：使用 due 字段判断复习日期
      if (data.fsrsCard && data.due) {
        const dueDate = data.due

        if (dueDate < today) {
          // 已逾期
          if (i === 0) overdue++
        } else if (dueDate === today) {
          // 今天是复习日
          if (i === 0) todayReview++
        } else if (dueDate === dateStr) {
          // 未来的某天是复习日
          if (i === 0) {
            todayReview++
          } else {
            pending++
          }
        }
      } else if (data.reviews) {
        // 兼容旧数据：SM-2 算法
        const hasReviewOnDay = data.reviews.some(r => r.scheduledDate === dateStr)
        const hasOverdue = data.reviews.some(r => !r.completed && r.scheduledDate < today)
        const allCompleted = data.reviews.every(r => r.completed)

        if (allCompleted) {
          completed++
        } else if (i === 0 && hasReviewOnDay) {
          todayReview++
        } else if (i === 0 && hasOverdue) {
          overdue++
        } else if (hasReviewOnDay) {
          pending++
        }
      }
    })

    stats.push({ date: dateStr, completed, todayReview, overdue, pending, label: `第${i + 1}天` })
  }

  return stats
}

function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getShortDate(dateStr) {
  const date = new Date(dateStr)
  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${month}/${day}`
}

// 渲染遗忘曲线图
function renderMemoryChart() {
  if (!memoryChartRef.value) return

  if (memoryChart) {
    memoryChart.destroy()
  }

  const ctx = memoryChartRef.value.getContext('2d')
  memoryChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['即时', '1天', '2天', '4天', '7天', '15天', '30天'],
      datasets: [{
        label: '记忆保持率',
        data: [100, 80, 70, 60, 55, 50, 40],
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.15)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#8b5cf6',
        pointBorderColor: 'rgba(255,255,255,0.8)',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.7)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)'
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.5)'
          }
        },
        y: {
          beginAtZero: true,
          max: 100,
          grid: {
            color: 'rgba(255, 255, 255, 0.05)'
          },
          ticks: {
            callback: value => value + '%',
            color: 'rgba(255, 255, 255, 0.5)'
          }
        }
      }
    }
  })
}

// 渲染未来7天复习预览
function renderReviewChart() {
  if (!reviewChartRef.value) return

  if (reviewChart) {
    reviewChart.destroy()
  }

  const stats = getReviewStatsForNext7Days()
  const labels = stats.map(s => getShortDate(s.date))
  const todayData = stats.map(s => s.todayReview + s.overdue)
  const pendingData = stats.map(s => s.pending)
  const completedData = stats.map(s => s.completed)

  const ctx = reviewChartRef.value.getContext('2d')
  reviewChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: '今日/逾期',
          data: todayData,
          backgroundColor: 'rgba(248, 113, 113, 0.8)',
          borderColor: '#f87171',
          borderWidth: 0,
          borderRadius: 4
        },
        {
          label: '待复习',
          data: pendingData,
          backgroundColor: 'rgba(251, 191, 36, 0.8)',
          borderColor: '#fbbf24',
          borderWidth: 0,
          borderRadius: 4
        },
        {
          label: '已完成',
          data: completedData,
          backgroundColor: 'rgba(52, 211, 153, 0.8)',
          borderColor: '#34d399',
          borderWidth: 0,
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 20,
            color: 'rgba(255, 255, 255, 0.7)'
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.7)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          stacked: true,
          grid: {
            display: false
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.5)'
          }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          grid: {
            color: 'rgba(255, 255, 255, 0.05)'
          },
          ticks: {
            stepSize: 1,
            color: 'rgba(255, 255, 255, 0.5)'
          }
        }
      }
    }
  })
}

// 初始化图表
function initCharts() {
  nextTick(() => {
    renderMemoryChart()
    renderReviewChart()
  })
}

// 监听数据变化重新渲染
watch(
  () => store.studyData,
  () => {
    renderReviewChart()
  },
  { deep: true }
)

onMounted(async () => {
  // 等待 store 初始化完成后再渲染图表
  await store.initStore()
  initCharts()
})
</script>

<template>
  <div class="charts-section">
    <div class="chart-card">
      <h3>📊 艾宾浩斯遗忘曲线</h3>
      <div class="chart-container">
        <canvas ref="memoryChartRef"></canvas>
      </div>
      <div class="chart-desc">
        记忆保持率随时间推移逐渐下降，需要定期复习来巩固
      </div>
    </div>

    <div class="chart-card">
      <h3>📅 未来7天复习预览</h3>
      <div class="chart-container">
        <canvas ref="reviewChartRef"></canvas>
      </div>
      <div class="schedule-table">
        <table>
          <thead>
            <tr>
              <th>复习次数</th>
              <th>间隔</th>
              <th>记忆保持率</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>第1次</td><td>1天后</td><td>约80%</td></tr>
            <tr><td>第2次</td><td>2天后</td><td>约70%</td></tr>
            <tr><td>第3次</td><td>4天后</td><td>约60%</td></tr>
            <tr><td>第4次</td><td>7天后</td><td>约55%</td></tr>
            <tr><td>第5次</td><td>15天后</td><td>约50%</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.charts-section {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin-bottom: 20px;
}

.chart-card {
  /* 应用 .glass-panel 样式 */
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  border-left: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: var(--radius-xl);
  padding: 20px;
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3), inset 0 0 0 1px rgba(255, 255, 255, 0.02);
}

.chart-card:hover {
  background: rgba(255, 255, 255, 0.06);
}

.chart-card h3 {
  color: var(--text-primary);
  margin-bottom: 15px;
  font-size: 16px;
  font-weight: 500;
}

.chart-container {
  height: 200px;
  margin-bottom: 15px;
}

.chart-desc {
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
  padding: 10px;
  background: var(--glass-bg);
  border-radius: var(--radius-sm);
}

.schedule-table {
  margin-top: 15px;
}

.schedule-table table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.schedule-table th,
.schedule-table td {
  padding: 8px;
  text-align: center;
  border-bottom: 1px solid var(--card-border);
}

.schedule-table th {
  background: var(--glass-bg);
  color: var(--text-secondary);
  font-weight: 600;
}

.schedule-table tr:hover {
  background: var(--glass-bg-hover);
}

@media (max-width: 768px) {
  .charts-section {
    grid-template-columns: 1fr;
  }

  .chart-container {
    height: 180px;
  }
}
</style>
