import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { FSRS, createEmptyCard, Rating } from 'ts-fsrs'
import { getToday, formatDate } from '../utils/sm2'
import { uploadData, downloadData, getSyncConfig, debounce } from '../utils/sync'

// 初始化 FSRS 调度器
const fsrs = new FSRS({})

/**
 * 【FSRS 数据净化器】强制确保卡片数据格式正确
 * 这是防止 FSRS 引擎崩溃的最后一道防线
 * @param {Object} item - 学习记录项
 * @returns {Object} 净化后的数据
 */
function sanitizeFSRSCard(item) {
  if (!item) return item

  // 1. 如果是旧版数据（连 fsrsCard 都没有），强制套壳
  if (!item.fsrsCard) {
    console.log('[sanitizeFSRSCard] 检测到无 fsrsCard，创建空卡片套壳')
    item.fsrsCard = createEmptyCard()
    if (item.due) {
      item.fsrsCard.due = new Date(item.due) // 继承旧版的复习时间
    }
  }

  // 2. 核心：强制将所有的字符串时间转换为 Date 对象
  // 这是 JSON 序列化/反序列化后的必要修复
  if (item.fsrsCard.due) {
    if (typeof item.fsrsCard.due === 'string') {
      item.fsrsCard.due = new Date(item.fsrsCard.due)
      console.log('[sanitizeFSRSCard] 修复 due: string -> Date')
    } else if (!(item.fsrsCard.due instanceof Date)) {
      // 处理其他奇怪的类型
      item.fsrsCard.due = new Date(item.fsrsCard.due)
    }
  }

  if (item.fsrsCard.last_review) {
    if (typeof item.fsrsCard.last_review === 'string') {
      item.fsrsCard.last_review = new Date(item.fsrsCard.last_review)
      console.log('[sanitizeFSRSCard] 修复 last_review: string -> Date')
    } else if (!(item.fsrsCard.last_review instanceof Date)) {
      item.fsrsCard.last_review = new Date(item.fsrsCard.last_review)
    }
  }

  // 3. 确保卡片有所有必要的字段（防御性编程）
  if (typeof item.fsrsCard.difficulty !== 'number') {
    item.fsrsCard.difficulty = item.difficulty || 5.0
  }
  if (typeof item.fsrsCard.stability !== 'number') {
    item.fsrsCard.stability = item.stability || 0.5
  }
  if (typeof item.fsrsCard.reps !== 'number') {
    item.fsrsCard.reps = item.repetitions || 0
  }

  // 4. 同步顶层字段（确保 UI 和逻辑一致性）
  if (item.fsrsCard.due) {
    const dueStr = formatDate(item.fsrsCard.due)
    if (item.due !== dueStr) {
      item.due = dueStr
    }
  }

  return item
}

/**
 * 【数据清洗与迁移】将旧版艾宾浩斯数据迁移到 FSRS 格式
 * @param {Object} studyData - 学习记录数据
 * @returns {Object} 清洗后的数据
 */
function migrateLegacyData(studyData) {
  if (!studyData || typeof studyData !== 'object') return {}

  Object.entries(studyData).forEach(([key, item]) => {
    if (!item) return

    // 检测：已有学习记录但没有 fsrsCard（旧版数据）
    if (item.learned && !item.fsrsCard) {
      console.log(`[数据迁移] 检测到旧版数据，正在迁移: ${key}`)

      // 创建 FSRS 空卡片外壳
      const card = createEmptyCard()

      // 继承旧版的 due date，防止复习计划丢失
      if (item.due) {
        card.due = new Date(item.due)
      } else if (item.reviews && item.reviews.length > 0) {
        // 从 reviews 数组中找到最近的未完成的 scheduledDate
        const pendingReview = item.reviews.find(r => !r.completed)
        if (pendingReview && pendingReview.scheduledDate) {
          card.due = new Date(pendingReview.scheduledDate)
        }
      }

      // 如果有学习日期，设为 last_review
      if (item.learnDate) {
        card.last_review = new Date(item.learnDate)
      }

      // 从旧数据继承一些合理的初始值
      const reviewCount = item.reviews ? item.reviews.filter(r => r.completed).length : 0
      card.reps = reviewCount
      card.difficulty = 5.0 // 默认中等难度
      card.stability = Math.max(0.5, reviewCount * 0.5) // 根据复习次数估算稳定性

      // 构建 FSRS 兼容结构
      item.fsrsCard = card

      // 同步顶层字段（兼容层）
      item.due = formatDate(card.due)
      item.difficulty = card.difficulty
      item.stability = card.stability
      item.interval = card.scheduled_days || 0
      item.repetitions = card.reps

      console.log(`[数据迁移] 完成: ${key}, due: ${item.due}`)
    }

    // 处理已有 fsrsCard 的情况：确保 Date 对象是有效的
    if (item.fsrsCard) {
      if (item.fsrsCard.due) {
        item.fsrsCard.due = item.fsrsCard.due instanceof Date
          ? item.fsrsCard.due
          : new Date(item.fsrsCard.due)
      }
      if (item.fsrsCard.last_review) {
        item.fsrsCard.last_review = item.fsrsCard.last_review instanceof Date
          ? item.fsrsCard.last_review
          : new Date(item.fsrsCard.last_review)
      }

      // 确保顶层 due 字段与 fsrsCard.due 同步
      if (item.fsrsCard.due) {
        const dueStr = formatDate(item.fsrsCard.due)
        if (item.due !== dueStr) {
          item.due = dueStr
        }
      }
    }
  })

  return studyData
}

// Rating 映射：将字符串反馈转为 FSRS Rating 枚举
const ratingMap = {
  'again': Rating.Again,   // 忘记 -> Again
  'hard': Rating.Hard,     // 困难 -> Hard (兼容)
  'normal': Rating.Good,   // 一般 -> Good (兼容旧代码/SectionItem)
  'good': Rating.Good,     // 良好 -> Good
  'easy': Rating.Easy      // 简单 -> Easy
}

const STORAGE_KEY = 'eb-study-data'
const BOOKS_KEY = 'eb-books'

// 默认书籍数据
const DEFAULT_BOOKS = {
  book1: {
    name: '数据结构',
    chapters: [
      { name: '第1章 绪论', sections: ['1.1 基本概念', '1.2 数据结构', '1.3 算法分析'] },
      { name: '第2章 线性表', sections: ['2.1 线性表定义', '2.2 顺序表示', '2.3 链式表示'] },
      { name: '第3章 栈和队列', sections: ['3.1 栈', '3.2 队列', '3.3 栈和队列的应用'] },
      { name: '第4章 树和二叉树', sections: ['4.1 树的概念', '4.2 二叉树', '4.3 遍历', '4.4 哈夫曼树'] }
    ]
  },
  book2: {
    name: '计算机组成原理',
    chapters: [
      { name: '第1章 计算机系统概述', sections: ['1.1 计算机发展', '1.2 计算机层次', '1.3 性能指标'] },
      { name: '第2章 数据的表示', sections: ['2.1 进制转换', '2.2 定点数', '2.3 浮点数', '2.4 校验码'] },
      { name: '第3章 运算方法', sections: ['3.1 定点运算', '3.2 浮点运算', '3.3 算术逻辑单元'] }
    ]
  }
}

export const useStudyStore = defineStore('study', () => {
  // ==================== State ====================
  // 书籍配置：嵌套结构 { bookId: { name, chapters: [{ name, sections: [] }] } }
  const books = ref({})

  // 学习记录：扁平化存储，key 格式为 `${bookId}_${chapterIdx}_${sectionIdx}`
  const studyData = ref({})

  // 当前选中的书籍
  const currentBookId = ref(null)

  // 撤销历史栈（最多5条）
  const historyStack = ref([])

  // 同步状态
  const syncEnabled = ref(false)
  const lastSyncTime = ref(null)

  // 防抖上传函数（3秒延迟）
  const debouncedUpload = debounce(async () => {
    if (!syncEnabled.value) return
    const config = getSyncConfig()
    if (!config.enabled) return

    await uploadData(studyData.value, books.value)
    lastSyncTime.value = Date.now()
  }, 3000)

  // ==================== Getters ====================
  // 总记忆节点数
  const totalSections = computed(() => {
    let count = 0
    Object.values(books.value).forEach(book => {
      book.chapters.forEach(chapter => {
        count += chapter.sections.length
      })
    })
    return count
  })

  // 已学习数量（至少学过一次）
  const learnedCount = computed(() => {
    return Object.values(studyData.value).filter(d => d && d.learned).length
  })

  // 今日待复习数量 (FSRS) - 仅今天到期，不包含逾期
  const todayReviewCount = computed(() => {
    const today = getToday()
    let count = 0
    Object.values(studyData.value).forEach(data => {
      if (data && data.learned) {
        // FSRS 逻辑 - 仅今天到期
        if (data.fsrsCard && data.due && data.due === today) {
          count++
        } else if (!data.fsrsCard && data.reviews) {
          // 兼容旧数据
          const hasTodayReview = data.reviews.some(
            r => !r.completed && r.scheduledDate === today
          )
          if (hasTodayReview) count++
        }
      }
    })
    return count
  })

  // 逾期数量 (FSRS)
  // 逾期数量 (FSRS)
  const overdueCount = computed(() => {
    const today = getToday()
    let count = 0
    Object.values(studyData.value).forEach(data => {
      if (data && data.learned) {
        // FSRS 逻辑
        if (data.fsrsCard && data.due && data.due < today) {
          count++
        } else if (!data.fsrsCard && data.reviews) {
          // 兼容旧数据
          const hasOverdue = data.reviews.some(
            r => !r.completed && r.scheduledDate < today
          )
          if (hasOverdue) count++
        }
      }
    })
    return count
  })

  // 当前书籍的章节列表
  const currentBookChapters = computed(() => {
    if (!currentBookId.value || !books.value[currentBookId.value]) return []
    return books.value[currentBookId.value].chapters
  })

  // 所有需要复习的记忆节点（今日+逾期）- 使用 FSRS 数据
  const dueQueue = computed(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0) // 重置为当天开始
    const todayStr = getToday()
    const queue = []

    Object.entries(studyData.value).forEach(([key, data]) => {
      if (!data || !data.learned || !data.fsrsCard) return

      // 使用 FSRS fsrsCard.due Date 对象判断
      const dueDate = data.fsrsCard.due instanceof Date
        ? data.fsrsCard.due
        : new Date(data.fsrsCard.due)

      // 比较日期（忽略时间部分）
      const dueDateStr = formatDate(dueDate)
      if (dueDateStr <= todayStr) {
        // 获取上下文信息
        const [bookId, chapterIdx, sectionIdx] = key.split('_')
        const book = books.value[bookId]
        const chapter = book?.chapters[parseInt(chapterIdx)]
        const sectionName = chapter?.sections[parseInt(sectionIdx)]

        queue.push({
          key,
          bookId,
          bookName: book?.name || '',
          chapterName: chapter?.name || '',
          sectionName: sectionName || '',
          due: dueDateStr,
          status: dueDateStr < todayStr ? 'overdue' : 'today'
        })
      }
    })

    // 按书籍和章节排序
    queue.sort((a, b) => {
      if (a.bookId !== b.bookId) return a.bookId.localeCompare(b.bookId)
      const aChapter = a.key.split('_')[1]
      const bChapter = b.key.split('_')[1]
      return parseInt(aChapter) - parseInt(bChapter)
    })

    return queue
  })

  // 兼容旧数据：所有需要复习的记忆节点（今日+逾期）
  const reviewQueue = computed(() => {
    const today = getToday()
    const queue = []
    Object.entries(studyData.value).forEach(([key, data]) => {
      if (data && data.learned && data.reviews) {
        const status = getSectionStatus(data, today)
        if (status === 'today' || status === 'overdue') {
          queue.push({ key, ...data, status })
        }
      }
    })
    return queue
  })

  // ==================== Actions ====================

  // 初始化 Store
  async function initStore() {
    // 读取书籍配置
    const savedBooks = localStorage.getItem(BOOKS_KEY)
    if (savedBooks) {
      books.value = JSON.parse(savedBooks)
    } else {
      // 注入默认数据
      books.value = JSON.parse(JSON.stringify(DEFAULT_BOOKS))
      localStorage.setItem(BOOKS_KEY, JSON.stringify(books.value))
    }

    // 读取学习记录
    const savedData = localStorage.getItem(STORAGE_KEY)
    if (savedData) {
      const parsedData = JSON.parse(savedData)

      // 【关键】数据清洗与迁移：处理旧版数据 + 修复 Date 反序列化
      studyData.value = migrateLegacyData(parsedData)

      // 如果迁移后有修改，立即保存回本地存储
      localStorage.setItem(STORAGE_KEY, JSON.stringify(studyData.value))
    } else {
      studyData.value = {}
    }

    // 设置默认选中的书籍
    const bookIds = Object.keys(books.value)
    if (bookIds.length > 0 && !currentBookId.value) {
      currentBookId.value = bookIds[0]
    }

    // 检查同步配置并执行初始同步
    const config = getSyncConfig()
    if (config.enabled) {
      syncEnabled.value = true

      try {
        const result = await downloadData()
        if (result.success && result.data) {
          // 合并数据（以云端时间戳为准）
          if (result.data.studyData) {
            studyData.value = result.data.studyData
            localStorage.setItem(STORAGE_KEY, JSON.stringify(studyData.value))
          }
          if (result.data.books) {
            books.value = result.data.books
            localStorage.setItem(BOOKS_KEY, JSON.stringify(books.value))
          }
          lastSyncTime.value = result.data.timestamp
        }
      } catch (e) {
        console.error('初始同步失败:', e)
      }
    }
  }

  // 添加书籍
  function addBook(name, chapters) {
    // 生成新书籍ID
    const bookIds = Object.keys(books.value)
    let newId = 'book1'
    let idx = 1
    while (books.value[newId]) {
      newId = 'book' + (++idx)
    }

    // 格式化章节数据
    const formattedChapters = chapters.map(ch => ({
      name: ch.name,
      sections: ch.sections || []
    }))

    books.value[newId] = {
      name,
      chapters: formattedChapters
    }

    // 保存到 LocalStorage
    localStorage.setItem(BOOKS_KEY, JSON.stringify(books.value))
  }

  // 删除书籍（级联删除学习记录）
  function deleteBook(bookId) {
    // 删除书籍
    delete books.value[bookId]

    // 删除该书籍下的所有学习记录
    const keysToDelete = Object.keys(studyData.value).filter(key =>
      key.startsWith(bookId + '_')
    )
    keysToDelete.forEach(key => delete studyData.value[key])

    // 保存
    localStorage.setItem(BOOKS_KEY, JSON.stringify(books.value))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(studyData.value))

    // 切换到其他书籍
    const remainingBooks = Object.keys(books.value)
    if (remainingBooks.length > 0) {
      currentBookId.value = remainingBooks[0]
    } else {
      currentBookId.value = null
    }
  }

  // 添加章节到当前书籍
  function addChapter(chapterName, sections) {
    if (!currentBookId.value) return

    const book = books.value[currentBookId.value]
    if (!book) return

    book.chapters.push({
      name: chapterName,
      sections: sections
    })

    localStorage.setItem(BOOKS_KEY, JSON.stringify(books.value))
  }

  // 删除章节
  function deleteChapter(chapterIdx) {
    if (!currentBookId.value) return

    const book = books.value[currentBookId.value]
    if (!book || !book.chapters[chapterIdx]) return

    // 删除章节
    const deletedChapter = book.chapters.splice(chapterIdx, 1)[0]

    // 删除对应的知识模块记忆记录
    const keysToDelete = []
    Object.keys(studyData.value).forEach(key => {
      const parts = key.split('_')
      if (parts[0] === currentBookId.value) {
        const chIdx = parseInt(parts[1])
        if (chIdx === chapterIdx) {
          keysToDelete.push(key)
        } else if (chIdx > chapterIdx) {
          // 重新索引：后续章节的索引-1
          const newKey = `${parts[0]}_${chIdx - 1}_${parts[2]}`
          studyData.value[newKey] = studyData.value[key]
          keysToDelete.push(key)
        }
      }
    })
    keysToDelete.forEach(key => delete studyData.value[key])

    localStorage.setItem(BOOKS_KEY, JSON.stringify(books.value))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(studyData.value))
  }

  // 开始学习/打卡
  function startLearning(sectionKey) {
    const data = studyData.value[sectionKey]

    // 如果未学习，先初始化 FSRS 卡片
    if (!data || !data.learned) {
      const today = new Date()
      const [bookId, chapterIdx, sectionIdx] = sectionKey.split('_')
      const book = books.value[bookId]
      const chapter = book?.chapters[parseInt(chapterIdx)]
      const sectionName = chapter?.sections[parseInt(sectionIdx)]

      // 创建空卡片并调度首次复习
      const card = createEmptyCard()
      const scheduling = fsrs.repeat(card, today)
      const result = scheduling[Rating.Good]

      studyData.value[sectionKey] = {
        learned: true,
        learnDate: getToday(),
        sectionName: sectionName,
        chapterName: chapter?.name,
        bookKey: bookId,
        // FSRS 核心数据
        fsrsCard: result.card,
        due: formatDate(result.card.due),
        difficulty: result.card.difficulty,
        stability: result.card.stability,
        interval: result.card.scheduled_days || 0,
        repetitions: result.card.reps || 1
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(studyData.value))
      return studyData.value[sectionKey]
    }

    // 已学习过，净化后返回（防止 JSON 序列化导致 Date 变字符串）
    sanitizeFSRSCard(data)
    return data
  }

  // 提交复习反馈 (使用原生 ts-fsrs)
  function submitReview(sectionKey, feedback) {
    try {
      const data = studyData.value[sectionKey]

      // 如果未学习，先初始化学习数据（首次学习）
      if (!data || !data.learned) {
        return startLearning(sectionKey)
      }

      // 【关键】保存历史状态（用于撤销）- 深拷贝 fsrsCard
      const historyData = JSON.parse(JSON.stringify(data))
      // 恢复 Date 对象（JSON 序列化会转成字符串）
      if (historyData.fsrsCard?.due) {
        historyData.fsrsCard.due = new Date(historyData.fsrsCard.due)
      }
      if (historyData.fsrsCard?.last_review) {
        historyData.fsrsCard.last_review = new Date(historyData.fsrsCard.last_review)
      }
      pushHistory(sectionKey, historyData)

      // 【关键】强制净化 FSRS 卡片数据（防止 JSON 序列化导致 Date 变字符串）
      sanitizeFSRSCard(data)

      // 使用 ts-fsrs 进行调度
      const now = new Date()
      const card = data.fsrsCard

      // 确保 card 是有效的
      if (!card || !card.due) {
        throw new Error('无效的 FSRS 卡片数据')
      }

      // 最终安全检查：确保 due 是 Date 对象
      if (!(card.due instanceof Date)) {
        throw new Error(`FSRS 卡片 due 字段类型错误: ${typeof card.due}`)
      }

      // 调用 FSRS 算法
      const scheduling = fsrs.repeat(card, now)

      // 获取对应评级的结果
      const rating = ratingMap[feedback] || Rating.Good
      const result = scheduling[rating]

      if (!result || !result.card) {
        throw new Error('FSRS 调度失败')
      }

      const nextCard = result.card

      // 更新数据
      studyData.value[sectionKey] = {
        ...data,
        // FSRS 核心数据
        fsrsCard: nextCard,
        due: formatDate(nextCard.due),
        difficulty: nextCard.difficulty,
        stability: nextCard.stability,
        interval: nextCard.scheduled_days || 0,
        repetitions: nextCard.reps || 0,
        // 保存当前评级
        rating: feedback
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(studyData.value))
      return studyData.value[sectionKey]

    } catch (error) {
      console.error('打卡失败：', error)
      const errMsg = '打卡失败: ' + error.message
      if (typeof window !== 'undefined' && window.alert) {
        alert(errMsg)
      }
      return null
    }
  }

  // 将状态推入历史栈
  function pushHistory(sectionKey, data) {
    const historyItem = {
      key: sectionKey,
      data: JSON.parse(JSON.stringify(data)),
      timestamp: Date.now()
    }
    historyStack.value.push(historyItem)

    // 限制历史栈长度为 5
    if (historyStack.value.length > 5) {
      historyStack.value.shift()
    }
  }

  // 撤销上一步操作
  function undoLastAction() {
    if (historyStack.value.length === 0) {
      return false
    }

    const lastAction = historyStack.value.pop()
    if (lastAction) {
      // 恢复历史状态
      const restoredData = lastAction.data

      // 【关键】恢复 Date 对象（JSON 序列化会转成字符串）
      if (restoredData.fsrsCard) {
        if (restoredData.fsrsCard.due && typeof restoredData.fsrsCard.due === 'string') {
          restoredData.fsrsCard.due = new Date(restoredData.fsrsCard.due)
        }
        if (restoredData.fsrsCard.last_review && typeof restoredData.fsrsCard.last_review === 'string') {
          restoredData.fsrsCard.last_review = new Date(restoredData.fsrsCard.last_review)
        }
      }

      studyData.value[lastAction.key] = restoredData
      localStorage.setItem(STORAGE_KEY, JSON.stringify(studyData.value))
      return true
    }
    return false
  }

  // 获取历史栈长度（用于 UI 显示）
  function getSectionData(sectionKey) {
    return studyData.value[sectionKey] || null
  }

  // 切换当前书籍
  function setCurrentBook(bookId) {
    if (books.value[bookId]) {
      currentBookId.value = bookId
    }
  }

  // 删除知识模块记忆记录
  function deleteSection(sectionKey) {
    const data = studyData.value[sectionKey]
    if (!data) return false

    // 保存历史状态（用于撤销）
    pushHistory(sectionKey, data)

    // 删除该知识模块的记忆记录
    delete studyData.value[sectionKey]

    // 立即保存到本地存储
    localStorage.setItem(STORAGE_KEY, JSON.stringify(studyData.value))

    return true
  }

  // 获取知识模块状态
  function getSectionStatus(sectionKey) {
    const data = studyData.value[sectionKey]

    if (!data || !data.learned) return 'unstarted'

    // 使用 FSRS 数据判断状态
    const today = getToday()

    // 没有 FSRS 数据的兼容旧数据
    if (!data.fsrsCard) {
      // 简单兼容旧数据
      if (data.reviews) {
        const hasOverdue = data.reviews.some(r => !r.completed && r.scheduledDate < today)
        const hasToday = data.reviews.some(r => !r.completed && r.scheduledDate === today)
        if (hasOverdue) return 'overdue'
        if (hasToday) return 'today'
        const allDone = data.reviews.every(r => r.completed)
        if (allDone) return 'completed'
        return 'learning'
      }
      return 'unstarted'
    }

    // FSRS 逻辑 - 使用 fsrsCard.due 进行日期比较
    const dueDate = data.fsrsCard?.due
      ? (data.fsrsCard.due instanceof Date ? formatDate(data.fsrsCard.due) : data.fsrsCard.due)
      : data.due

    if (!dueDate) return 'learning'

    // 使用日期比较
    if (dueDate < today) return 'overdue'
    if (dueDate === today) return 'today'

    // 距离下次复习还有时间，标记为学习中
    // 如果已经复习了很多次（间隔大于30天），可以认为已掌握
    if (data.interval > 30) return 'completed'

    return 'learning'
  }

  // 导入数据
  function importData(jsonData) {
    try {
      const data = JSON.parse(jsonData)

      if (data.books) {
        books.value = data.books
        localStorage.setItem(BOOKS_KEY, JSON.stringify(data.books))
      }

      if (data.studyData) {
        // 【关键】导入时执行数据清洗与迁移
        const migratedData = migrateLegacyData(data.studyData)
        studyData.value = migratedData

        localStorage.setItem(STORAGE_KEY, JSON.stringify(studyData.value))
      }

      // 重置当前选中的书籍
      const bookIds = Object.keys(books.value)
      if (bookIds.length > 0) {
        currentBookId.value = bookIds[0]
      } else {
        currentBookId.value = null
      }

      return true
    } catch (e) {
      console.error('导入数据失败:', e)
      return false
    }
  }

  // 导出数据
  function exportData() {
    return JSON.stringify({
      books: books.value,
      studyData: studyData.value
    }, null, 2)
  }

  // ==================== 持久化 ====================
  // 深度监听 books 和 studyData，自动保存
  watch(
    () => books.value,
    (newVal) => {
      localStorage.setItem(BOOKS_KEY, JSON.stringify(newVal))
      // 触发自动上传
      debouncedUpload()
    },
    { deep: true }
  )

  watch(
    () => studyData.value,
    (newVal) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newVal))
      // 触发自动上传
      debouncedUpload()
    },
    { deep: true }
  )

  return {
    // State
    books,
    studyData,
    currentBookId,
    syncEnabled,
    lastSyncTime,

    // Getters
    totalSections,
    learnedCount,
    todayReviewCount,
    overdueCount,
    currentBookChapters,
    dueQueue,
    reviewQueue,

    // 是否可以撤销
    canUndo: computed(() => historyStack.value.length > 0),

    // Actions
    initStore,
    addBook,
    deleteBook,
    addChapter,
    deleteChapter,
    startLearning,
    submitReview,
    getSectionData,
    setCurrentBook,
    deleteSection,
    getSectionStatus,
    importData,
    exportData,
    undoLastAction
  }
})
