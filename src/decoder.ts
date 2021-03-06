/* -*- tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */
/*
   Copyright 2011 notmasteryet

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

import { RawImageData, BufferLike, DecodePrefs, DCTs, YCbCr } from './types';
import { clampTo8bit, debinarize, binarize, getMessageTail } from './utils';
import { QIM } from './qim';
import { RepeatAccumulation } from './repeat_accumulate';

// - The JPEG specification can be found in the ITU CCITT Recommendation T.81
//   (www.w3.org/Graphics/JPEG/itu-t81.pdf)
// - The JFIF specification can be found in the JPEG File Interchange Format
//   (www.w3.org/Graphics/JPEG/jfif3.pdf)
// - The Adobe Application-Specific JPEG markers in the Supporting the DCT Filters
//   in PostScript Level 2, Technical Note #5116
//   (partners.adobe.com/public/developer/en/ps/sdk/5116.DCT_Filter.pdf)

interface HuffmanTableValue {
  children: any;
  index: number;
}

interface ComponentsValue {
  lines: Uint8Array[];
  scaleX: number;
  scaleY: number;
}

interface Adobe {
  version: number;
  flags0: number;
  flags1: number;
  transformCode: number;
}

interface JFIF {
  version: { major: number; minor: number };
  densityUnits: number;
  xDensity: number;
  yDensity: number;
  thumbWidth: number;
  thumbHeight: number;
  thumbData: Uint8Array;
}

interface ImageFrameComponent {
  h: number;
  v: number;
  quantizationIdx: number;
  blocksPerLine?: number;
  blocksPerColumn?: number;
  blocks?: Float32Array[][];
  htDC?: Array<any>;
  htAC?: Array<any>;
  qT?: Int32Array;
  pred?: number;
}

interface ImageFrameComponents {
  [index: string]: ImageFrameComponent;
}

interface ImageFrame {
  extended?: boolean;
  progressive?: boolean;
  precision?: number;
  scanLines?: number;
  samplesPerLine?: number;
  components?: ImageFrameComponents;
  componentsOrder?: number[];
  maxH?: number;
  maxV?: number;
  mcusPerLine?: number;
  mcusPerColumn?: number;
}

class JpegConstants {
  // prettier-ignore
  static readonly dctZigZag = new Uint8Array([
    0,
    1,  8,
    16, 9,  2,
    3,  10, 17, 24,
    32, 25, 18, 11, 4,
    5,  12, 19, 26, 33, 40,
    48, 41, 34, 27, 20, 13, 6,
    7,  14, 21, 28, 35, 42, 49, 56,
    57, 50, 43, 36, 29, 22, 15,
    23, 30, 37, 44, 51, 58,
    59, 52, 45, 38, 31,
    39, 46, 53, 60,
    61, 54, 47,
    55, 62,
    63
  ]);

  static readonly dctCos1 = 4017; // cos(pi/16)
  static readonly dctSin1 = 799; // sin(pi/16)
  static readonly dctCos3 = 3406; // cos(3*pi/16)
  static readonly dctSin3 = 2276; // sin(3*pi/16)
  static readonly dctCos6 = 1567; // cos(6*pi/16)
  static readonly dctSin6 = 3784; // sin(6*pi/16)
  static readonly dctSqrt2 = 5793; // sqrt(2)
  static readonly dctSqrt1d2 = 2896; // sqrt(2) / 2
}

class JpegImage {
  constructor(data: Uint8Array, opts: DecodePrefs) {
    this.opts = opts;
    // If this constructor ever supports async decoding this will need to be done differently.
    // Until then, treating as singleton limit is fine.
    this.resetMaxMemoryUsage(this.opts.maxMemoryUsageInMB! * 1024 * 1024);
    this.height = 0;
    this.width = 0;
    this.comments = [];
    this.components = [];
    this.message = '';
    this.parse(data);
  }

  protected readonly opts: DecodePrefs;
  height: number;
  width: number;
  comments: string[];
  components: ComponentsValue[];
  message: string;

  // Optional variables
  jfif?: JFIF;
  exif?: Uint8Array;
  adobe?: Adobe;
  DCTs?: DCTs;
  YCbCr?: YCbCr;

  private static buildHuffmanTable(
    codeLengths: Uint8Array,
    values: Uint8Array
  ): any[] {
    var k = 0,
      code: HuffmanTableValue[] = [],
      i,
      j,
      length = 16;

    // Getting the last index before zero filled
    while (length > 0 && !codeLengths[length - 1]) length--;

    code.push({ children: [], index: 0 });

    var p = code[0],
      q: HuffmanTableValue;
    for (i = 0; i < length; i++) {
      for (j = 0; j < codeLengths[i]; j++) {
        p = code.pop()!;
        p.children[p.index] = values[k];
        while (p.index > 0) {
          if (code.length === 0)
            throw new Error('Could not recreate Huffman Table');
          p = code.pop()!;
        }
        p.index++;
        code.push(p);
        while (code.length <= i) {
          code.push((q = { children: [], index: 0 }));
          p.children[p.index] = q.children;
          p = q;
        }
        k++;
      }
      if (i + 1 < length) {
        // p here points to last code
        code.push((q = { children: [], index: 0 }));
        p.children[p.index] = q.children;
        p = q;
      }
    }
    return code[0].children;
  }

  private static decodeScan(
    data: Uint8Array,
    offset: number,
    frame: ImageFrame,
    components: ImageFrameComponent[],
    resetInterval: number,
    spectralStart: number,
    spectralEnd: number,
    successivePrev: number,
    successive: number,
    opts: DecodePrefs
  ) {
    var precision = frame.precision;
    var samplesPerLine = frame.samplesPerLine;
    var scanLines = frame.scanLines;
    var mcusPerLine = frame.mcusPerLine!;
    var progressive = frame.progressive!;
    var maxH = frame.maxH,
      maxV = frame.maxV;

    var startOffset = offset,
      bitsData = 0,
      bitsCount = 0;
    function readBit() {
      if (bitsCount > 0) {
        bitsCount--;
        return (bitsData >> bitsCount) & 1;
      }
      bitsData = data[offset++];
      if (bitsData == 0xff) {
        var nextByte = data[offset++];
        if (nextByte) {
          throw new Error(
            'unexpected marker: ' + ((bitsData << 8) | nextByte).toString(16)
          );
        }
        // unstuff 0
      }
      bitsCount = 7;
      return bitsData >>> 7;
    }
    function decodeHuffman(tree: Array<any>): number {
      var node = tree,
        bit;
      while ((bit = readBit()) !== null) {
        node = node[bit];
        if (typeof node === 'number') return node;
        if (typeof node !== 'object')
          throw new Error('invalid huffman sequence');
      }
      return 0;
    }
    function receive(length: number): number {
      var n = 0;
      while (length > 0) {
        var bit = readBit();
        if (bit === null) return 0;
        n = (n << 1) | bit;
        length--;
      }
      return n;
    }
    function receiveAndExtend(length: number) {
      var n = receive(length);
      if (n >= 1 << (length - 1)) return n;
      return n + (-1 << length) + 1;
    }
    function decodeBaseline(component: ImageFrameComponent, zz: Int32Array) {
      var t = decodeHuffman(component.htDC!);
      var diff = t === 0 ? 0 : receiveAndExtend(t);
      zz[0] = component.pred! += diff;
      var k = 1;
      while (k < 64) {
        var rs = decodeHuffman(component.htAC!);
        var s = rs & 15,
          r = rs >> 4;
        if (s === 0) {
          if (r < 15) break;
          k += 16;
          continue;
        }
        k += r;
        var z = JpegConstants.dctZigZag[k];
        zz[z] = receiveAndExtend(s);
        k++;
      }
    }
    function decodeDCFirst(component: ImageFrameComponent, zz: Int32Array) {
      var t = decodeHuffman(component.htDC!);
      var diff = t === 0 ? 0 : receiveAndExtend(t) << successive;
      zz[0] = component.pred! += diff;
    }
    function decodeDCSuccessive(
      component: ImageFrameComponent,
      zz: Int32Array
    ) {
      zz[0] |= readBit() << successive;
    }
    var eobrun = 0;
    function decodeACFirst(component: ImageFrameComponent, zz: Int32Array) {
      if (eobrun > 0) {
        eobrun--;
        return;
      }
      var k = spectralStart,
        e = spectralEnd;
      while (k <= e) {
        var rs = decodeHuffman(component.htAC!);
        var s = rs & 15,
          r = rs >> 4;
        if (s === 0) {
          if (r < 15) {
            eobrun = receive(r) + (1 << r) - 1;
            break;
          }
          k += 16;
          continue;
        }
        k += r;
        var z = JpegConstants.dctZigZag[k];
        zz[z] = receiveAndExtend(s) * (1 << successive);
        k++;
      }
    }
    var successiveACState = 0,
      successiveACNextValue: number;
    function decodeACSuccessive(
      component: ImageFrameComponent,
      zz: Int32Array
    ) {
      var k = spectralStart,
        e = spectralEnd,
        r = 0;
      while (k <= e) {
        var z = JpegConstants.dctZigZag[k];
        var direction = zz[z] < 0 ? -1 : 1;
        switch (successiveACState) {
          case 0: // initial state
            var rs = decodeHuffman(component.htAC!);
            var s = rs & 15,
              r = rs >> 4;
            if (s === 0) {
              if (r < 15) {
                eobrun = receive(r) + (1 << r);
                successiveACState = 4;
              } else {
                r = 16;
                successiveACState = 1;
              }
            } else {
              if (s !== 1) throw new Error('invalid ACn encoding');
              successiveACNextValue = receiveAndExtend(s);
              successiveACState = r ? 2 : 3;
            }
            continue;
          case 1: // skipping r zero items
          case 2:
            if (zz[z]) zz[z] += (readBit() << successive) * direction;
            else {
              r--;
              if (r === 0) successiveACState = successiveACState == 2 ? 3 : 0;
            }
            break;
          case 3: // set value for a zero item
            if (zz[z]) zz[z] += (readBit() << successive) * direction;
            else {
              zz[z] = successiveACNextValue << successive;
              successiveACState = 0;
            }
            break;
          case 4: // eob
            if (zz[z]) zz[z] += (readBit() << successive) * direction;
            break;
        }
        k++;
      }
      if (successiveACState === 4) {
        eobrun--;
        if (eobrun === 0) successiveACState = 0;
      }
    }
    function decodeMcu(
      component: ImageFrameComponent,
      decode: Function,
      mcu: number,
      row: number,
      col: number
    ) {
      var mcuRow = (mcu / mcusPerLine) | 0;
      var mcuCol = mcu % mcusPerLine;
      var blockRow = mcuRow * component.v + row;
      var blockCol = mcuCol * component.h + col;
      // If the block is missing and we're in tolerant mode, just skip it.
      if (component.blocks![blockRow] === undefined && opts.tolerantDecoding)
        return;
      decode(component, component.blocks![blockRow][blockCol]);
    }
    function decodeBlock(
      component: ImageFrameComponent,
      decode: Function,
      mcu: number
    ) {
      var blockRow = (mcu / component.blocksPerLine!) | 0;
      var blockCol = mcu % component.blocksPerLine!;
      // If the block is missing and we're in tolerant mode, just skip it.
      if (component.blocks![blockRow] === undefined && opts.tolerantDecoding)
        return;
      decode(component, component.blocks![blockRow][blockCol]);
    }

    var componentsLength = Object.keys(components).length;
    var component, i, j, k, n;
    var decodeFn;
    if (progressive) {
      if (spectralStart === 0)
        decodeFn = successivePrev === 0 ? decodeDCFirst : decodeDCSuccessive;
      else decodeFn = successivePrev === 0 ? decodeACFirst : decodeACSuccessive;
    } else {
      decodeFn = decodeBaseline;
    }

    var mcu = 0,
      marker;
    var mcuExpected;
    if (componentsLength == 1) {
      mcuExpected =
        components[0].blocksPerLine! * components[0].blocksPerColumn!;
    } else {
      mcuExpected = mcusPerLine * frame.mcusPerColumn!;
    }
    if (!resetInterval) resetInterval = mcuExpected;

    var h, v;
    while (mcu < mcuExpected) {
      // reset interval stuff
      for (i = 0; i < componentsLength; i++) components[i].pred = 0;
      eobrun = 0;

      if (componentsLength == 1) {
        component = components[0];
        for (n = 0; n < resetInterval; n++) {
          decodeBlock(component, decodeFn, mcu);
          mcu++;
        }
      } else {
        for (n = 0; n < resetInterval; n++) {
          for (i = 0; i < componentsLength; i++) {
            component = components[i];
            h = component.h;
            v = component.v;
            for (j = 0; j < v; j++) {
              for (k = 0; k < h; k++) {
                decodeMcu(component, decodeFn, mcu, j, k);
              }
            }
          }
          mcu++;

          // If we've reached our expected MCU's, stop decoding
          if (mcu === mcuExpected) break;
        }
      }

      if (mcu === mcuExpected) {
        // Skip trailing bytes at the end of the scan - until we reach the next marker
        do {
          if (data[offset] === 0xff) {
            if (data[offset + 1] !== 0x00) {
              break;
            }
          }
          offset += 1;
        } while (offset < data.length - 2);
      }

      // find marker
      bitsCount = 0;
      marker = (data[offset] << 8) | data[offset + 1];
      if (marker < 0xff00) {
        throw new Error('marker was not found');
      }

      if (marker >= 0xffd0 && marker <= 0xffd7) {
        // RSTx
        offset += 2;
      } else break;
    }

    return offset - startOffset;
  }

  // A port of poppler's IDCT method which in turn is taken from:
  //   Christoph Loeffler, Adriaan Ligtenberg, George S. Moschytz,
  //   "Practical Fast 1-D DCT Algorithms with 11 Multiplications",
  //   IEEE Intl. Conf. on Acoustics, Speech & Signal Processing, 1989,
  //   988-991.
  private static quantizeAndInverse(
    zz: Float32Array,
    dataOut: Uint8Array,
    dataIn: Int32Array,
    qt: Int32Array
  ): void {
    var v0, v1, v2, v3, v4, v5, v6, v7, t;
    var p = dataIn;
    var i;

    // dequant
    for (i = 0; i < 64; i++) p[i] = zz[i] * qt[i];

    // inverse DCT on rows
    for (i = 0; i < 8; ++i) {
      var row = 8 * i;

      // check for all-zero AC coefficients
      if (
        p[1 + row] == 0 &&
        p[2 + row] == 0 &&
        p[3 + row] == 0 &&
        p[4 + row] == 0 &&
        p[5 + row] == 0 &&
        p[6 + row] == 0 &&
        p[7 + row] == 0
      ) {
        t = (JpegConstants.dctSqrt2 * p[0 + row] + 512) >> 10;
        p[0 + row] = t;
        p[1 + row] = t;
        p[2 + row] = t;
        p[3 + row] = t;
        p[4 + row] = t;
        p[5 + row] = t;
        p[6 + row] = t;
        p[7 + row] = t;
        continue;
      }

      // stage 4
      v0 = (JpegConstants.dctSqrt2 * p[0 + row] + 128) >> 8;
      v1 = (JpegConstants.dctSqrt2 * p[4 + row] + 128) >> 8;
      v2 = p[2 + row];
      v3 = p[6 + row];
      v4 = (JpegConstants.dctSqrt1d2 * (p[1 + row] - p[7 + row]) + 128) >> 8;
      v7 = (JpegConstants.dctSqrt1d2 * (p[1 + row] + p[7 + row]) + 128) >> 8;
      v5 = p[3 + row] << 4;
      v6 = p[5 + row] << 4;

      // stage 3
      t = (v0 - v1 + 1) >> 1;
      v0 = (v0 + v1 + 1) >> 1;
      v1 = t;
      t = (v2 * JpegConstants.dctSin6 + v3 * JpegConstants.dctCos6 + 128) >> 8;
      v2 = (v2 * JpegConstants.dctCos6 - v3 * JpegConstants.dctSin6 + 128) >> 8;
      v3 = t;
      t = (v4 - v6 + 1) >> 1;
      v4 = (v4 + v6 + 1) >> 1;
      v6 = t;
      t = (v7 + v5 + 1) >> 1;
      v5 = (v7 - v5 + 1) >> 1;
      v7 = t;

      // stage 2
      t = (v0 - v3 + 1) >> 1;
      v0 = (v0 + v3 + 1) >> 1;
      v3 = t;
      t = (v1 - v2 + 1) >> 1;
      v1 = (v1 + v2 + 1) >> 1;
      v2 = t;
      t =
        (v4 * JpegConstants.dctSin3 + v7 * JpegConstants.dctCos3 + 2048) >> 12;
      v4 =
        (v4 * JpegConstants.dctCos3 - v7 * JpegConstants.dctSin3 + 2048) >> 12;
      v7 = t;
      t =
        (v5 * JpegConstants.dctSin1 + v6 * JpegConstants.dctCos1 + 2048) >> 12;
      v5 =
        (v5 * JpegConstants.dctCos1 - v6 * JpegConstants.dctSin1 + 2048) >> 12;
      v6 = t;

      // stage 1
      p[0 + row] = v0 + v7;
      p[7 + row] = v0 - v7;
      p[1 + row] = v1 + v6;
      p[6 + row] = v1 - v6;
      p[2 + row] = v2 + v5;
      p[5 + row] = v2 - v5;
      p[3 + row] = v3 + v4;
      p[4 + row] = v3 - v4;
    }

    // inverse DCT on columns
    for (i = 0; i < 8; ++i) {
      var col = i;

      // check for all-zero AC coefficients
      if (
        p[1 * 8 + col] == 0 &&
        p[2 * 8 + col] == 0 &&
        p[3 * 8 + col] == 0 &&
        p[4 * 8 + col] == 0 &&
        p[5 * 8 + col] == 0 &&
        p[6 * 8 + col] == 0 &&
        p[7 * 8 + col] == 0
      ) {
        t = (JpegConstants.dctSqrt2 * dataIn[i + 0] + 8192) >> 14;
        p[0 * 8 + col] = t;
        p[1 * 8 + col] = t;
        p[2 * 8 + col] = t;
        p[3 * 8 + col] = t;
        p[4 * 8 + col] = t;
        p[5 * 8 + col] = t;
        p[6 * 8 + col] = t;
        p[7 * 8 + col] = t;
        continue;
      }

      // stage 4
      v0 = (JpegConstants.dctSqrt2 * p[0 * 8 + col] + 2048) >> 12;
      v1 = (JpegConstants.dctSqrt2 * p[4 * 8 + col] + 2048) >> 12;
      v2 = p[2 * 8 + col];
      v3 = p[6 * 8 + col];
      v4 =
        (JpegConstants.dctSqrt1d2 * (p[1 * 8 + col] - p[7 * 8 + col]) + 2048) >>
        12;
      v7 =
        (JpegConstants.dctSqrt1d2 * (p[1 * 8 + col] + p[7 * 8 + col]) + 2048) >>
        12;
      v5 = p[3 * 8 + col];
      v6 = p[5 * 8 + col];

      // stage 3
      t = (v0 - v1 + 1) >> 1;
      v0 = (v0 + v1 + 1) >> 1;
      v1 = t;
      t =
        (v2 * JpegConstants.dctSin6 + v3 * JpegConstants.dctCos6 + 2048) >> 12;
      v2 =
        (v2 * JpegConstants.dctCos6 - v3 * JpegConstants.dctSin6 + 2048) >> 12;
      v3 = t;
      t = (v4 - v6 + 1) >> 1;
      v4 = (v4 + v6 + 1) >> 1;
      v6 = t;
      t = (v7 + v5 + 1) >> 1;
      v5 = (v7 - v5 + 1) >> 1;
      v7 = t;

      // stage 2
      t = (v0 - v3 + 1) >> 1;
      v0 = (v0 + v3 + 1) >> 1;
      v3 = t;
      t = (v1 - v2 + 1) >> 1;
      v1 = (v1 + v2 + 1) >> 1;
      v2 = t;
      t =
        (v4 * JpegConstants.dctSin3 + v7 * JpegConstants.dctCos3 + 2048) >> 12;
      v4 =
        (v4 * JpegConstants.dctCos3 - v7 * JpegConstants.dctSin3 + 2048) >> 12;
      v7 = t;
      t =
        (v5 * JpegConstants.dctSin1 + v6 * JpegConstants.dctCos1 + 2048) >> 12;
      v5 =
        (v5 * JpegConstants.dctCos1 - v6 * JpegConstants.dctSin1 + 2048) >> 12;
      v6 = t;

      // stage 1
      p[0 * 8 + col] = v0 + v7;
      p[7 * 8 + col] = v0 - v7;
      p[1 * 8 + col] = v1 + v6;
      p[6 * 8 + col] = v1 - v6;
      p[2 * 8 + col] = v2 + v5;
      p[5 * 8 + col] = v2 - v5;
      p[3 * 8 + col] = v3 + v4;
      p[4 * 8 + col] = v3 - v4;
    }

    // convert to 8-bit integers
    for (i = 0; i < 64; ++i) {
      var sample = 128 + ((p[i] + 8) >> 4);
      dataOut[i] = sample < 0 ? 0 : sample > 0xff ? 0xff : sample;
    }
  }

  private buildComponentData(
    component: ImageFrameComponent,
    Y: boolean = false
  ): Uint8Array[] {
    var blocksPerLine = component.blocksPerLine!;
    var blocksPerColumn = component.blocksPerColumn!;
    var samplesPerLine = blocksPerLine << 3;
    // Only 1 used per invocation of this function and garbage collected after invocation, so no need to account for its memory footprint.
    var R = new Int32Array(64),
      r = new Uint8Array(64);

    this.requestMemoryAllocation(samplesPerLine * blocksPerColumn * 8);

    // Type is Uint8Array[]
    var lines: Uint8Array[] = [];

    var i, j;
    for (var blockRow = 0; blockRow < blocksPerColumn; blockRow++) {
      var scanLine = blockRow << 3;
      for (i = 0; i < 8; i++) lines.push(new Uint8Array(samplesPerLine));
      for (var blockCol = 0; blockCol < blocksPerLine; blockCol++) {
        // TODO: extract message here
        if (this.opts.withKey && Y) {
          this.message += QIM.detectQDCT(component.blocks![blockRow][blockCol]);
        }

        JpegImage.quantizeAndInverse(
          component.blocks![blockRow][blockCol],
          r,
          R,
          component.qT!
        );

        var offset = 0,
          sample = blockCol << 3;
        for (j = 0; j < 8; j++) {
          var line = lines[scanLine + j];
          for (i = 0; i < 8; i++) line[sample + i] = r[offset++];
        }
      }
    }
    return lines;
  }

  // load(path: string) {
  //   var xhr = new XMLHttpRequest();
  //   xhr.open('GET', path, true);
  //   xhr.responseType = 'arraybuffer';
  //   xhr.onload = function () {
  //     // TODO catch parse error
  //     var data = new Uint8Array(xhr.response || xhr.mozResponseArrayBuffer);
  //     this.parse(data);
  //     if (this.onload) this.onload();
  //   }.bind(this);
  //   xhr.send(null);
  // };

  private static readUint16(
    data: Uint8Array,
    offset: number
  ): [number, number] {
    var value = (data[offset] << 8) | data[offset + 1];
    offset += 2;
    return [value, offset];
  }

  private static readDataBlock(
    data: Uint8Array,
    offset: number
  ): [Uint8Array, number] {
    var [length, offset] = JpegImage.readUint16(data, offset);
    var array = data.subarray(offset, offset + length - 2);
    offset += array.length;
    return [array, offset];
  }

  private prepareComponents(frame: ImageFrame) {
    var maxH = 0,
      maxV = 0;
    var component, componentId;
    for (componentId in frame.components) {
      if (frame.components!.hasOwnProperty(componentId)) {
        component = frame.components![componentId];
        if (maxH < component.h) maxH = component.h;
        if (maxV < component.v) maxV = component.v;
      }
    }
    var mcusPerLine = Math.ceil(frame.samplesPerLine! / 8 / maxH);
    var mcusPerColumn = Math.ceil(frame.scanLines! / 8 / maxV);
    for (componentId in frame.components!) {
      if (frame.components!.hasOwnProperty(componentId)) {
        component = frame.components![componentId];
        var blocksPerLine = Math.ceil(
          (Math.ceil(frame.samplesPerLine! / 8) * component.h) / maxH
        );
        var blocksPerColumn = Math.ceil(
          (Math.ceil(frame.scanLines! / 8) * component.v) / maxV
        );
        var blocksPerLineForMcu = mcusPerLine * component.h;
        var blocksPerColumnForMcu = mcusPerColumn * component.v;
        var blocksToAllocate = blocksPerColumnForMcu * blocksPerLineForMcu;
        var blocks = [];

        // Each block is a Int32Array of length 64 (4 x 64 = 256 bytes)
        this.requestMemoryAllocation(blocksToAllocate * 256);

        for (var i = 0; i < blocksPerColumnForMcu; i++) {
          var row = [];
          for (var j = 0; j < blocksPerLineForMcu; j++)
            row.push(new Float32Array(64));
          blocks.push(row);
        }
        component.blocksPerLine = blocksPerLine;
        component.blocksPerColumn = blocksPerColumn;
        component.blocks = blocks;
      }
    }
    frame.maxH = maxH;
    frame.maxV = maxV;
    frame.mcusPerLine = mcusPerLine;
    frame.mcusPerColumn = mcusPerColumn;
  }

  private parse(data: Uint8Array) {
    var maxResolutionInPixels = this.opts.maxResolutionInMP! * 1000 * 1000;
    var offset = 0,
      length = data.length,
      fileMarker = 0;
    var adobe = null;
    var frame: ImageFrame = {},
      resetInterval = 0;
    var quantizationTables = [],
      frames: ImageFrame[] = [];
    var huffmanTablesAC: any[] = [],
      huffmanTablesDC: any[] = [];
    [fileMarker, offset] = JpegImage.readUint16(data, offset);
    this.comments = [];
    if (fileMarker != 0xffd8) {
      // SOI (Start of Image)
      throw new Error('SOI not found');
    }

    [fileMarker, offset] = JpegImage.readUint16(data, offset);
    while (fileMarker != 0xffd9) {
      // EOI (End of image)
      var i, j, l;
      switch (fileMarker) {
        case 0xff00:
          break;
        case 0xffe0: // APP0 (Application Specific)
        case 0xffe1: // APP1
        case 0xffe2: // APP2
        case 0xffe3: // APP3
        case 0xffe4: // APP4
        case 0xffe5: // APP5
        case 0xffe6: // APP6
        case 0xffe7: // APP7
        case 0xffe8: // APP8
        case 0xffe9: // APP9
        case 0xffea: // APP10
        case 0xffeb: // APP11
        case 0xffec: // APP12
        case 0xffed: // APP13
        case 0xffee: // APP14
        case 0xffef: // APP15
        case 0xfffe: // COM (Comment)
          var [appData, offset] = JpegImage.readDataBlock(data, offset);

          if (fileMarker === 0xfffe) {
            var comment = String.fromCharCode.apply(null, Array.from(appData));
            this.comments.push(comment);
          }

          if (fileMarker === 0xffe0) {
            if (
              appData[0] === 0x4a &&
              appData[1] === 0x46 &&
              appData[2] === 0x49 &&
              appData[3] === 0x46 &&
              appData[4] === 0
            ) {
              // 'JFIF\x00'
              this.jfif = {
                version: { major: appData[5], minor: appData[6] },
                densityUnits: appData[7],
                xDensity: (appData[8] << 8) | appData[9],
                yDensity: (appData[10] << 8) | appData[11],
                thumbWidth: appData[12],
                thumbHeight: appData[13],
                thumbData: appData.subarray(
                  14,
                  14 + 3 * appData[12] * appData[13]
                ),
              };
            }
          }
          // TODO APP1 - Exif
          if (fileMarker === 0xffe1) {
            if (
              appData[0] === 0x45 &&
              appData[1] === 0x78 &&
              appData[2] === 0x69 &&
              appData[3] === 0x66 &&
              appData[4] === 0
            ) {
              // 'EXIF\x00'
              this.exif = appData.subarray(5, appData.length);
            }
          }

          if (fileMarker === 0xffee) {
            if (
              appData[0] === 0x41 &&
              appData[1] === 0x64 &&
              appData[2] === 0x6f &&
              appData[3] === 0x62 &&
              appData[4] === 0x65 &&
              appData[5] === 0
            ) {
              // 'Adobe\x00'
              this.adobe = {
                version: appData[6],
                flags0: (appData[7] << 8) | appData[8],
                flags1: (appData[9] << 8) | appData[10],
                transformCode: appData[11],
              };
            }
          }
          break;

        case 0xffdb: // DQT (Define Quantization Tables)
          var [quantizationTablesLength, offset] = JpegImage.readUint16(
            data,
            offset
          );
          var quantizationTablesEnd = quantizationTablesLength + offset - 2;
          while (offset < quantizationTablesEnd) {
            var quantizationTableSpec = data[offset++];
            this.requestMemoryAllocation(64 * 4);
            var tableData = new Int32Array(64);
            if (quantizationTableSpec >> 4 === 0) {
              // 8 bit values
              for (j = 0; j < 64; j++) {
                var z = JpegConstants.dctZigZag[j];
                tableData[z] = data[offset++];
              }
            } else if (quantizationTableSpec >> 4 === 1) {
              //16 bit
              for (j = 0; j < 64; j++) {
                var z = JpegConstants.dctZigZag[j];
                [tableData[z], offset] = JpegImage.readUint16(data, offset);
              }
            } else throw new Error('DQT: invalid table spec');
            quantizationTables[quantizationTableSpec & 15] = tableData;
          }
          break;

        case 0xffc0: // SOF0 (Start of Frame, Baseline DCT)
        case 0xffc1: // SOF1 (Start of Frame, Extended DCT)
        case 0xffc2: // SOF2 (Start of Frame, Progressive DCT)
          [, offset] = JpegImage.readUint16(data, offset); // skip data length
          frame.extended = fileMarker === 0xffc1;
          frame.progressive = fileMarker === 0xffc2;
          frame.precision = data[offset++];
          [frame.scanLines, offset] = JpegImage.readUint16(data, offset);
          [frame.samplesPerLine, offset] = JpegImage.readUint16(data, offset);
          frame.componentsOrder = [];
          frame.components = {};

          var pixelsInFrame = frame.scanLines * frame.samplesPerLine;
          if (pixelsInFrame > maxResolutionInPixels) {
            var exceededAmount = Math.ceil(
              (pixelsInFrame - maxResolutionInPixels) / 1e6
            );
            throw new Error(
              `maxResolutionInMP limit exceeded by ${exceededAmount}MP`
            );
          }

          var componentsCount = data[offset++],
            componentId;
          var maxH = 0,
            maxV = 0;
          for (i = 0; i < componentsCount; i++) {
            componentId = data[offset];
            var h = data[offset + 1] >> 4;
            var v = data[offset + 1] & 15;
            var qId = data[offset + 2];
            frame.componentsOrder.push(componentId);
            frame.components[componentId] = {
              h: h,
              v: v,
              quantizationIdx: qId,
            };
            offset += 3;
          }
          this.prepareComponents(frame);
          frames.push(frame);
          break;

        case 0xffc4: // DHT (Define Huffman Tables)
          var [huffmanLength, offset] = JpegImage.readUint16(data, offset);
          for (i = 2; i < huffmanLength; ) {
            var huffmanTableSpec = data[offset++];
            var codeLengths = new Uint8Array(16);
            var codeLengthSum = 0;
            for (j = 0; j < 16; j++, offset++) {
              codeLengthSum += codeLengths[j] = data[offset];
            }
            this.requestMemoryAllocation(16 + codeLengthSum);
            var huffmanValues = new Uint8Array(codeLengthSum);
            for (j = 0; j < codeLengthSum; j++, offset++)
              huffmanValues[j] = data[offset];
            i += 17 + codeLengthSum;

            (huffmanTableSpec >> 4 === 0 ? huffmanTablesDC : huffmanTablesAC)[
              huffmanTableSpec & 15
            ] = JpegImage.buildHuffmanTable(codeLengths, huffmanValues);
          }
          break;

        case 0xffdd: // DRI (Define Restart Interval)
          [, offset] = JpegImage.readUint16(data, offset); // skip data length
          [resetInterval, offset] = JpegImage.readUint16(data, offset);
          break;

        case 0xffda: // SOS (Start of Scan)
          var [scanLength, offset] = JpegImage.readUint16(data, offset);
          var selectorsCount = data[offset++];
          var imageFramesComponents: ImageFrameComponent[] = [],
            imageFrameComponent: ImageFrameComponent;
          for (i = 0; i < selectorsCount; i++) {
            imageFrameComponent = frame.components![data[offset++]];
            var tableSpec = data[offset++];
            imageFrameComponent.htDC = huffmanTablesDC[tableSpec >> 4];
            imageFrameComponent.htAC = huffmanTablesAC[tableSpec & 15];
            imageFramesComponents.push(imageFrameComponent);
          }
          var spectralStart = data[offset++];
          var spectralEnd = data[offset++];
          var successiveApproximation = data[offset++];
          var processed = JpegImage.decodeScan(
            data,
            offset,
            frame,
            imageFramesComponents,
            resetInterval,
            spectralStart,
            spectralEnd,
            successiveApproximation >> 4,
            successiveApproximation & 15,
            this.opts
          );
          offset += processed;
          break;

        case 0xffff: // Fill bytes
          if (data[offset] !== 0xff) {
            // Avoid skipping a valid marker.
            offset--;
          }
          break;

        default:
          if (
            data[offset - 3] == 0xff &&
            data[offset - 2] >= 0xc0 &&
            data[offset - 2] <= 0xfe
          ) {
            // could be incorrect encoding -- last 0xFF byte of the previous
            // block was eaten by the encoder
            offset -= 3;
            break;
          }
          throw new Error('unknown JPEG marker ' + fileMarker.toString(16));
      }
      [fileMarker, offset] = JpegImage.readUint16(data, offset);
    }
    if (frames.length != 1)
      throw new Error('only single frame JPEGs supported');

    // set each frame's components quantization table
    for (i = 0; i < frames.length; i++) {
      var cp = frames[i].components!;
      for (j in cp) {
        cp[j].qT = quantizationTables[cp[j].quantizationIdx];
        delete cp[j].quantizationIdx;
      }
    }

    this.width = frame.samplesPerLine!;
    this.height = frame.scanLines!;
    for (i = 0; i < frame.componentsOrder!.length; i++) {
      var imageFrameComponent = frame.components![frame.componentsOrder![i]];
      this.components.push({
        // Call build component data with boolean indicating which one
        //  is Y.
        lines: this.buildComponentData(imageFrameComponent, i == 0),
        scaleX: imageFrameComponent.h / frame.maxH!,
        scaleY: imageFrameComponent.v / frame.maxV!,
      });
    }
    //fetch wanted data
    if (this.opts.withDCTs) {
      this.DCTs = {
        Y: imageFramesComponents![0].blocks!, // Y channel dct coeffs
        U: imageFramesComponents![1]
          ? imageFramesComponents![1].blocks
          : undefined, // U channel dct coeffs
        V: imageFramesComponents![2]
          ? imageFramesComponents![2].blocks
          : undefined, // V channel dct coeffs
      };
    }
  }

  getData(width: number, height: number) {
    var scaleX = this.width / width,
      scaleY = this.height / height;

    var component1, component2, component3, component4;
    var component1Line, component2Line, component3Line, component4Line;
    var x, y;
    var offset = 0;
    var Y, Cb, Cr, K, C, M, Ye, R, G, B;
    var colorTransform;
    var dataLength = width * height * this.components.length;
    this.requestMemoryAllocation(dataLength);
    var data = new Uint8Array(dataLength);
    if (this.opts.withYCbCr) {
      this.requestMemoryAllocation(width * height * this.components.length);
      this.YCbCr = {
        Y: new Array(height).fill(new Uint8Array(width)),
        Cb:
          this.components.length > 1
            ? new Array(height).fill(new Uint8Array(width))
            : undefined,
        Cr:
          this.components.length > 2
            ? new Array(height).fill(new Uint8Array(width))
            : undefined,
      };
    }
    switch (this.components.length) {
      case 1:
        component1 = this.components[0];
        for (y = 0; y < height; y++) {
          component1Line =
            component1.lines[0 | (y * component1.scaleY * scaleY)];
          for (x = 0; x < width; x++) {
            Y = component1Line[0 | (x * component1.scaleX * scaleX)];
            this.opts.withYCbCr ? (this.YCbCr!.Y[y][x] = Y) : null;
            data[offset++] = Y;
          }
        }
        break;
      case 2:
        // PDF might compress two component data in custom colorspace
        component1 = this.components[0];
        component2 = this.components[1];
        for (y = 0; y < height; y++) {
          component1Line =
            component1.lines[0 | (y * component1.scaleY * scaleY)];
          component2Line =
            component2.lines[0 | (y * component2.scaleY * scaleY)];
          for (x = 0; x < width; x++) {
            Y = component1Line[0 | (x * component1.scaleX * scaleX)];
            this.opts.withYCbCr ? (this.YCbCr!.Y[y][x] = Y) : null;
            data[offset++] = Y;
            Y = component2Line[0 | (x * component2.scaleX * scaleX)];
            this.opts.withYCbCr ? (this.YCbCr!.Cb![y][x] = Y) : null;
            data[offset++] = Y;
          }
        }
        break;
      case 3:
        // The default transform for three components is true
        colorTransform = true;
        // The adobe transform marker overrides any previous setting
        if (this.adobe && this.adobe.transformCode) colorTransform = true;
        else if (typeof this.opts.colorTransform !== 'undefined')
          colorTransform = !!this.opts.colorTransform;

        component1 = this.components[0];
        component2 = this.components[1];
        component3 = this.components[2];
        for (y = 0; y < height; y++) {
          component1Line =
            component1.lines[0 | (y * component1.scaleY * scaleY)];
          component2Line =
            component2.lines[0 | (y * component2.scaleY * scaleY)];
          component3Line =
            component3.lines[0 | (y * component3.scaleY * scaleY)];
          for (x = 0; x < width; x++) {
            if (!colorTransform) {
              R = component1Line[0 | (x * component1.scaleX * scaleX)];
              this.opts.withYCbCr ? (this.YCbCr!.Y[y][x] = R) : null;
              G = component2Line[0 | (x * component2.scaleX * scaleX)];
              this.opts.withYCbCr ? (this.YCbCr!.Cb![y][x] = G) : null;
              B = component3Line[0 | (x * component3.scaleX * scaleX)];
              this.opts.withYCbCr ? (this.YCbCr!.Cr![y][x] = B) : null;
            } else {
              Y = component1Line[0 | (x * component1.scaleX * scaleX)];
              this.opts.withYCbCr ? (this.YCbCr!.Y[y][x] = Y) : null;
              Cb = component2Line[0 | (x * component2.scaleX * scaleX)];
              this.opts.withYCbCr ? (this.YCbCr!.Cb![y][x] = Cb) : null;
              Cr = component3Line[0 | (x * component3.scaleX * scaleX)];
              this.opts.withYCbCr ? (this.YCbCr!.Cr![y][x] = Cr) : null;

              R = clampTo8bit(Y + 1.402 * (Cr - 128));
              G = clampTo8bit(
                Y - 0.3441363 * (Cb - 128) - 0.71413636 * (Cr - 128)
              );
              B = clampTo8bit(Y + 1.772 * (Cb - 128));
            }

            data[offset++] = R;
            data[offset++] = G;
            data[offset++] = B;
          }
        }
        break;
      case 4:
        if (!this.adobe)
          throw new Error('Unsupported color mode (4 components)');
        // The default transform for four components is false
        colorTransform = false;
        // The adobe transform marker overrides any previous setting
        if (this.adobe && this.adobe.transformCode) colorTransform = true;
        else if (typeof this.opts.colorTransform !== 'undefined')
          colorTransform = !!this.opts.colorTransform;

        component1 = this.components[0];
        component2 = this.components[1];
        component3 = this.components[2];
        component4 = this.components[3];
        for (y = 0; y < height; y++) {
          component1Line =
            component1.lines[0 | (y * component1.scaleY * scaleY)];
          component2Line =
            component2.lines[0 | (y * component2.scaleY * scaleY)];
          component3Line =
            component3.lines[0 | (y * component3.scaleY * scaleY)];
          component4Line =
            component4.lines[0 | (y * component4.scaleY * scaleY)];
          for (x = 0; x < width; x++) {
            if (!colorTransform) {
              C = component1Line[0 | (x * component1.scaleX * scaleX)];
              M = component2Line[0 | (x * component2.scaleX * scaleX)];
              Ye = component3Line[0 | (x * component3.scaleX * scaleX)];
              K = component4Line[0 | (x * component4.scaleX * scaleX)];
            } else {
              Y = component1Line[0 | (x * component1.scaleX * scaleX)];
              this.opts.withYCbCr ? (this.YCbCr!.Y[y][x] = Y) : null;
              Cb = component2Line[0 | (x * component2.scaleX * scaleX)];
              this.opts.withYCbCr ? (this.YCbCr!.Cb![y][x] = Cb) : null;
              Cr = component3Line[0 | (x * component3.scaleX * scaleX)];
              this.opts.withYCbCr ? (this.YCbCr!.Cr![y][x] = Cr) : null;
              K = component4Line[0 | (x * component4.scaleX * scaleX)];

              C = 255 - clampTo8bit(Y + 1.402 * (Cr - 128));
              M =
                255 -
                clampTo8bit(
                  Y - 0.3441363 * (Cb - 128) - 0.71413636 * (Cr - 128)
                );
              Ye = 255 - clampTo8bit(Y + 1.772 * (Cb - 128));
            }
            data[offset++] = 255 - C;
            data[offset++] = 255 - M;
            data[offset++] = 255 - Ye;
            data[offset++] = 255 - K;
          }
        }
        break;
      default:
        throw new Error('Unsupported color mode');
    }
    return data;
  }

  static copyToImageData(
    decoder: JpegImage,
    imageData: RawImageData<Buffer | Uint8Array>
  ) {
    var width = imageData.width,
      height = imageData.height;
    var imageDataArray = imageData.data;
    var data = decoder.getData(width, height);
    var i = 0,
      j = 0,
      x,
      y;
    var Y, K, C, M, R, G, B;

    switch (decoder.components.length) {
      case 1:
        for (y = 0; y < height; y++) {
          for (x = 0; x < width; x++) {
            Y = data[i++];

            imageDataArray[j++] = Y;
            imageDataArray[j++] = Y;
            imageDataArray[j++] = Y;
            if (decoder.opts.formatAsRGBA) {
              imageDataArray[j++] = 255;
            }
          }
        }
        break;
      case 3:
        for (y = 0; y < height; y++) {
          for (x = 0; x < width; x++) {
            R = data[i++];
            G = data[i++];
            B = data[i++];

            imageDataArray[j++] = R;
            imageDataArray[j++] = G;
            imageDataArray[j++] = B;
            if (decoder.opts.formatAsRGBA) {
              imageDataArray[j++] = 255;
            }
          }
        }
        break;
      case 4:
        for (y = 0; y < height; y++) {
          for (x = 0; x < width; x++) {
            C = data[i++];
            M = data[i++];
            Y = data[i++];
            K = data[i++];

            R = 255 - clampTo8bit(C * (1 - K / 255) + K);
            G = 255 - clampTo8bit(M * (1 - K / 255) + K);
            B = 255 - clampTo8bit(Y * (1 - K / 255) + K);

            imageDataArray[j++] = R;
            imageDataArray[j++] = G;
            imageDataArray[j++] = B;
            if (decoder.opts.formatAsRGBA) {
              imageDataArray[j++] = 255;
            }
          }
        }
        break;
      default:
        throw new Error('Unsupported color mode');
    }
  }

  // We cap the amount of memory used by jpeg-js to avoid unexpected OOMs from untrusted content.
  private totalBytesAllocated: number = 0;
  private maxMemoryUsageBytes: number = 0;
  requestMemoryAllocation(increaseAmount: number = 0) {
    var totalMemoryImpactBytes = this.totalBytesAllocated + increaseAmount;
    if (totalMemoryImpactBytes > this.maxMemoryUsageBytes) {
      var exceededAmount = Math.ceil(
        (totalMemoryImpactBytes - this.maxMemoryUsageBytes) / 1024 / 1024
      );
      throw new Error(
        `maxMemoryUsageInMB limit exceeded by at least ${exceededAmount}MB`
      );
    }

    this.totalBytesAllocated = totalMemoryImpactBytes;
  }

  resetMaxMemoryUsage(maxMemoryUsageBytes_: number) {
    this.totalBytesAllocated = 0;
    this.maxMemoryUsageBytes = maxMemoryUsageBytes_;
  }

  getBytesAllocated() {
    return this.totalBytesAllocated;
  }
}

export function decode(jpegData: Buffer, userOpts: DecodePrefs = {}) {
  var defaultOpts: DecodePrefs = {
    // "undefined" means "Choose whether to transform colors based on the image’s color model."
    colorTransform: undefined,
    useTArray: false,
    formatAsRGBA: true,
    tolerantDecoding: true,
    maxResolutionInMP: 100, // Don't decode more than 100 megapixels
    maxMemoryUsageInMB: 512, // Don't decode if memory footprint is more than 512MB
    withYCbCr: false, // Return the YCbCr arrays
    withDCTs: false, // Return the decoded DCTs
    withKey: undefined, // Attempts to extract an embedded message
  };

  var opts: DecodePrefs = { ...defaultOpts, ...userOpts };
  var arr = Uint8Array.from(jpegData);
  var decoder = new JpegImage(arr, opts);

  var channels = opts.formatAsRGBA ? 4 : 3;
  var bytesNeeded = decoder.width * decoder.height * channels;
  try {
    decoder.requestMemoryAllocation(bytesNeeded);
    var image: RawImageData<Buffer | Uint8Array> = {
      width: decoder.width,
      height: decoder.height,
      exif: decoder.exif,
      data: opts.useTArray
        ? new Uint8Array(bytesNeeded)
        : Buffer.alloc(bytesNeeded),
    };
    if (decoder.comments.length > 0) {
      image.comments = decoder.comments;
    }
  } catch (err) {
    if (err instanceof RangeError) {
      throw new Error(
        'Could not allocate enough memory for the image. ' +
          'Required: ' +
          bytesNeeded
      );
    } else {
      throw err;
    }
  }

  JpegImage.copyToImageData(decoder, image);

  // TODO: Should probably deep copy here
  image.YCbCr = decoder.YCbCr;
  image.DCT = decoder.DCTs;

  if (opts.withKey) {
    // TODO: Get correct binary substring
    const tail = '1'.repeat(opts.withKey.q * 8);
    // console.log(decoder.message.lastIndexOf(tail));
    // TODO: Dynamically find the location of the substring
    let decode_substr = decoder.message.substring(0, 1104);
    decode_substr = RepeatAccumulation.decode(
      decode_substr,
      opts.withKey.q,
      opts.withKey.key
    );
    image.message = debinarize(decode_substr);
  }

  return image;
}
