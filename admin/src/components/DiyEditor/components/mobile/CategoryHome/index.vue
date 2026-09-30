<template>
  <div class="category-home-preview">
    <div class="preview-header">
      <div class="preview-brand">
        <img v-if="property.brand?.logo" :src="property.brand.logo" alt="" />
        <span>{{ property.brand?.name || '娱果' }}</span>
      </div>
      <div v-if="property.search?.show !== false" class="preview-search">
        <Icon icon="ep:search" />
        <span>{{ property.search?.placeholder || '搜索商品' }}</span>
      </div>
    </div>
    <div v-if="property.tabs?.length" class="preview-tabs">
      <div
        v-for="(tab, index) in property.tabs"
        :key="index"
        class="preview-tab"
        :class="{ active: index === 0 }"
      >
        <img v-if="tab.iconUrl" :src="tab.iconUrl" alt="" />
        <span v-else-if="tab.icon">{{ tab.icon }}</span>
        <b>{{ tab.displayName || tab.categoryName || '未命名分类' }}</b>
      </div>
    </div>
    <div v-if="property.tabs?.[0]" class="preview-content">
      <div v-if="property.tabs[0].banners?.length" class="preview-banner">
        <img :src="property.tabs[0].banners[0].imgUrl" alt="" />
        <span v-if="property.tabs[0].banners.length > 1">
          +{{ property.tabs[0].banners.length - 1 }} 张轮播图
        </span>
      </div>
      <template v-if="property.tabs[0].hot?.enabled !== false">
        <div class="preview-section-title">
          <b>热榜</b>
          <em>HOT</em>
        </div>
        <div class="preview-hot-list">
          <div v-for="index in Math.min(property.tabs[0].hot?.limit || 3, 3)" :key="index">
            <div class="preview-product-image"></div>
            <span>热榜商品 {{ index }}</span>
          </div>
        </div>
      </template>
      <div class="preview-product-grid">
        <div v-for="index in 4" :key="index">
          <div class="preview-product-image"></div>
          <span>商品名称 {{ index }}</span>
          <strong>￥99.00</strong>
        </div>
      </div>
    </div>
    <el-empty v-else description="请在模板列表中配置分类首页" :image-size="52" />
  </div>
</template>

<script setup lang="ts">
import { CategoryHomeProperty } from './config'

defineOptions({ name: 'CategoryHome' })

defineProps<{ property: CategoryHomeProperty }>()
</script>

<style lang="scss" scoped>
.category-home-preview {
  min-height: 520px;
  color: #1f2329;
  background: #f4f6f8;
}

.preview-header {
  padding: 16px;
  background: #fff;
}

.preview-brand {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 24px;
  font-weight: 700;
  color: #101214;
}

.preview-brand img {
  width: 28px;
  height: 28px;
  object-fit: contain;
}

.preview-search {
  display: flex;
  height: 32px;
  padding: 0 10px;
  align-items: center;
  gap: 6px;
  color: #9298a1;
  background: #f4f6f8;
  border: 1px solid #dfe3e8;
  border-radius: 4px;
  font-size: 12px;
}

.preview-tabs {
  display: flex;
  padding: 0 8px;
  overflow: hidden;
  white-space: nowrap;
  background: #fff;
}

.preview-tab {
  position: relative;
  display: flex;
  padding: 14px 12px 12px;
  align-items: center;
  gap: 4px;
  color: #515760;
  font-size: 12px;
}

.preview-tab img {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.preview-tab span {
  line-height: 1;
}

.preview-tab b {
  font-weight: inherit;
}

.preview-tab.active {
  color: #12a99c;
  font-weight: 600;
}

.preview-tab.active::after {
  position: absolute;
  right: 12px;
  bottom: 0;
  left: 12px;
  height: 2px;
  background: #19b8aa;
  content: '';
}

.preview-content {
  padding-bottom: 16px;
}

.preview-banner {
  position: relative;
  height: 180px;
  overflow: hidden;
  background: #e9edf0;
}

.preview-banner img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-banner span {
  position: absolute;
  right: 8px;
  bottom: 8px;
  padding: 3px 6px;
  color: #fff;
  background: rgb(0 0 0 / 45%);
  border-radius: 3px;
  font-size: 11px;
}

.preview-section-title {
  display: flex;
  padding: 14px 12px 8px;
  align-items: center;
  gap: 6px;
  background: #fff;
}

.preview-section-title b {
  font-size: 16px;
}

.preview-section-title em {
  padding: 2px 5px;
  color: #fff;
  background: #17b8aa;
  border-radius: 3px;
  font-size: 10px;
  font-style: italic;
}

.preview-hot-list,
.preview-product-grid {
  display: grid;
  padding: 0 12px 8px;
  gap: 8px;
  background: #fff;
}

.preview-hot-list {
  grid-template-columns: repeat(3, 1fr);
}

.preview-product-grid {
  padding-top: 12px;
  grid-template-columns: repeat(2, 1fr);
}

.preview-hot-list > div,
.preview-product-grid > div {
  min-width: 0;
  padding-bottom: 8px;
  overflow: hidden;
  border: 1px solid #eaedf0;
  border-radius: 4px;
  background: #fff;
}

.preview-hot-list span,
.preview-product-grid span {
  display: block;
  padding: 4px 6px 0;
  overflow: hidden;
  color: #333840;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-product-grid strong {
  display: block;
  padding: 4px 6px 0;
  color: #e43f3f;
  font-size: 12px;
}

.preview-product-image {
  height: 72px;
  background: #f1f3f5;
}
</style>
