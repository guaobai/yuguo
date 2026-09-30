const SOURCE_HOST = 'm.yetimall.store'
const IMAGE_SOURCE_ATTRIBUTES = ['src', 'data-src', 'data-original', 'data-lazy-src']

const toHttps = (value) => {
  const url = String(value || '').trim()
  if (url.startsWith('//')) {
    return `https:${url}`
  }
  return url.replace(/^http:\/\//i, 'https://')
}

const getImageSource = (image) => {
  for (const attribute of IMAGE_SOURCE_ATTRIBUTES) {
    const source = toHttps(image.getAttribute(attribute))
    if (source) {
      return source
    }
  }
  return ''
}

const isHttpUrl = (value) => {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

const clipText = (value, maxLength) =>
  Array.from(String(value || '').trim())
    .slice(0, maxLength)
    .join('')

const unique = (values) => Array.from(new Set(values.filter(Boolean)))

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

const textFromHtml = (html) => {
  const documentNode = new DOMParser().parseFromString(String(html || ''), 'text/html')
  return documentNode.body.textContent?.replace(/\s+/g, ' ').trim() || ''
}

const createImageParagraph = (documentNode, image) => {
  const paragraph = documentNode.createElement('p')
  paragraph.setAttribute('style', 'text-align:center;')
  paragraph.append(image)
  return paragraph
}

const normalizeDescriptionImages = (documentNode) => {
  const topLevelElements = []
  const seen = new Set()

  documentNode.querySelectorAll('img').forEach((image) => {
    let topLevel = image
    while (topLevel.parentElement && topLevel.parentElement !== documentNode.body) {
      topLevel = topLevel.parentElement
    }
    if (!seen.has(topLevel)) {
      seen.add(topLevel)
      topLevelElements.push(topLevel)
    }
  })

  topLevelElements.forEach((topLevel) => {
    if (topLevel.tagName === 'IMG') {
      const paragraph = documentNode.createElement('p')
      paragraph.setAttribute('style', 'text-align:center;')
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

    const hasText = Boolean(topLevel.textContent?.trim())
    if (hasText) {
      topLevel.after(fragment)
    } else {
      topLevel.replaceWith(fragment)
    }
  })
}

const cleanDescriptionHtml = (html) => {
  const documentNode = new DOMParser().parseFromString(String(html || ''), 'text/html')
  documentNode
    .querySelectorAll('script, style, iframe, object, embed, form, input, button')
    .forEach((node) => node.remove())

  documentNode.querySelectorAll('img').forEach((image) => {
    const source = getImageSource(image)
    if (
      source.includes('/images/public/goods_top_img.png') ||
      source.includes('/images/goods/config/goods_pub_content_img.png')
    ) {
      image.remove()
      return
    }
    if (!isHttpUrl(source)) {
      image.remove()
      return
    }
    image.setAttribute('src', source)
    image.setAttribute('style', 'max-width:100%;height:auto;')
    for (const attribute of Array.from(image.attributes)) {
      const name = attribute.name.toLowerCase()
      if (name.startsWith('on') || (IMAGE_SOURCE_ATTRIBUTES.includes(name) && name !== 'src')) {
        image.removeAttribute(attribute.name)
      }
    }
  })

  documentNode.querySelectorAll('*').forEach((node) => {
    for (const attribute of Array.from(node.attributes)) {
      const name = attribute.name.toLowerCase()
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
  normalizeDescriptionImages(documentNode)
  documentNode.querySelectorAll('p').forEach((paragraph) => {
    if (!paragraph.textContent?.trim() && !paragraph.querySelector('img')) {
      paragraph.remove()
    }
  })
  return documentNode.body.innerHTML
}

const extractDetailImageUrls = (html) => {
  const documentNode = new DOMParser().parseFromString(String(html || ''), 'text/html')
  return unique(
    Array.from(documentNode.images)
      .map(getImageSource)
      .filter((url) => url.includes('/images/base_up/'))
  )
}

const buildKeyword = (data) =>
  clipText(
    unique([data.tag_str, data.sub_station_tag, data.goods_type_name, 'YETIMALL']).join(','),
    64
  )

const buildIntroduction = (data, cleanName) => {
  const schedule = String(data.presale_expected_outbound || '').replace(/\s*\n\s*/g, '；')
  return clipText([data.tag_str, cleanName, schedule].filter(Boolean).join('｜'), 128)
}

const buildDescription = (data) => {
  const noticeItems = unique([
    ...(Array.isArray(data.presale_expected_outbound_tiplist)
      ? data.presale_expected_outbound_tiplist
      : []),
    ...(Array.isArray(data.commitment) ? data.commitment : [])
  ])
  const schedule = String(data.presale_expected_outbound || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const noticeHtml =
    schedule.length || noticeItems.length
      ? `<section><h3>预售信息</h3>${schedule
          .map((line) => `<p>${escapeHtml(line)}</p>`)
          .join('')}<ul>${noticeItems
          .map((item) => `<li>${escapeHtml(item)}</li>`)
          .join('')}</ul></section>`
      : ''
  return `${noticeHtml}${cleanDescriptionHtml(data.detail_desc)}`
}

const normalizeVariant = (variant) => {
  const sourceProperties =
    Array.isArray(variant.propertyListN) && variant.propertyListN.length > 0
      ? variant.propertyListN
      : Array.isArray(variant.propertyList)
        ? variant.propertyList
        : []
  const properties = sourceProperties
    .map((property, index) => ({
      sourceName: String(property.name || '').trim(),
      value: String(property.value || '').trim(),
      position: index
    }))
    .filter((property) => property.value)
  const sourceSkuId = Number(variant.id)
  const price = Number(variant.price)
  if (!Number.isFinite(sourceSkuId) || !Number.isFinite(price) || price <= 0) {
    return null
  }
  return {
    sourceSkuId,
    properties,
    price,
    inventory: Number(variant.inventory),
    imageUrl: toHttps(variant.img_url || variant.img_thumb)
  }
}

const buildPropertyGroups = (variants) => {
  const propertyCount = Math.max(0, ...variants.map((variant) => variant.properties.length))
  return Array.from({ length: propertyCount }, (_, index) => {
    const sourceName =
      variants
        .map((variant) => variant.properties[index]?.sourceName)
        .find((name) => String(name || '').trim()) || ''
    return {
      position: index,
      sourceName,
      values: unique(variants.map((variant) => variant.properties[index]?.value))
    }
  })
}

export const parseYetimallProductId = (sourceUrl) => {
  const parsed = new URL(String(sourceUrl || '').trim())
  if (parsed.hostname !== SOURCE_HOST) {
    throw new Error('请输入 m.yetimall.store 的商品详情链接')
  }
  const hashQuery = parsed.hash.includes('?') ? parsed.hash.slice(parsed.hash.indexOf('?') + 1) : ''
  const id = new URLSearchParams(hashQuery).get('gid') || parsed.searchParams.get('gid')
  if (!id || !/^\d+$/.test(id)) {
    throw new Error('商品链接中缺少有效的 gid')
  }
  return Number(id)
}

export const fetchYetimallProduct = async (sourceUrl) => {
  const productId = parseYetimallProductId(sourceUrl)
  const apiUrl = `https://m.yetimall.store/public/home/WxStore/getGoodsInfo?id=${productId}&userId=0`
  const response = await fetch(apiUrl, {
    method: 'GET',
    credentials: 'omit',
    cache: 'no-store'
  })
  if (!response.ok) {
    throw new Error(`商品接口请求失败：HTTP ${response.status}`)
  }
  const result = await response.json()
  if (Number(result.errorCode) !== 0 || !result.data) {
    throw new Error(result.errorInfo || '商品接口返回异常')
  }

  const data = result.data
  const variants = (Array.isArray(data.propertyList) ? data.propertyList : [])
    .map(normalizeVariant)
    .filter(Boolean)
  if (variants.length === 0) {
    throw new Error('未提取到商品规格')
  }

  const cleanName = String(data.name || '')
    .replace(/^【[^】]+】\s*/, '')
    .trim()
  const detailImageUrls = extractDetailImageUrls(data.detail_desc)
  const propertyGroups = buildPropertyGroups(variants)
  const productTypes = propertyGroups[1]?.values || propertyGroups[0]?.values || ['默认规格']
  const prices = variants.map((variant) => variant.price).filter(Number.isFinite)

  return {
    sourceUrl,
    sourceApiUrl: apiUrl,
    sourceProductId: Number(data.id),
    name: clipText(cleanName || data.name, 64),
    originalName: String(data.name || ''),
    keyword: buildKeyword(data),
    introduction: buildIntroduction(data, cleanName),
    descriptionHtml: buildDescription(data),
    descriptionText: textFromHtml(data.detail_desc),
    mainImageUrl: toHttps(data.img_url || data.thumb),
    detailImageUrls,
    tag: String(data.tag_str || ''),
    sale: Number(data.sale || 0),
    totalInventory: Number(data.inventory || 0),
    schedule: String(data.presale_expected_outbound || ''),
    propertyGroups,
    productTypes,
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    variants,
    extractedAt: new Date().toISOString()
  }
}
