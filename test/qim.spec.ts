import { QIM } from '../src/qim';
import { expect } from 'chai';
import 'mocha';

const float32toy = (size: number = 0x100) => {
  var arr = new Float32Array(size);
  for (var i = 0; i < size; ++i) {
    arr[i] = i;
  }
  return arr;
};

describe('Emeddings tests', () => {
  it('embed 1 into every value between 0-255', () => {
    const vals = float32toy();
    for (let i = 0; i < 0x100; i++) {
      const out = QIM.embed(vals[i], 1);
      expect(out).to.equal(
        Math.round(i / 4) * 4 + (Math.pow(-1, 1 + 1) * 4) / 4
      );
    }
  });

  it('embeds 0 into every value between 0-255', () => {
    const vals = float32toy();
    for (let i = 0; i < 0x100; i++) {
      const out = QIM.embed(i, 0);
      expect(out).to.equal(
        Math.round(i / 4) * 4 + (Math.pow(-1, 0 + 1) * 4) / 4
      );
    }
  });

  it('retrieves the 0 bit embedding', () => {
    const vals = float32toy();
    for (let i = 0; i < 0x100; i++) {
      const embedded = QIM.embed(i, 1);
      const out = QIM.detect(embedded);
      expect(out).to.equal(1);
    }
  });

  it('retrieves the 1 bit embedding', () => {
    const vals = float32toy();
    for (let i = 0; i < 0x100; i++) {
      const embedded = QIM.embed(i, 0);
      const out = QIM.detect(embedded);
      expect(out).to.equal(0);
    }
  });

  it('retrieves the correct bit embedding over 1-9 quantization steps', () => {
    for (let i = 1; i < 10; i++) {
      const embedded = QIM.embed(128, 0, i);
      const out = QIM.detect(embedded, i);
      expect(out).to.equal(0, i.toString());
    }
  });
});

describe('DCT manipulation tests', () => {
  it('Retrieve block capacity of DCT', () => {
    const DCT_block = Float32Array.from([
      -5,
      14,
      -20,
      17,
      0,
      0,
      0,
      3,
      -4,
      10,
      0,
      0,
      0,
      -1,
      0,
      0,
      1,
      0,
      -1,
      -2,
      -2,
      0,
      -1,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
    ]);
    var capacity = QIM.getBlockCapacity({ qDCT_block: DCT_block });
    expect(capacity).to.equal(4);
  });

  it('Embed DCT function tests', () => {
    let DCT_block = Float32Array.from([
      -5,
      14,
      -20,
      17,
      0,
      0,
      0,
      3,
      -4,
      10,
      0,
      0,
      0,
      -1,
      0,
      0,
      1,
      0,
      -1,
      -2,
      -2,
      0,
      -1,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
    ]);
    let original = DCT_block.toString();
    var embeded_DCT_block = QIM.embedQDCT(DCT_block, '1001', 4);
    expect(embeded_DCT_block.toString()).to.not.equal(original);
  });

  it('Detect DCT function tests', () => {
    let DCT_block = Float32Array.from([
      -5,
      14,
      -20,
      17,
      0,
      0,
      0,
      3,
      -4,
      10,
      0,
      0,
      0,
      -1,
      0,
      0,
      1,
      0,
      -1,
      -2,
      -2,
      0,
      -1,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
    ]);
    var capacity = QIM.getBlockCapacity({ qDCT_block: DCT_block });
    const embeded_DCT_block = QIM.embedQDCT(DCT_block, '1001', 4);
    const msg = QIM.detectQDCT(embeded_DCT_block, 4);
    expect(msg).to.equal('1001');
  });
});
