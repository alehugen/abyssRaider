import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import ConfirmDialog from './ConfirmDialog.vue'
import { confirm, settleConfirm } from './useConfirm'

describe('ConfirmDialog', () => {
  afterEach(() => {
    settleConfirm(false)
    document.body.innerHTML = ''
  })

  async function open(destructive = false) {
    const wrapper = mount(ConfirmDialog, { attachTo: document.body })
    const answer = confirm({ title: 'Excluir a party?', confirmText: 'Excluir party', destructive })
    await nextTick()
    await nextTick()
    const buttons = [...document.body.querySelectorAll('button')]
    return { wrapper, answer, buttons }
  }

  it('resolve true ao clicar em confirmar', async () => {
    const { wrapper, answer, buttons } = await open(true)
    buttons.find((b) => b.textContent?.includes('Excluir party'))!.click()
    await expect(answer).resolves.toBe(true)
    wrapper.unmount()
  })

  it('resolve false ao cancelar', async () => {
    const { wrapper, answer, buttons } = await open()
    buttons.find((b) => b.textContent?.includes('Cancelar'))!.click()
    await expect(answer).resolves.toBe(false)
    wrapper.unmount()
  })
})
