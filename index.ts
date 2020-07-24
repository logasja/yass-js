import { encode } from './src/encoder';
import { decode } from './src/decoder';
import { RawImageData, EmbedMessage, DecodePrefs } from './src/types';

export class YASS {
  static encode(
    imgData: RawImageData<Buffer | Uint8Array>,
    qu?: number,
    message?: EmbedMessage
  ): { data: Buffer | Uint8Array; width: number; height: number } {
    return encode(imgData, qu, message);
  }

  static decode(
    jpegData: Buffer | Uint8Array,
    userOpts: DecodePrefs = {}
  ): RawImageData<Buffer | Uint8Array> {
    var opts: DecodePrefs = {
      ...userOpts,
      ...{ formatAsRGBA: true, useTArray: true },
    };
    return decode(Buffer.from(jpegData), opts);
  }
}

export class JPEG {
  static encode(
    imgData: RawImageData<Buffer | Uint8Array>,
    qu?: number
  ): { data: Buffer | Uint8Array; width: number; height: number } {
    return encode(imgData, qu);
  }

  static decode(
    jpegData: Buffer | Uint8Array,
    userOpts?: DecodePrefs
  ): RawImageData<Buffer | Uint8Array> {
    return decode(Buffer.from(jpegData), userOpts);
  }
}
