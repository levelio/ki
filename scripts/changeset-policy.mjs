const CHANGESET_PREFIX = '.changeset/'
const RELEASE_ONLY_FILES = new Set([
  'CHANGELOG.md',
  'package.json',
  'package-lock.json',
])

function isChangesetDoc(file) {
  return file === '.changeset/README.md'
}

function isChangesetEntry(file) {
  return (
    file.startsWith(CHANGESET_PREFIX) &&
    file.endsWith('.md') &&
    !isChangesetDoc(file)
  )
}

function isIgnoredFile(file) {
  return (
    file === 'README.md' ||
    file === 'README.en.md' ||
    file.startsWith('docs/') ||
    file.startsWith('.github/') ||
    file === '.gitignore' ||
    file === 'LICENSE' ||
    file.startsWith('.changeset/')
  )
}

export function hasChangesetFile(files) {
  return files.some(isChangesetEntry)
}

export function shouldRequireChangeset(files) {
  const relevantFiles = files.filter(Boolean)

  if (relevantFiles.length === 0) {
    return false
  }

  if (relevantFiles.every((file) => RELEASE_ONLY_FILES.has(file))) {
    return false
  }

  return relevantFiles.some((file) => !isIgnoredFile(file))
}
