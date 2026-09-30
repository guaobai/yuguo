import { ensureAdminPermission } from './lib/admin-fill.js'
import { fetchYetimallProduct } from './lib/yetimall.js'
import {
  FILL_TASK_KEY,
  getExtractedProduct,
  getFillTask,
  getSettings,
  saveExtractedProduct,
  saveFillTask
} from './lib/storage.js'

const sourceUrlInput = document.querySelector('#sourceUrl')
const extractButton = document.querySelector('#extractButton')
const fillButton = document.querySelector('#fillButton')
const openOptionsButton = document.querySelector('#openOptionsButton')
const statusElement = document.querySelector('#status')
const previewElement = document.querySelector('#productPreview')
const productImage = document.querySelector('#productImage')
const productName = document.querySelector('#productName')
const productMeta = document.querySelector('#productMeta')
const productSchedule = document.querySelector('#productSchedule')
const adminUrlText = document.querySelector('#adminUrlText')

let currentProduct = null
let busy = false

const setStatus = (message, state = 'idle') => {
  statusElement.textContent = message
  statusElement.dataset.state = state
}

const setBusy = (value) => {
  busy = value
  extractButton.disabled = value
  fillButton.disabled = value
  sourceUrlInput.disabled = value
}

const renderProduct = (product) => {
  currentProduct = product
  if (!product) {
    previewElement.hidden = true
    return
  }
  previewElement.hidden = false
  productImage.src = product.mainImageUrl
  productName.textContent = product.name
  const propertyCount = product.propertyGroups?.length || 0
  productMeta.textContent = `${propertyCount} 个规格属性 · ${product.variants.length} 个 SKU · ¥${product.minPrice}–¥${product.maxPrice}`
  productSchedule.textContent = product.schedule.replace(/\s*\n\s*/g, '；')
}

const renderFillTask = (task, product = currentProduct) => {
  if (!task || (product?.sourceUrl && task.sourceUrl !== product.sourceUrl)) {
    return false
  }
  setStatus(task.message || '自动填入任务状态未知', task.state || 'idle')
  return true
}

const extractCurrentProduct = async () => {
  const sourceUrl = sourceUrlInput.value.trim()
  if (!sourceUrl) {
    throw new Error('请填写商品详情链接')
  }
  setStatus('正在提取商品信息…', 'working')
  const product = await fetchYetimallProduct(sourceUrl)
  await saveExtractedProduct(product)
  renderProduct(product)
  setStatus(`提取完成：${product.variants.length} 个 SKU`, 'success')
  return product
}

extractButton.addEventListener('click', async () => {
  if (busy) {
    return
  }
  setBusy(true)
  try {
    await extractCurrentProduct()
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '商品提取失败', 'error')
  } finally {
    setBusy(false)
  }
})

fillButton.addEventListener('click', async () => {
  if (busy) {
    return
  }
  setBusy(true)
  try {
    const product =
      currentProduct && currentProduct.sourceUrl === sourceUrlInput.value.trim()
        ? currentProduct
        : await extractCurrentProduct()
    const settings = await getSettings()
    const granted = await ensureAdminPermission(settings.adminUrl)
    if (!granted) {
      throw new Error('未获得管理后台页面访问权限')
    }
    const taskId = crypto.randomUUID()
    setStatus('正在打开管理后台并填入商品…', 'working')
    await saveFillTask({
      taskId,
      state: 'working',
      message: '正在打开管理后台并填入商品…',
      sourceUrl: product.sourceUrl,
      sourceProductId: product.sourceProductId,
      startedAt: Date.now()
    })
    const response = await chrome.runtime.sendMessage({
      type: 'FILL_ADMIN_PRODUCT',
      taskId,
      product,
      settings
    })
    if (!response?.ok) {
      throw new Error(response?.message || '自动填入失败')
    }
    setStatus(`填入完成：${response.result.skuCount} 个 SKU`, 'success')
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '自动填入失败', 'error')
  } finally {
    setBusy(false)
  }
})

openOptionsButton.addEventListener('click', () => {
  chrome.runtime.openOptionsPage()
})

sourceUrlInput.addEventListener('input', () => {
  if (currentProduct?.sourceUrl !== sourceUrlInput.value.trim()) {
    renderProduct(null)
  }
})

const initialize = async () => {
  const [settings, storedProduct, fillTask, tabs] = await Promise.all([
    getSettings(),
    getExtractedProduct(),
    getFillTask(),
    chrome.tabs.query({ active: true, currentWindow: true })
  ])
  adminUrlText.textContent = settings.adminUrl
  const activeUrl = tabs[0]?.url || ''
  if (activeUrl.includes('m.yetimall.store/h5/#/goods')) {
    sourceUrlInput.value = activeUrl
  } else if (storedProduct?.sourceUrl) {
    sourceUrlInput.value = storedProduct.sourceUrl
  }
  if (storedProduct && storedProduct.sourceUrl === sourceUrlInput.value.trim()) {
    renderProduct(storedProduct)
    if (!renderFillTask(fillTask, storedProduct)) {
      setStatus(`已加载上次提取结果：${storedProduct.variants.length} 个 SKU`, 'success')
    }
  }
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes[FILL_TASK_KEY]?.newValue) {
    renderFillTask(changes[FILL_TASK_KEY].newValue)
  }
})

initialize().catch((error) => {
  setStatus(error instanceof Error ? error.message : '插件初始化失败', 'error')
})
