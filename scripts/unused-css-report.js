// Generates a report of unused CSS selectors across the project (excluding minified/bundled CSS)
// It DOES NOT modify any CSS files. Output: reports/unused-css-report.json

const { PurgeCSS } = require('purgecss')
const fs = require('fs')
const path = require('path')
const fg = require('fast-glob')

async function run() {
  const projectRoot = __dirname ? path.join(__dirname, '..') : process.cwd()
  const reportDir = path.join(projectRoot, 'reports')
  const outFile = path.join(reportDir, 'unused-css-report.json')

  fs.mkdirSync(reportDir, { recursive: true })

  const contentGlobs = [
    'src/**/*.{html,js,ts,jsx,tsx,vue}',
    'public/**/*.html',
    'public/js/**/*.js',
    'modules/**/*.js',
    'routes/**/*.js',
    'server.js',
    'admin-frontend/index.html',
    'admin-frontend/src/**/*.{vue,js,ts,jsx,tsx,html}',
  ].map(p => path.posix.join(projectRoot.replace(/\\/g, '/'), p))

  const cssGlobs = [
    'public/css/*.css',
    'public/widgets/*.css',
    'admin-frontend/src/styles/*.css',
    'src/*.css',
  ].map(p => path.posix.join(projectRoot.replace(/\\/g, '/'), p))

  const skipGlobs = [
    'public/admin-dist/**/*.css',
    'public/**/min/**/*.css',
    '**/*.min.css',
  ].map(p => path.posix.join(projectRoot.replace(/\\/g, '/'), p))

  const micromatch = require('micromatch')

  const content = fg.sync(contentGlobs, { onlyFiles: true, unique: true, absolute: true, dot: false })
  const cssFiles = fg.sync(cssGlobs, { onlyFiles: true, unique: true, absolute: true, dot: false, ignore: skipGlobs })

  const results = await new PurgeCSS().purge({
    content,
    css: cssFiles,
    rejected: true,

    defaultExtractor: (content) => content.match(/[A-Za-z0-9-:_/]+/g) || [],
  })

  const filtered = results.filter(r => {
    const file = (r.file || '').replace(/\\/g, '/')
    return !micromatch.isMatch(file, skipGlobs)
  })

  const summary = filtered.map(r => ({
    file: path.relative(projectRoot, r.file || ''),
    unusedCount: r.rejected?.length || 0,
    sampleUnused: (r.rejected || []).slice(0, 50),
  }))

  summary.sort((a, b) => b.unusedCount - a.unusedCount)

  const totals = summary.reduce((acc, item) => {
    acc.files += 1
    acc.unusedSelectors += item.unusedCount
    return acc
  }, { files: 0, unusedSelectors: 0 })

  const output = {
    generatedAt: new Date().toISOString(),
    notes: [
      'Minified/bundled CSS was excluded (public/admin-dist, **/*.min.css, public/**/min).',
      'Tailwind utilities are analyzed against project content; dynamic class names built at runtime may be reported as unused if not detectable.',
      'This is a read-only report. No files were changed.',
    ],
    totals,
    byFile: summary,
  }

  fs.writeFileSync(outFile, JSON.stringify(output, null, 2), 'utf8')
  const top = summary.slice(0, 10).map(s => `- ${s.file} → unused: ${s.unusedCount}`).join('\n')

  console.log(`Unused CSS report written to: ${path.relative(projectRoot, outFile)}\nTop files with unused selectors:\n${top}`)
}

run().catch(err => {

  console.error('Error generating unused CSS report:', err)
  process.exit(1)
})
