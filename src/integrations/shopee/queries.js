export const PRODUCT_OFFERS_QUERY = `
  query ProductOffers($keyword: String, $listType: Int, $sortType: Int, $page: Int, $limit: Int) {
    productOfferV2(
      keyword: $keyword
      listType: $listType
      sortType: $sortType
      page: $page
      limit: $limit
    ) {
      nodes {
        itemId
        productName
        productLink
        offerLink
        imageUrl
        priceMin
        priceMax
        priceDiscountRate
        sales
        ratingStar
        commissionRate
        sellerCommissionRate
        shopeeCommissionRate
        commission
        shopId
        shopName
        shopType
        periodStartTime
        periodEndTime
      }
      pageInfo {
        page
        limit
        hasNextPage
      }
    }
  }
`;

export const SHOP_OFFERS_QUERY = `
  query ShopOffers($keyword: String, $sortType: Int, $page: Int, $limit: Int) {
    shopOfferV2(keyword: $keyword, sortType: $sortType, page: $page, limit: $limit) {
      nodes {
        shopId
        shopName
        commissionRate
        ratingStar
        shopType
        imageUrl
        offerLink
        originalLink
        remainingBudget
        sellerCommCoveRatio
        periodStartTime
        periodEndTime
      }
      pageInfo {
        page
        limit
        hasNextPage
      }
    }
  }
`;

export const CAMPAIGN_OFFERS_QUERY = `
  query CampaignOffers($keyword: String, $sortType: Int, $page: Int, $limit: Int) {
    shopeeOfferV2(keyword: $keyword, sortType: $sortType, page: $page, limit: $limit) {
      nodes {
        commissionRate
        imageUrl
        offerLink
        originalLink
        offerName
        offerType
        categoryId
        collectionId
        periodStartTime
        periodEndTime
      }
      pageInfo {
        page
        limit
        hasNextPage
      }
    }
  }
`;
