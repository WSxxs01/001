/**
 * FSRS (Free Spaced Repetition Scheduler) 记忆算法引擎
 * 基于官方 ts-fsrs 库实现
 */

import { FSRS, createEmptyCard, Rating, default_maximum_interval, default_request_retention } from 'ts-fsrs'
import { getToday, formatDate } from './sm2'

// 初始化 FSRS 实例
const fsrs = new FSRS()

// 获取默认参数
function getDefaultParameters() {
  return {
    maximum_interval: 365,        // 最大复习间隔 365 天
    request_retention: 0.90,     // 目标留存率 90%
    w: null                      // 使用默认权重
  }
}

/**
 * 处理首次学习
 * @returns {Object} 包含 card 和其他数据
 */
export function handleFirstLearn() {
  try {
    const card = createEmptyCard()
    // 验证 card 是否有效
    if (!card) {
      throw new Error('Failed to create empty card')
    }
    const scheduling = fsrs.repeat(card, Rating.Good)

    // 检查 scheduling 是否有效 - 兼容不同版本的返回格式
    if (!scheduling) {
      throw new Error('FSRS repeat returned invalid result')
    }

    // 尝试获取 good 结果，如果不存在则使用第一个可用的结果
    let result = scheduling.good
    if (!result) {
      // 尝试获取其他评级
      const availableRatings = ['again', 'hard', 'good', 'easy']
      for (const r of availableRatings) {
        if (scheduling[r]) {
          result = scheduling[r]
          break
        }
      }
    }

    // 如果仍然没有结果，使用默认值
    if (!result || !result.card) {
      console.warn('FSRS scheduling result is incomplete, using defaults')
      return getDefaultResult()
    }

    // 返回标准化的卡片数据
    return {
      card: result.card,
      due: result.card.due,
      difficulty: result.card.difficulty,
      stability: result.card.stability,
      interval: result.card.interval,
      reps: result.card.reps,
      log: result.log
    }
  } catch (e) {
    console.error('handleFirstLearn error:', e)
    return getDefaultResult()
  }
}

// 获取默认结果
function getDefaultResult() {
  const today = new Date()
  return {
    card: createEmptyCard(),
    due: today,
    difficulty: 1,
    stability: 0,
    interval: 0,
    reps: 1,
    log: {}
  }
}

/**
 * 从存储的数据恢复 Card 对象
 * @param {Object} savedCard - 从 localStorage 恢复的 card 数据
 * @returns {Object} Card 对象
 */
function restoreCard(savedCard) {
  if (!savedCard) return createEmptyCard()

  // 尝试使用 FSRS 的 createCard 恢复
  // 如果失败，创建新卡片
  try {
    // 创建一个新卡片，然后复制保存的属性
    const card = createEmptyCard()
    // 复制关键属性
    if (savedCard.state !== undefined) card.state = savedCard.state
    if (savedCard.due) {
      // due 可能是字符串，转换为 Date
      card.due = new Date(savedCard.due)
    }
    if (savedCard.stability !== undefined) card.stability = savedCard.stability
    if (savedCard.difficulty !== undefined) card.difficulty = savedCard.difficulty
    if (savedCard.reps !== undefined) card.reps = savedCard.reps
    if (savedCard.lapses !== undefined) card.lapses = savedCard.lapses
    if (savedCard.step !== undefined) card.step = savedCard.step
    if (savedCard.interval !== undefined) card.interval = savedCard.interval
    return card
  } catch (e) {
    console.error('恢复 Card 失败:', e)
    return createEmptyCard()
  }
}

/**
 * 调度下一次复习 - 简单可靠的间隔重复算法
 * 基于 SM-2 风格的简化实现
 * @param {Object} currentData - 当前小节的学习数据
 * @param {string} feedback - 用户反馈: 'easy', 'normal', 'hard'
 * @returns {Object} 更新后的数据
 */
export function scheduleNextReview(currentData, feedback) {
  try {
    // 当前间隔和难度
    let interval = currentData?.interval || 1
    let difficulty = currentData?.difficulty || 1

    // 根据反馈调整间隔
    let newInterval
    switch (feedback) {
      case 'easy':
        // 太简单：间隔翻倍
        newInterval = Math.round(interval * 2.5)
        difficulty = Math.max(0.5, difficulty - 0.5)
        break
      case 'hard':
        // 太难：间隔减半或重置
        newInterval = Math.max(1, Math.round(interval * 0.5))
        difficulty = Math.min(5, difficulty + 1)
        break
      case 'normal':
      default:
        // 正常：间隔增加到 1.5-2 倍
        newInterval = Math.round(interval * (difficulty < 2 ? 2 : 1.5))
        break
    }

    // 最大间隔 180 天
    newInterval = Math.min(180, newInterval)

    // 计算下次复习日期
    const today = new Date()
    const dueDate = new Date(today)
    dueDate.setDate(dueDate.getDate() + newInterval)

    // 新的重复次数
    const repetitions = (currentData?.repetitions || 0) + 1

    return {
      // 简单存储，不依赖复杂的 card 对象
      fsrsCard: { state: 0, interval: newInterval },

      // 下次复习时间
      due: formatDate(dueDate),

      // 难度 (0-5)
      difficulty: difficulty,

      // 稳定性（简化为间隔）
      stability: newInterval,

      // 复习间隔（天）
      interval: newInterval,

      // 学习次数
      repetitions: repetitions,

      // 截止日期时间戳
      dueTimestamp: dueDate.getTime()
    }
  } catch (e) {
    console.error('scheduleNextReview error:', e)
    return getDefaultReviewResult()
  }
}

// 获取默认的复习结果
function getDefaultReviewResult() {
  const today = new Date()
  return {
    fsrsCard: createEmptyCard(),
    due: formatDate(today),
    difficulty: 1,
    stability: 0,
    interval: 0,
    repetitions: 1,
    isNew: true,
    isLapsed: false,
    dueTimestamp: today.getTime()
  }
}

/**
 * 获取卡片当前状态
 * @param {Object} currentData - 当前小节学习数据
 * @returns {string} 状态: 'new', 'learning', 'review', 'relearning'
 */
export function getCardStatus(currentData) {
  if (!currentData || !currentData.fsrsCard) {
    return 'new'
  }

  const state = currentData.fsrsCard.state
  if (state === 0) return 'new'  // New
  if (state === 1) return 'learning'  // Learning
  if (state === 3) return 'learning'  // Relearning
  return 'review'
}

/**
 * 获取卡片是否到期
 * @param {Object} currentData - 当前小节学习数据
 * @returns {boolean}
 */
export function isCardDue(currentData) {
  if (!currentData || !currentData.fsrsCard) {
    return true // 新卡片需要学习
  }

  const today = new Date(getToday())
  const dueDate = new Date(currentData.due)

  return dueDate <= today
}

// 导出 Rating 枚举供外部使用
export { Rating }

/**
 * 格式化 FSRS 结果为可显示的状态
 * @param {Object} fsrsData - FSRS 数据
 * @returns {Object}
 */
export function formatFsrsStatus(fsrsData) {
  if (!fsrsData) {
    return { status: 'unstarted', label: '未开始', class: 'tag-unstarted' }
  }

  const now = new Date()
  const dueDate = new Date(fsrsData.due)

  // 新卡片
  if (fsrsData.isNew) {
    return { status: 'new', label: '新卡片', class: 'tag-new' }
  }

  // 判断是否到期
  const today = new Date(getToday())
  if (dueDate <= now) {
    if (dueDate < today) {
      return { status: 'overdue', label: '已逾期', class: 'tag-overdue' }
    }
    return { status: 'due', label: '今日复习', class: 'tag-today' }
  }

  // 根据难度和稳定性判断状态
  if (fsrsData.difficulty < 3) {
    return { status: 'mastered', label: '已掌握', class: 'tag-mastered' }
  } else if (fsrsData.difficulty < 6) {
    return { status: 'stable', label: '稳定', class: 'tag-stable' }
  } else {
    return { status: 'learning', label: '学习中', class: 'tag-learning' }
  }
}
