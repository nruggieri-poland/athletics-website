// One-off (but safely re-runnable) script — sets the Navigation global's
// initial links to Calendar and News, each visible in both the header and
// footer. Documents was dropped from the nav (the collection still exists
// in the CMS for internal use, it's just not linked from the site anymore).
// From here on, editing order/labels/visibility is done in the CMS admin
// (Globals > Navigation), not in code. Run with: npm run seed:navigation

import { getPayload } from 'payload'
import config from '../payload.config.ts'

async function main() {
  const payload = await getPayload({ config })

  await payload.updateGlobal({
    slug: 'navigation',
    data: {
      links: [
        { label: 'Calendar', url: '/calendar', showInHeader: true, showInFooter: true },
        { label: 'News', url: '/news', showInHeader: true, showInFooter: true },
      ],
    },
  })

  console.log('Navigation global seeded with Calendar, News.')
  process.exit(0)
}

await main().catch((err) => {
  console.error(err)
  process.exit(1)
})
