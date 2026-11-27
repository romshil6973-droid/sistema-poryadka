// Кнопка «Купить» на странице магазина.
// Адрес оплаты задаётся в одном месте: атрибут data-pay-base в magazin/index.html.
// Пока там не абсолютный http(s)-адрес, кнопки остаются на #kak-kupit и неактивны. Виджет оплаты на страницу не встраивается.
// Из адреса страницы читаются только utm_source, utm_medium, utm_campaign,
// utm_content и utm_term. Значение — латиница, цифры, «_» и «-», не длиннее 64 знаков.
// Ничего больше не читается, не сохраняется и никуда не отправляется.

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']
const UTM_VALUE = /^[A-Za-z0-9_-]{1,64}$/

export function paymentHref(base, search) {
  const raw = String(base ?? '').trim()
  let url
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (!url.hostname) return null

  const incoming = new URLSearchParams(search || '')
  for (const key of UTM_KEYS) {
    const value = incoming.get(key)
    if (value && UTM_VALUE.test(value)) url.searchParams.set(key, value)
  }
  return url.toString()
}

export function applyPaymentLinks(doc, loc) {
  const source = doc.querySelector('[data-pay-base]')
  if (!source) return
  const buttons = [...doc.querySelectorAll('[data-pay-button], [data-pay-base]')]
  const notes = [...doc.querySelectorAll('[data-pay-note]')]
  if (buttons.length === 0) return

  for (const button of buttons) {
    button.addEventListener('click', (event) => {
      if (button.getAttribute('aria-disabled') === 'true') event.preventDefault()
    })
  }

  const href = paymentHref(source.getAttribute('data-pay-base'), loc.search || '')
  if (!href) {
    for (const button of buttons) {
      button.setAttribute('href', '#kak-kupit')
      button.setAttribute('aria-disabled', 'true')
      button.setAttribute('tabindex', '-1')
    }
    for (const note of notes) note.hidden = false
    return
  }

  for (const button of buttons) {
    button.setAttribute('href', href)
    button.removeAttribute('aria-disabled')
    button.removeAttribute('tabindex')
  }
  for (const note of notes) note.hidden = true
}

if (typeof document !== 'undefined') applyPaymentLinks(document, location)
