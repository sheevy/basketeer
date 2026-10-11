/**
 * GraphQL operation strings for `xapi.tesco.com`, ported from observed traffic.
 * Internal — not part of the public API. Config/constants live in operations.ts.
 */

// Shelf taxonomy: super-department › department › aisle › shelf. Ids are opaque facets.
const TAXONOMY_FIELDS =
  "superDepartmentName departmentId departmentName aisleId aisleName shelfId shelfName";

const PRODUCT_FIELDS = `
  tpnb tpnc title brandName defaultImageUrl isForSale
  productType averageWeight minWeight maxWeight increment bulkBuyLimit
  catchWeightList { price weight default }
  ${TAXONOMY_FIELDS}
  price { actual unitPrice unitOfMeasure }
  promotions {
    description
    startDate
    endDate
    attributes
    price { afterDiscount beforeDiscount }
  }
  details {
    packSize { value units }
    nutrition { name value1 value2 value3 }
    ingredients
  }
`.trim();

export const GET_PRODUCT = `
query GetProduct($tpnc: String!) {
  product(tpnc: $tpnc) {
    ${PRODUCT_FIELDS}
  }
}`.trim();

/** Build one aliased GraphQL operation so a product set costs one HTTP request. */
export function getProductsQuery(count: number): string {
  const variables = Array.from({ length: count }, (_, i) => `$tpnc${i}: String!`).join(", ");
  const products = Array.from(
    { length: count },
    (_, i) => `p${i}: product(tpnc: $tpnc${i}) { ${PRODUCT_FIELDS} }`,
  ).join("\n  ");
  return `query GetProducts(${variables}) {\n  ${products}\n}`;
}

export const SEARCH = `
query Search($query: String!, $page: Int = 1, $count: Int) {
  search(query: $query, page: $page, count: $count) {
    results {
      node {
        __typename
        ... on ProductInterface {
          tpnc tpnb title brandName defaultImageUrl isForSale
          productType averageWeight minWeight maxWeight increment bulkBuyLimit
          catchWeightList { price weight default }
          ${TAXONOMY_FIELDS}
          sellers {
            results {
              price { actual unitPrice unitOfMeasure }
              promotions {
                description
                startDate
                endDate
                attributes
                price { afterDiscount beforeDiscount }
              }
            }
          }
        }
      }
    }
  }
}`.trim();

export const GET_CATEGORY_PRODUCTS = `
query GetCategoryProducts($facet: ID, $page: Int = 1, $count: Int) {
  category(facet: $facet, page: $page, count: $count) {
    results {
      node {
        __typename
        ... on ProductInterface {
          tpnc tpnb title brandName defaultImageUrl isForSale
          productType averageWeight minWeight maxWeight increment bulkBuyLimit
          catchWeightList { price weight default }
          ${TAXONOMY_FIELDS}
          sellers {
            results {
              price { actual unitPrice unitOfMeasure }
              promotions { description startDate endDate attributes price { afterDiscount beforeDiscount } }
            }
          }
        }
      }
    }
  }
}`.trim();

export const GET_FAVOURITES = `
query GetFavourites($page: Int = 1, $count: Int, $sortBy: String) {
  favourites(page: $page, count: $count, sortBy: $sortBy) {
    products {
      __typename
      ... on ProductInterface {
        tpnc tpnb title brandName defaultImageUrl isForSale
        productType averageWeight minWeight maxWeight increment bulkBuyLimit
        catchWeightList { price weight default }
        ${TAXONOMY_FIELDS}
        sellers {
          results {
            price { actual unitPrice unitOfMeasure }
            promotions { description startDate endDate attributes price { afterDiscount beforeDiscount } }
          }
        }
      }
    }
  }
}`.trim();

export const GET_BASKET = `
query GetBasket {
  basket {
    id
    guidePrice
    isInAmend
    amendExpiry
    shoppingMethod
    items {
      __typename
      id
      unit
      weight
      cost
      quantity
      product { id __typename isForSale }
    }
  }
}`.trim();

// Selects the same fields as GET_BASKET so the Basket returned from a write has
// full fidelity (guidePrice / isInAmend / amendExpiry / unit / weight), not a
// partial object.
export const UPDATE_BASKET = `
mutation UpdateBasket($items: [BasketLineItemInputType], $orderId: ID) {
  basket(items: $items, orderId: $orderId) {
    id
    guidePrice
    isInAmend
    amendExpiry
    shoppingMethod
    items {
      __typename
      id
      unit
      weight
      cost
      quantity
      product { id __typename isForSale }
    }
    updates {
      items { id successful __typename }
    }
  }
}`.trim();

// ---- orders ----------------------------------------------------------------

// `cost` is the line total charged, not a unit price.
const ORDER_LINE_FIELDS = "id quantity unit weight cost product { id title }";

const ORDER_SUMMARY_FIELDS = `
      id
      orderNo
      status
      createdDateTime
      totalPrice
      totalItems
      isInAmend
      amendExpiryTime
      shoppingMethod
      paymentMode
      slot { id start end charge }
      address { name city addressLine1 postcode }`;

const ORDER_FIELDS = `${ORDER_SUMMARY_FIELDS}
      items { ${ORDER_LINE_FIELDS} }`;

export const GET_UPCOMING_ORDERS = `
query GetUpcomingOrders($orderContexts: [OrderContextType]) {
  orderSearch(orderContexts: $orderContexts) {
    orders {${ORDER_FIELDS}
    }
  }
}`.trim();

// Offset pagination over a LIVE, newest-first result set. Tesco's orderSearch
// exposes only count/offset — no cursor, total, or page metadata — so terminal
// state is inferred from a short page. The schema accepts `page` but ignores
// it; never send it.
export const GET_ORDER_HISTORY = `
query GetOrderHistory($orderContexts: [OrderContextType], $count: Int, $offset: Int) {
  orderSearch(orderContexts: $orderContexts, count: $count, offset: $offset) {
    orders {${ORDER_FIELDS}
    }
  }
}`.trim();

// One unified mutation drives the order lifecycle: action ∈ AMEND | CANCEL | CANCEL_AMEND.
export const AMEND_ORDER = `
mutation AmendOrder($orderNo: ID!) {
  order(orderNo: $orderNo, action: AMEND) { id orderNo }
}`.trim();

export const CANCEL_ORDER = `
mutation CancelOrder($orderNo: ID!) {
  order(orderNo: $orderNo, action: CANCEL) { id }
}`.trim();

export const CANCEL_AMEND = `
mutation CancelAmend($orderNo: ID!) {
  order(orderNo: $orderNo, action: CANCEL_AMEND) { id orderNo }
  basket { id isInAmend amendExpiry }
}`.trim();

// Last delivered order — the source for "reorder my usual shop".
export const GET_LAST_FULFILLED_ORDER = `
query GetLastFulfilledOrder($status: OrderStatusInputType) {
  order(status: $status) {
    orderNo
    items { ${ORDER_LINE_FIELDS} }
  }
}`.trim();

// One order by id, with its lines grouped into `splitView` splits (one per
// fulfilment) — the view Tesco's receipt page renders.
export const GET_ORDER_RECEIPT = `
query GetOrderReceipt($orderId: ID!) {
  order(orderId: $orderId) {${ORDER_SUMMARY_FIELDS}
      splitView { items { ${ORDER_LINE_FIELDS} } }
  }
}`.trim();

// ---- slots -----------------------------------------------------------------

export const DELIVERY_SLOTS = `
query DeliverySlots($start: String, $end: String, $group: Int, $type: FulfilmentTypeType) {
  delivery(start: $start, end: $end, group: $group) {
    ...Slot
    __typename
  }
  fulfilment(type: $type, range: {start: $start, end: $end}) {
    ...Fulfilment
    __typename
  }
}

fragment Slot on SlotInterface {
  id
  start
  end
  charge
  status
  group
  price {
    beforeDiscount
    afterDiscount
    __typename
  }
  locationUuid
  __typename
}

fragment Fulfilment on FulfilmentType {
  fulfilmentLocation {
    locationUuid
    __typename
  }
  metadata {
    preBookedOrderDays
    __typename
  }
  __typename
}`.trim();

export const COLLECTION_SLOTS = `
query CollectionSlots($start: String, $end: String, $locationUuid: ID) {
  collection(start: $start, end: $end, locationUuid: $locationUuid) {
    id start end charge status group locationUuid
    price { beforeDiscount afterDiscount }
  }
}`.trim();

// Reserve (action "BOOK") or release (action "UNBOOK") a slot by its id.
// `action` mirrors the server's `SlotActions` enum.
export const FULFILMENT = `
mutation Fulfilment($slotId: ID, $action: SlotActions) {
  fulfilment(slotId: $slotId, action: $action) {
    slot {
      id
      status
      start
      end
      reservationExpiry
      group
      locationUuid
      __typename
    }
    __typename
  }
}`.trim();
