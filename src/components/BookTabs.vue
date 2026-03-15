<script setup>
import { ref } from 'vue'
import { useStudyStore } from '../stores/useStudyStore'

const store = useStudyStore()

const emit = defineEmits(['update:activeBookId'])

function selectBook(bookId) {
  store.setCurrentBook(bookId)
  emit('update:activeBookId', bookId)
}

function handleDelete(bookId, event) {
  event.stopPropagation()
  const bookName = store.books[bookId]?.name
  if (confirm(`确定要删除「${bookName}」吗？该书籍下的所有学习记录将被清除。`)) {
    store.deleteBook(bookId)
  }
}
</script>

<template>
  <div class="book-tabs-container">
    <div class="book-tabs">
      <div
        v-for="(book, bookId) in store.books"
        :key="bookId"
        class="book-tab-wrapper"
      >
        <button
          class="book-tab"
          :class="{ active: store.currentBookId === bookId }"
          @click="selectBook(bookId)"
        >
          {{ book.name }}
        </button>
        <button
          class="book-tab-delete"
          @click="handleDelete(bookId, $event)"
          title="删除书籍"
        >
          ×
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.book-tabs-container {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.book-tabs {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.book-tab-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.book-tab {
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all var(--transition-normal);
  color: var(--text-secondary);
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

.book-tab.active {
  background: #5E6AD2;
  color: white;
  border-color: transparent;
  box-shadow:
    0 0 0 1px rgba(94, 106, 210, 0.5),
    0 4px 12px rgba(94, 106, 210, 0.3),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.2);
}

.book-tab:hover:not(.active) {
  background: var(--bg-hover);
  border-color: var(--border-hover);
  transform: translateY(-2px);
}

.book-tab-delete {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 18px;
  height: 18px;
  background: var(--danger);
  color: white;
  border: none;
  border-radius: 50%;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.book-tab-wrapper:hover .book-tab-delete {
  opacity: 0.8;
}

.book-tab-delete:hover {
  transform: scale(1.2);
  background: #F87171;
  opacity: 1;
}

</style>
