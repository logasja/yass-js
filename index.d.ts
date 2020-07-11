export interface RawImageData<T> {
  width: number;
  height: number;
  data: T;
  dct_coeffs?: {
    Y: Int32Array[][] | undefined,
    U: Int32Array[][] | undefined,
    V: Int32Array[][] | undefined
  };
  quant?: {
    Y: Int32Array[] | undefined,
    U: Int32Array[] | undefined,
    V: Int32Array[] | undefined
  }
}

type BufferRet = RawImageData<Buffer>;
type UintArrRet = RawImageData<Uint8Array>;

type ImageData = BufferRet | UintArrRet;
type BufferLike = Buffer | Uint8Array | ArrayLike<number> | Iterable<number> | ArrayBuffer;

export declare function encode(imgData: RawImageData<BufferLike>, quality?: number, newDCTTable?: any, is_input_yuv?:boolean): BufferRet;

export declare function decode(
  jpegData: BufferLike,
  opts: {
    useTArray: true;
    colorTransform?: boolean;
    formatAsRGBA?: boolean;
    tolerantDecoding?: boolean;
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
    maxResolutionInMP?: number;
    maxMemoryUsageInMB?: number;
  },
): BufferRet & {comments?: string[]};
