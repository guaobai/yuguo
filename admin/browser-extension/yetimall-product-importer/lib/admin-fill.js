const getAdminOriginPattern = (adminUrl) => {
  const parsed = new URL(adminUrl)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('管理后台地址只支持 HTTP 或 HTTPS')
  }
  return `${parsed.protocol}//${parsed.host}/*`
}

const buildAdminNavigationUrl = (adminUrl) => {
  const parsed = new URL(adminUrl)
  parsed.searchParams.set('_yetimall_import', `${Date.now()}-${crypto.randomUUID()}`)
  return parsed.toString()
}

export const ensureAdminPermission = async (adminUrl) => {
  const origins = [getAdminOriginPattern(adminUrl)]
  const granted = await chrome.permissions.contains({ origins })
  if (granted) {
    return true
  }
  return await chrome.permissions.request({ origins })
}

const isExpectedNavigation = (currentUrl, expectedUrl) => {
  try {
    const current = new URL(currentUrl)
    const expected = new URL(expectedUrl)
    return (
      current.origin === expected.origin &&
      current.pathname === expected.pathname &&
      current.searchParams.get('_yetimall_import') === expected.searchParams.get('_yetimall_import')
    )
  } catch {
    return false
  }
}

const waitForTabComplete = async (tabId, expectedUrl, timeoutMs = 30000) => {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const current = await chrome.tabs.get(tabId)
    if (
      current.status === 'complete' &&
      current.url &&
      isExpectedNavigation(current.url, expectedUrl)
    ) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('等待管理后台加载超时')
}

const openAdminTab = async (adminUrl) => {
  const targetUrl = new URL(adminUrl)
  const navigationUrl = buildAdminNavigationUrl(adminUrl)
  const tabs = await chrome.tabs.query({})
  const existing = tabs.find((tab) => {
    if (!tab.url) {
      return false
    }
    try {
      const currentUrl = new URL(tab.url)
      return (
        currentUrl.origin === targetUrl.origin &&
        currentUrl.pathname.startsWith('/mall/product/spu')
      )
    } catch {
      return false
    }
  })

  if (existing?.id) {
    await chrome.tabs.update(existing.id, {
      active: true,
      url: navigationUrl
    })
    await chrome.windows.update(existing.windowId, { focused: true })
    return {
      tabId: existing.id,
      navigationUrl
    }
  }

  const created = await chrome.tabs.create({
    active: true,
    url: navigationUrl
  })
  if (!created.id) {
    throw new Error('无法打开管理后台标签页')
  }
  return {
    tabId: created.id,
    navigationUrl
  }
}

const dispatchImportInMainWorld = async (detail) => {
  const bridgeWindow = window
  const startedAt = Date.now()
  while (!bridgeWindow.__YETIMALL_IMPORT_BRIDGE__ && Date.now() - startedAt < 10000) {
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  if (!bridgeWindow.__YETIMALL_IMPORT_BRIDGE__) {
    return {
      ok: false,
      code: 'BRIDGE_MISSING',
      message: '管理后台未加载商品导入桥接，请确认线上前端已部署最新版'
    }
  }

  return await new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      window.removeEventListener('yetimall-product-import-result', handleResult)
      resolve({
        ok: false,
        code: 'IMPORT_TIMEOUT',
        message: '管理后台处理商品数据超时'
      })
    }, 30000)

    const handleResult = (event) => {
      if (event.detail?.requestId !== detail.requestId) {
        return
      }
      clearTimeout(timeoutId)
      window.removeEventListener('yetimall-product-import-result', handleResult)
      resolve(event.detail)
    }

    window.addEventListener('yetimall-product-import-result', handleResult)
    window.dispatchEvent(
      new CustomEvent('yetimall-product-import', {
        detail
      })
    )
  })
}

export const fillAdminProductForm = async (product, settings) => {
  const granted = await ensureAdminPermission(settings.adminUrl)
  if (!granted) {
    throw new Error('未获得管理后台页面访问权限')
  }

  const { tabId, navigationUrl } = await openAdminTab(settings.adminUrl)
  await waitForTabComplete(tabId, navigationUrl)
  await new Promise((resolve) => setTimeout(resolve, 500))

  const requestId = crypto.randomUUID()
  const executionResults = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: dispatchImportInMainWorld,
    args: [
      {
        requestId,
        product,
        settings
      }
    ]
  })
  const result = executionResults[0]?.result
  if (!result?.ok) {
    throw new Error(result?.message || '管理后台自动填入失败')
  }
  return {
    ...result,
    tabId
  }
}
