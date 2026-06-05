import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

if (process.env.CI || !existsSync('.git')) {
  process.exit(0)
}

execSync('pnpm run setup:husky && pnpm run install:gitleaks', {
  stdio: 'inherit'
})
