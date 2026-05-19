import sharp from 'sharp';
import fs from 'fs';

const svg = `<svg viewBox="0 0 100 70" width="1024" height="1024" xmlns="http://www.w3.org/2000/svg" style="background-color: black;">
  <defs>
    <linearGradient id="fwdGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#B026FF" />
      <stop offset="55%" stopColor="#FF006B" />
      <stop offset="100%" stopColor="#00BFFF" />
    </linearGradient>
    <linearGradient id="fwdGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#FF006B" />
      <stop offset="100%" stopColor="#00BFFF" />
    </linearGradient>
  </defs>
  <g transform="translate(10, 10) scale(0.8)">
    <path d="M5 10 L40 35 L5 60 Z" fill="none" stroke="url(#fwdGrad)" stroke-width="5" stroke-linejoin="round" />
    <path d="M45 10 L80 35 L45 60 Z" fill="none" stroke="url(#fwdGrad2)" stroke-width="5" stroke-linejoin="round" />
  </g>
</svg>`;

async function run() {
  await sharp(Buffer.from(svg))
    .png()
    .toFile('assets/icon.png');
  await sharp(Buffer.from(svg))
    .png()
    .toFile('assets/splash.png');
  console.log("Assets generated");
}

run();
