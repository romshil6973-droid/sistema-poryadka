// Проверяет catalog/products.json перед публикацией: обязательные поля, уникальные id, картинки на месте.
// Запуск: node scripts/check-catalog.mjs
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const { products } = JSON.parse(readFileSync(join(root, 'catalog', 'products.json'), 'utf8'))

const errors = []
const ids = new Set()

for (const [index, product] of products.entries()) {
  const name = product.name || product.id || `№${index + 1}`
  const fail = (text) => errors.push(`«${name}»: ${text}`)

  for (const key of ['id', 'name', 'status', 'tagline']) {
    if (!product[key]) fail(`нет поля ${key}`)
  }
  if (product.id && !/^[a-z0-9-]+$/.test(product.id)) fail('id — только латиница в нижнем регистре, цифры и дефис')
  if (ids.has(product.id)) fail(`id «${product.id}» уже занят`)
  ids.add(product.id)
  if (!['available', 'soon'].includes(product.status)) fail('status должен быть available или soon')

  if (product.status === 'available') {
    if (!['free', 'paid'].includes(product.kind)) fail('у доступного продукта kind должен быть free или paid')
    if (!product.price) fail('у доступного продукта нет price')
    if (!product.action?.href) fail('у доступного продукта нет action.href (куда ведёт кнопка)')
  } else if (product.kind && !['free', 'paid'].includes(product.kind)) {
    fail('kind должен быть free или paid')
  }

  if (product.tagline && product.tagline.length > 90) fail('tagline длиннее 90 знаков — на баннере не поместится в строку')
  if (product.description && product.description.length > 180) fail('description длиннее 180 знаков — баннер раздуется')
  if (product.image && !existsSync(join(root, product.image))) fail(`нет файла картинки ${product.image}`)
  if (product.image && !product.imageAlt) fail('у картинки нет imageAlt (описания)')
}

if (errors.length) {
  console.error(`Каталог: ${errors.length} ошибок\n- ${errors.join('\n- ')}`)
  process.exit(1)
}
const count = (fn) => products.filter(fn).length
console.log(
  `Каталог в порядке: ${products.length} баннеров (бесплатных ${count((p) => p.kind === 'free')}, платных ${count((p) => p.kind === 'paid')}, «скоро» ${count((p) => p.status === 'soon')})`
)
