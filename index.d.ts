export interface RawImageData<T> {
  width: number;
  height: number;
  data: T;
  DCT?: DCTs;
  YCbCr?: YCbCr;
}

export interface DCTs {
  Y: Int32Array[][],
  U?: Int32Array[][],
  V?: Int32Array[][]
}

export interface YCbCr {
  Y: Uint8Array[],
  Cb?: Uint8Array[],
  Cr?: Uint8Array[]  
}

type BufferRet = RawImageData<Buffer>;
type UintArrRet = RawImageData<Uint8Array>;

type ImageData = BufferRet | UintArrRet;
type BufferLike = Buffer | Uint8Array | ArrayLike<number> | Iterable<number> | ArrayBuffer;

export declare function encode(imgData: RawImageData<BufferLike>, quality?: number, ycbcr?:YCbCr): BufferRet;

export declare function decode(
  jpegData: BufferLike,
  opts: {
    useTArray: true;
    colorTransform?: boolean;
    formatAsRGBA?: boolean;
    tolerantDecoding?: boolean;
    withYCbCr?: boolean;
    withDCTs?: boolean;
    maxResolutionInMP?: number;
    maxMemoryUsageInMB?: number;
  },
): UintArrRet & {comments?: string[]};
export declare function decode(
  jpegData: BufferLike,
  opts?: {
    useTArray?: false;
    colorTransform?: boolean;
    formatAsRGBA?: boolean;
    tolerantDecoding?: boolean;
    withYCbCr?: boolean;
    withDCTs?: boolean;
    maxResolutionInMP?: number;
    maxMemoryUsageInMB?: number;
  },
): BufferRet & {comments?: string[]};
