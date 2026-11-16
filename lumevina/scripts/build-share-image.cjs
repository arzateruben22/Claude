// The link-preview picture (img/share.jpg, 1200×675): the open water (img/water/open.webp) with her logo in near-black.
//   node scripts/build-share-image.cjs        (from lumevina/; needs playwright)
const { chromium } = require('playwright');
const fs = require('fs');
const L = require('path').resolve(__dirname, '..') + '/';
(async () => {
  const water = 'data:image/webp;base64,' + fs.readFileSync(L + 'img/water/open.webp').toString('base64');
  let svg = fs.readFileSync(L + 'img/logo-full.svg', 'utf8').replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/stroke="#000"/g, 'stroke="#171717"').replace(/fill="#000"/g, 'fill="#171717"').replace(/\sfill-opacity="[^"]*"/g, '');
  svg = svg.replace('<svg ', '<svg width="760" ');
  const html = `<!doctype html><html><body style="margin:0">
    <div style="width:1200px;height:675px;position:relative;overflow:hidden;background:#E9E6E0 url(${water}) 50% 50%/cover no-repeat">
      <div style="position:absolute;inset:0;background:radial-gradient(60% 70% at 50% 50%, rgba(246,244,239,.62), rgba(246,244,239,0) 75%)"></div>
      <div style="position:absolute;inset:0;display:grid;place-items:center">${svg}</div>
    </div></body></html>`;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 675 }, deviceScaleFactor: 1 });
  await p.setContent(html, { waitUntil: 'load' });
  await p.waitForTimeout(300);
  await p.screenshot({ path: L + 'img/share.jpg', type: 'jpeg', quality: 86 });
  await b.close();
  console.log('share.jpg', fs.statSync(L + 'img/share.jpg').size);
})();
