const path = require('path');
const sharp = require('sharp');
const tinycolor = require('tinycolor2');
const Avatars = require('@dicebear/avatars');
const sprites = require('@dicebear/avatars-avataaars-sprites');
const { createConverter } = require('convert-svg-to-png');

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
  const color = tinycolor(`#${hexcode}`);

  if (color.isValid()) {
    const rgb = color.toRgb();
    rgb.alpha = rgb.a;
    delete rgb.a;
    return rgb;
  } else {
    return transparent;
  }
}

const avatarsOptions = { radius: 25 };
const avatars = new Avatars.default(sprites.default, avatarsOptions);

const converterOptions = { puppeteer: { args: ['--no-sandbox'] } };

// Each converter launches a separate headless Chromium instance
// using Puppeteer. We pre-create four converters here (one for each
// avatar in the grid) in order to convert SVGs in parallel and also
// re-use the same Chromium instances for each request.
const converterA = createConverter(converterOptions);
const converterB = createConverter(converterOptions);
const converterC = createConverter(converterOptions);
const converterD = createConverter(converterOptions);

exports.avatars = async (req, res) => {
  let hashes;
  let color;
  
  try {
    const { hashes: _hashes, color: _color } = parseImgPath(req.url);
    hashes = _hashes;
    color = _color;
  } catch(e) {
    console.error(e);
    return;
  }
  
  const canvas = sharp({
    create: {
      width: 1000,
      height: 1000,
      channels: 3,
      background: color
    }
  });

   function convert(converter, hash) {
    const svg = avatars.create(hash);
    return converter.convert(svg, {
      width: 400,
      height: 400
    });
  } 

  const pngs = await Promise.all([
    convert(converterA, hashes[0]),
    convert(converterB, hashes[1]),
    convert(converterC, hashes[2]),
    convert(converterD, hashes[3]),
  ]);

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
};