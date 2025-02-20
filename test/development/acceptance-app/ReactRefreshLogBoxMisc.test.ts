import { sandbox } from './helpers'
import { createNext, FileRef } from 'e2e-utils'
import { NextInstance } from 'test/lib/next-modes/base'
import path from 'path'

// TODO: re-enable these tests after figuring out what is causing
// them to be so unreliable in CI
describe.skip('ReactRefreshLogBox app', () => {
  if (process.env.NEXT_TEST_REACT_VERSION === '^17') {
    it('should skip for react v17', () => {})
    return
  }

  let next: NextInstance

  beforeAll(async () => {
    next = await createNext({
      files: new FileRef(path.join(__dirname, 'fixtures', 'default-template')),
      skipStart: true,
    })
  })
  afterAll(() => next.destroy())

  test('<Link> with multiple children', async () => {
    const { session, cleanup } = await sandbox(next)

    await session.patch(
      'index.js',
      `
        import Link from 'next/link'

        export default function Index() {
          return (
            <Link href="/">
              <p>One</p>
              <p>Two</p>
            </Link>
          )
        }
      `
    )

    expect(await session.hasRedbox(true)).toBe(true)
    expect(await session.getRedboxDescription()).toMatchInlineSnapshot(
      `"Error: Multiple children were passed to <Link> with \`href\` of \`/\` but only one child is supported https://nextjs.org/docs/messages/link-multiple-children"`
    )
    expect(
      await session.evaluate(
        () =>
          (
            document
              .querySelector('body > nextjs-portal')
              .shadowRoot.querySelector(
                '#nextjs__container_errors_desc a:nth-of-type(1)'
              ) as any
          ).href
      )
    ).toMatch('https://nextjs.org/docs/messages/link-multiple-children')

    await cleanup()
  })

  test('<Link> component props errors', async () => {
    const { session, cleanup } = await sandbox(next)

    await session.patch(
      'index.js',
      `
        import Link from 'next/link'

        export default function Hello() {
          return <Link />
        }
      `
    )

    expect(await session.hasRedbox(true)).toBe(true)
    expect(await session.getRedboxDescription()).toMatchInlineSnapshot(
      `"Error: Failed prop type: The prop \`href\` expects a \`string\` or \`object\` in \`<Link>\`, but got \`undefined\` instead."`
    )

    await session.patch(
      'index.js',
      `
        import Link from 'next/link'

        export default function Hello() {
          return <Link href="/">Abc</Link>
        }
      `
    )
    expect(await session.hasRedbox()).toBe(false)

    await session.patch(
      'index.js',
      `
        import Link from 'next/link'

        export default function Hello() {
          return (
            <Link
              href="/"
              as="/"
              replace={false}
              scroll={false}
              shallow={false}
              passHref={false}
              prefetch={false}
            >
              Abc
            </Link>
          )
        }
      `
    )
    expect(await session.hasRedbox()).toBe(false)

    await session.patch(
      'index.js',
      `
        import Link from 'next/link'

        export default function Hello() {
          return (
            <Link
              href="/"
              as="/"
              replace={true}
              scroll={true}
              shallow={true}
              passHref={true}
              prefetch={true}
            >
              Abc
            </Link>
          )
        }
      `
    )
    expect(await session.hasRedbox()).toBe(false)

    await session.patch(
      'index.js',
      `
        import Link from 'next/link'

        export default function Hello() {
          return (
            <Link
              href="/"
              as="/"
              replace={undefined}
              scroll={undefined}
              shallow={undefined}
              passHref={undefined}
              prefetch={undefined}
            >
              Abc
            </Link>
          )
        }
      `
    )
    expect(await session.hasRedbox()).toBe(false)

    await session.patch(
      'index.js',
      `
        import Link from 'next/link'

        export default function Hello() {
          return (
            <Link
              href="/"
              as="/"
              replace={undefined}
              scroll={'oops'}
              shallow={undefined}
              passHref={undefined}
              prefetch={undefined}
            >
              Abc
            </Link>
          )
        }
      `
    )
    expect(await session.hasRedbox(true)).toBe(true)
    expect(await session.getRedboxDescription()).toMatchSnapshot()

    await session.patch(
      'index.js',
      `
        import Link from 'next/link'

        export default function Hello() {
          return (
            <Link
              href={false}
              as="/"
              replace={undefined}
              scroll={'oops'}
              shallow={undefined}
              passHref={undefined}
              prefetch={undefined}
            >
              Abc
            </Link>
          )
        }
      `
    )
    expect(await session.hasRedbox(true)).toBe(true)
    expect(await session.getRedboxDescription()).toMatchSnapshot()

    await cleanup()
  })

  test('server-side only compilation errors', async () => {
    const { session, cleanup } = await sandbox(next)

    await session.patch(
      'app/page.js',
      `'use client'
        import myLibrary from 'my-non-existent-library'
        export async function getStaticProps() {
          return {
            props: {
              result: myLibrary()
            }
          }
        }
        export default function Hello(props) {
          return <h1>{props.result}</h1>
        }
      `
    )

    expect(await session.hasRedbox(true)).toBe(true)
    await cleanup()
  })
})
