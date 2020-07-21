import { RepeatAccumulation } from '../src/repeat_accumulate';
import { expect } from 'chai';
import 'mocha';

function getRandomInt(min: number, max: number): number {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

describe('encode function tests', () => {
  it('Ensure different keys get different results over 10 iterations', () => {
    for (let i = 0; i < 10; i++) {
      const message = getRandomInt(0, 255).toString(2);
      const key1 = getRandomInt(1, 100);
      const encoded_msg1 = RepeatAccumulation.encode(message, 7, key1).message;
      const key2 = getRandomInt(1, 100);
      const encoded_msg2 = RepeatAccumulation.encode(message, 7, key2).message;
      if (key1 == key2) {
        expect(encoded_msg1).to.equal(
          encoded_msg2,
          key1.toString() + '|' + key2.toString()
        );
      } else {
        expect(encoded_msg1).to.not.equal(
          encoded_msg2,
          key1.toString() + '|' + key2.toString()
        );
      }
    }
  });
  it('Ensure same keys get same results over 10 iterations', () => {
    for (let i = 0; i < 10; i++) {
      const message = getRandomInt(0, 255).toString(2);
      const key = getRandomInt(1, 100);
      const encoded_msg1 = RepeatAccumulation.encode(message, 7, key).message;
      const encoded_msg2 = RepeatAccumulation.encode(message, 7, key).message;
      expect(encoded_msg1).to.equal(encoded_msg2, key.toString(16));
    }
  });
});

describe('decode function tests', () => {
  it('Ensure messages can be decoded', () => {
    for (let i = 0; i < 10; i++) {
      const message = getRandomInt(0, 255).toString(2);
      const key = getRandomInt(1, 100);
      const encoded_msg = RepeatAccumulation.encode(message, 7, key).message;
      const decoded = RepeatAccumulation.decode(encoded_msg, 7, key);
      expect(decoded).to.equal(message, key.toString(16));
    }
  });
});
