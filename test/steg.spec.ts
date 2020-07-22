var fs = require('fs'),
  path = require('path'),
  jpeg = require('../index');
import { expect, assert } from 'chai';
import 'mocha';

function fixture(name: string) {
  return fs.readFileSync(path.join(__dirname, 'fixtures', name));
}

describe('Test the embedding of various sizes of messages', () => {
  it('should complete without error and save valid jpg', () => {
    var frameData = fixture('grumpycat.rgba');
    var rawImageData = {
      data: frameData,
      width: 320,
      height: 180,
    };
    const embed_obj = { str: 'hello', key: 'AE0F', q: 3 };
    var jpegImageData = jpeg.encode(rawImageData, 50, embed_obj);
    expect(jpegImageData.width).to.equal(320);
    expect(jpegImageData.height).to.equal(180);
    var expected = fixture('grumpycat-50.jpg');
    expect(jpegImageData.data).to.not.eq(expected);
    fs.writeFileSync('./test/output_jpgs/grumpy_hello.jpg', jpegImageData.data);
  });
});

describe('Test extracting previously embedded messages', () => {
  it('should complete without error and properly read message', () => {
    let fbuf = fs.readFileSync('./test/output_jpgs/grumpy_hello.jpg');
    var imageData = jpeg.decode(fbuf, { withKey: { key: 'AE0F', q: 3 } });
    expect(imageData.message).to.equal('hello');
  });
});
