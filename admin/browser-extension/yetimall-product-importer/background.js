import { fillAdminProductForm } from './lib/admin-fill.js'
import { saveFillTask } from './lib/storage.js'

const FILL_ADMIN_PRODUCT = 'FILL_ADMIN_PRODUCT'

const configureSidePanel = () => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {})
}

chrome.runtime.onInstalled.addListener(configureSidePanel)
chrome.runtime.onStartup.addListener(configureSidePanel)
configureSidePanel()

const runFillTask = async ({ taskId, product, settings }) => {
  const startedAt = Date.now()
  await saveFillTask({
    taskId,
    state: 'working',
    message: '正在打开管理后台并填入商品…',
    sourceUrl: product.sourceUrl,
    sourceProductId: product.sourceProductId,
    startedAt
  })

  try {
    const result = await fillAdminProductForm(product, settings)
    await saveFillTask({
      taskId,
      state: 'success',
      message: `填入完成：${result.skuCount} 个 SKU`,
      sourceUrl: product.sourceUrl,
      sourceProductId: product.sourceProductId,
      startedAt,
      completedAt: Date.now(),
      result
    })
    return {
      ok: true,
      taskId,
      result
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '自动填入失败'
    await saveFillTask({
      taskId,
      state: 'error',
      message,
      sourceUrl: product.sourceUrl,
      sourceProductId: product.sourceProductId,
      startedAt,
      completedAt: Date.now()
    })
    return {
      ok: false,
      taskId,
      message
    }
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== FILL_ADMIN_PRODUCT) {
    return
  }

  const taskId = message.taskId || crypto.randomUUID()
  runFillTask({
    taskId,
    product: message.product,
    settings: message.settings
  })
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        ok: false,
        taskId,
        message: error instanceof Error ? error.message : '自动填入失败'
      })
    })

  return true
})
