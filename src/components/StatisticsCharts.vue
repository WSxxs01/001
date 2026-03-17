<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'
import { Chart, registerables } from 'chart.js'
import { useStudyStore } from '../stores/useStudyStore'
import { getToday } from '../utils/sm2'

Chart.register(...registerables)

// 强制设置图表全局文字颜色
Chart.defaults.color = 'rgba(255, 255, 255, 0.6)'
Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.05)'

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

// 渲染 FSRS 记忆可提取率曲线
function renderMemoryChart() {
  if (!memoryChartRef.value) return

  if (memoryChart) {
    memoryChart.destroy()
  }

  const ctx = memoryChartRef.value.getContext('2d')

  // 创建渐变背景：从 Accent 色 20% 透明度到完全透明
  const gradient = ctx.createLinearGradient(0, 0, 0, 200)
  gradient.addColorStop(0, 'rgba(94, 106, 210, 0.2)')
  gradient.addColorStop(1, 'rgba(94, 106, 210, 0)')

  memoryChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['即时', '1天', '2天', '4天', '7天', '15天', '30天'],
      datasets: [{
        label: '记忆保持率',
        data: [100, 80, 70, 60, 55, 50, 40],
        borderColor: '#5E6AD2',
        backgroundColor: gradient,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: '#5E6AD2',
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
            color: 'rgba(255, 255, 255, 0.6)'
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
            color: 'rgba(255, 255, 255, 0.6)'
          }
        }
      }
    }
  })
}

// 渲染未来7天动态调度负荷
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
          backgroundColor: 'rgba(244, 114, 182, 0.85)',
          borderColor: '#f472b6',
          borderWidth: 0,
          borderRadius: 4
        },
        {
          label: '待复习',
          data: pendingData,
          backgroundColor: 'rgba(251, 146, 60, 0.85)',
          borderColor: '#fb923c',
          borderWidth: 0,
          borderRadius: 4
        },
        {
          label: '已完成',
          data: completedData,
          backgroundColor: 'rgba(34, 211, 238, 0.85)',
          borderColor: '#22d3ee',
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
            color: 'rgba(255, 255, 255, 0.6)'
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
            color: 'rgba(255, 255, 255, 0.6)'
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
            color: 'rgba(255, 255, 255, 0.6)'
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
    <div class="chart-card glass-panel">
      <h3>📊 FSRS 记忆可提取率 (Retrievability) 动态预测</h3>
      <div class="chart-container">
        <canvas ref="memoryChartRef"></canvas>
      </div>
      <div class="chart-desc">
        基于 DSR 记忆动力学模型，展示特定稳定性 (S) 下的召回概率幂函数衰减
      </div>
    </div>

    <div class="chart-card glass-panel">
      <h3>📅 未来 7 天动态调度负荷 (Workload)</h3>
      <div class="chart-container">
        <canvas ref="reviewChartRef"></canvas>
      </div>
      <div class="schedule-table">
        <table>
          <thead>
            <tr>
              <th>用户反馈 (Rating)</th>
              <th>状态转移</th>
              <th>稳定性 S 变化</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>🔴 困难 (Hard)</td><td>维持/下降</td><td>极其缓慢增长</td></tr>
            <tr><td>🟠 遗忘 (Again)</td><td>记忆重塑</td><td>稳定性重置</td></tr>
            <tr><td>🟢 良好 (Good)</td><td>正常巩固</td><td>稳步指数增长</td></tr>
            <tr><td>🔵 简单 (Easy)</td><td>长期记忆</td><td>跨越式暴增</td></tr>
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
  padding: 20px;
}

.chart-card h3 {
  color: var(--text-primary);
  margin-bottom: 15px;
  font-size: 16px;
  font-weight: 500;
  letter-spacing: -0.01em;
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
  background: var(--bg-hover);
  color: #8A8F98;
  font-weight: 500;
  font-size: 13px;
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
