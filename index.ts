import { encode } from './src/encoder';
import { decode } from './src/decoder';
import { RawImageData, EmbedMessage, DecodePrefs } from './src/types';

export class YASS {
  static encode(
    imgData: RawImageData<Buffer | Uint8Array>,
    qu?: number,
    message?: EmbedMessage,
    QTs?: string | { Y: Uint8Array; UV: Uint8Array }
  ): { data: Buffer | Uint8Array; width: number; height: number } {
    return encode(imgData, qu, message, QTs);
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
    qu?: number,
    QTs?: string | { Y: Uint8Array; UV: Uint8Array }
  ): { data: Buffer | Uint8Array; width: number; height: number } {
    return encode(imgData, qu, undefined, QTs);
  }

  static decode(
    jpegData: Buffer | Uint8Array,
    userOpts?: DecodePrefs
  ): RawImageData<Buffer | Uint8Array> {
    return decode(Buffer.from(jpegData), userOpts);
  }
}
