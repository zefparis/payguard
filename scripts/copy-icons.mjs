import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'

const source = resolve('public/icons/icon-512.png')

const targets = [
  'android/app/src/main/res/mipmap-mdpi',
  'android/app/src/main/res/mipmap-hdpi',
  'android/app/src/main/res/mipmap-xhdpi',
  'android/app/src/main/res/mipmap-xxhdpi',
  'android/app/src/main/res/mipmap-xxxhdpi',
]

for (const dir of targets) {
  const absDir = resolve(dir)
  if (!existsSync(absDir)) mkdirSync(absDir, { recursive: true })
  copyFileSync(source, resolve(dir + '/ic_launcher.png'))
  copyFileSync(source, resolve(dir + '/ic_launcher_round.png'))
  console.log('✅ ' + dir)
}
