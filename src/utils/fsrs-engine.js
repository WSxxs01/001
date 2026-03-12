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
 * 调度下一次复习
 * @param {Object} currentData - 当前小节的学习数据（包含 fsrsCard）
 * @param {string} feedback - 用户反馈: 'easy', 'normal', 'hard'
 * @returns {Object} 更新后的数据
 */
export function scheduleNextReview(currentData, feedback) {
  try {
    let card

    // 如果有保存的 FSRS Card 数据，恢复它
    if (currentData && currentData.fsrsCard && currentData.fsrsCard.state !== undefined) {
      card = currentData.fsrsCard
    } else {
      // 如果没有或数据不完整，创建新卡片
      card = createEmptyCard()
    }

    // 验证 card 是否有效
    if (!card || card.state === undefined) {
      console.warn('Invalid card data, creating new card')
      card = createEmptyCard()
    }

    // 获取对应的 FSRS 评级
    const ratingMap = {
      'easy': Rating.Easy,      // 太简单
      'normal': Rating.Good,   // 掌握一般
      'hard': Rating.Hard      // 太难了
    }

    const rating = ratingMap[feedback] || Rating.Good

    // 使用 FSRS 计算下次复习
    const scheduling = fsrs.repeat(card, rating)

    // 检查 scheduling 是否有效
    if (!scheduling) {
      console.error('FSRS repeat returned invalid scheduling')
      return getDefaultReviewResult()
    }

    // 根据评级获取对应的结果
    let result
    switch (rating) {
      case Rating.Easy:
        result = scheduling.easy
        break
      case Rating.Good:
        result = scheduling.good
        break
      case Rating.Hard:
        result = scheduling.hard
        break
      default:
        result = scheduling.good
    }

    // 如果 result 仍然不存在，尝试其他可用评级
    if (!result) {
      const availableRatings = ['again', 'hard', 'good', 'easy']
      for (const r of availableRatings) {
        if (scheduling[r]) {
          result = scheduling[r]
          break
        }
      }
    }

    // 最终检查，如果还是没有结果，返回默认值
    if (!result || !result.card) {
      console.warn('No valid scheduling result, using defaults')
      return getDefaultReviewResult()
    }

    // 提取关键数据
    const dueDate = result.card.due

    return {
      // FSRS Card 数据（用于持久化）
      fsrsCard: result.card,

      // 下次复习时间
      due: formatDate(dueDate),

      // 难度 (0-10)
      difficulty: result.card.difficulty,

      // 稳定性（记忆稳固程度）
      stability: result.card.stability,

      // 复习间隔（天）
      interval: result.card.interval || 0,

      // 学习次数
      repetitions: result.card.reps || 1,

      // 是否是新卡片
      isNew: result.card.state === 0,  // State.New

      // 是否 lapsed（遗忘后重新学习）
      isLapsed: result.card.lapses > 0,

      // 截止日期（用于排序）
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
