// Проверяет сборку ссылки оплаты и что адрес задан одним атрибутом.
// Запуск: node scripts/check-pay-link.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyPaymentLinks, paymentHref } from '../magazin/pay-link.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const html = readFileSync(join(root, 'magazin', 'index.html'), 'utf8')
const js = readFileSync(join(root, 'magazin', 'pay-link.js'), 'utf8')
const catalog = JSON.parse(readFileSync(join(root, 'catalog', 'products.json'), 'utf8'))

const demo = paymentHref(
  'https://example.payform.ru/',
  '?utm_source=vk&utm_campaign=start&utm_medium=bad medium&email=buyer@example.com&utm_content=' + 'y'.repeat(65) + '&utm_term=' + 'x'.repeat(65)
)
assert.equal(demo, 'https://example.payform.ru/?utm_source=vk&utm_campaign=start')
assert.equal(
  paymentHref('https://example.payform.ru/path', '?utm_source=vk&utm_medium=cpc&utm_campaign=start&utm_content=banner&utm_term=cenniki&yclid=999'),
  'https://example.payform.ru/path?utm_source=vk&utm_medium=cpc&utm_campaign=start&utm_content=banner&utm_term=cenniki'
)
assert.equal(
  paymentHref('https://example.payform.ru/', '?utm_source=' + 'a'.repeat(64)),
  'https://example.payform.ru/?utm_source=' + 'a'.repeat(64)
)

assert.equal(
  paymentHref('https://example.payform.ru/?product=cenniki&utm_campaign=old', '?utm_source=vk&utm_campaign=start'),
  'https://example.payform.ru/?product=cenniki&utm_campaign=start&utm_source=vk'
)
assert.equal(paymentHref('https://example.payform.ru/', '?utm_source=vk_1-a&utm_medium=cpc'), 'https://example.payform.ru/?utm_source=vk_1-a&utm_medium=cpc')
assert.equal(paymentHref('https://example.payform.ru/', '?utm_content=' + encodeURIComponent('цена')), 'https://example.payform.ru/')
assert.equal(paymentHref('javascript:alert(1)', '?utm_source=vk'), null)
assert.equal(paymentHref('not a link', '?utm_source=vk'), null)
assert.equal(paymentHref('', ''), null)

const bases = [...html.matchAll(/data-pay-base="([^"]*)"/g)]
assert.equal(bases.length, 1, 'data-pay-base должен быть ровно один')
const base = bases[0][1]
assert.equal(js.includes(base), false, 'значение ссылки не должно дублироваться в скрипте')
assert.match(html, /Купить за 1 490 ₽/)
assert.match(html, /Оплата откроется в ближайшее время/)
assert.equal([...html.matchAll(/data-pay-button/g)].length >= 1, true)
assert.doesNotMatch(js, /localStorage|sessionStorage|document\.cookie|indexedDB|fetch\s*\(|XMLHttpRequest|sendBeacon|gtag|metrika/)

const built = paymentHref(base, '?utm_source=vk&utm_campaign=start')
if (built === null) {
  assert.equal(/^https?:\/\//i.test(base), false)
  console.log('Заглушка: внешний адрес из data-pay-base не строится')
} else {
  const live = new URL(built)
  assert.equal(live.protocol, 'https:')
  assert.equal(live.searchParams.get('utm_source'), 'vk')
  assert.equal(live.searchParams.get('utm_campaign'), 'start')
  console.log('Боевая ссылка:', built)
}

const product = catalog.products.find((item) => item.id === 'konstruktor-cennikov')
assert.ok(product, 'в каталоге нет konstruktor-cennikov')
assert.equal(product.kind, 'paid')
assert.ok(String(product.price).includes('1 490 ₽'), 'цена в каталоге должна содержать 1 490 ₽')

function element(attrs) {
  return {
    attrs: new Map(Object.entries(attrs)),
    hidden: false,
    listeners: {},
    getAttribute(name) { return this.attrs.has(name) ? this.attrs.get(name) : null },
    setAttribute(name, value) { this.attrs.set(name, String(value)) },
    removeAttribute(name) { this.attrs.delete(name) },
    addEventListener(type, fn) { this.listeners[type] = fn }
  }
}

function page(baseValue) {
  const source = element({ href: '#oplata-skoro', 'data-pay-base': baseValue, 'data-pay-button': '' })
  const extra = element({ href: '#oplata-skoro', 'data-pay-button': '' })
  const note = element({})
  const doc = {
    querySelector(selector) { return selector === '[data-pay-base]' ? source : null },
    querySelectorAll(selector) {
      if (selector.includes('data-pay-note')) return [note]
      return [source, extra]
    }
  }
  return { doc, source, extra, note }
}

const held = page('NOT_A_LINK')
applyPaymentLinks(held.doc, { search: '?utm_source=vk&utm_campaign=start' })
assert.equal(held.source.getAttribute('href'), '#oplata-skoro')
assert.equal(held.extra.getAttribute('href'), '#oplata-skoro')
assert.equal(held.source.getAttribute('aria-disabled'), 'true')
assert.equal(held.note.hidden, false)
const blocked = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true } }
held.source.listeners.click(blocked)
assert.equal(blocked.defaultPrevented, true)

const open = page('https://example.payform.ru/')
applyPaymentLinks(open.doc, { search: '?utm_source=vk&utm_campaign=start&utm_medium=cpc&foo=1' })
const expected = 'https://example.payform.ru/?utm_source=vk&utm_medium=cpc&utm_campaign=start'
assert.equal(open.source.getAttribute('href'), expected)
assert.equal(open.extra.getAttribute('href'), expected)
assert.equal(open.source.getAttribute('aria-disabled'), null)
assert.equal(open.note.hidden, true)
const allowed = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true } }
open.source.listeners.click(allowed)
assert.equal(allowed.defaultPrevented, false)

console.log('pay-link: ok')
console.log('Пример /magazin/?utm_source=vk&utm_campaign=start при базе https://example.payform.ru/ →', paymentHref('https://example.payform.ru/', '?utm_source=vk&utm_campaign=start'))
