import { describe, expect, it } from 'vitest'
import { render } from '../src/index.js'

describe('discord tags', () => {
  it('userid uses context user info', async () => {
    const result = await render('{userid}', {
      discord: { user: { id: '123', tag: 'Test#0001', mention: '<@123>' } },
    })
    expect(result.output).toBe('123')
  })

  it('usertag returns user tag', async () => {
    const result = await render('{usertag}', {
      discord: { user: { id: '123', tag: 'Test#0001', mention: '<@123>' } },
    })
    expect(result.output).toBe('Test#0001')
  })

  it('usertag handles modern username without discriminator', async () => {
    const result = await render('{usertag}', {
      discord: { user: { id: '123', tag: 'pomelo_user', mention: '<@123>' } },
    })
    expect(result.output).toBe('pomelo_user')
  })

  it('mention returns user mention', async () => {
    const result = await render('{mention}', {
      discord: { user: { id: '123', tag: 'Test#0001', mention: '<@123>' } },
    })
    expect(result.output).toBe('<@123>')
  })

  it('channelid returns channel id', async () => {
    const result = await render('{channelid}', {
      discord: { channelId: '456' },
    })
    expect(result.output).toBe('456')
  })

  it('server returns server name', async () => {
    const result = await render('{server}', {
      discord: { server: 'Test Server' },
    })
    expect(result.output).toBe('Test Server')
  })

  it('serverid returns server id', async () => {
    const result = await render('{serverid}', {
      discord: { serverId: '789' },
    })
    expect(result.output).toBe('789')
  })

  it('avatar returns default PNG avatar URL', async () => {
    const result = await render('{avatar}', {
      discord: { user: { id: '123', tag: 'Test#0001', mention: '<@123>' } },
    })
    expect(result.output).toBe('https://cdn.discordapp.com/avatars/123/123.png')
  })

  it('avatar supports custom base URL', async () => {
    const result = await render('{avatar}', {
      discord: {
        user: {
          id: '123',
          tag: 'Test#0001',
          mention: '<@123>',
          avatarBase: 'https://custom.cdn.com/avatars/123',
        },
      },
    })
    expect(result.output).toBe('https://custom.cdn.com/avatars/123/123.png')
  })

  it('avatar supports GIF format', async () => {
    const result = await render('{avatar}', {
      discord: {
        user: {
          id: '123',
          tag: 'Test#0001',
          mention: '<@123>',
          avatarFormat: 'gif',
        },
      },
    })
    expect(result.output).toBe('https://cdn.discordapp.com/avatars/123/123.gif')
  })

  it('avatar supports JPEG format', async () => {
    const result = await render('{avatar}', {
      discord: {
        user: {
          id: '123',
          tag: 'Test#0001',
          mention: '<@123>',
          avatarFormat: 'jpeg',
        },
      },
    })
    expect(result.output).toBe('https://cdn.discordapp.com/avatars/123/123.jpg')
  })

  it('avatar returns empty string when no user id', async () => {
    const result = await render('{avatar}', {})
    expect(result.output).toBe('')
  })

  it('avatar falls back to PNG for unsupported format', async () => {
    const result = await render('{avatar}', {
      discord: {
        user: {
          id: '123',
          tag: 'Test#0001',
          mention: '<@123>',
          avatarFormat: 'unsupported',
        },
      },
    })
    expect(result.output).toBe('https://cdn.discordapp.com/avatars/123/123.png')
  })
})
