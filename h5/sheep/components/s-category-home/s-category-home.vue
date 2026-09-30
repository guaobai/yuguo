<template>
  <view class="category-home">
    <view class="home-header" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="brand-row">
        <image
          v-if="data.brand?.logo"
          class="brand-logo"
          :src="sheep.$url.cdn(data.brand.logo)"
          mode="aspectFit"
        />
        <text class="brand-name">{{ data.brand?.name || '娱果' }}</text>
      </view>
      <view v-if="data.search?.show !== false" class="search-box" @tap="openSearch">
        <text class="search-placeholder">{{ data.search?.placeholder || '搜索商品' }}</text>
        <text class="search-action">搜索</text>
      </view>
    </view>

    <scroll-view v-if="tabs.length" class="category-tabs" scroll-x :show-scrollbar="false">
      <view class="category-tabs-inner">
        <view
          v-for="(tab, index) in tabs"
          :key="tab.categoryId || index"
          class="category-tab"
          :class="{ active: state.activeIndex === index }"
          @tap="changeTab(index)"
        >
          <image
            v-if="tab.iconUrl"
            class="category-tab-image"
            :src="sheep.$url.cdn(tab.iconUrl)"
            mode="aspectFit"
          />
          <text v-else-if="tab.icon" class="category-tab-icon">{{ tab.icon }}</text>
          <text>{{ tab.displayName || tab.categoryName || '未命名分类' }}</text>
        </view>
      </view>
    </scroll-view>

    <template v-if="currentTab">
      <swiper
        v-if="currentBanners.length"
        class="banner-swiper"
        circular
        :autoplay="currentBanners.length > 1"
        :indicator-dots="currentBanners.length > 1"
        indicator-color="rgba(255,255,255,.55)"
        indicator-active-color="#17b8aa"
      >
        <swiper-item v-for="(banner, index) in currentBanners" :key="index">
          <image
            class="banner-image"
            :src="sheep.$url.cdn(banner.imgUrl)"
            mode="aspectFill"
            @tap="openBanner(banner)"
          />
        </swiper-item>
      </swiper>

      <view v-if="currentTab.hot?.enabled !== false" class="hot-section">
        <view class="section-title-row">
          <text class="section-title">热榜</text>
          <text class="hot-mark">HOT</text>
        </view>
        <scroll-view v-if="currentCache.hotList.length" class="hot-scroll" scroll-x>
          <view class="hot-list">
            <view
              v-for="(item, index) in currentCache.hotList"
              :key="item.id"
              class="hot-card"
              @tap="openGoods(item.id)"
            >
              <view class="rank-badge" :class="'rank-' + (index + 1)">{{ index + 1 }}</view>
              <image class="hot-image" :src="sheep.$url.cdn(item.picUrl)" mode="aspectFill" />
              <view class="hot-info">
                <text class="hot-name">{{ item.name }}</text>
                <text class="hot-price">￥{{ fen2yuan(item.price) }}</text>
              </view>
            </view>
          </view>
        </scroll-view>
        <view v-else-if="currentCache.hotLoading" class="section-placeholder">热榜加载中</view>
        <view v-else class="section-placeholder">暂无热榜商品</view>
      </view>

      <view class="product-section">
        <view v-if="currentCache.products.length" class="product-grid">
          <view
            v-for="item in currentCache.products"
            :key="item.id"
            class="product-card"
            @tap="openGoods(item.id)"
          >
            <image class="product-image" :src="sheep.$url.cdn(item.picUrl)" mode="aspectFill" />
            <view class="product-info">
              <text class="product-name">{{ item.name }}</text>
              <view class="product-meta">
                <text class="product-price">￥{{ fen2yuan(item.price) }}</text>
                <text class="product-sales">已售 {{ item.salesCount || 0 }}</text>
              </view>
            </view>
          </view>
        </view>
        <view v-else-if="currentCache.productLoading" class="section-placeholder product-empty">
          商品加载中
        </view>
        <view v-else class="section-placeholder product-empty">暂无商品</view>
        <uni-load-more
          v-if="currentCache.products.length && currentTab.products?.mode !== 'manual'"
          :status="currentCache.loadStatus"
          :content-text="loadMoreText"
        />
      </view>
    </template>

    <view v-else class="no-category">请先在后台配置首页商品分类</view>
  </view>
</template>

<script setup>
  import { computed, onMounted, reactive, watch } from 'vue';
  import sheep from '@/sheep';
  import SpuApi from '@/sheep/api/product/spu';
  import { fen2yuan } from '@/sheep/hooks/useGoods';

  const props = defineProps({
    data: {
      type: Object,
      default: () => ({}),
    },
  });

  const statusBarHeight = sheep.$platform.device.statusBarHeight || 0;
  const state = reactive({
    activeIndex: 0,
    caches: {},
  });
  const loadMoreText = {
    contentdown: '上拉加载更多',
    contentrefresh: '正在加载',
    contentnomore: '没有更多了',
  };

  const tabs = computed(() => (Array.isArray(props.data.tabs) ? props.data.tabs : []));
  const currentTab = computed(() => tabs.value[state.activeIndex]);
  const currentBanners = computed(() =>
    (currentTab.value?.banners || []).filter((item) => item?.imgUrl),
  );

  function createCache() {
    return {
      hotList: [],
      hotLoaded: false,
      hotLoading: false,
      products: [],
      productLoaded: false,
      productLoading: false,
      pageNo: 1,
      total: 0,
      loadStatus: 'more',
    };
  }

  const fallbackCache = createCache();
  const currentCache = computed(() => state.caches[state.activeIndex] || fallbackCache);

  function getCache(index) {
    if (!state.caches[index]) {
      state.caches[index] = createCache();
    }
    return state.caches[index];
  }

  function normalizeIds(ids) {
    return Array.from(new Set((Array.isArray(ids) ? ids : []).filter(Boolean)));
  }

  function restoreConfiguredOrder(list, ids) {
    const productMap = new Map((list || []).map((item) => [String(item.id), item]));
    return ids.map((id) => productMap.get(String(id))).filter(Boolean);
  }

  async function getProductsByIds(ids) {
    if (!ids.length) {
      return [];
    }
    const response = await SpuApi.getSpuListByIds(ids.join(','));
    if (response.code !== 0) {
      return [];
    }
    return restoreConfiguredOrder(response.data, ids);
  }

  async function loadHot(tab, cache) {
    if (tab.hot?.enabled === false) {
      cache.hotList = [];
      cache.hotLoaded = true;
      return;
    }
    if (cache.hotLoaded || cache.hotLoading) {
      return;
    }
    cache.hotLoading = true;
    try {
      const limit = Math.max(1, Math.min(Number(tab.hot?.limit) || 10, 50));
      const manualIds = normalizeIds(tab.hot?.spuIds).slice(0, limit);
      const manualProducts = await getProductsByIds(manualIds);
      const remaining = limit - manualProducts.length;
      let autoProducts = [];
      if (remaining > 0) {
        const response = await SpuApi.getSpuPage({
          categoryId: tab.categoryId,
          pageNo: 1,
          pageSize: Math.min(limit + manualIds.length, 100),
          sortField: 'salesCount',
          sortAsc: false,
        });
        if (response.code === 0) {
          const manualIdSet = new Set(manualProducts.map((item) => String(item.id)));
          autoProducts = (response.data?.list || [])
            .filter((item) => !manualIdSet.has(String(item.id)))
            .slice(0, remaining);
        }
      }
      cache.hotList = manualProducts.concat(autoProducts);
      cache.hotLoaded = true;
    } catch (error) {
      cache.hotList = [];
      cache.hotLoaded = true;
    } finally {
      cache.hotLoading = false;
    }
  }

  async function loadProducts(tab, cache, nextPageNo = 1) {
    if (cache.productLoading || (cache.productLoaded && cache.loadStatus === 'noMore')) {
      return;
    }
    cache.productLoading = true;
    cache.loadStatus = 'loading';
    try {
      if (tab.products?.mode === 'manual') {
        const ids = normalizeIds(tab.products?.spuIds);
        cache.products = await getProductsByIds(ids);
        cache.total = cache.products.length;
        cache.productLoaded = true;
        cache.loadStatus = 'noMore';
        return;
      }
      const pageSize = Math.max(2, Math.min(Number(tab.products?.pageSize) || 10, 50));
      const response = await SpuApi.getSpuPage({
        categoryId: tab.categoryId,
        pageNo: nextPageNo,
        pageSize,
      });
      if (response.code !== 0) {
        cache.loadStatus = 'more';
        return;
      }
      const newProducts = response.data?.list || [];
      const productMap = new Map(cache.products.map((item) => [String(item.id), item]));
      newProducts.forEach((item) => productMap.set(String(item.id), item));
      cache.products = Array.from(productMap.values());
      cache.pageNo = nextPageNo;
      cache.total = response.data?.total || 0;
      cache.productLoaded = true;
      cache.loadStatus = cache.products.length < cache.total ? 'more' : 'noMore';
    } catch (error) {
      cache.loadStatus = cache.products.length ? 'more' : 'noMore';
    } finally {
      cache.productLoading = false;
    }
  }

  async function loadTab(index) {
    const tab = tabs.value[index];
    if (!tab) {
      return;
    }
    const cache = getCache(index);
    await Promise.all([loadHot(tab, cache), loadProducts(tab, cache)]);
  }

  function changeTab(index) {
    if (state.activeIndex === index) {
      return;
    }
    state.activeIndex = index;
    loadTab(index);
  }

  function openSearch() {
    sheep.$router.go('/pages/index/search');
  }

  function openBanner(banner) {
    if (banner.url) {
      sheep.$router.go(banner.url);
    }
  }

  function openGoods(id) {
    sheep.$router.go('/pages/goods/index', { id });
  }

  function loadMore() {
    const tab = currentTab.value;
    const cache = getCache(state.activeIndex);
    if (
      !tab ||
      tab.products?.mode === 'manual' ||
      cache.productLoading ||
      cache.loadStatus !== 'more'
    ) {
      return;
    }
    loadProducts(tab, cache, cache.pageNo + 1);
  }

  defineExpose({
    loadMore,
  });

  onMounted(() => {
    loadTab(state.activeIndex);
  });

  watch(
    () => props.data,
    () => {
      state.activeIndex = 0;
      state.caches = {};
      loadTab(0);
    },
    { deep: true },
  );
</script>

<style lang="scss" scoped>
  .category-home {
    min-height: 100vh;
    color: #1f2329;
    background: #f4f6f8;
  }

  .home-header {
    padding-right: 24rpx;
    padding-left: 24rpx;
    padding-bottom: 20rpx;
    background: #ffffff;
    box-sizing: border-box;
  }

  .brand-row {
    height: 88rpx;
    display: flex;
    align-items: center;
  }

  .brand-logo {
    width: 56rpx;
    height: 56rpx;
    margin-right: 12rpx;
    flex-shrink: 0;
  }

  .brand-name {
    font-size: 42rpx;
    line-height: 1;
    font-weight: 700;
    color: #101214;
  }

  .search-box {
    height: 68rpx;
    padding: 0 18rpx;
    border: 2rpx solid #dfe3e8;
    border-radius: 8rpx;
    display: flex;
    align-items: center;
    background: #ffffff;
    box-sizing: border-box;
  }

  .search-placeholder {
    min-width: 0;
    flex: 1;
    font-size: 27rpx;
    color: #9298a1;
  }

  .search-action {
    margin-left: 16rpx;
    font-size: 27rpx;
    color: #25282d;
  }

  .category-tabs {
    width: 100%;
    height: 88rpx;
    white-space: nowrap;
    background: #ffffff;
  }

  .category-tabs-inner {
    height: 88rpx;
    padding: 0 16rpx;
    display: inline-flex;
    align-items: stretch;
    box-sizing: border-box;
  }

  .category-tab {
    position: relative;
    height: 88rpx;
    padding: 0 24rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 27rpx;
    color: #515760;
    box-sizing: border-box;
  }

  .category-tab-image {
    width: 34rpx;
    height: 34rpx;
    margin-right: 6rpx;
    flex-shrink: 0;
  }

  .category-tab-icon {
    margin-right: 6rpx;
    line-height: 1;
  }

  .category-tab.active {
    font-weight: 600;
    color: #12a99c;
  }

  .category-tab.active::after {
    position: absolute;
    right: 24rpx;
    bottom: 0;
    left: 24rpx;
    height: 5rpx;
    border-radius: 3rpx;
    background: #19b8aa;
    content: '';
  }

  .banner-swiper {
    width: 750rpx;
    height: 750rpx;
    background: #eaedf0;
  }

  .banner-image {
    width: 750rpx;
    height: 750rpx;
  }

  .hot-section,
  .product-section {
    background: #ffffff;
  }

  .hot-section {
    padding: 24rpx 0 28rpx;
  }

  .section-title-row {
    height: 52rpx;
    padding: 0 24rpx;
    display: flex;
    align-items: center;
    box-sizing: border-box;
  }

  .section-title {
    max-width: 540rpx;
    overflow: hidden;
    font-size: 32rpx;
    font-weight: 700;
    color: #20242a;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .hot-mark {
    margin-left: 10rpx;
    padding: 2rpx 8rpx;
    border-radius: 4rpx;
    font-size: 20rpx;
    font-weight: 700;
    font-style: italic;
    color: #ffffff;
    background: #17b8aa;
  }

  .hot-scroll {
    width: 100%;
    margin-top: 16rpx;
    white-space: nowrap;
  }

  .hot-list {
    padding: 0 24rpx;
    display: inline-flex;
    box-sizing: border-box;
  }

  .hot-card {
    position: relative;
    width: 220rpx;
    margin-right: 16rpx;
    overflow: hidden;
    border: 1rpx solid #ebedf0;
    border-radius: 6rpx;
    background: #ffffff;
    box-sizing: border-box;
  }

  .hot-card:last-child {
    margin-right: 0;
  }

  .rank-badge {
    position: absolute;
    top: 8rpx;
    left: 8rpx;
    z-index: 2;
    min-width: 38rpx;
    height: 38rpx;
    padding: 0 8rpx;
    border-radius: 4rpx;
    font-size: 22rpx;
    line-height: 38rpx;
    text-align: center;
    color: #ffffff;
    background: #69717d;
    box-sizing: border-box;
  }

  .rank-1 {
    background: #ef4f4f;
  }

  .rank-2 {
    background: #ee8b32;
  }

  .rank-3 {
    background: #d3a13a;
  }

  .hot-image {
    width: 218rpx;
    height: 218rpx;
    background: #f1f3f5;
  }

  .hot-info {
    padding: 12rpx;
    display: flex;
    flex-direction: column;
  }

  .hot-name {
    height: 68rpx;
    overflow: hidden;
    font-size: 25rpx;
    line-height: 34rpx;
    color: #333840;
    white-space: normal;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  .hot-price {
    margin-top: 8rpx;
    font-size: 27rpx;
    font-weight: 600;
    color: #e23b3b;
  }

  .product-section {
    margin-top: 16rpx;
    padding: 24rpx 20rpx 28rpx;
  }

  .product-grid {
    display: flex;
    flex-wrap: wrap;
  }

  .product-card {
    min-width: 0;
    width: calc((100% - 18rpx) / 2);
    margin-bottom: 18rpx;
    overflow: hidden;
    border: 1rpx solid #eaedf0;
    border-radius: 6rpx;
    background: #ffffff;
    box-sizing: border-box;
  }

  .product-card:nth-child(2n + 1) {
    margin-right: 18rpx;
  }

  .product-image {
    width: 100%;
    height: 340rpx;
    background: #f1f3f5;
  }

  .product-info {
    padding: 16rpx;
  }

  .product-name {
    height: 76rpx;
    overflow: hidden;
    font-size: 27rpx;
    line-height: 38rpx;
    color: #2b3037;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  .product-meta {
    min-width: 0;
    margin-top: 14rpx;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
  }

  .product-price {
    min-width: 0;
    overflow: hidden;
    flex: 1;
    font-size: 30rpx;
    font-weight: 700;
    color: #e43f3f;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .product-sales {
    margin-left: 8rpx;
    flex-shrink: 0;
    font-size: 21rpx;
    color: #969ca5;
  }

  .section-placeholder,
  .no-category {
    height: 180rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 26rpx;
    color: #9298a1;
  }

  .product-empty {
    height: 260rpx;
  }

  .no-category {
    min-height: 520rpx;
    background: #ffffff;
  }
</style>
