/**
 * SM-2 艾宾浩斯记忆算法
 * 基于 SuperMemo-2 算法的简化实现
 */

// 艾宾浩斯基础复习间隔（天）
export const REVIEW_INTERVALS = [1, 2, 4, 7, 15]

// SM-2 配置
export const SM2_CONFIG = {
  minStability: 0.5,      // 最小稳定性因子
  maxStability: 3.0,       // 最大稳定性因子
  defaultStability: 1.0,   // 默认稳定性
  easyFactor: 2.0,         // "太简单" 时间乘数
  hardFactor: 0.5,         // "太难" 时间乘数
  resetLevel: 0,           // "太难" 重置到的级别
  dailyLimit: 20           // 每日复习上限预警阈值
}

// 反馈类型
export const FEEDBACK = {
  EASY: 'easy',      // 太简单
  NORMAL: 'normal',  // 掌握一般
  HARD: 'hard'       // 太难/没记住
}

/**
 * 计算初始复习计划
 * @param {string} learnDate - 学习日期 (YYYY-MM-DD)
 * @returns {Array} 复习计划数组
 */
export function calculateInitialReviews(learnDate) {
  return REVIEW_INTERVALS.map((interval, index) => ({
    level: index,
    baseInterval: interval,
    scheduledDate: addDays(learnDate, interval),
    completed: false,
    completedDate: null,
    actualInterval: interval
  }))
}

/**
 * 添加天数到日期
 * @param {string} dateStr - 日期字符串 YYYY-MM-DD
 * @param {number} days - 要添加的天数
 * @returns {string} 新日期字符串
 */
function addDays(dateStr, days) {
  const date = new Date(dateStr)
  date.setDate(date.getDate() + days)
  return formatDate(date)
}

/**
 * 格式化日期为 YYYY-MM-DD
 * @param {Date} date
 * @returns {string}
 */
export function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 获取今天的日期字符串
 * @returns {string}
 */
export function getToday() {
  return formatDate(new Date())
}

/**
 * 计算下一次复习日期
 * @param {Object} currentData - 当前小节学习数据
 * @param {string} feedback - 反馈类型 ('easy', 'normal', 'hard')
 * @returns {Object} 更新后的学习数据
 */
export function calculateNextReviewDate(currentData, feedback) {
  const today = getToday()
  let { stability, difficultyLevel, reviews, masteryLevel } = currentData

  // 找到下一个未完成的复习
  const nextReviewIndex = reviews.findIndex(r => !r.completed)

  if (nextReviewIndex === -1) {
    // 所有复习已完成，保持原数据
    return currentData
  }

  // 更新当前复习项
  reviews[nextReviewIndex].completed = true
  reviews[nextReviewIndex].completedDate = today

  // 根据反馈调整
  switch (feedback) {
    case FEEDBACK.EASY:
      // 太简单：稳定性提高，间隔翻倍
      stability = Math.min(stability * SM2_CONFIG.easyFactor, SM2_CONFIG.maxStability)
      difficultyLevel = Math.max(difficultyLevel - 1, 0)
      masteryLevel = getNewMasteryLevel(masteryLevel, 'easy')
      break
    case FEEDBACK.HARD:
      // 太难：稳定性降低，回到第一轮
      stability = Math.max(stability * SM2_CONFIG.hardFactor, SM2_CONFIG.minStability)
      difficultyLevel = SM2_CONFIG.resetLevel
      masteryLevel = 'weak'
      break
    case FEEDBACK.NORMAL:
    default:
      // 正常：稳定性保持或微调
      stability = Math.max(stability * 1.1, SM2_CONFIG.minStability)
      masteryLevel = getNewMasteryLevel(masteryLevel, 'normal')
      break
  }

  // 计算下一轮复习（如果还有的话）
  const nextLevel = nextReviewIndex + 1
  if (nextLevel < REVIEW_INTERVALS.length) {
    const baseInterval = REVIEW_INTERVALS[nextLevel]
    const adjustedInterval = Math.round(baseInterval * stability)
    reviews[nextLevel] = {
      level: nextLevel,
      baseInterval: baseInterval,
      scheduledDate: addDays(today, adjustedInterval),
      completed: false,
      completedDate: null,
      actualInterval: adjustedInterval
    }
  }

  // 更新掌握程度
  if (!masteryLevel || masteryLevel === 'learning') {
    if (nextReviewIndex >= 2) masteryLevel = 'stable'
    if (nextReviewIndex >= 4) masteryLevel = 'mastered'
  }

  return {
    ...currentData,
    stability,
    difficultyLevel,
    reviews,
    masteryLevel
  }
}

/**
 * 根据反馈获取新的掌握程度
 */
function getNewMasteryLevel(current, feedback) {
  if (feedback === 'hard') return 'weak'
  if (feedback === 'easy') {
    if (current === 'stable') return 'mastered'
    return 'stable'
  }
  return current || 'learning'
}

/**
 * 初始化小节学习数据
 * @param {string} learnDate - 学习日期
 * @param {string} sectionName - 小节名称
 * @param {string} chapterName - 章节名称
 * @param {string} bookKey - 书籍Key
 */
export function initSectionData(learnDate, sectionName, chapterName, bookKey) {
  return {
    learned: true,
    learnDate,
    sectionName,
    chapterName,
    bookKey,
    stability: SM2_CONFIG.defaultStability,
    difficultyLevel: 0,
    reviews: calculateInitialReviews(learnDate),
    masteryLevel: 'learning'
  }
}

/**
 * 获取小节状态
 * @param {Object} data - 学习数据
 * @param {string} today - 今天的日期
 * @returns {string} 状态: 'unstarted', 'learning', 'today', 'overdue', 'completed'
 */
export function getSectionStatus(data, today) {
  if (!data || !data.learned) return 'unstarted'

  // 如果没有 reviews 数据（FSRS 模式），返回 learning
  if (!data.reviews) return 'learning'

  const allReviewsDone = data.reviews.every(r => r.completed)
  if (allReviewsDone) return 'completed'

  const hasOverdue = data.reviews.some(r => !r.completed && r.scheduledDate < today)
  if (hasOverdue) return 'overdue'

  const hasToday = data.reviews.some(r => !r.completed && r.scheduledDate === today)
  if (hasToday) return 'today'

  return 'learning'
}
