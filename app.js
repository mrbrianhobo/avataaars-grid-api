const express = require('express');
const path = require('path');
const sharp = require('sharp');
const tinycolor = require("tinycolor2");
const Avatars = require('@dicebear/avatars');
const sprites = require('@dicebear/avatars-avataaars-sprites');
const { convert } = require('convert-svg-to-png');

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

function parseImgPath(imgPath) {
  if (path.parse(imgPath).ext != '.png') {
    throw new Error('Invalid image type. Expected .png but got: ' + path.parse(imgPath).ext);
  }

  const fields = path.parse(imgPath).name.split('-');
  if (fields.length < 4 || fields.length > 5) {
    throw new Error('Invalid number of arguments. Expected 4/5 but got: ' + fields.length);
  }

  return {
    hashes: fields.slice(0, 4),
    color: fields.length === 5 ? hex2rgb(fields[4]) : transparent
  };
}

function hex2rgb(hexcode) {
  const color = tinycolor('#' + hexcode);

  if (color.isValid()) {
    let rgb = color.toRgb();
    rgb.alpha = rgb.a;
    delete rgb.a;
    return rgb;
  } else {
    return transparent;
  }
}

const app = express();
const port = 3000;

const options = { radius: 25 };

const avatars = new Avatars.default(sprites.default, options);

app.get('/*', async function (req, res) {
  const { hashes, color } = parseImgPath(req.url);
  
  const canvas = sharp({
    create: {
      width: 1000,
      height: 1000,
      channels: 4,
      background: color
    }
  });

  const pngs = await Promise.all(hashes.map((hash) => {
    const svg = avatars.create(hash); 
    return convert(svg, { width: 400, height: 400 });
  }));

  const grid = [
    // northwest
    {input: pngs[0], density: 300, top: 50, left: 100},
    // northeast
    {input: pngs[1], density: 300, top: 50, left: 500},
    // southwest
    {input: pngs[2], density: 300, top: 500, left: 100}, 
    // southeast
    {input: pngs[3], density: 300, top: 500, left: 500}
  ];

  const composite = await canvas
    .composite(grid)
    .png()
    .toBuffer();
  
  res.set('Content-Type', 'image/png');
  res.send(composite);
});

app.listen(port, () => console.log(`avatar generator listening on port ${port}!`))
