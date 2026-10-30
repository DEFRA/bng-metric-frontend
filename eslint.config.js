import neostandard from 'neostandard'

export default [
  { ignores: ['.cache/**', 'coverage/**', '.public/**'] },
  ...neostandard({
    env: ['node', 'vitest'],
    ignores: [...neostandard.resolveIgnoresFromGitignore(), '.public/**'],
    noJsx: true,
    noStyle: true
  })
]
