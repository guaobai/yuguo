import { ensureAdminPermission } from './lib/admin-fill.js'
import { getSettings, saveSettings } from './lib/storage.js'

const form = document.querySelector('#settingsForm')
const statusElement = document.querySelector('#optionsStatus')

const field = (id) => document.querySelector(`#${id}`)

const numberOrNull = (value) => {
  if (value === '') {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const setValue = (id, value) => {
  field(id).value = value ?? ''
}

const load = async () => {
  const settings = await getSettings()
  setValue('adminUrl', settings.adminUrl)
  setValue('categoryId', settings.categoryId)
  setValue('brandId', settings.brandId)
  field('deliveryExpress').checked = settings.deliveryTypes.includes(1)
  field('deliveryPickup').checked = settings.deliveryTypes.includes(2)
  setValue('deliveryTemplateId', settings.deliveryTemplateId)
  setValue('maxSliderImages', settings.maxSliderImages)
  setValue('memberPropertyName', settings.memberPropertyName)
  setValue('productTypePropertyName', settings.productTypePropertyName)
  field('createMissingProperties').checked = settings.createMissingProperties
  setValue('marketPriceMultiplier', settings.marketPriceMultiplier)
  setValue('costPriceMultiplier', settings.costPriceMultiplier)
  setValue('stockMode', settings.stockMode)
  setValue('fixedStock', settings.fixedStock)
  setValue('defaultWeight', settings.defaultWeight)
  setValue('defaultVolume', settings.defaultVolume)
  setValue('barcodePrefix', settings.barcodePrefix)
  field('importVirtualSales').checked = settings.importVirtualSales
  setValue('sort', settings.sort)
  setValue('giveIntegral', settings.giveIntegral)
}

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  statusElement.textContent = '正在保存…'
  try {
    const adminUrl = field('adminUrl').value.trim()
    const parsedAdminUrl = new URL(adminUrl)
    if (parsedAdminUrl.protocol !== 'http:' && parsedAdminUrl.protocol !== 'https:') {
      throw new Error('后台地址只支持 HTTP 或 HTTPS')
    }
    const deliveryTypes = []
    if (field('deliveryExpress').checked) {
      deliveryTypes.push(1)
    }
    if (field('deliveryPickup').checked) {
      deliveryTypes.push(2)
    }
    const settings = await saveSettings({
      adminUrl,
      categoryId: numberOrNull(field('categoryId').value),
      brandId: numberOrNull(field('brandId').value),
      deliveryTypes,
      deliveryTemplateId: numberOrNull(field('deliveryTemplateId').value),
      maxSliderImages: Number(field('maxSliderImages').value),
      memberPropertyName: field('memberPropertyName').value.trim(),
      productTypePropertyName: field('productTypePropertyName').value.trim(),
      createMissingProperties: field('createMissingProperties').checked,
      marketPriceMultiplier: Number(field('marketPriceMultiplier').value),
      costPriceMultiplier: Number(field('costPriceMultiplier').value),
      stockMode: field('stockMode').value,
      fixedStock: Number(field('fixedStock').value),
      defaultWeight: Number(field('defaultWeight').value),
      defaultVolume: Number(field('defaultVolume').value),
      barcodePrefix: field('barcodePrefix').value.trim(),
      importVirtualSales: field('importVirtualSales').checked,
      sort: Number(field('sort').value),
      giveIntegral: Number(field('giveIntegral').value)
    })
    const granted = await ensureAdminPermission(settings.adminUrl)
    statusElement.textContent = granted ? '设置已保存' : '设置已保存，后台页面权限尚未授权'
  } catch (error) {
    statusElement.textContent = error instanceof Error ? error.message : '保存失败'
  }
})

load().catch((error) => {
  statusElement.textContent = error instanceof Error ? error.message : '加载设置失败'
})
