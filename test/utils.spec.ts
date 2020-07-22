import * as utils from '../src/utils';
import { expect } from 'chai';
import 'mocha';

describe('Binarize tests', () => {
  it('Binarize function test', () => {
    const out = utils.binarize('hello');
    expect(out).to.equal('0110100001100101011011000110110001101111');
  });
  it('Debinarize function test', () => {
    const out = utils.debinarize('0110100001100101011011000110110001101111');
    expect(out).to.equal('hello');
  });
});

describe('Message tail tests', () => {
  it('Add message tail function test', () => {
    const out = utils.addMessageTail(
      '0110100001100101011011000110110001101111',
      6
    );
    expect(out).to.equal(
      '0110100001100101011011000110110001101111' + '1'.repeat(6 * 8)
    );
  });

  it('Get message tail function test', () => {
    const out = utils.getMessageTail(6);
    expect(out.threshold).to.equal(16);
    expect(out.LCM).to.equal(48);
  });
});
