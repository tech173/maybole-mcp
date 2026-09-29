import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const stage = await mkdtemp(join(tmpdir(), 'maybole-mcpb-'))
const outputDir = join(root, 'dist')
const output = join(outputDir, `maybole-mailbox-bridge-${pkg.version}.mcpb`)
const publicDir = basename(dirname(root)) === 'packages' ? resolve(root, '..', '..', 'public', 'downloads') : null

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: false })
  if (result.status !== 0) throw new Error(`${command} failed with status ${result.status}`)
}

try {
  await Promise.all([
    cp(join(root, 'bin'), join(stage, 'bin'), { recursive: true }),
    cp(join(root, 'prototypes', 'local-helper'), join(stage, 'prototypes', 'local-helper'), { recursive: true }),
    cp(join(root, 'manifest.json'), join(stage, 'manifest.json')),
    cp(join(root, 'LICENSE'), join(stage, 'LICENSE')),
    cp(join(root, 'README.md'), join(stage, 'README.md')),
  ])
  const runtimePackage = {
    name: pkg.name,
    version: pkg.version,
    private: true,
    type: 'module',
    engines: pkg.engines,
    dependencies: pkg.dependencies,
  }
  await writeFile(join(stage, 'package.json'), `${JSON.stringify(runtimePackage, null, 2)}\n`)
  run('npm', ['install', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], stage)
  await mkdir(outputDir, { recursive: true })
  await rm(output, { force: true })
  run(join(root, 'node_modules', '.bin', 'mcpb'), ['validate', join(stage, 'manifest.json')], root)
  run(join(root, 'node_modules', '.bin', 'mcpb'), ['pack', stage, output], root)
  const bytes = await readFile(output)
  const digest = createHash('sha256').update(bytes).digest('hex')
  await writeFile(`${output}.sha256`, `${digest}  ${basename(output)}\n`)
  const sbom = spawnSync('npm', ['sbom', '--omit=dev', '--package-lock-only', '--sbom-format=spdx'], { cwd: stage, encoding: 'utf8', shell: false })
  if (sbom.status !== 0) throw new Error(`npm sbom failed: ${sbom.stderr}`)
  await writeFile(join(outputDir, `maybole-mailbox-bridge-${pkg.version}.spdx.json`), sbom.stdout)
  if (publicDir) {
  await mkdir(publicDir, { recursive: true })
  await cp(output, join(publicDir, basename(output)))
  await cp(`${output}.sha256`, join(publicDir, `${basename(output)}.sha256`))
  }
  process.stdout.write(`Built ${output}\nSHA-256 ${digest}\n`)
} finally {
  await rm(stage, { recursive: true, force: true })
}
