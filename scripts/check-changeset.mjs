import {
  hasChangesetFile,
  shouldRequireChangeset,
} from './changeset-policy.mjs'

const files = process.argv.slice(2).filter(Boolean)

if (!shouldRequireChangeset(files)) {
  console.log('No changeset required for this change set.')
  process.exit(0)
}

if (hasChangesetFile(files)) {
  console.log('Changeset found.')
  process.exit(0)
}

console.error(
  'This pull request changes product files but does not include a .changeset/*.md entry.',
)
console.error('Run `npm run changeset` and commit the generated file.')
process.exit(1)
