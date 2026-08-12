import type { Auth } from '../../client-core/bundle/auth';
import type { Client } from '../bundle/types';
import { buildUrl, createQuerySerializer, getParseAs, setAuthParams } from '../bundle/utils';

describe('buildUrl', () => {
  const scenarios: Array<{
    options: Parameters<Client['buildUrl']>[0];
    url: string;
  }> = [
    {
      options: {
        path: {
          id: new Date('2025-01-01T00:00:00.000Z'),
        },
        url: '/foo/{id}',
      },
      url: '/foo/2025-01-01T00:00:00.000Z',
    },
  ];

  it.each(scenarios)('builds $url', async ({ options, url }) => {
    expect(buildUrl(options)).toEqual(url);
  });
});

describe('createQuerySerializer', () => {
  const scenarios: Array<{
    description: string;
    options: Parameters<typeof createQuerySerializer>[0];
    query: Record<string, unknown>;
    search: string;
  }> = [
    {
      description: 'JSON-encodes an object',
      options: { parameters: { node: { type: 'json' } } },
      query: { node: { email: 'foo@bar.baz' } },
      search: 'node=%7B%22email%22%3A%22foo%40bar.baz%22%7D',
    },
    {
      description: 'JSON-encodes an array',
      options: { parameters: { ids: { type: 'json' } } },
      query: { ids: [1, 2] },
      search: 'ids=%5B1%2C2%5D',
    },
    {
      description: 'JSON-encodes a primitive',
      options: { parameters: { cursor: { type: 'json' } } },
      query: { cursor: 'foo' },
      search: 'cursor=%22foo%22',
    },
    {
      description: 'JSON-encodes dates and bigints',
      options: { parameters: { node: { type: 'json' } } },
      query: { node: { id: 9007199254740993n, since: new Date('2025-01-01T00:00:00.000Z') } },
      search:
        'node=%7B%22id%22%3A%229007199254740993%22%2C%22since%22%3A%222025-01-01T00%3A00%3A00.000Z%22%7D',
    },
    {
      description: 'leaves reserved characters unencoded when allowReserved is true',
      options: { parameters: { node: { allowReserved: true, type: 'json' } } },
      query: { node: { email: 'foo@bar.baz' } },
      search: 'node={"email":"foo@bar.baz"}',
    },
    {
      description: 'serializes JSON and non-JSON parameters side by side',
      options: { parameters: { node: { type: 'json' } } },
      query: { node: { user_id: 1 }, search: 'foo' },
      search: 'node=%7B%22user_id%22%3A1%7D&search=foo',
    },
    {
      description: 'skips undefined and null values',
      options: { parameters: { node: { type: 'json' } } },
      query: { node: undefined, search: null },
      search: '',
    },
  ];

  it.each(scenarios)('$description', ({ options, query, search }) => {
    expect(createQuerySerializer(options)(query)).toEqual(search);
  });
});

describe('getParseAs', () => {
  const scenarios: Array<{
    content: Parameters<typeof getParseAs>[0];
    parseAs: ReturnType<typeof getParseAs>;
  }> = [
    {
      content: null,
      parseAs: 'stream',
    },
    {
      content: 'application/json',
      parseAs: 'json',
    },
    {
      content: 'application/ld+json',
      parseAs: 'json',
    },
    {
      content: 'application/ld+json;charset=utf-8',
      parseAs: 'json',
    },
    {
      content: 'application/ld+json; charset=utf-8',
      parseAs: 'json',
    },
    {
      content: 'multipart/form-data',
      parseAs: 'formData',
    },
    {
      content: 'application/*',
      parseAs: 'blob',
    },
    {
      content: 'audio/*',
      parseAs: 'blob',
    },
    {
      content: 'image/*',
      parseAs: 'blob',
    },
    {
      content: 'video/*',
      parseAs: 'blob',
    },
    {
      content: 'text/*',
      parseAs: 'text',
    },
    {
      content: 'unsupported',
      parseAs: undefined,
    },
  ];

  it.each(scenarios)('detects $content as $parseAs', async ({ content, parseAs }) => {
    expect(getParseAs(content)).toEqual(parseAs);
  });
});

describe('setAuthParams', () => {
  it('sets bearer token in headers', async () => {
    const auth = vi.fn().mockReturnValue('foo');
    const headers = new Headers();
    const query: Record<any, unknown> = {};
    await setAuthParams({
      auth,
      headers,
      query,
      security: [
        {
          name: 'baz',
          scheme: 'bearer',
          type: 'http',
        },
      ],
    });
    expect(auth).toHaveBeenCalled();
    expect(headers.get('baz')).toBe('Bearer foo');
    expect(Object.keys(query).length).toBe(0);
  });

  it('sets access token in query', async () => {
    const auth = vi.fn().mockReturnValue('foo');
    const headers = new Headers();
    const query: Record<any, unknown> = {};
    await setAuthParams({
      auth,
      headers,
      query,
      security: [
        {
          in: 'query',
          name: 'baz',
          scheme: 'bearer',
          type: 'http',
        },
      ],
    });
    expect(auth).toHaveBeenCalled();
    expect(headers.get('baz')).toBeNull();
    expect(query.baz).toBe('Bearer foo');
  });

  it('sets access token in query when query is initially undefined', async () => {
    const auth = vi.fn().mockReturnValue('foo');
    const headers = new Headers();
    const opts: Parameters<typeof setAuthParams>[0] = {
      auth,
      headers,
      security: [
        {
          in: 'query',
          name: 'baz',
          type: 'apiKey',
        },
      ],
    };
    await setAuthParams(opts);
    expect(auth).toHaveBeenCalled();
    expect(opts.query).toEqual({ baz: 'foo' });
  });

  it('sets Authorization header when `in` and `name` are undefined', async () => {
    const auth = vi.fn().mockReturnValue('foo');
    const headers = new Headers();
    const query: Record<any, unknown> = {};
    await setAuthParams({
      auth,
      headers,
      query,
      security: [
        {
          type: 'http',
        },
      ],
    });
    expect(auth).toHaveBeenCalled();
    expect(headers.get('Authorization')).toBe('foo');
    expect(query).toEqual({});
  });

  it('sets first scheme only', async () => {
    const auth = vi.fn().mockReturnValue('foo');
    const headers = new Headers();
    const query: Record<any, unknown> = {};
    await setAuthParams({
      auth,
      headers,
      query,
      security: [
        {
          name: 'baz',
          scheme: 'bearer',
          type: 'http',
        },
        {
          in: 'query',
          name: 'baz',
          scheme: 'bearer',
          type: 'http',
        },
      ],
    });
    expect(auth).toHaveBeenCalled();
    expect(headers.get('baz')).toBe('Bearer foo');
    expect(Object.keys(query).length).toBe(0);
  });

  it('sets first scheme with token', async () => {
    const auth = vi.fn().mockImplementation((auth: Auth) => {
      if (auth.type === 'apiKey') {
        return;
      }
      return 'foo';
    });
    const headers = new Headers();
    const query: Record<any, unknown> = {};
    await setAuthParams({
      auth,
      headers,
      query,
      security: [
        {
          name: 'baz',
          type: 'apiKey',
        },
        {
          in: 'query',
          name: 'baz',
          scheme: 'bearer',
          type: 'http',
        },
      ],
    });
    expect(auth).toHaveBeenCalled();
    expect(headers.get('baz')).toBeNull();
    expect(query.baz).toBe('Bearer foo');
  });

  it('sets an API key in a cookie', async () => {
    const auth = vi.fn().mockReturnValue('foo');
    const headers = new Headers();
    const query: Record<any, unknown> = {};
    await setAuthParams({
      auth,
      headers,
      query,
      security: [
        {
          in: 'cookie',
          name: 'baz',
          type: 'apiKey',
        },
      ],
    });
    expect(auth).toHaveBeenCalled();
    expect(headers.get('Cookie')).toBe('baz=foo');
    expect(query).toEqual({});
  });

  it('sets only one specific header', async () => {
    const auth = vi.fn(({ name }: Auth) => {
      if (name === 'baz') {
        return 'foo';
      }
      return 'buz';
    });
    const headers = new Headers();
    const query: Record<any, unknown> = {};
    await setAuthParams({
      auth,
      headers,
      query,
      security: [
        {
          name: 'baz',
          scheme: 'bearer',
          type: 'http',
        },
        {
          name: 'fiz',
          type: 'http',
        },
        {
          in: 'query',
          name: 'baz',
          scheme: 'bearer',
          type: 'http',
        },
      ],
    });
    expect(auth).toHaveBeenCalled();
    expect(headers.get('baz')).toBe('Bearer foo');
    expect(headers.get('fiz')).toBe('buz');
    expect(Object.keys(query).length).toBe(0);
  });
});
