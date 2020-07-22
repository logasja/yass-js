//file to implement Repeat-accumulate codes
import { assert } from 'console';
import * as SeededShuffle from 'seededshuffle';

interface RAout {
  message: string;
  key: number | string;
  q: number;
}

export class RepeatAccumulation {
  /*
  function to encode binary bits message using RA codes
  @inputs:
      message(str): binary bits message
      q(int): coding rate
      key(number>1): key used to shuffle the repeated message(if not assigned, will be generated randomly)

  @output(json): 
      en_msg(str): encoded message
      key(number>1): key used to shuffle the repeated message
      q(int): coding rate
  */
  static encode(message: string, q: number, key: number | string): RAout {
    var msg = message;
    var q = q;
    //normalize the key in u=(3.59,4] and x_0=(0,1)
    // var u = 3.59 + (1 / key / 10) * 4;
    // var x_0 = 1 / key;

    //repeat each bit of message for q times
    let re_msg_len = q * msg.length; //length of repeated message = q * length of original message
    var re_msg = new Array(re_msg_len); //create repeated message
    for (var i = 0; i < re_msg_len; ++i) {
      re_msg[i] = msg[Math.floor(i / q)]; //assign value for each bit of repeated message
    }

    //shuffle the message
    var shuffled_re_msg = SeededShuffle.shuffle<string>(re_msg, key);

    //calculated the accumulated sum
    var t = new Array(re_msg_len);
    t[0] = parseInt(shuffled_re_msg[0]);
    for (var i = 1; i < re_msg_len; i++) {
      t[i] = t[i - 1] + (parseInt(shuffled_re_msg[i]) % 2);
    }

    //transform t into binary
    var en_msg = '';
    for (var i = 0; i < t.length; ++i) {
      en_msg = en_msg.concat((t[i] % 2).toString());
    }

    //return encoded message along with key and coding rate(q) in json format
    var info = { message: en_msg, key: key, q: q };
    return info;
  }

  /*
  function to decode encoded message by RA codes
  @inputs:
      en_msg(str): binary bits encoded msg
      q(int): coding rate
      key(number>1): key used to shuffle the repeated message(if not assigned, will be generated randomly)

  @output: 
      msg(str): original message
  */
  static decode(en_msg: string, q: number, key: number | string) {
    //do parity check to retrieve shuffled repeated message from en_msg
    var shuffled_re_msg = new Array(en_msg.length);
    shuffled_re_msg[0] = parseInt(en_msg[0]);
    for (var i = 1; i < en_msg.length; ++i) {
      shuffled_re_msg[i] = (parseInt(en_msg[i]) + parseInt(en_msg[i - 1])) % 2;
    }

    //restore the shuffled message to repeated message
    let re_msg = SeededShuffle.unshuffle(shuffled_re_msg, key);

    //devide the repeated message into several parts, each part contains q bits
    var bit_count = [0, 0]; //create list to record appeared bits [number of appeared 0, number of appeared 1]
    var msg = ''; //create decoded message string
    for (var i = 0; i < re_msg.length; ++i) {
      if (re_msg[i] == 0) {
        bit_count[0]++;
      } else if (re_msg[i] == 1) {
        bit_count[1]++;
      }
      if ((i + 1) % q == 0) {
        //for each q bits block, assign the corresponding bit as the most frequent value
        if (bit_count[0] < bit_count[1]) {
          //if 1 appears more than 0 in the block
          msg = msg + '1'; //this bit will be recognized as 1
        } //otherwise
        else {
          msg = msg + '0'; //this bit will be recognized as 0
        }
        bit_count = [0, 0];
      }
    }

    return msg;
  }
}
