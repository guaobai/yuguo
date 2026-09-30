<template>
  <Dialog
    v-model="dialogVisible"
    title="配置新首页"
    width="96%"
    top="3vh"
    class="category-home-dialog"
  >
    <div v-loading="formLoading" class="category-home-editor">
      <el-alert
        v-if="!categoryHomeEnabled"
        title="当前模板仍使用原首页"
        description="点击“启用分类首页”后，才会替换小程序首页组件。原首页组件会自动保存，可随时恢复。"
        type="info"
        show-icon
        :closable="false"
        class="m-b-16px"
      >
        <template #default>
          <div class="flex items-center justify-between gap-12px">
            <span>新首页不会影响“装修”入口，原首页配置也会保留在备份中。</span>
            <el-button type="primary" size="small" @click="enableCategoryHome">
              启用分类首页
            </el-button>
          </div>
        </template>
      </el-alert>

      <template v-else>
        <el-alert
          title="分类首页已启用"
          description="顶部品牌名称、Logo、搜索框以及分类顺序、图标、轮播图、热榜和商品列表均按下方配置生效。"
          type="success"
          show-icon
          :closable="false"
          class="m-b-16px"
        />

        <el-form label-width="92px" class="category-home-form">
          <el-card header="首页基础设置" shadow="never" class="m-b-16px">
            <el-form-item label="品牌 Logo">
              <UploadImg
                v-model="formData.brand.logo"
                height="64px"
                width="64px"
                :show-btn-text="false"
              />
              <el-text type="info" class="m-l-8px">可不配置，不配置时仅显示品牌名称</el-text>
            </el-form-item>
            <el-form-item label="品牌名称">
              <el-input
                v-model="formData.brand.name"
                maxlength="20"
                class="!w-260px"
                placeholder="请输入品牌名称"
              />
              <el-text type="info" class="m-l-8px">留空时默认展示“娱果”</el-text>
            </el-form-item>
            <el-form-item label="搜索框">
              <el-switch v-model="formData.search.show" />
              <el-input
                v-model="formData.search.placeholder"
                :disabled="!formData.search.show"
                class="m-l-12px !w-260px"
                placeholder="请输入搜索框提示文字"
              />
            </el-form-item>
          </el-card>

          <el-card header="商品分类首页" shadow="never">
            <template #header>
              <div class="flex items-center justify-between">
                <span>商品分类首页</span>
                <el-button type="primary" plain size="small" @click="addTab">
                  <Icon icon="ep:plus" class="mr-4px" /> 添加分类
                </el-button>
              </div>
            </template>

            <el-empty v-if="!formData.tabs.length" description="暂未配置分类，请先添加分类" />

            <Draggable
              v-else
              v-model="formData.tabs"
              :empty-item="createTab()"
              :min="0"
              class="category-tab-list"
            >
              <template #default="{ element }">
                <el-form-item label="分类">
                  <el-select
                    v-model="element.categoryId"
                    class="!w-260px"
                    clearable
                    filterable
                    placeholder="请选择商品分类"
                    @change="(value) => handleCategoryChange(element, value)"
                  >
                    <el-option
                      v-for="category in getCategoryOptions(element)"
                      :key="category.id"
                      :label="getCategoryLabel(category)"
                      :value="category.id"
                    />
                  </el-select>
                  <el-input
                    v-model="element.displayName"
                    class="m-l-8px !w-260px"
                    placeholder="标签展示名称"
                  />
                </el-form-item>

                <el-form-item label="标签图标">
                  <div class="category-icon-config">
                    <UploadImg
                      v-model="element.iconUrl"
                      height="48px"
                      width="48px"
                      :show-btn-text="false"
                    />
                    <el-input
                      v-model="element.icon"
                      maxlength="8"
                      class="!w-220px"
                      placeholder="也可填写表情，如 🔥"
                    />
                    <el-text type="info">均可留空；同时配置时优先显示图片图标</el-text>
                  </div>
                </el-form-item>

                <el-form-item label="轮播图">
                  <div class="banner-list">
                    <Draggable
                      v-model="element.banners"
                      :empty-item="createBanner()"
                      :min="0"
                      class="w-full"
                    >
                      <template #default="{ element: banner }">
                        <div class="banner-item">
                          <UploadImg v-model="banner.imgUrl" height="84px" width="150px" />
                          <el-input
                            v-model="banner.url"
                            class="m-l-8px flex-1"
                            placeholder="点击图片后的跳转地址，可留空"
                          />
                        </div>
                      </template>
                    </Draggable>
                  </div>
                </el-form-item>

                <el-form-item label="开启热榜">
                  <el-switch
                    v-model="element.hot.enabled"
                    active-text="开启"
                    inactive-text="关闭"
                  />
                  <el-text type="info" class="m-l-8px">
                    关闭后该分类只展示轮播图和商品列表
                  </el-text>
                </el-form-item>

                <el-form-item v-if="element.hot.enabled" label="热榜数量">
                  <el-input-number v-model="element.hot.limit" :min="1" :max="50" />
                  <el-text type="info" class="m-l-8px">
                    手工商品优先，不足部分按销量自动补齐
                  </el-text>
                </el-form-item>

                <el-form-item v-if="element.hot.enabled" label="手工热榜">
                  <div class="product-config">
                    <el-button type="primary" plain @click="openProductSelect(element, 'hot')">
                      <Icon icon="ep:plus" class="mr-4px" /> 选择商品
                    </el-button>
                    <div v-if="element.hot.spuIds.length" class="selected-product-list">
                      <VueDraggable
                        v-model="element.hot.spuIds"
                        :animation="150"
                        :force-fallback="true"
                        handle=".selected-product-drag"
                        :item-key="productKey"
                      >
                        <template #item="{ element: spuId, index: spuIndex }">
                          <div class="selected-product-item">
                            <Icon
                              icon="ic:round-drag-indicator"
                              class="selected-product-drag cursor-move"
                            />
                            <el-avatar :size="36" shape="square" :src="getSpu(spuId)?.picUrl" />
                            <span class="selected-product-name">
                              {{ spuIndex + 1 }}. {{ getSpu(spuId)?.name || `商品 ${spuId}` }}
                            </span>
                            <Icon
                              icon="ep:delete"
                              class="cursor-pointer text-red-5"
                              @click="removeProduct(element.hot.spuIds, spuIndex)"
                            />
                          </div>
                        </template>
                      </VueDraggable>
                    </div>
                    <el-text v-else type="info" class="m-t-8px">
                      未手工选择时，热榜全部按销量自动生成
                    </el-text>
                  </div>
                </el-form-item>

                <el-form-item label="商品列表">
                  <div class="product-config">
                    <el-radio-group v-model="element.products.mode">
                      <el-radio value="category">按分类自动加载</el-radio>
                      <el-radio value="manual">手工选品</el-radio>
                    </el-radio-group>
                    <template v-if="element.products.mode === 'category'">
                      <div class="flex items-center gap-8px m-t-8px">
                        <span>每页数量</span>
                        <el-input-number v-model="element.products.pageSize" :min="2" :max="50" />
                        <el-text type="info">支持触底加载更多</el-text>
                      </div>
                    </template>
                    <template v-else>
                      <el-button
                        type="primary"
                        plain
                        class="m-t-8px"
                        @click="openProductSelect(element, 'products')"
                      >
                        <Icon icon="ep:plus" class="mr-4px" /> 选择商品
                      </el-button>
                      <div
                        v-if="element.products.spuIds.length"
                        class="selected-product-list m-t-8px"
                      >
                        <VueDraggable
                          v-model="element.products.spuIds"
                          :animation="150"
                          :force-fallback="true"
                          handle=".selected-product-drag"
                          :item-key="productKey"
                        >
                          <template #item="{ element: spuId, index: spuIndex }">
                            <div class="selected-product-item">
                              <Icon
                                icon="ic:round-drag-indicator"
                                class="selected-product-drag cursor-move"
                              />
                              <el-avatar :size="36" shape="square" :src="getSpu(spuId)?.picUrl" />
                              <span class="selected-product-name">
                                {{ spuIndex + 1 }}. {{ getSpu(spuId)?.name || `商品 ${spuId}` }}
                              </span>
                              <Icon
                                icon="ep:delete"
                                class="cursor-pointer text-red-5"
                                @click="removeProduct(element.products.spuIds, spuIndex)"
                              />
                            </div>
                          </template>
                        </VueDraggable>
                      </div>
                      <el-text v-else type="info" class="m-t-8px">暂未选择商品</el-text>
                    </template>
                  </div>
                </el-form-item>
              </template>
            </Draggable>
          </el-card>
        </el-form>
      </template>

      <SpuTableSelect ref="spuTableSelectRef" :multiple="true" @change="handleProductSelected" />
    </div>

    <template #footer>
      <el-button
        v-if="categoryHomeEnabled && hasLegacyHome"
        type="warning"
        plain
        :disabled="formLoading"
        @click="restoreLegacyHome"
      >
        恢复原首页
      </el-button>
      <el-button :disabled="formLoading" @click="dialogVisible = false">取 消</el-button>
      <el-button
        v-if="categoryHomeEnabled"
        type="primary"
        :loading="formLoading"
        @click="submitForm"
      >
        保存配置
      </el-button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { cloneDeep } from 'lodash-es'
import VueDraggable from 'vuedraggable'
import * as DiyPageApi from '@/api/mall/promotion/diy/page'
import * as DiyTemplateApi from '@/api/mall/promotion/diy/template'
import * as ProductCategoryApi from '@/api/mall/product/category'
import * as ProductSpuApi from '@/api/mall/product/spu'
import SpuTableSelect from '@/views/mall/product/spu/components/SpuTableSelect.vue'

defineOptions({ name: 'CategoryHomeEditor' })

interface BannerItem {
  imgUrl: string
  url: string
}

interface CategoryTab {
  categoryId?: number
  categoryName: string
  displayName: string
  icon: string
  iconUrl: string
  banners: BannerItem[]
  hot: {
    enabled: boolean
    limit: number
    spuIds: number[]
  }
  products: {
    mode: 'category' | 'manual'
    pageSize: number
    spuIds: number[]
  }
}

interface CategoryHomeProperty {
  schemaVersion: number
  brand: {
    name: string
    logo: string
  }
  search: {
    show: boolean
    placeholder: string
  }
  tabs: CategoryTab[]
}

interface CategoryOption {
  id: number
  name: string
  parentId?: number
  children?: CategoryOption[]
  status?: number
}

interface ProductOption {
  id: number
  name?: string
  picUrl?: string
  categoryId?: number
}

interface ProductSelectionContext {
  tab: CategoryTab
  type: 'hot' | 'products'
}

const message = useMessage()
const emit = defineEmits(['success'])

const dialogVisible = ref(false)
const formLoading = ref(false)
const categoryHomeEnabled = ref(false)
const hasLegacyHome = ref(false)
const templateData = ref<DiyTemplateApi.DiyTemplatePropertyVO>()
const homePage = ref<DiyPageApi.DiyPageVO>()
const categoryList = ref<CategoryOption[]>([])
const productList = ref<ProductOption[]>([])
const formData = ref<CategoryHomeProperty>(createDefaultProperty())
const spuTableSelectRef = ref()
const productSelectionContext = ref<ProductSelectionContext>()
const productKey = (id: number) => String(id)

const createBanner = (): BannerItem => ({
  imgUrl: '',
  url: ''
})

const createTab = (): CategoryTab => ({
  categoryId: undefined,
  categoryName: '',
  displayName: '',
  icon: '',
  iconUrl: '',
  banners: [],
  hot: {
    enabled: true,
    limit: 10,
    spuIds: []
  },
  products: {
    mode: 'category',
    pageSize: 10,
    spuIds: []
  }
})

function createDefaultProperty(): CategoryHomeProperty {
  return {
    schemaVersion: 2,
    brand: {
      name: '娱果',
      logo: ''
    },
    search: {
      show: true,
      placeholder: '搜索商品'
    },
    tabs: []
  }
}

function parseProperty(property: unknown): Record<string, any> {
  if (typeof property === 'string') {
    try {
      return JSON.parse(property) || {}
    } catch {
      return {}
    }
  }
  return property && typeof property === 'object' ? cloneDeep(property) : {}
}

function normalizeIds(ids: unknown): number[] {
  return Array.from(
    new Set(
      (Array.isArray(ids) ? ids : [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0)
    )
  )
}

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? Math.max(min, Math.min(max, numberValue)) : fallback
}

function normalizeTab(tab: any): CategoryTab {
  const categoryId = Number(tab?.categoryId)
  const category = categoryList.value.find((item) => item.id === categoryId)
  const categoryName = tab?.categoryName || category?.name || ''
  return {
    categoryId: Number.isFinite(categoryId) && categoryId > 0 ? categoryId : undefined,
    categoryName,
    displayName: tab?.displayName || categoryName,
    icon: typeof tab?.icon === 'string' ? tab.icon : '',
    iconUrl: typeof tab?.iconUrl === 'string' ? tab.iconUrl : '',
    banners: Array.isArray(tab?.banners)
      ? tab.banners.map((banner: any) => ({
          imgUrl: banner?.imgUrl || '',
          url: banner?.url || ''
        }))
      : [],
    hot: {
      enabled: tab?.hot?.enabled !== false,
      limit: clamp(tab?.hot?.limit, 1, 50, 10),
      spuIds: normalizeIds(tab?.hot?.spuIds)
    },
    products: {
      mode: tab?.products?.mode === 'manual' ? 'manual' : 'category',
      pageSize: clamp(tab?.products?.pageSize, 2, 50, 10),
      spuIds: normalizeIds(tab?.products?.spuIds)
    }
  }
}

function normalizeProperty(property: unknown): CategoryHomeProperty {
  const data = parseProperty(property)
  return {
    schemaVersion: 2,
    brand: {
      name: typeof data.brand?.name === 'string' ? data.brand.name : '娱果',
      logo: typeof data.brand?.logo === 'string' ? data.brand.logo : ''
    },
    search: {
      show: data.search?.show !== false,
      placeholder: data.search?.placeholder || '搜索商品'
    },
    tabs: Array.isArray(data.tabs) ? data.tabs.map((tab) => normalizeTab(tab)) : []
  }
}

function getCategoryLabel(category: CategoryOption) {
  const parent = categoryList.value.find((item) => item.id === category.parentId)
  return parent ? `${parent.name} / ${category.name}` : category.name
}

function getCategoryOptions(currentTab: CategoryTab) {
  const usedIds = new Set(
    formData.value.tabs
      .filter((tab) => tab !== currentTab)
      .map((tab) => tab.categoryId)
      .filter((id): id is number => Boolean(id))
  )
  return categoryList.value.filter(
    (category) => category.id === currentTab.categoryId || !usedIds.has(category.id)
  )
}

function getSpu(id: number) {
  return productList.value.find((item) => item.id === Number(id))
}

function enableCategoryHome() {
  categoryHomeEnabled.value = true
  formData.value = createDefaultProperty()
}

function addTab() {
  const availableCategory = categoryList.value.find(
    (category) => !formData.value.tabs.some((tab) => tab.categoryId === category.id)
  )
  const tab = createTab()
  if (availableCategory) {
    tab.categoryId = availableCategory.id
    tab.categoryName = availableCategory.name
    tab.displayName = availableCategory.name
  }
  formData.value.tabs.push(tab)
}

function handleCategoryChange(tab: CategoryTab, categoryId?: number) {
  const category = categoryList.value.find((item) => item.id === categoryId)
  const oldName = tab.categoryName
  tab.categoryId = categoryId
  tab.categoryName = category?.name || ''
  if (!tab.displayName || tab.displayName === oldName) {
    tab.displayName = category?.name || ''
  }
}

function openProductSelect(tab: CategoryTab, type: 'hot' | 'products') {
  productSelectionContext.value = { tab, type }
  const ids = type === 'hot' ? tab.hot.spuIds : tab.products.spuIds
  spuTableSelectRef.value?.open(ids.map((id) => getSpu(id)).filter(Boolean))
}

function handleProductSelected(spus: ProductOption | ProductOption[]) {
  if (!productSelectionContext.value) return
  const list = Array.isArray(spus) ? spus : [spus]
  const ids = normalizeIds(list.map((spu) => spu.id))
  if (productSelectionContext.value.type === 'hot') {
    productSelectionContext.value.tab.hot.spuIds = ids
  } else {
    productSelectionContext.value.tab.products.spuIds = ids
  }
}

function removeProduct(ids: number[], index: number) {
  ids.splice(index, 1)
}

function validateForm() {
  formData.value.brand.name = formData.value.brand.name.trim() || '娱果'
  formData.value.brand.logo = formData.value.brand.logo || ''
  if (!formData.value.tabs.length) {
    message.warning('请至少添加一个商品分类')
    return false
  }
  const categoryIds = new Set<number>()
  for (const tab of formData.value.tabs) {
    const categoryId = tab.categoryId
    if (!categoryId) {
      message.warning('每个首页分类都必须选择商品分类')
      return false
    }
    if (categoryIds.has(categoryId)) {
      message.warning('首页分类不能重复')
      return false
    }
    categoryIds.add(categoryId)
    tab.categoryName =
      categoryList.value.find((category) => category.id === categoryId)?.name || tab.categoryName
    tab.displayName = tab.displayName || tab.categoryName
    tab.icon = tab.icon?.trim() || ''
    tab.iconUrl = tab.iconUrl || ''
    tab.banners = tab.banners.filter((banner) => banner.imgUrl)
    tab.hot.limit = clamp(tab.hot.limit, 1, 50, 10)
    tab.hot.spuIds = normalizeIds(tab.hot.spuIds).slice(0, tab.hot.limit)
    tab.products.pageSize = clamp(tab.products.pageSize, 2, 50, 10)
    tab.products.spuIds = normalizeIds(tab.products.spuIds)
  }
  return true
}

function getPageProperty() {
  return parseProperty(homePage.value?.property)
}

async function submitForm() {
  if (!homePage.value || !templateData.value || !validateForm()) return
  formLoading.value = true
  try {
    const pageProperty = getPageProperty()
    if (!hasLegacyHome.value && Array.isArray(pageProperty.components)) {
      pageProperty.legacyComponents = cloneDeep(pageProperty.components)
    }
    pageProperty.components = [
      {
        id: 'CategoryHome',
        property: cloneDeep(formData.value)
      }
    ]
    const data = {
      ...homePage.value,
      property:
        typeof homePage.value.property === 'string' ? JSON.stringify(pageProperty) : pageProperty
    } as DiyPageApi.DiyPageVO
    await DiyPageApi.updateDiyPageProperty(data)
    hasLegacyHome.value = true
    homePage.value = data
    message.success('新首页配置保存成功')
    dialogVisible.value = false
    emit('success')
  } finally {
    formLoading.value = false
  }
}

async function restoreLegacyHome() {
  if (!homePage.value || !hasLegacyHome.value) return
  try {
    await message.confirm('恢复后小程序首页将重新使用原装修组件，确定继续吗？')
    formLoading.value = true
    const pageProperty = getPageProperty()
    if (!Object.prototype.hasOwnProperty.call(pageProperty, 'legacyComponents')) {
      message.warning('未找到原首页备份，无法恢复')
      return
    }
    pageProperty.components = cloneDeep(pageProperty.legacyComponents || [])
    delete pageProperty.legacyComponents
    const data = {
      ...homePage.value,
      property:
        typeof homePage.value.property === 'string' ? JSON.stringify(pageProperty) : pageProperty
    } as DiyPageApi.DiyPageVO
    await DiyPageApi.updateDiyPageProperty(data)
    homePage.value = data
    categoryHomeEnabled.value = false
    hasLegacyHome.value = false
    formData.value = createDefaultProperty()
    message.success('原首页已恢复')
    emit('success')
  } finally {
    formLoading.value = false
  }
}

async function loadData(id: number) {
  formLoading.value = true
  try {
    const [template, categories, spus] = await Promise.all([
      DiyTemplateApi.getDiyTemplateProperty(id),
      ProductCategoryApi.getCategoryList({}),
      ProductSpuApi.getSpuSimpleList()
    ])
    templateData.value = template
    categoryList.value = Array.isArray(categories) ? categories : []
    productList.value = Array.isArray(spus) ? spus : spus?.list || []
    homePage.value = template.pages?.find((page) => page.name === '首页')
    if (!homePage.value) {
      message.warning('当前模板没有“首页”页面')
      return
    }
    const pageProperty = getPageProperty()
    const categoryHome = pageProperty.components?.find(
      (component: any) => component.id === 'CategoryHome'
    )
    categoryHomeEnabled.value = !!categoryHome
    hasLegacyHome.value = Object.prototype.hasOwnProperty.call(pageProperty, 'legacyComponents')
    formData.value = categoryHome
      ? normalizeProperty(categoryHome.property)
      : createDefaultProperty()
  } finally {
    formLoading.value = false
  }
}

const open = async (id: number) => {
  dialogVisible.value = true
  categoryHomeEnabled.value = false
  hasLegacyHome.value = false
  templateData.value = undefined
  homePage.value = undefined
  formData.value = createDefaultProperty()
  await loadData(id)
}

defineExpose({ open })
</script>

<style lang="scss" scoped>
.category-home-editor {
  min-height: 480px;
  max-height: 76vh;
  overflow: auto;
}

.category-home-form {
  :deep(.el-card__header) {
    padding: 12px 16px;
  }

  :deep(.el-card__body) {
    padding: 16px;
  }
}

.category-tab-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.banner-list {
  width: 100%;
}

.category-icon-config {
  display: flex;
  align-items: center;
  gap: 8px;
}

.banner-item {
  display: flex;
  align-items: center;
  width: 100%;
  margin-bottom: 8px;
}

.product-config {
  width: 100%;
}

.selected-product-list {
  max-width: 640px;
  padding: 8px;
  margin-top: 8px;
  background: var(--app-content-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
}

.selected-product-item {
  display: flex;
  min-height: 44px;
  padding: 4px 0;
  align-items: center;
  gap: 8px;
}

.selected-product-name {
  min-width: 0;
  overflow: hidden;
  flex: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
