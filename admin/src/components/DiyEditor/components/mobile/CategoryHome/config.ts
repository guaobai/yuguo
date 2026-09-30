import { ComponentStyle, DiyComponent } from '@/components/DiyEditor/util'

export interface CategoryHomeBanner {
  imgUrl: string
  url: string
}

export interface CategoryHomeTab {
  categoryId?: number
  categoryName: string
  displayName: string
  icon: string
  iconUrl: string
  banners: CategoryHomeBanner[]
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

export interface CategoryHomeProperty {
  schemaVersion: number
  brand: {
    name: string
    logo: string
  }
  search: {
    show: boolean
    placeholder: string
  }
  tabs: CategoryHomeTab[]
  style?: ComponentStyle
}

export const component = {
  id: 'CategoryHome',
  name: '分类首页',
  icon: 'ep:home-filled',
  property: {
    schemaVersion: 2,
    brand: {
      name: '娱果',
      logo: ''
    },
    search: {
      show: true,
      placeholder: '搜索商品'
    },
    tabs: [],
    style: {
      bgType: 'color',
      bgColor: '#f4f6f8',
      bgImg: '',
      margin: 0,
      marginTop: 0,
      marginRight: 0,
      marginBottom: 0,
      marginLeft: 0,
      padding: 0,
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      borderRadius: 0,
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      borderBottomRightRadius: 0,
      borderBottomLeftRadius: 0
    }
  }
} as DiyComponent<CategoryHomeProperty>
