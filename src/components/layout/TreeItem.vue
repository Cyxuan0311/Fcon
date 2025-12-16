<template>
  <div class="tree-item">
    <div
      class="tree-item-content"
      :class="{
        'is-selected': isSelected,
        'is-directory': item.type === 'directory'
      }"
      :style="{ paddingLeft: `${level * 16 + 8}px` }"
      @click="handleClick"
    >
      <div class="tree-item-icon">
        <span v-if="item.type === 'directory'" class="expand-icon" @click.stop="toggleExpand">
          {{ isExpanded ? '▼' : '▶' }}
        </span>
        <span v-else class="file-icon">•</span>
      </div>
      <span class="tree-item-name">{{ item.name }}</span>
    </div>
    
    <div v-if="item.type === 'directory' && isExpanded" class="tree-item-children">
      <TreeItem
        v-for="child in children"
        :key="child.id"
        :item="child"
        :selected-id="selectedId"
        :level="level + 1"
        @select="$emit('select', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useFileSystemStore } from '@/stores/fileSystem'

const props = defineProps({
  item: {
    type: Object,
    required: true
  },
  selectedId: {
    type: String,
    default: null
  },
  level: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['select'])

const fileSystemStore = useFileSystemStore()
const isExpanded = ref(false)

const isSelected = computed(() => {
  return props.selectedId === props.item.id
})

const children = computed(() => {
  if (props.item.type !== 'directory') {
    return []
  }
  
  const allFiles = fileSystemStore.files || []
  const childFiles = allFiles.filter(f => f && f.parentId === props.item.id)
  
  return childFiles.sort((a, b) => {
    // 目录排在前面
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1
    }
    return a.name.localeCompare(b.name)
  })
})

const handleClick = () => {
  emit('select', props.item)
}

const toggleExpand = () => {
  if (props.item.type === 'directory') {
    isExpanded.value = !isExpanded.value
  }
}
</script>

<style scoped>
.tree-item {
  user-select: none;
}

.tree-item-content {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  cursor: pointer;
  transition: background-color 0.2s;
  border-radius: 4px;
}

.tree-item-content:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.tree-item-content.is-selected {
  background-color: rgba(59, 130, 246, 0.2);
}

.tree-item-icon {
  display: flex;
  align-items: center;
  width: 16px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
}

.expand-icon {
  cursor: pointer;
  user-select: none;
  transition: transform 0.2s;
}

.file-icon {
  color: rgba(255, 255, 255, 0.4);
}

.tree-item-name {
  flex: 1;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tree-item-content.is-directory .tree-item-name {
  font-weight: 500;
}

.tree-item-children {
  margin-left: 0;
}
</style>

