import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { getToday, formatDate } from '../utils/sm2'
import { scheduleNextReview, handleFirstLearn, isCardDue, Rating } from '../utils/fsrs-engine'
import { uploadData, downloadData, getSyncConfig, debounce } from '../utils/sync'

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
  // 总小节数
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

  // 所有需要复习的小节（今日+逾期）- 使用 FSRS 数据
  const dueQueue = computed(() => {
    const today = getToday()
    const queue = []

    Object.entries(studyData.value).forEach(([key, data]) => {
      if (!data || !data.learned) return

      // 使用 FSRS due 字段判断
      if (data.due && data.due <= today) {
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
          due: data.due,
          status: data.due < today ? 'overdue' : 'today'
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

  // 兼容旧数据：所有需要复习的小节（今日+逾期）
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
      studyData.value = JSON.parse(savedData)
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

    // 删除对应的小节学习记录
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
    // 直接调用 submitReview 处理首次学习（内部会使用 FSRS）
    return submitReview(sectionKey, 'normal')
  }

  // 提交复习反馈
  function submitReview(sectionKey, feedback) {
    try {
      const data = studyData.value[sectionKey]

      // 如果未学习，先初始化学习数据（首次学习）
      if (!data || !data.learned) {
        // 保存历史状态（用于撤销）
        if (data) {
          pushHistory(sectionKey, data)
        }

        // 创建首次学习数据
        const today = getToday()
        const [bookId, chapterIdx, sectionIdx] = sectionKey.split('_')
        const book = books.value[bookId]
        const chapter = book?.chapters[parseInt(chapterIdx)]
        const sectionName = chapter?.sections[parseInt(sectionIdx)]

        // 首次学习使用 Good (normal) 评级
        const initialResult = handleFirstLearn()

        let cardData = initialResult?.card
        if (!cardData) {
          cardData = {}
        }

        // 处理 due 日期
        let dueDate = today
        if (initialResult?.due instanceof Date) {
          dueDate = formatDate(initialResult.due)
        }

        studyData.value[sectionKey] = {
          learned: true,
          learnDate: today,
          sectionName: sectionName,
          chapterName: chapter?.name,
          bookKey: bookId,
          // FSRS 数据 - 严禁调用 toJSON
          fsrsCard: cardData,
          due: dueDate,
          difficulty: initialResult?.difficulty ?? 1,
          stability: initialResult?.stability ?? 0,
          interval: initialResult?.interval ?? 0,
          repetitions: initialResult?.reps ?? 1,
          rating: 'good'
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(studyData.value))
        return studyData.value[sectionKey]
      }

      // 已学习，使用 FSRS 算法计算下次复习
      // 保存历史状态（用于撤销）
      pushHistory(sectionKey, data)

      const fsrsResult = scheduleNextReview(data, feedback)

      if (!fsrsResult) {
        alert('打卡失败，请查看控制台')
        return data
      }

      let cardData = fsrsResult?.fsrsCard
      if (!cardData) {
        cardData = {}
      }

      // 更新数据 - 严禁调用 toJSON
      studyData.value[sectionKey] = {
        ...data,
        // FSRS 更新
        fsrsCard: cardData,
        due: fsrsResult?.due || data.due,
        difficulty: fsrsResult?.difficulty ?? data.difficulty,
        stability: fsrsResult?.stability ?? data.stability,
        interval: fsrsResult?.interval ?? data.interval,
        repetitions: fsrsResult?.repetitions ?? data.repetitions,
        dueTimestamp: fsrsResult?.dueTimestamp ?? data.dueTimestamp,
        // 保存当前评级
        rating: feedback,
        // 更新学习日期（如果是首次）
        learnDate: data.learnDate || getToday()
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(studyData.value))
      return studyData.value[sectionKey]

    } catch (error) {
      console.error('打卡失败：', error)
      const errMsg = '打卡失败: ' + error.message
      // 移动端友好提示
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
      studyData.value[lastAction.key] = lastAction.data
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

  // 删除小节学习记录
  function deleteSection(sectionKey) {
    const data = studyData.value[sectionKey]
    if (!data) return false

    // 保存历史状态（用于撤销）
    pushHistory(sectionKey, data)

    // 删除该小节的学习记录
    delete studyData.value[sectionKey]

    // 立即保存到本地存储
    localStorage.setItem(STORAGE_KEY, JSON.stringify(studyData.value))

    return true
  }

  // 获取小节状态
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

    // FSRS 逻辑 - 修复日期比较
    const dueDate = data.due
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
        studyData.value = data.studyData
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.studyData))
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
