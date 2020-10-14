var fs = require('fs'),
  path = require('path');
import { expect, assert } from 'chai';
import 'mocha';
import { JPEG, YASS } from '../index';

function fixture(name: string) {
  return fs.readFileSync(path.join(__dirname, 'fixtures', name));
}

describe('Jpeg non-standard QT tests', () => {
  it('should be able to encode a JPEG with facebook QTs', function () {
    var frameData = fixture('grumpycat.rgba');
    var rawImageData = {
      data: frameData,
      width: 320,
      height: 180,
    };
    var jpegImageData = JPEG.encode(rawImageData, 50, 'facebook');
    expect(jpegImageData.width).to.equal(320);
    expect(jpegImageData.height).to.equal(180);
    var expected = fixture('grumpycat-50.jpg');
    expect(jpegImageData.data.toString()).to.deep.equal(expected.toString());
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
    var jpegImageData = JPEG.encode(rawImageData, 50, 'facebook');
    expect(jpegImageData.width).to.equal(width);
    expect(jpegImageData.height).to.equal(height);
    var expected = fixture('redbox.jpg');
    expect(jpegImageData.data.toString()).to.deep.equal(expected.toString());
  });

  it('should encode message into a GAN art image', () => {
    var frameData = fixture('art.jfif');
    frameData = YASS.decode(frameData);
    var rawImageData = {
      data: frameData.data,
      width: frameData.width,
      height: frameData.height,
    };
    const embed_obj = {
      str: 'QmaxPRLxaDMazUjfv1drnBf4DrDhxjX5RrCEhhPsJDV3Uj',
      key: 'AE0F',
      q: 3,
    };
    var jpegImageData = YASS.encode(rawImageData, 82, embed_obj, 'facebook');
    expect(jpegImageData.width).to.equal(512);
    expect(jpegImageData.height).to.equal(512);
    fs.writeFileSync(
      './test/output_jpgs/art_predefinedQT.jpg',
      jpegImageData.data
    );
  });

  it('should encode message into a GAN jpg person image', () => {
    var frameData = fixture('person.jfif');
    frameData = YASS.decode(frameData);
    var rawImageData = {
      data: frameData.data,
      width: frameData.width,
      height: frameData.height,
    };
    const embed_obj = {
      str: 'QmaxPRLxaDMazUjfv1drnBf4DrDhxjX5RrCEhhPsJDV3Uj',
      key: 'AE0F',
      q: 3,
    };
    var jpegImageData = YASS.encode(rawImageData, 82, embed_obj, 'facebook');
    expect(jpegImageData.width).to.equal(1024);
    expect(jpegImageData.height).to.equal(1024);
    fs.writeFileSync(
      './test/output_jpgs/person_predefinedQT.jpg',
      jpegImageData.data
    );
  });
});
