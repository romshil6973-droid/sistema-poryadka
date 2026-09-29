// Проверяет catalog/products.json перед публикацией: обязательные поля, уникальные id, картинки на месте.
// Запуск: node scripts/check-catalog.mjs
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const { products } = JSON.parse(readFileSync(join(root, 'catalog', 'products.json'), 'utf8'))

const errors = []
const ids = new Set()
let featured = 0

for (const [index, product] of products.entries()) {
  const name = product.name || product.id || `№${index + 1}`
  const fail = (text) => errors.push(`«${name}»: ${text}`)

  for (const key of ['id', 'name', 'kind', 'price', 'status', 'tagline']) {
    if (!product[key]) fail(`нет поля ${key}`)
  }
  if (product.id && !/^[a-z0-9-]+$/.test(product.id)) fail('id — только латиница в нижнем регистре, цифры и дефис')
  if (ids.has(product.id)) fail(`id «${product.id}» уже занят`)
  ids.add(product.id)
  if (!['free', 'paid'].includes(product.kind)) fail('kind должен быть free или paid')
  if (!['available', 'soon'].includes(product.status)) fail('status должен быть available или soon')
  if (!product.action?.label) fail('нет action.label (текст кнопки)')
  if (product.status === 'available' && !product.action?.href) fail('доступный продукт без action.href (куда ведёт кнопка)')
  if (product.image && !existsSync(join(root, product.image))) fail(`нет файла картинки ${product.image}`)
  if (product.image && !product.imageAlt) fail('у картинки нет imageAlt (описания)')
  if (Array.isArray(product.features) && product.features.length > 4) fail('больше 4 пунктов в features — карточка раздуется')
  if (product.featured) featured += 1
}
if (featured > 1) errors.push(`featured: true стоит у ${featured} продуктов — крупно показывается только первый`)

if (errors.length) {
  console.error(`Каталог: ${errors.length} ошибок\n- ${errors.join('\n- ')}`)
  process.exit(1)
}
console.log(`Каталог в порядке: ${products.length} продуктов (бесплатных ${products.filter((p) => p.kind === 'free').length}, платных ${products.filter((p) => p.kind === 'paid').length})`)
