var fs = require('fs'),
  path = require('path');
import { expect, assert } from 'chai';
import 'mocha';
import { JPEG } from '../index';

function fixture(name: string) {
  return fs.readFileSync(path.join(__dirname, 'fixtures', name));
}

const SUPER_LARGE_JPEG_BASE64 =
  '/9j/wJ39sP//DlKWvX+7xPlXkJa9f7v8DoDVAAD//zb6QAEAI2cBv3P/r4ADpX8Jf14AAAAAgCPE+VeQlr1/uwCAAAAVALNOjAGP2lIS';

const SUPER_LARGE_JPEG_BUFFER = Buffer.from(SUPER_LARGE_JPEG_BASE64, 'base64');
describe('Jpeg tests', () => {
  it('should be able to decode a JPEG', function () {
    var jpegData = fixture('grumpycat.jpg');
    var rawImageData = JPEG.decode(jpegData);
    expect(rawImageData.width).to.equal(320);
    expect(rawImageData.height).to.equal(180);
    var expected = fixture('grumpycat.rgba');
    expect(rawImageData.data).to.deep.equal(expected);
  });

  it('should be able to decode a JPEG with fill bytes', function () {
    var jpegData = fixture('fillbytes.jpg');
    var rawImageData = JPEG.decode(jpegData);
    expect(rawImageData.width).to.equal(704);
    expect(rawImageData.height).to.equal(576);
  });

  it('should be able to decode a JPEG with RST intervals', function () {
    var jpegData = fixture('redbox-with-rst.jpg');
    var rawImageData = JPEG.decode(jpegData);
    var expected = fixture('redbox.jpg');
    var rawExpectedImageData = JPEG.decode(expected);
    expect(rawImageData.data).to.deep.equal(rawExpectedImageData.data);
  });

  it('should be able to decode a JPEG with trailing bytes', function () {
    var jpegData = fixture('redbox-with-trailing-bytes.jpg');
    var rawImageData = JPEG.decode(jpegData);
    var expected = fixture('redbox.jpg');
    var rawExpectedImageData = JPEG.decode(expected);
    expect(rawImageData.data).to.deep.equal(rawExpectedImageData.data);
  });

  it('should be able to decode a grayscale JPEG', function () {
    var jpegData = fixture('apsara.jpg');
    var rawImageData = JPEG.decode(jpegData);
    expect(rawImageData.width).to.equal(580);
    expect(rawImageData.height).to.equal(599);
    // No longer available with a comment
    // expect(rawImageData.comments).to.deep.equal(['File source: http://commons.wikimedia.org/wiki/File:Apsara-mit-Sitar.jpg']);
    var expected = fixture('apsara.rgba');
    expect(rawImageData.data).to.deep.equal(expected);
  });

  it('should be able to decode a CMYK jpeg with correct colors', function () {
    var jpegData = fixture('tree-cmyk.jpg');
    var rawImageData = JPEG.decode(jpegData);
    expect(rawImageData.width).to.equal(400);
    expect(rawImageData.height).to.equal(250);
    var expected = fixture('tree-cmyk.cmyk');
    expect(rawImageData.data).to.deep.equal(expected);
  });

  it('should be able to decode a CMYK jpeg with correct colors without transform', function () {
    var jpegData = fixture('tree-cmyk-notransform.jpg');
    var rawImageData = JPEG.decode(jpegData);
    expect(rawImageData.width).to.equal(400);
    expect(rawImageData.height).to.equal(250);
    var expected = fixture('tree-cmyk-notransform.cmyk');
    expect(rawImageData.data).to.deep.equal(expected);
  });

  it('should be able to decode an RGB jpeg with correct colors', function () {
    var jpegData = fixture('tree-rgb.jpg');
    var rawImageData = JPEG.decode(jpegData);
    expect(rawImageData.width).to.equal(400);
    expect(rawImageData.height).to.equal(250);
    var expected = fixture('tree-rgb.rgba');
    expect(rawImageData.data).to.deep.equal(expected);
  });

  it('should be able to decode a greyscale CMYK jpeg with correct colors', function () {
    var jpegData = fixture('cmyk-grey.jpg');
    var rawImageData = JPEG.decode(jpegData);
    expect(rawImageData.width).to.equal(300);
    expect(rawImageData.height).to.equal(389);
    var expected = fixture('cmyk-grey.cmyk');
    expect(rawImageData.data).to.deep.equal(expected);
  });

  it('should be able to decode an adobe CMYK jpeg with correct colors', function () {
    var jpegData = fixture('cmyktest.jpg');
    var rawImageData = JPEG.decode(jpegData);
    expect(rawImageData.width).to.equal(300);
    expect(rawImageData.height).to.equal(111);
    var expected = fixture('cmyktest.cmyk');
    expect(rawImageData.data).to.deep.equal(expected);

    var jpegData2 = fixture('plusshelf-drawing.jpg');
    var rawImageData2 = JPEG.decode(jpegData2);
    expect(rawImageData2.width).to.equal(350);
    expect(rawImageData2.height).to.equal(233);
    var expected2 = fixture('plusshelf-drawing.cmyk');
    expect(rawImageData2.data).to.deep.equal(expected2);
  });

  it('should be able to decode a unconventional table JPEG', function () {
    var jpegData = fixture('unconventional-table.jpg');
    var rawImageData = JPEG.decode(jpegData);
    expect(rawImageData.width).to.equal(1920);
    expect(rawImageData.height).to.equal(1200);
  });

  it('should be able to decode a progressive JPEG', function () {
    var jpegData = fixture('skater-progressive.jpg');
    var rawImageData = JPEG.decode(jpegData);
    expect(rawImageData.width).to.equal(256);
    expect(rawImageData.height).to.equal(256);
    var expected = fixture('skater-progressive.rgba');
    expect(rawImageData.data).to.deep.equal(expected);
  });

  it('should be able to decode a progressive JPEG the same as non-progressive', function () {
    var jpegData = fixture('skater.jpg');
    var rawImageData = JPEG.decode(jpegData);

    var otherJpegData = fixture('skater-progressive.jpg');
    var otherRawImageData = JPEG.decode(otherJpegData);

    expect(rawImageData.width).to.equal(otherRawImageData.width);
    expect(rawImageData.height).to.equal(otherRawImageData.height);
    expect(rawImageData.data).to.deep.equal(otherRawImageData.data);
  });

  it('should be able to encode a JPEG', function () {
    var frameData = fixture('grumpycat.rgba');
    var rawImageData = {
      data: frameData,
      width: 320,
      height: 180,
    };
    var jpegImageData = JPEG.encode(rawImageData, 50);
    expect(jpegImageData.width).to.equal(320);
    expect(jpegImageData.height).to.equal(180);
    var expected = fixture('grumpycat-50.jpg');
    expect(jpegImageData.data).to.deep.equal(expected);
  });

  it('should be able to create a JPEG from an array', function () {
    var width = 320,
      height = 180;
    var frameData = Buffer.alloc(width * height * 4);
    var i = 0;
    while (i < frameData.length) {
      frameData[i++] = 0xff; // red
      frameData[i++] = 0x00; // green
      frameData[i++] = 0x00; // blue
      frameData[i++] = 0xff; // alpha - ignored in JPEGs
    }
    var rawImageData = {
      data: frameData,
      width: width,
      height: height,
    };
    var jpegImageData = JPEG.encode(rawImageData, 50);
    expect(jpegImageData.width).to.equal(width);
    expect(jpegImageData.height).to.equal(height);
    var expected = fixture('redbox.jpg');
    expect(jpegImageData.data).to.deep.equal(expected);
  });

  it('should be able to decode a JPEG into a typed array', function () {
    var jpegData = fixture('grumpycat.jpg');
    var rawImageData = JPEG.decode(jpegData, { useTArray: true });
    expect(rawImageData.width).to.equal(320);
    expect(rawImageData.height).to.equal(180);
    var expected = fixture('grumpycat.rgba');
    expect(rawImageData.data).to.deep.equal(new Uint8Array(expected));
    assert.ok(rawImageData.data instanceof Uint8Array, 'data is a typed array');
  });

  it('should be able to decode a JPEG from a typed array into a typed array', function () {
    var jpegData = fixture('grumpycat.jpg');
    var rawImageData = JPEG.decode(new Uint8Array(jpegData), {
      useTArray: true,
    });
    expect(rawImageData.width).to.equal(320);
    expect(rawImageData.height).to.equal(180);
    var expected = fixture('grumpycat.rgba');
    expect(rawImageData.data).to.deep.equal(new Uint8Array(expected));
    assert.ok(rawImageData.data instanceof Uint8Array, 'data is a typed array');
  });

  it('should be able to decode a JPEG with options', function () {
    var jpegData = fixture('grumpycat.jpg');
    var rawImageData = JPEG.decode(new Uint8Array(jpegData), {
      useTArray: true,
      colorTransform: false,
    });
    expect(rawImageData.width).to.equal(320);
    expect(rawImageData.height).to.equal(180);
    var expected = fixture('grumpycat-nocolortrans.rgba');
    expect(rawImageData.data).to.deep.equal(new Uint8Array(expected));
    assert.ok(rawImageData.data instanceof Uint8Array, 'data is a typed array');
  });

  it('should be able to decode a JPEG with YCbCr options', function () {
    var jpegData = fixture('grumpycat.jpg');
    var rawImageData = JPEG.decode(new Uint8Array(jpegData), {
      useTArray: true,
      withYCbCr: true,
    });
    expect(rawImageData.width).to.equal(320);
    expect(rawImageData.height).to.equal(180);
    expect(rawImageData.YCbCr!.Y.length).to.deep.equal(180);
    expect(rawImageData.YCbCr!.Y[0].length).to.deep.equal(320);
  });

  // it('should be able to encode a JPEG with YCbCr input', function () {
  //   var jpegData = fixture('grumpycat.jpg');
  //   var rawImageData = JPEG.decode(new Uint8Array(jpegData), {
  //     useTArray: true,
  //     withYCbCr: true,
  //   });
  //   expect(rawImageData.width).to.equal(320);
  //   expect(rawImageData.height).to.equal(180);
  //   expect(rawImageData.YCbCr.Y.length).to.deep.equal(180);
  //   expect(rawImageData.YCbCr.Y[0].length).to.deep.equal(320);

  //   fail();
  // });

  it('should be able to decode a JPEG with DCT options', function () {
    var jpegData = fixture('grumpycat.jpg');
    var rawImageData = JPEG.decode(new Uint8Array(jpegData), {
      useTArray: true,
      withDCTs: true,
    });
    expect(rawImageData.DCT!.Y[0][0].length).to.deep.equal(64);
  });

  it('should be able to decode a JPEG into RGB', function () {
    var jpegData = fixture('grumpycat.jpg');
    var rawImageData = JPEG.decode(new Uint8Array(jpegData), {
      useTArray: true,
      formatAsRGBA: false,
    });
    expect(rawImageData.width).to.equal(320);
    expect(rawImageData.height).to.equal(180);
    var expected = fixture('grumpycat.rgb');
    expect(rawImageData.data).to.deep.equal(new Uint8Array(expected));
    assert.ok(rawImageData.data instanceof Uint8Array, 'data is a typed array');
  });

  it('should be able to encode/decode image with exif data', function () {
    var jpegData = fixture('grumpycat.jpg');
    var imageData = JPEG.decode(new Uint8Array(jpegData));
    assert.ok(imageData.exif, 'decodes an exif buffer');
    var encodedData = JPEG.encode(imageData);
    var loopImageData = JPEG.decode(new Uint8Array(encodedData.data));
    expect(loopImageData.exif).to.deep.equal(imageData.exif);
  });

  it('should be able to decode large images within memory limits', () => {
    var jpegData = fixture('black-6000x6000.jpg');
    var rawImageData = JPEG.decode(jpegData);
    expect(rawImageData.width).to.equal(6000);
    expect(rawImageData.height).to.equal(6000);
  }).timeout(5000);

  // See https://github.com/eugeneware/jpeg-js/issues/53
  it('should limit resolution exposure', function () {
    expect(() => JPEG.decode(SUPER_LARGE_JPEG_BUFFER)).to.throw(
      'maxResolutionInMP limit exceeded by 141MP'
    );
  });

  it('should limit memory exposure', function () {
    expect(() =>
      JPEG.decode(SUPER_LARGE_JPEG_BUFFER, { maxResolutionInMP: 500 })
    ).to.throw(/maxMemoryUsageInMB limit exceeded by at least \d+MB/);

    // Make sure the limit resets each decode.
    var jpegData = fixture('grumpycat.jpg');
    expect(() => JPEG.decode(jpegData)).not.to.throw();
  }).timeout(3000);
});
