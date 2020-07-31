//file to implement YASS data hiding algorithm

import { deflate } from 'zlib';

var fround =
  Math.fround ||
  function (x) {
    return x;
  };

export class QIM {
  static readonly AC_COORDS = 19;

  //function definitions
  /*
  function to embed 1 bit data into a number using QIM
  @inputs:
      x(int): cover data
      m(int 0 or 1 or -1): bit wait to be embeded
      d(number, defaultly as 4): quantizer's step
  @output:
      y(number): cover data that embeded with secret message bit
  */
  static embed(x: number, m: number, d: number = 4): number {
    var y = fround(Math.round(x / d) * d + Math.pow(-1, m + 1) * (d / 4));
    return y;
  }

  /*
  function to detect 1 bit from into a number using QIM
  @inputs:
      x(int): cover data
      d(number, defaultly as 4): quantizer's step
  @output:
      m(int 0 or 1 or -1): embeded bit
  */
  static detect(y: number, delta: number = 4): number {
    var z0 = QIM.embed(y, 0, delta);
    var z1 = QIM.embed(y, 1, delta);
    //calculate the difference between y and z0, z1
    var d0 = Math.abs(y - z0);
    var d1 = Math.abs(y - z1);
    //compare d0 and d1, if d0<d1, then recognized this message bit as 0 (and the original DCT value is z0), otherwise, recognize this message bit as 1 (and the original DCT value is z1)
    var m = d0 < d1 ? 0 : 1;
    //return m
    return m;
  }

  // Quantize to nearest integer and take magnitude to get r_k
  static quantI(
    qDCT_block: Float32Array,
    t: number = 8,
    delta: number = 4,
    N: number = QIM.AC_COORDS
  ): { idx: number; rk: number; t: boolean }[] {
    // console.log('Quant I');
    let out: { idx: number; rk: number; t: boolean }[] = [];
    // Skip the first value
    for (var k = 1; k < N; ++k) {
      // Quantization taken from https://en.wikipedia.org/wiki/Quantization_(signal_processing)
      var r_k = delta * Math.floor(qDCT_block[k] / delta + 0.5);
      r_k = Math.abs(r_k);
      var r_k = delta * Math.floor(qDCT_block[k] / delta + 0.5);
      r_k = Math.abs(r_k);
      // console.log(r_k);
      if (r_k >= t - 1) {
        if (r_k < Math.floor(t + (delta + 4) / 8)) {
          qDCT_block[k] = qDCT_block[k] > 0 ? t - 2 : 2 - t;
        } else if (r_k <= t + delta / 4 + 2) {
          qDCT_block[k] =
            qDCT_block[k] > 0 ? t + delta / 4 + 3 : -(t + delta / 4 + 3);
          out.push({ idx: k, rk: r_k, t: false });
        } else {
          out.push({ idx: k, rk: r_k, t: false });
        }
      } else {
        out.push({ idx: k, rk: r_k, t: true });
      }
      // console.log(k);
    }
    return out;
  }

  /*
  function to get 8x8 DCT Coefficients block's QIM data hiding capacity 
  @inputs:
      DCT_block(number array [8*[8]]): 8x8 quantized DCT Coefficients block
      t(number>0, default as 2): threshold for data embedding
  @output:
      capacity(number): how many bit can be embeded in the input block
  @example:
      var data = new Array(64);
      for(var i=0; i<64; ++i)
      {
          data[i] = new Array(64);
          for(var j=0; j<64; ++j)
          {
              data[i][j] = i*64 + j;
          }
      }
      var blocks = Process.extractBxBBlocks(data, 10);
      var subblocks = Process.extract_8x8_subblocks(blocks, 1.5);
      var DCT_block = Process.DCT_2D_8x8(subblocks[0][0]);
      var capacity = getBlockCapacity(DCT_block);
      console.log(capacity);
  */
  static getBlockCapacity({
    qDCT_block,
    t = 8,
    delta = 4,
    N = QIM.AC_COORDS,
  }: {
    qDCT_block: Float32Array;
    t?: number;
    delta?: number;
    N?: number;
  }): number {
    return QIM.quantI(qDCT_block, t, delta, N).filter((val) => {
      return val.t == false;
    }).length;
  }

  /*
  The first N of these coefficients are used for hiding after excluding
  the dc coefficient (k = 0 term).
  @inputs:
      DCT_block(number array [8*[8]]): 8x8 quantized DCT Coefficients block
      data(string formed by '0' amd '1', or '-1'): data to be embeded, if data = '-1', retun the original subblock 
      delta(number, defaultly as 4): quantizer's step
      t(number>0, default as 2): threshold for data embedding
  @output:
      embeded_DCT_block(number array [8*[8]]): 8x8 DCT Coefficients block with embeded data
  @example:
      var data = new Array(64);
      for(var i=0; i<64; ++i)
      {
          data[i] = new Array(64);
          for(var j=0; j<64; ++j)
          {
              data[i][j] = i*64 + j;
          }
      }
      var blocks = Process.extractBxBBlocks(data, 10);
      var subblocks = Process.extract_8x8_subblocks(blocks, 1.5);
      var DCT_block = Process.DCT_2D_8x8(subblocks[0][0]);
      var embeded_DCT_block = embedDCT(DCT_block, '10110', 4);
      console.log(embeded_DCT_block);
  */
  static embedQDCT(
    qDCT_block: Float32Array,
    data: string,
    delta: number = 4,
    t: number = 8,
    N: number = QIM.AC_COORDS
  ): Float32Array {
    if (data == '-1') {
      console.log('**********');
      return qDCT_block;
    }

    var embeddable = QIM.quantI(qDCT_block, t, delta, N);

    // embed bit into each available coefficient
    let i = 0;
    embeddable.forEach((coef) => {
      if (coef.t) {
        qDCT_block[coef.idx] = coef.rk;
      } else if (data.charAt(i)) {
        qDCT_block[coef.idx] = QIM.embed(
          qDCT_block[coef.idx],
          Number.parseInt(data.charAt(i)),
          delta
        );
        ++i;
      }
    });

    if (qDCT_block.includes(Number.NaN)) {
      throw Error(
        'data: ' +
          data +
          '\nEmbedding failed on table:\n' +
          qDCT_block.toString()
      );
    }

    return qDCT_block;
  }

  /*
  function to detect embeded data from 8x8 DCT Coefficients block using QIM 
  @inputs:
      embeded_DCT_block(number array [8*[8]]): 8x8 DCT Coefficients block with embeded data
      delta(number, defaultly as 4): quantizer's step
      t(number>0, default as 2): threshold for data embedding
  @output:
      data(string formed by '0' amd '1'): data to be embeded 
  @example:
      var data = new Array(64);
      for(var i=0; i<64; ++i)
      {
          data[i] = new Array(64);
          for(var j=0; j<64; ++j)
          {
              data[i][j] = i*64 + j;
          }
      }
      var blocks = Process.extractBxBBlocks(data, 10);
      var subblocks = Process.extract_8x8_subblocks(blocks, 1.5);
      var DCT_block = Process.DCT_2D_8x8(subblocks[0][0]);
      var embeded_DCT_block = embedDCT(DCT_block, '10110', 4);
      var msg = detectDCT(embeded_DCT_block);
      console.log(msg);
  */
  static detectQDCT(
    qDCT_block: Float32Array,
    delta: number = 4,
    t: number = 8,
    N: number = QIM.AC_COORDS
  ): string {
    //initial the data string
    var data = '';

    // Get list of the embeddable parts of the block
    var embeddable = QIM.quantI(qDCT_block, t, delta, N);

    embeddable.forEach((element) => {
      if (element.t == false) {
        let m = QIM.detect(qDCT_block[element.idx], delta);
        data += m.toString();
      }
    });
    return data;
  }
}
