export interface RawImageData<T> {
  width: number;
  height: number;
  data: T;
  DCT?: DCTs;
  YCbCr?: YCbCr;
  exif?: Uint8Array;
  comments?: string[];
}

export interface DCTs {
  Y: Int32Array[][];
  U?: Int32Array[][];
  V?: Int32Array[][];
}

export interface YCbCr {
  Y: Uint8Array[];
  Cb?: Uint8Array[];
  Cr?: Uint8Array[];
}

export interface DecodePrefs {
  // "undefined" means "Choose whether to transform colors based on the image’s color model."
  colorTransform?: boolean;
  useTArray?: boolean;
  formatAsRGBA?: boolean;
  tolerantDecoding?: boolean;
  maxResolutionInMP?: number; // Don't decode more than 100 megapixels
  maxMemoryUsageInMB?: number; // Don't decode if memory footprint is more than 512MB
  withYCbCr?: boolean; // Return the YCbCr arrays
  withDCTs?: boolean; // Return the decoded DCTs
}

export type BufferRet = RawImageData<Buffer>;
export type UintArrRet = RawImageData<Uint8Array>;

export type ImageData = BufferRet | UintArrRet;
export type BufferLike =
  | Buffer
  | Uint8Array
  | ArrayLike<number>
  | Iterable<number>
  | ArrayBuffer;
