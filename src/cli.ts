#!/usr/bin/env bun
import { runApp } from './tui'

// Version from package.json
const VERSION = '0.1.0'

// Parse command line arguments
const args = process.argv.slice(2)

if (args.includes('--version') || args.includes('-v')) {
  console.log(`skill v${VERSION}`)
  process.exit(0)
}

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
skill v${VERSION} - LazySkill CLI

Usage:
  skill          Start the interactive skill manager
  skill --version, -v    Show version
  skill --help, -h       Show this help message
`)
  process.exit(0)
}

runApp().catch(console.error)
