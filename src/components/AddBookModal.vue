<script setup>
import { ref, watch } from 'vue'
import { useStudyStore } from '../stores/useStudyStore'

const store = useStudyStore()

const visible = ref(false)
const bookName = ref('')
const chaptersText = ref('')

function openModal() {
  visible.value = true
  bookName.value = ''
  chaptersText.value = ''
}

function closeModal() {
  visible.value = false
}

function handleSubmit() {
  const name = bookName.value.trim()
  const text = chaptersText.value.trim()

  if (!name) {
    alert('请输入书籍/科目名称')
    return
  }

  if (!text) {
    alert('请输入章节列表')
    return
  }

  // 解析章节文本
  const chapters = []
  const lines = text.split('\n').filter(line => line.trim())

  lines.forEach(line => {
    const parts = line.split('|')
    const chapterName = parts[0].trim()
    const sectionsStr = parts[1] || ''

    // 分割小节（支持逗号、顿号、中文逗号）
    const sections = sectionsStr
      .split(/[,，、]/)
      .map(s => s.trim())
      .filter(s => s)

    if (chapterName) {
      chapters.push({ name: chapterName, sections })
    }
  })

  if (chapters.length === 0) {
    alert('请至少添加一个章节')
    return
  }

  // 调用 store 添加书籍
  store.addBook(name, chapters)

  // 成功提示
  alert(`「${name}」添加成功！共${chapters.length}个章节`)

  // 关闭并重置
  closeModal()
}

defineExpose({
  openModal,
  closeModal
})
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <div class="modal-icon">📚</div>
        <div class="modal-title">添加书籍/科目</div>

        <div class="form-group">
          <label>书籍/科目名称</label>
          <input
            v-model="bookName"
            type="text"
            placeholder="例如：数据结构"
            @keyup.enter="handleSubmit"
          />
        </div>

        <div class="form-group">
          <label>章节与小节</label>
          <div class="format-hint">
            格式：章节名 | 小节1, 小节2, 小节3
          </div>
          <textarea
            v-model="chaptersText"
            placeholder="第1章 绪论 | 1.1基本概念, 1.2数据结构, 1.3算法分析
第2章 线性表 | 2.1线性表定义, 2.2顺序表示, 2.3链式表示
每行一个章节，小节用逗号分隔"
          ></textarea>
        </div>

        <div class="modal-buttons">
          <button class="btn btn-secondary" @click="closeModal">取消</button>
          <button class="btn btn-primary" @click="handleSubmit">✓ 确认添加</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: center;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-content {
  background: white;
  border-radius: 20px;
  padding: 30px;
  max-width: 480px;
  width: 90%;
  text-align: center;
  animation: modalIn 0.3s ease;
}

@keyframes modalIn {
  from { transform: scale(0.8); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.modal-icon {
  font-size: 48px;
  margin-bottom: 15px;
}

.modal-title {
  font-size: 22px;
  margin-bottom: 20px;
  color: #333;
}

.form-group {
  margin-bottom: 20px;
  text-align: left;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #333;
  font-size: 14px;
  font-weight: 500;
}

.format-hint {
  font-size: 12px;
  color: #999;
  margin-bottom: 8px;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 12px 15px;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  font-size: 14px;
  transition: border-color 0.3s;
  font-family: inherit;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #667eea;
}

.form-group textarea {
  resize: vertical;
  min-height: 180px;
  line-height: 1.6;
}

.modal-buttons {
  display: flex;
  gap: 15px;
  justify-content: center;
  margin-top: 25px;
}

.btn {
  padding: 12px 28px;
  border: none;
  border-radius: 25px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.btn-primary:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 20px rgba(102,126,234,0.4);
}

.btn-secondary {
  background: #e0e0e0;
  color: #666;
}

.btn-secondary:hover {
  background: #d0d0d0;
}

@media (max-width: 480px) {
  .modal-content {
    padding: 20px;
  }

  .modal-title {
    font-size: 18px;
  }

  .form-group textarea {
    min-height: 150px;
  }
}
</style>
