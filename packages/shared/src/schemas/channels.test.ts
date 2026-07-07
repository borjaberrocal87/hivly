import { describe, expect, it } from 'vitest';

import { CHANNELS_ERROR, ChannelSchema, ChannelsResponseSchema } from './channels.js';

describe('ChannelSchema', () => {
  it('should parse a valid channel', () => {
    expect(ChannelSchema.safeParse({ id: '1234567890', name: 'general' }).success).toBe(true);
  });

  it('should reject a channel missing a required field', () => {
    expect(ChannelSchema.safeParse({ id: '1234567890' }).success).toBe(false);
  });
});

describe('ChannelsResponseSchema', () => {
  it('should parse an empty channels array (deny-by-default)', () => {
    expect(ChannelsResponseSchema.safeParse({ channels: [] }).success).toBe(true);
  });

  it('should parse a populated channels array', () => {
    const result = ChannelsResponseSchema.safeParse({
      channels: [{ id: '1', name: 'general' }, { id: '2', name: 'random' }],
    });
    expect(result.success).toBe(true);
  });
});

describe('CHANNELS_ERROR', () => {
  it('should expose the stable channels error codes', () => {
    expect(CHANNELS_ERROR.INTERNAL).toBe('INTERNAL');
  });
});
