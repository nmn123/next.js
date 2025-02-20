/* eslint-env jest */
import { sandbox } from './helpers'
import { createNext, FileRef } from 'e2e-utils'
import { NextInstance } from 'test/lib/next-modes/base'
import path from 'path'

describe('ReactRefresh app', () => {
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

  test('can edit a component without losing state', async () => {
    const { session, cleanup } = await sandbox(next)
    await session.patch(
      'index.js',
      `
        import { useCallback, useState } from 'react'
        export default function Index() {
          const [count, setCount] = useState(0)
          const increment = useCallback(() => setCount(c => c + 1), [setCount])
          return (
            <main>
              <p>{count}</p>
              <button onClick={increment}>Increment</button>
            </main>
          )
        }
      `
    )
    await session.evaluate(() => document.querySelector('button').click())
    expect(
      await session.evaluate(() => document.querySelector('p').textContent)
    ).toBe('1')
    await session.patch(
      'index.js',
      `
        import { useCallback, useState } from 'react'
        export default function Index() {
          const [count, setCount] = useState(0)
          const increment = useCallback(() => setCount(c => c + 1), [setCount])
          return (
            <main>
              <p>Count: {count}</p>
              <button onClick={increment}>Increment</button>
            </main>
          )
        }
      `
    )
    expect(
      await session.evaluate(() => document.querySelector('p').textContent)
    ).toBe('Count: 1')
    await session.evaluate(() => document.querySelector('button').click())
    expect(
      await session.evaluate(() => document.querySelector('p').textContent)
    ).toBe('Count: 2')
    await cleanup()
  })

  test('cyclic dependencies', async () => {
    const { session, cleanup } = await sandbox(next)

    await session.write(
      'NudgeOverview.js',
      `
        import * as React from 'react';

        import { foo } from './routes';

        const NudgeOverview = () => {
          return <span />;
          foo;
        };

        export default NudgeOverview;
      `
    )

    await session.write(
      'SurveyOverview.js',
      `
        const SurveyOverview = () => {
          return 100;
        };

        export default SurveyOverview;
      `
    )

    await session.write(
      'Milestones.js',
      `
        import React from 'react';

        import { fragment } from './DashboardPage';

        const Milestones = props => {
          return <span />;
          fragment;
        };

        export default Milestones;
      `
    )

    await session.write(
      'DashboardPage.js',
      `
        import React from 'react';

        import Milestones from './Milestones';
        import SurveyOverview from './SurveyOverview';
        import NudgeOverview from './NudgeOverview';

        export const fragment = {};

        const DashboardPage = () => {
          return (
            <>
              <Milestones />
              <SurveyOverview />
              <NudgeOverview />
            </>
          );
        };

        export default DashboardPage;
      `
    )

    await session.write(
      'routes.js',
      `
        import DashboardPage from './DashboardPage';

        export const foo = {};

        console.warn('DashboardPage at import time:', DashboardPage);
        setTimeout(() => console.warn('DashboardPage after:', DashboardPage), 0);

        export default DashboardPage;
      `
    )

    await session.patch(
      'index.js',
      `
        import * as React from 'react';

        import DashboardPage from './routes';

        const HeroApp = (props) => {
          return <p>Hello. {DashboardPage ? <DashboardPage /> : null}</p>;
        };

        export default HeroApp;
      `
    )

    expect(
      await session.evaluate(() => document.querySelector('p').textContent)
    ).toBe('Hello. 100')

    let didFullRefresh = !(await session.patch(
      'SurveyOverview.js',
      `
        const SurveyOverview = () => {
          return 200;
        };

        export default SurveyOverview;
      `
    ))

    expect(
      await session.evaluate(() => document.querySelector('p').textContent)
    ).toBe('Hello. 200')
    expect(didFullRefresh).toBe(false)

    didFullRefresh = !(await session.patch(
      'index.js',
      `
        import * as React from 'react';

        import DashboardPage from './routes';

        const HeroApp = (props) => {
          return <p>Hello: {DashboardPage ? <DashboardPage /> : null}</p>;
        };

        export default HeroApp;
      `
    ))

    expect(
      await session.evaluate(() => document.querySelector('p').textContent)
    ).toBe('Hello: 200')
    expect(didFullRefresh).toBe(false)

    didFullRefresh = !(await session.patch(
      'SurveyOverview.js',
      `
        const SurveyOverview = () => {
          return 300;
        };

        export default SurveyOverview;
      `
    ))

    expect(
      await session.evaluate(() => document.querySelector('p').textContent)
    ).toBe('Hello: 300')
    expect(didFullRefresh).toBe(false)

    await cleanup()
  })
})
