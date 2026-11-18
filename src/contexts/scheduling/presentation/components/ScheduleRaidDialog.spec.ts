import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import ScheduleRaidDialog from './ScheduleRaidDialog.vue'

const suggestion = new Date('2030-01-16T22:00:00Z')
const options = [{ date: suggestion, detail: '4 de 5 livres, 2 h' }]

let wrapper: VueWrapper | null = null

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

async function openDialog(props: InstanceType<typeof ScheduleRaidDialog>['$props']) {
  wrapper = mount(ScheduleRaidDialog, { props, attachTo: document.body })
  await wrapper.get('button').trigger('click')
  await flushPromises()
  return wrapper
}

const field = () => document.querySelector<HTMLInputElement>('#schedule-when')!
const form = () => document.querySelector('form')!
const submitButton = () => document.querySelector<HTMLButtonElement>('button[type="submit"]')!

async function type(value: string) {
  field().value = value
  field().dispatchEvent(new Event('input'))
  await flushPromises()
}

async function submit() {
  form().dispatchEvent(new Event('submit', { cancelable: true }))
  await flushPromises()
}

const scheduled = () => wrapper!.emitted<[Date[], string | null]>('schedule')?.[0]?.[0]

describe('ScheduleRaidDialog', () => {
  it('não marca nenhuma sugestão ao abrir', async () => {
    await openDialog({ options })
    expect(field().value).toBe('')
    expect(submitButton().disabled).toBe(true)
  })

  it('agenda o horário digitado, mesmo fora das sugestões e sem clicar em Adicionar', async () => {
    await openDialog({ options })
    await type('2030-01-15T22:30')
    await submit()
    expect(scheduled()).toEqual([new Date('2030-01-16T01:30:00Z')])
  })

  it('não agenda enquanto o horário digitado estiver no passado', async () => {
    await openDialog({ options })
    await type('2020-01-15T22:30')
    expect(submitButton().disabled).toBe(true)
    await submit()
    expect(scheduled()).toBeUndefined()
  })

  it('sem sugestões, o campo já vem com a data da rotina', async () => {
    await openDialog({ suggested: suggestion })
    await submit()
    expect(scheduled()).toEqual([suggestion])
  })
})
