/* eslint-env jest */

import { NextInstance } from 'test/lib/next-modes/base'
import { fetchViaHTTP } from 'next-test-utils'
import { createNext, FileRef } from 'e2e-utils'
import cheerio from 'cheerio'
import path from 'path'

describe('app-dir with middleware', () => {
  if ((global as any).isNextDeploy) {
    it('should skip next deploy for now', () => {})
    return
  }

  let next: NextInstance

  afterAll(() => next.destroy())
  beforeAll(async () => {
    next = await createNext({
      files: new FileRef(path.join(__dirname, 'app-middleware')),
      dependencies: {
        react: '0.0.0-experimental-9cdf8a99e-20221018',
        'react-dom': '0.0.0-experimental-9cdf8a99e-20221018',
      },
    })
  })

  describe.each([
    {
      title: 'Serverless Functions',
      path: '/api/dump-headers-serverless',
      toJson: (res: Response) => res.json(),
    },
    {
      title: 'Edge Functions',
      path: '/api/dump-headers-edge',
      toJson: (res: Response) => res.json(),
    },
    {
      title: 'next/headers',
      path: '/headers',
      toJson: async (res: Response) => {
        const $ = cheerio.load(await res.text())
        return JSON.parse($('#headers').text())
      },
    },
  ])('Mutate request headers for $title', ({ path, toJson }) => {
    it(`Adds new headers`, async () => {
      const res = await fetchViaHTTP(next.url, path, null, {
        headers: {
          'x-from-client': 'hello-from-client',
        },
      })
      expect(await toJson(res)).toMatchObject({
        'x-from-client': 'hello-from-client',
        'x-from-middleware': 'hello-from-middleware',
      })
    })

    it(`Deletes headers`, async () => {
      const res = await fetchViaHTTP(
        next.url,
        path,
        {
          'remove-headers': 'x-from-client1,x-from-client2',
        },
        {
          headers: {
            'x-from-client1': 'hello-from-client',
            'X-From-Client2': 'hello-from-client',
          },
        }
      )

      const json = await toJson(res)
      expect(json).not.toHaveProperty('x-from-client1')
      expect(json).not.toHaveProperty('X-From-Client2')
      expect(json).toMatchObject({
        'x-from-middleware': 'hello-from-middleware',
      })

      // Should not be included in response headers.
      expect(res.headers.get('x-middleware-override-headers')).toBeNull()
      expect(
        res.headers.get('x-middleware-request-x-from-middleware')
      ).toBeNull()
      expect(res.headers.get('x-middleware-request-x-from-client1')).toBeNull()
      expect(res.headers.get('x-middleware-request-x-from-client2')).toBeNull()
    })

    it(`Updates headers`, async () => {
      const res = await fetchViaHTTP(
        next.url,
        path,
        {
          'update-headers':
            'x-from-client1=new-value1,x-from-client2=new-value2',
        },
        {
          headers: {
            'x-from-client1': 'old-value1',
            'X-From-Client2': 'old-value2',
            'x-from-client3': 'old-value3',
          },
        }
      )
      expect(await toJson(res)).toMatchObject({
        'x-from-client1': 'new-value1',
        'x-from-client2': 'new-value2',
        'x-from-client3': 'old-value3',
        'x-from-middleware': 'hello-from-middleware',
      })

      // Should not be included in response headers.
      expect(res.headers.get('x-middleware-override-headers')).toBeNull()
      expect(
        res.headers.get('x-middleware-request-x-from-middleware')
      ).toBeNull()
      expect(res.headers.get('x-middleware-request-x-from-client1')).toBeNull()
      expect(res.headers.get('x-middleware-request-x-from-client2')).toBeNull()
      expect(res.headers.get('x-middleware-request-x-from-client3')).toBeNull()
    })
  })
})
