import { describe, expect, it } from 'vitest'
import { isDiscordWebhook } from './PartyNotifications'

describe('isDiscordWebhook', () => {
  it('aceita só URLs de webhook do Discord', () => {
    expect(isDiscordWebhook('https://discord.com/api/webhooks/123456/abc-DEF_9')).toBe(true)
    expect(isDiscordWebhook('  https://ptb.discord.com/api/webhooks/1/x  ')).toBe(true)
    expect(isDiscordWebhook('https://discordapp.com/api/webhooks/1/x')).toBe(true)
    expect(isDiscordWebhook('http://discord.com/api/webhooks/1/x')).toBe(false)
    expect(isDiscordWebhook('https://evil.com/api/webhooks/1/x')).toBe(false)
    expect(isDiscordWebhook('https://discord.com.evil.com/api/webhooks/1/x')).toBe(false)
    expect(isDiscordWebhook('https://discord.com/api/webhooks/abc/x')).toBe(false)
  })
})
