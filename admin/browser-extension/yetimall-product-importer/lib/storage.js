export const DEFAULT_SETTINGS = Object.freeze({
  adminUrl: 'https://yg.webto.cc/mall/product/spu/add',
  categoryId: null,
  brandId: null,
  deliveryTypes: [],
  deliveryTemplateId: null,
  memberPropertyName: '成员',
  productTypePropertyName: '商品类型',
  createMissingProperties: true,
  marketPriceMultiplier: 1,
  costPriceMultiplier: 1,
  stockMode: 'source',
  fixedStock: 100,
  defaultWeight: 0,
  defaultVolume: 0,
  maxSliderImages: 4,
  importVirtualSales: true,
  barcodePrefix: 'YETI-',
  sort: 0,
  giveIntegral: 0
})

const SETTINGS_KEY = 'yetimallImporterSettings'
const PRODUCT_KEY = 'yetimallExtractedProduct'
export const FILL_TASK_KEY = 'yetimallFillTask'

const nullableNumber = (value) => {
  if (value === '' || value === null || value === undefined) {
    return null
  }
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

const nonNegativeNumber = (value, fallback) => {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : fallback
}

export const normalizeSettings = (settings = {}) => ({
  ...DEFAULT_SETTINGS,
  ...settings,
  adminUrl: String(settings.adminUrl || DEFAULT_SETTINGS.adminUrl).trim(),
  categoryId: nullableNumber(settings.categoryId),
  brandId: nullableNumber(settings.brandId),
  deliveryTypes: Array.isArray(settings.deliveryTypes)
    ? settings.deliveryTypes.map(Number).filter((value) => value === 1 || value === 2)
    : [],
  deliveryTemplateId: nullableNumber(settings.deliveryTemplateId),
  memberPropertyName: String(
    settings.memberPropertyName || DEFAULT_SETTINGS.memberPropertyName
  ).trim(),
  productTypePropertyName: String(
    settings.productTypePropertyName || DEFAULT_SETTINGS.productTypePropertyName
  ).trim(),
  createMissingProperties: settings.createMissingProperties !== false,
  marketPriceMultiplier: nonNegativeNumber(settings.marketPriceMultiplier, 1),
  costPriceMultiplier: nonNegativeNumber(settings.costPriceMultiplier, 1),
  stockMode: settings.stockMode === 'fixed' ? 'fixed' : 'source',
  fixedStock: Math.floor(nonNegativeNumber(settings.fixedStock, 100)),
  defaultWeight: nonNegativeNumber(settings.defaultWeight, 0),
  defaultVolume: nonNegativeNumber(settings.defaultVolume, 0),
  maxSliderImages: Math.max(
    1,
    Math.min(10, Math.floor(nonNegativeNumber(settings.maxSliderImages, 4)))
  ),
  importVirtualSales: settings.importVirtualSales !== false,
  barcodePrefix: String(settings.barcodePrefix ?? DEFAULT_SETTINGS.barcodePrefix).trim(),
  sort: Math.floor(nonNegativeNumber(settings.sort, 0)),
  giveIntegral: Math.floor(nonNegativeNumber(settings.giveIntegral, 0))
})

export const getSettings = async () => {
  const result = await chrome.storage.sync.get(SETTINGS_KEY)
  return normalizeSettings(result[SETTINGS_KEY])
}

export const saveSettings = async (settings) => {
  const normalized = normalizeSettings(settings)
  await chrome.storage.sync.set({ [SETTINGS_KEY]: normalized })
  return normalized
}

export const getExtractedProduct = async () => {
  const result = await chrome.storage.local.get(PRODUCT_KEY)
  return result[PRODUCT_KEY] || null
}

export const saveExtractedProduct = async (product) => {
  await chrome.storage.local.set({ [PRODUCT_KEY]: product })
}

export const getFillTask = async () => {
  const result = await chrome.storage.local.get(FILL_TASK_KEY)
  return result[FILL_TASK_KEY] || null
}

export const saveFillTask = async (task) => {
  await chrome.storage.local.set({ [FILL_TASK_KEY]: task })
  return task
}
