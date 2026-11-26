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
  'https://example.com/pay/',
  '?utm_source=vk&utm_campaign=start&utm_medium=bad medium&email=buyer@example.com&utm_content=' + 'y'.repeat(65) + '&utm_term=' + 'x'.repeat(65)
)
assert.equal(demo, 'https://example.com/pay/?utm_source=vk&utm_campaign=start')
assert.equal(
  paymentHref('https://example.com/pay/path', '?utm_source=vk&utm_medium=cpc&utm_campaign=start&utm_content=banner&utm_term=cenniki&yclid=999'),
  'https://example.com/pay/path?utm_source=vk&utm_medium=cpc&utm_campaign=start&utm_content=banner&utm_term=cenniki'
)
assert.equal(
  paymentHref('https://example.com/pay/', '?utm_source=' + 'a'.repeat(64)),
  'https://example.com/pay/?utm_source=' + 'a'.repeat(64)
)

assert.equal(
  paymentHref('https://example.com/pay/?product=cenniki&utm_campaign=old', '?utm_source=vk&utm_campaign=start'),
  'https://example.com/pay/?product=cenniki&utm_campaign=start&utm_source=vk'
)
assert.equal(paymentHref('https://example.com/pay/', '?utm_source=vk_1-a&utm_medium=cpc'), 'https://example.com/pay/?utm_source=vk_1-a&utm_medium=cpc')
assert.equal(paymentHref('https://example.com/pay/', '?utm_content=' + encodeURIComponent('цена')), 'https://example.com/pay/')
assert.equal(paymentHref('javascript:alert(1)', '?utm_source=vk'), null)
assert.equal(paymentHref('not a link', '?utm_source=vk'), null)
assert.equal(paymentHref('', ''), null)

const bases = [...html.matchAll(/data-pay-base="([^"]*)"/g)]
assert.equal(bases.length, 1, 'data-pay-base должен быть ровно один')
const base = bases[0][1]
assert.equal(base, '', 'до активации магазина data-pay-base должен быть пустым')
assert.match(html, /Купить за 1 490 ₽/)
assert.match(html, /Оплата онлайн через Robokassa/)
assert.doesNotMatch(html, /Оплата откроется в ближайшее время/)
assert.doesNotMatch(html, /Скоро в продаже/)
assert.doesNotMatch(html, /Скоро — оплата/)
assert.doesNotMatch(html, /payform\.ru|paymentLinkId|prodamus|Продамус/i)
assert.doesNotMatch(html, /widget|robokassa\.com\/Pay|MerchantLogin|Robokassa\.js/i)
assert.equal([...html.matchAll(/data-pay-button/g)].length >= 1, true)
assert.doesNotMatch(js, /localStorage|sessionStorage|document\.cookie|indexedDB|fetch\s*\(|XMLHttpRequest|sendBeacon|gtag|metrika/)
assert.match(js, /#kak-kupit/)

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
  const source = element({ href: '#kak-kupit', 'data-pay-base': baseValue, 'data-pay-button': '' })
  const extra = element({ href: '#kak-kupit', 'data-pay-button': '' })
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
assert.equal(held.source.getAttribute('href'), '#kak-kupit')
assert.equal(held.extra.getAttribute('href'), '#kak-kupit')
assert.equal(held.source.getAttribute('aria-disabled'), 'true')
assert.equal(held.note.hidden, false)
const blocked = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true } }
held.source.listeners.click(blocked)
assert.equal(blocked.defaultPrevented, true)

const open = page('https://example.com/pay/')
applyPaymentLinks(open.doc, { search: '?utm_source=vk&utm_campaign=start&utm_medium=cpc&foo=1' })
const expected = 'https://example.com/pay/?utm_source=vk&utm_medium=cpc&utm_campaign=start'
assert.equal(open.source.getAttribute('href'), expected)
assert.equal(open.extra.getAttribute('href'), expected)
assert.equal(open.source.getAttribute('aria-disabled'), null)
assert.equal(open.source.getAttribute('tabindex'), null)
assert.equal(open.extra.getAttribute('aria-disabled'), null)
assert.equal(open.extra.getAttribute('tabindex'), null)
assert.equal(open.note.hidden, true)
const allowed = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true } }
open.source.listeners.click(allowed)
assert.equal(allowed.defaultPrevented, false)

const idle = page(base)
applyPaymentLinks(idle.doc, { search: '?utm_source=vk&utm_campaign=start' })
assert.equal(idle.source.getAttribute('href'), '#kak-kupit')
assert.equal(idle.extra.getAttribute('href'), '#kak-kupit')
assert.equal(idle.source.getAttribute('aria-disabled'), 'true')
assert.equal(idle.source.getAttribute('tabindex'), '-1')
assert.equal(idle.extra.getAttribute('aria-disabled'), 'true')
assert.equal(idle.extra.getAttribute('tabindex'), '-1')
assert.equal(idle.note.hidden, false)

console.log('pay-link: ok (ссылка оплаты ещё не задана, кнопки ведут на #kak-kupit)')
