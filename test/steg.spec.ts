var fs = require('fs'),
  path = require('path');
import { expect, assert } from 'chai';
import 'mocha';
import { YASS } from '../index';

function fixture(name: string) {
  return fs.readFileSync(path.join(__dirname, 'fixtures', name));
}

describe('Test the embedding of various sizes of messages', () => {
  it('should encode a simple message into grumpycat rgba raw values', () => {
    var frameData = fixture('grumpycat.rgba');
    var rawImageData = {
      data: frameData,
      width: 320,
      height: 180,
    };
    const embed_obj = { str: 'hello', key: 'AE0F', q: 3 };
    var jpegImageData = YASS.encode(rawImageData, 50, embed_obj);
    expect(jpegImageData.width).to.equal(320);
    expect(jpegImageData.height).to.equal(180);
    fs.writeFileSync('./test/output_jpgs/grumpy_hello.jpg', jpegImageData.data);
  });

  it('should encode a simple message into grumpycat rgba raw values', () => {
    var frameData = fixture('tree-cmyk.jpg');
    frameData = YASS.decode(frameData);
    var rawImageData = {
      data: frameData.data,
      width: frameData.width,
      height: frameData.height,
    };
    const embed_obj = { str: 'hello', key: 'AE0F', q: 3 };
    var jpegImageData = YASS.encode(rawImageData, 50, embed_obj);
    expect(jpegImageData.width).to.equal(400);
    expect(jpegImageData.height).to.equal(250);
    fs.writeFileSync(
      './test/output_jpgs/tree-cmyk-hello.jpg',
      jpegImageData.data
    );
  });

  it('should encode long message into a GAN cat image', () => {
    var frameData = fixture('cat.jfif');
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
    expect(YASS.encode.bind(YASS, rawImageData, 82, embed_obj)).to.throw(Error);
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
    var jpegImageData = YASS.encode(rawImageData, 82, embed_obj);
    expect(jpegImageData.width).to.equal(512);
    expect(jpegImageData.height).to.equal(512);
    fs.writeFileSync('./test/output_jpgs/art.jpg', jpegImageData.data);
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
    var jpegImageData = YASS.encode(rawImageData, 82, embed_obj);
    expect(jpegImageData.width).to.equal(1024);
    expect(jpegImageData.height).to.equal(1024);
    fs.writeFileSync('./test/output_jpgs/person.jpg', jpegImageData.data);
  });

  it('should encode message into a GAN room image', () => {
    var frameData = fixture('room.jpg');
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
    var jpegImageData = YASS.encode(rawImageData, 82, embed_obj);
    expect(jpegImageData.width).to.equal(512);
    expect(jpegImageData.height).to.equal(512);
    fs.writeFileSync('./test/output_jpgs/room.jpg', jpegImageData.data);
  });

  it('should encode message into a GAN person image already undergone FB compression', () => {
    var frameData = fixture('person_fb.jpg');
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
    var jpegImageData = YASS.encode(rawImageData, 82, embed_obj);
    expect(jpegImageData.width).to.equal(1024);
    expect(jpegImageData.height).to.equal(1024);
    fs.writeFileSync('./test/output_jpgs/person_fb.jpg', jpegImageData.data);
  });
});

describe('Test extracting previously embedded messages', () => {
  it('should complete with output message of hello', () => {
    let fbuf = fs.readFileSync('./test/output_jpgs/grumpy_hello.jpg');
    var imageData = YASS.decode(fbuf, { withKey: { key: 'AE0F', q: 3 } });
    expect(imageData.message).to.equal('hello');
  });

  it('should retrieve long key from room jpeg', () => {
    let fbuf = fs.readFileSync('./test/output_jpgs/room.jpg');
    var imageData = YASS.decode(fbuf, { withKey: { key: 'AE0F', q: 3 } });
    expect(imageData.message).to.equal(
      'QmaxPRLxaDMazUjfv1drnBf4DrDhxjX5RrCEhhPsJDV3Uj'
    );
  });

  it('should retrieve key from person jpeg', () => {
    let fbuf = fs.readFileSync('./test/output_jpgs/person.jpg');
    var imageData = YASS.decode(fbuf, { withKey: { key: 'AE0F', q: 3 } });
    expect(imageData.message).to.equal(
      'QmaxPRLxaDMazUjfv1drnBf4DrDhxjX5RrCEhhPsJDV3Uj'
    );
  });

  it('should retrieve key from person_fb jpeg', () => {
    let fbuf = fs.readFileSync('./test/output_jpgs/person_fb.jpg');
    var imageData = YASS.decode(fbuf, { withKey: { key: 'AE0F', q: 3 } });
    expect(imageData.message).to.equal(
      'QmaxPRLxaDMazUjfv1drnBf4DrDhxjX5RrCEhhPsJDV3Uj'
    );
  });

  it('should retrieve key from person_fb_u jpeg', () => {
    let fbuf = fs.readFileSync('./test/output_jpgs/person_fb_u.jpg');
    console.log(fbuf);
    var imageData = YASS.decode(fbuf, { withKey: { key: 'AE0F', q: 3 } });
    expect(imageData.message).to.equal(
      'QmaxPRLxaDMazUjfv1drnBf4DrDhxjX5RrCEhhPsJDV3Uj'
    );
  });
});
