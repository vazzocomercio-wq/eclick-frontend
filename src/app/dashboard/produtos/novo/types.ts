export type WholesaleLevel = {
  id: string
  minQty: string
  price: string
}

export type Variation = {
  id: string
  type: string
  value: string
  price: string
  stock: string
  sku: string
}

export type ProductForm = {
  // Tab 1 - Basic
  photos: File[]
  photoUrls: string[]
  name: string
  sku: string
  gtin: string
  brand: string
  model: string
  condition: 'new' | 'used' | 'refurbished'
  category: string
  // Tab 2 - Description
  mlTitle: string
  description: string
  // Tab 3 - Attributes
  color: string
  lightColor: string
  voltage: string
  material: string
  power: string
  powerUnit: string
  lightingType: string
  lampType: string
  connectionType: string
  installLocation: string
  originCountry: string
  warrantyType: 'seller' | 'factory' | 'none'
  warrantyDays: string
  // Tab 4 - Variations
  hasVariations: boolean
  variations: Variation[]
  // Tab 5 - Sales & Stock
  price: string
  stock: string
  saleFormat: string
  wholesaleEnabled: boolean
  wholesaleLevels: WholesaleLevel[]
  mlListingType: 'classic' | 'premium'
  // Tab 6 - Shipping
  weightKg: string
  widthCm: string
  lengthCm: string
  heightCm: string
  mlFreeShipping: boolean
  mlFlex: boolean
  shopeeXpress: boolean
  shopeeQuickDelivery: boolean
  shopeePickup: boolean
  // Tab 7 - Fiscal
  ncm: string
  origin: string
  cfopSameState: string
  cfopOtherState: string
  csosn: string
  pisCofins: string
  cest: string
  tributesPercent: string
  recopi: string
  exTipi: string
  fci: string
  additionalInfo: string
  groupable: boolean
  // Tab 8 - Others
  mainSku: string
  publishAt: string
  anatelHomologation: string
  anatelFile: File | null
  platforms: string[]
}

export const emptyForm: ProductForm = {
  photos: [], photoUrls: [],
  name: '', sku: '', gtin: '', brand: '', model: '',
  condition: 'new', category: '',
  mlTitle: '', description: '',
  color: '', lightColor: '', voltage: '', material: '',
  power: '', powerUnit: 'W', lightingType: '', lampType: '',
  connectionType: '', installLocation: '', originCountry: 'Brasil',
  warrantyType: 'seller', warrantyDays: '90',
  hasVariations: false, variations: [],
  price: '', stock: '', saleFormat: 'unit',
  wholesaleEnabled: false, wholesaleLevels: [],
  mlListingType: 'classic',
  weightKg: '', widthCm: '', lengthCm: '', heightCm: '',
  mlFreeShipping: false, mlFlex: false,
  shopeeXpress: false, shopeeQuickDelivery: false, shopeePickup: false,
  ncm: '', origin: '0', cfopSameState: '', cfopOtherState: '',
  csosn: '', pisCofins: '', cest: '', tributesPercent: '',
  recopi: '', exTipi: '', fci: '', additionalInfo: '', groupable: false,
  mainSku: '', publishAt: '', anatelHomologation: '', anatelFile: null,
  platforms: ['mercadolivre', 'shopee'],
}

export type TabProps = {
  data: ProductForm
  set: <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => void
}
