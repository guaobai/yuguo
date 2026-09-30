import { ElMessage } from 'element-plus'
import { onBeforeUnmount, onMounted, type Ref } from 'vue'
import type { Property, Sku, Spu } from '@/api/mall/product/spu'
import * as ProductPropertyApi from '@/api/mall/product/property'

export const YETIMALL_IMPORT_EVENT = 'yetimall-product-import'
export const YETIMALL_IMPORT_RESULT_EVENT = 'yetimall-product-import-result'

interface YetimallVariant {
  sourceSkuId: number
  properties?: YetimallVariantProperty[]
  productType?: string
  member?: string
  price: number
  inventory: number
  imageUrl: string
}

interface YetimallVariantProperty {
  sourceName?: string
  value: string
  position?: number
}

interface YetimallProduct {
  sourceUrl: string
  sourceProductId: number
  name: string
  keyword: string
  introduction: string
  descriptionHtml: string
  mainImageUrl: string
  detailImageUrls: string[]
  sale: number
  variants: YetimallVariant[]
}

interface YetimallImportSettings {
  categoryId?: number
  brandId?: number
  deliveryTypes?: number[]
  deliveryTemplateId?: number
  memberPropertyName?: string
  productTypePropertyName?: string
  createMissingProperties?: boolean
  marketPriceMultiplier?: number
  costPriceMultiplier?: number
  stockMode?: 'source' | 'fixed'
  fixedStock?: number
  defaultWeight?: number
  defaultVolume?: number
  maxSliderImages?: number
  importVirtualSales?: boolean
  barcodePrefix?: string
  sort?: number
  giveIntegral?: number
}

interface YetimallImportEventDetail {
  requestId: string
  product: YetimallProduct
  settings?: YetimallImportSettings
}

interface UseYetimallProductImportOptions {
  formData: Ref<Spu>
  activeName: Ref<string>
  loading: Ref<boolean>
}

type ImportBridgeWindow = Window & {
  __YETIMALL_IMPORT_BRIDGE__?: {
    version: string
  }
}

const IMAGE_SOURCE_ATTRIBUTES = ['src', 'data-src', 'data-original', 'data-lazy-src']

const normalizedName = (value: unknown) => String(value ?? '').trim()

const sameName = (left: unknown, right: unknown) =>
  normalizedName(left).toLocaleLowerCase() === normalizedName(right).toLocaleLowerCase()

const asPositiveNumber = (value: unknown, fallback: number) => {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : fallback
}

const roundMoney = (value: number) => Math.round(value * 100) / 100

const clipText = (value: unknown, maxLength: number) =>
  Array.from(normalizedName(value)).slice(0, maxLength).join('')

const toHttps = (value: unknown) => {
  const url = normalizedName(value)
  if (url.startsWith('//')) {
    return `https:${url}`
  }
  return url.replace(/^http:\/\//i, 'https://')
}

const getImageSource = (image: HTMLImageElement) => {
  for (const attribute of IMAGE_SOURCE_ATTRIBUTES) {
    const source = toHttps(image.getAttribute(attribute))
    if (source) {
      return source
    }
  }
  return ''
}

const isHttpUrl = (value: string) => {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

const uniqueUrls = (urls: unknown[]) => Array.from(new Set(urls.map(toHttps).filter(isHttpUrl)))

const createImageParagraph = (
  documentNode: Document,
  image: HTMLImageElement
): HTMLParagraphElement => {
  const paragraph = documentNode.createElement('p')
  paragraph.style.textAlign = 'center'
  paragraph.append(image)
  return paragraph
}

const normalizeDescriptionImages = (documentNode: Document) => {
  const topLevelElements: Element[] = []
  const seen = new Set<Element>()

  documentNode.querySelectorAll('img').forEach((image) => {
    let topLevel: Element = image
    while (topLevel.parentElement && topLevel.parentElement !== documentNode.body) {
      topLevel = topLevel.parentElement
    }
    if (!seen.has(topLevel)) {
      seen.add(topLevel)
      topLevelElements.push(topLevel)
    }
  })

  topLevelElements.forEach((topLevel) => {
    if (topLevel instanceof HTMLImageElement) {
      const paragraph = documentNode.createElement('p')
      paragraph.style.textAlign = 'center'
      topLevel.before(paragraph)
      paragraph.append(topLevel)
      return
    }

    const images = Array.from(topLevel.querySelectorAll('img'))
    if (images.length === 0) {
      return
    }

    const fragment = documentNode.createDocumentFragment()
    images.forEach((image) => fragment.append(createImageParagraph(documentNode, image)))

    if (topLevel.textContent?.trim()) {
      topLevel.after(fragment)
    } else {
      topLevel.replaceWith(fragment)
    }
  })
}

const sanitizeDescriptionHtml = (html: unknown, productName = '') => {
  const parser = new DOMParser()
  const documentNode = parser.parseFromString(String(html ?? ''), 'text/html')
  documentNode
    .querySelectorAll('script, style, iframe, object, embed, form, input, button')
    .forEach((node) => node.remove())

  documentNode.querySelectorAll('*').forEach((node) => {
    for (const attribute of Array.from(node.attributes)) {
      const name = attribute.name.toLocaleLowerCase()
      const value = attribute.value.trim()
      if (
        name.startsWith('on') ||
        name === 'srcdoc' ||
        ((name === 'href' || name === 'src') && /^javascript:/i.test(value))
      ) {
        node.removeAttribute(attribute.name)
      }
    }
  })

  documentNode.querySelectorAll('img').forEach((image) => {
    const source = getImageSource(image)
    if (!isHttpUrl(source)) {
      image.remove()
      return
    }
    image.setAttribute('src', source)
    image.setAttribute('alt', image.getAttribute('alt') || productName)
    image.style.maxWidth = '100%'
    image.style.height = 'auto'
    IMAGE_SOURCE_ATTRIBUTES.filter((attribute) => attribute !== 'src').forEach((attribute) =>
      image.removeAttribute(attribute)
    )
  })
  normalizeDescriptionImages(documentNode)
  documentNode.querySelectorAll('p').forEach((paragraph) => {
    if (!paragraph.textContent?.trim() && !paragraph.querySelector('img')) {
      paragraph.remove()
    }
  })
  return documentNode.body.innerHTML
}

const buildDescriptionHtml = (product: YetimallProduct) => {
  const parser = new DOMParser()
  const documentNode = parser.parseFromString(
    sanitizeDescriptionHtml(product.descriptionHtml, product.name),
    'text/html'
  )
  const existingUrls = new Set(
    Array.from(documentNode.images)
      .map((image) => toHttps(image.getAttribute('src')))
      .filter(isHttpUrl)
  )
  const detailImageUrls = uniqueUrls(
    Array.isArray(product.detailImageUrls) ? product.detailImageUrls : []
  )

  detailImageUrls.forEach((url) => {
    if (existingUrls.has(url)) {
      return
    }
    const image = documentNode.createElement('img')
    image.setAttribute('src', url)
    image.setAttribute('alt', product.name)
    image.style.maxWidth = '100%'
    image.style.height = 'auto'
    documentNode.body.append(createImageParagraph(documentNode, image))
    existingUrls.add(url)
  })
  return documentNode.body.innerHTML
}

const validateImportPayload = (detail: YetimallImportEventDetail) => {
  if (!detail?.requestId || !detail.product) {
    throw new Error('导入数据格式不完整')
  }
  if (!detail.product.name || !detail.product.mainImageUrl) {
    throw new Error('商品名称或主图缺失')
  }
  if (!Array.isArray(detail.product.variants) || detail.product.variants.length === 0) {
    throw new Error('商品规格数据为空')
  }
  if (detail.product.variants.length > 500) {
    throw new Error('商品规格超过 500 条，已停止导入')
  }

  const variantPropertyValues = detail.product.variants.map(getVariantPropertyValues)
  const propertyCount = variantPropertyValues[0]?.length || 0
  if (variantPropertyValues.some((properties) => properties.length !== propertyCount)) {
    throw new Error('来源商品的 SKU 规格数量不一致')
  }
  if (propertyCount > 5) {
    throw new Error('来源商品的规格属性超过 5 个，已停止导入')
  }
  if (propertyCount === 0 && detail.product.variants.length > 1) {
    throw new Error('来源商品存在多个 SKU，但没有可用于区分 SKU 的规格')
  }
  const combinations = variantPropertyValues.map((properties) =>
    JSON.stringify(properties.map((property) => normalizedName(property.value)))
  )
  if (new Set(combinations).size !== combinations.length) {
    throw new Error('来源商品存在重复的 SKU 规格组合')
  }
}

const dispatchResult = (detail: Record<string, unknown>) => {
  window.dispatchEvent(
    new CustomEvent(YETIMALL_IMPORT_RESULT_EVENT, {
      detail
    })
  )
}

const findOrCreateProperty = async (
  propertyName: string,
  createMissing: boolean
): Promise<number> => {
  const properties = await ProductPropertyApi.getPropertySimpleList()
  const existing = properties.find((property) => sameName(property.name, propertyName))
  if (existing?.id) {
    return existing.id
  }
  if (!createMissing) {
    throw new Error(`后台缺少商品属性“${propertyName}”`)
  }
  return await ProductPropertyApi.createProperty({
    name: propertyName,
    remark: '由 YETIMALL 商品搬运插件创建'
  })
}

const findOrCreatePropertyValues = async (
  propertyId: number,
  valueNames: string[],
  createMissing: boolean
) => {
  const valueMap = new Map<string, number>()
  const existingValues = await ProductPropertyApi.getPropertyValueSimpleList(propertyId)
  existingValues.forEach((value) => {
    if (value.id) {
      valueMap.set(normalizedName(value.name).toLocaleLowerCase(), value.id)
    }
  })

  for (const valueName of Array.from(new Set(valueNames.map(normalizedName))).filter(Boolean)) {
    const key = valueName.toLocaleLowerCase()
    if (valueMap.has(key)) {
      continue
    }
    if (!createMissing) {
      throw new Error(`后台属性缺少属性值“${valueName}”`)
    }
    const valueId = await ProductPropertyApi.createPropertyValue({
      propertyId,
      name: valueName,
      remark: '由 YETIMALL 商品搬运插件创建'
    })
    valueMap.set(key, valueId)
  }
  return valueMap
}

interface ImportedPropertyDefinition {
  propertyId: number
  propertyName: string
  valueMap: Map<string, number>
}

const getVariantPropertyValues = (variant: YetimallVariant): YetimallVariantProperty[] => {
  if (Array.isArray(variant.properties)) {
    return variant.properties
      .map((property) => ({
        sourceName: normalizedName(property.sourceName),
        value: normalizedName(property.value),
        position: property.position
      }))
      .filter((property) => property.value)
  }

  return [
    {
      value: normalizedName(variant.member),
      position: 0
    },
    {
      value: normalizedName(variant.productType),
      position: 1
    }
  ].filter((property) => property.value)
}

const getConfiguredPropertyName = (index: number, settings: YetimallImportSettings): string => {
  if (index === 0) {
    return clipText(settings.memberPropertyName || '成员', 32)
  }
  if (index === 1) {
    return clipText(settings.productTypePropertyName || '商品类型', 32)
  }
  return `规格${index + 1}`
}

const buildPropertyDefinitions = async (
  variants: YetimallVariant[],
  settings: YetimallImportSettings
): Promise<ImportedPropertyDefinition[]> => {
  const createMissing = settings.createMissingProperties !== false
  const propertyCount = getVariantPropertyValues(variants[0]).length
  const propertyNames = Array.from({ length: propertyCount }, (_, index) =>
    getConfiguredPropertyName(index, settings)
  )
  if (
    new Set(propertyNames.map((name) => name.toLocaleLowerCase())).size !== propertyNames.length
  ) {
    throw new Error('后台规格属性名称不能重复')
  }

  const definitions: ImportedPropertyDefinition[] = []
  for (let index = 0; index < propertyCount; index++) {
    const propertyName = propertyNames[index]
    const propertyId = await findOrCreateProperty(propertyName, createMissing)
    const valueMap = await findOrCreatePropertyValues(
      propertyId,
      variants.map((variant) => getVariantPropertyValues(variant)[index]?.value || ''),
      createMissing
    )
    definitions.push({
      propertyId,
      propertyName,
      valueMap
    })
  }
  return definitions
}

const buildSkuProperties = (
  variant: YetimallVariant,
  definitions: ImportedPropertyDefinition[]
): Property[] => {
  const variantProperties = getVariantPropertyValues(variant)
  return definitions.map((definition, index) => {
    const valueName = normalizedName(variantProperties[index]?.value)
    const valueId = definition.valueMap.get(valueName.toLocaleLowerCase())
    if (!valueId) {
      throw new Error(`规格属性映射失败：${definition.propertyName} / ${valueName}`)
    }
    return {
      propertyId: definition.propertyId,
      propertyName: definition.propertyName,
      valueId,
      valueName
    }
  })
}

const buildImportedSpu = async (
  currentForm: Spu,
  product: YetimallProduct,
  settings: YetimallImportSettings
): Promise<Spu> => {
  const propertyDefinitions = await buildPropertyDefinitions(product.variants, settings)

  const marketPriceMultiplier = asPositiveNumber(settings.marketPriceMultiplier, 1)
  const costPriceMultiplier = asPositiveNumber(settings.costPriceMultiplier, 1)
  const fixedStock = Math.floor(asPositiveNumber(settings.fixedStock, 100))
  const defaultWeight = asPositiveNumber(settings.defaultWeight, 0)
  const defaultVolume = asPositiveNumber(settings.defaultVolume, 0)
  const barcodePrefix = normalizedName(settings.barcodePrefix || 'YETI-')
  const stockMode = settings.stockMode === 'fixed' ? 'fixed' : 'source'
  const mainImageUrl = toHttps(product.mainImageUrl)

  const skus: Sku[] = product.variants.map((variant) => {
    const price = Math.max(0.01, asPositiveNumber(variant.price, 0.01))
    return {
      properties: buildSkuProperties(variant, propertyDefinitions),
      price: roundMoney(price),
      marketPrice: Math.max(0.01, roundMoney(price * marketPriceMultiplier)),
      costPrice: Math.max(0.01, roundMoney(price * costPriceMultiplier)),
      barCode: `${barcodePrefix}${variant.sourceSkuId}`,
      picUrl: toHttps(variant.imageUrl) || mainImageUrl,
      stock:
        stockMode === 'fixed'
          ? fixedStock
          : Math.floor(asPositiveNumber(variant.inventory, fixedStock)),
      weight: defaultWeight,
      volume: defaultVolume,
      firstBrokeragePrice: 0,
      secondBrokeragePrice: 0
    }
  })

  const maxSliderImages = Math.max(
    1,
    Math.min(10, Math.floor(asPositiveNumber(settings.maxSliderImages, 4)))
  )
  const detailImageUrls = Array.isArray(product.detailImageUrls) ? product.detailImageUrls : []
  const sliderPicUrls = uniqueUrls([mainImageUrl, ...detailImageUrls]).slice(0, maxSliderImages)
  const deliveryTypes =
    Array.isArray(settings.deliveryTypes) && settings.deliveryTypes.length > 0
      ? settings.deliveryTypes
      : currentForm.deliveryTypes || []

  return {
    ...currentForm,
    name: clipText(product.name, 64),
    categoryId: settings.categoryId ?? currentForm.categoryId,
    keyword: clipText(product.keyword, 64),
    picUrl: mainImageUrl,
    sliderPicUrls,
    introduction: clipText(product.introduction, 128),
    deliveryTypes,
    deliveryTemplateId: settings.deliveryTemplateId ?? currentForm.deliveryTemplateId,
    brandId: settings.brandId ?? currentForm.brandId,
    specType: propertyDefinitions.length > 0,
    subCommissionType: false,
    skus,
    description: buildDescriptionHtml(product),
    sort: Math.floor(asPositiveNumber(settings.sort, currentForm.sort || 0)),
    giveIntegral: Math.floor(
      asPositiveNumber(settings.giveIntegral, currentForm.giveIntegral || 0)
    ),
    virtualSalesCount:
      settings.importVirtualSales === false
        ? currentForm.virtualSalesCount || 0
        : Math.floor(asPositiveNumber(product.sale, 0))
  }
}

export const useYetimallProductImport = ({
  formData,
  activeName,
  loading
}: UseYetimallProductImportOptions) => {
  let importing = false

  const handleImport = async (event: Event) => {
    const detail = (event as CustomEvent<YetimallImportEventDetail>).detail
    if (!detail?.requestId) {
      return
    }
    if (importing) {
      dispatchResult({
        requestId: detail.requestId,
        ok: false,
        message: '正在处理另一个商品，请稍后重试'
      })
      return
    }

    importing = true
    loading.value = true
    try {
      validateImportPayload(detail)
      if (formData.value.id) {
        throw new Error('插件只允许填入新增商品页面')
      }
      const importedForm = await buildImportedSpu(
        formData.value,
        detail.product,
        detail.settings || {}
      )
      formData.value = importedForm
      activeName.value = 'info'
      ElMessage.success(`已填入商品信息和 ${importedForm.skus?.length || 0} 个 SKU`)
      dispatchResult({
        requestId: detail.requestId,
        ok: true,
        message: '商品信息已填入',
        skuCount: importedForm.skus?.length || 0,
        imageCount: importedForm.sliderPicUrls?.length || 0
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '商品导入失败'
      ElMessage.error(message)
      dispatchResult({
        requestId: detail.requestId,
        ok: false,
        message
      })
    } finally {
      importing = false
      loading.value = false
    }
  }

  onMounted(() => {
    window.addEventListener(YETIMALL_IMPORT_EVENT, handleImport)
    ;(window as ImportBridgeWindow).__YETIMALL_IMPORT_BRIDGE__ = {
      version: '1.1.1'
    }
  })

  onBeforeUnmount(() => {
    window.removeEventListener(YETIMALL_IMPORT_EVENT, handleImport)
    delete (window as ImportBridgeWindow).__YETIMALL_IMPORT_BRIDGE__
  })
}
