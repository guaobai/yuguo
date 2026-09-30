<template>
  <el-alert
    title="分类首页使用独立配置面板"
    description="请返回模板列表，点击对应模板的“配置新首页”按钮进行配置。"
    type="info"
    show-icon
    :closable="false"
  />
</template>

<script setup lang="ts">
import { CategoryHomeProperty } from './config'

defineOptions({ name: 'CategoryHomeProperty' })

defineProps<{ modelValue: CategoryHomeProperty }>()
</script>
