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
  if (product.description && product.description.length > 360) fail('description длиннее 360 знаков')
  if (product.features !== undefined) {
    if (!Array.isArray(product.features) || product.features.length < 1 || product.features.length > 4) {
      fail('features — массив из 1–4 строк')
    } else {
      for (const line of product.features) {
        if (typeof line !== 'string' || !line.trim()) fail('пустой пункт features')
        else if (line.length > 120) fail('пункт features длиннее 120 знаков')
      }
    }
  }
  if (product.markLabel !== undefined) {
    if (typeof product.markLabel !== 'string' || product.markLabel.length < 2 || product.markLabel.length > 4) {
      fail('markLabel — от 2 до 4 символов')
    }
  }
  if (product.accent !== undefined && (typeof product.accent !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(product.accent))) {
    fail('accent — цвет вроде #355c8a')
  }
  if (product.page !== undefined) {
    const pageOk = typeof product.page === 'string' && product.page.startsWith('https://romshil6973-droid.github.io/sistema-poryadka/')
    if (!pageOk) fail('page — полный https-адрес страницы на витрине')
  }
  if (product.status === 'soon' && product.action != null) {
    const action = product.action
    if (typeof action !== 'object' || Array.isArray(action)) fail('action должен быть объектом')
    else {
      if (!action.href) fail('у «скоро» с action нет action.href')
      if (!action.label) fail('у «скоро» с action нет action.label')
      if (action.href && !/^mailto:R\.SH\.69\.73@yandex\.ru\?subject=[^&\s]+$/.test(action.href)) {
        fail('action.href для «скоро» — только mailto:R.SH.69.73@yandex.ru?subject=…')
      }
    }
  }
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
