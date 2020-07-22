// As the name implies, returns a number clamped to unsigned 8 bit
export function clampTo8bit(a: number): number {
  return a < 0 ? 0 : a > 255 ? 255 : a;
}

/*
function to encode text message into message used for QIM
@inputs:
    text_message(string): any text message
    code_type('ascii', 'utf8'..., default as 'ascii'): code type for message encoding
@output:
    encoded_message(str of '0' and '1'): encoded message
@example:
*/
export function binarize(message: string, code_type: string = 'ascii'): string {
  //create encoded message binary string
  var encoded_msg = '';

  //encode message according to the code type
  if (code_type == 'ascii') {
    //create var to store ascii value for each character
    var this_ascii_value = 0;
    //assign values for ascii value array
    for (var i = 0; i < message.length; ++i) {
      //convert char to ascii value
      this_ascii_value = message.charCodeAt(i);
      //convert ascii value to binary string
      encoded_msg = encoded_msg + this_ascii_value.toString(2).padStart(8, '0');
    }
  } else if (code_type == 'ipfs') {
    //create var to store ascii value for each character
    var this_ascii_value = 0;
    //assign values for ascii value array
    for (var i = 0; i < message.length; ++i) {
      //convert char to ascii value
      this_ascii_value = message.charCodeAt(i);
      //restric the value to 0-61
      if (this_ascii_value >= 48 && this_ascii_value <= 57) {
        //cast ascii value 48-57 (char 0-9) to 0-9
        this_ascii_value = this_ascii_value - 48;
      } else if (this_ascii_value >= 65 && this_ascii_value <= 90) {
        //cast ascii value 65-90(char A-Z) to 10-35
        this_ascii_value = this_ascii_value - 55;
      } else if (this_ascii_value >= 97 && this_ascii_value <= 122) {
        //cast ascii value 97-122(char a-z) to 36-61
        this_ascii_value = this_ascii_value - 61;
      } //otherwise, output 'illegal character' and assign the value as 63
      else {
        console.log('illegal character');
        this_ascii_value = 63;
      }
      //convert ascii value to 6 digit binary string
      encoded_msg = encoded_msg + this_ascii_value.toString(2).padStart(6, '0');
    }
  }

  //return encoded message
  return encoded_msg;
}

/*
function to decode text message from encoded message used for QIM
@inputs:
    encoded_message(str of '0' and '1'): encoded message
    code_type('ascii', 'utf8'..., default as 'ascii'): code type for message encoding
@output:
    text_message(string): any text message
@example:
*/
export function debinarize(
  encoded_message: string,
  code_type: string = 'ascii'
): string {
  //create encoded message binary string
  var decoded_msg = '';

  //encode message according to the code type
  if (code_type == 'ascii') {
    //create var to store ascii value for each character
    var this_ascii_value = 0;
    //assign values for ascii value array
    for (var i = 0; i < encoded_message.length; i = i + 8) {
      //convert each 8 binary char to ascii value
      this_ascii_value = parseInt(encoded_message.slice(i, i + 8), 2);
      //convert ascii value to char string
      decoded_msg = decoded_msg + String.fromCharCode(this_ascii_value);
    }
  } else if (code_type == 'ipfs') {
    //create var to store ascii value for each character
    var this_ascii_value = 0;
    //assign values for ascii value array
    for (var i = 0; i < encoded_message.length; i = i + 6) {
      //convert each 8 binary char to ascii value
      this_ascii_value = parseInt(encoded_message.slice(i, i + 6), 2);
      //cast ipfs restricted value back to ascii value
      if (this_ascii_value >= 0 && this_ascii_value <= 9) {
        //cast ascii value 48-57 (char 0-9) to 0-9
        this_ascii_value = this_ascii_value + 48;
      } else if (this_ascii_value >= 10 && this_ascii_value <= 35) {
        //cast ascii value 65-90(char A-Z) to 10-35
        this_ascii_value = this_ascii_value + 55;
      } else if (this_ascii_value >= 36 && this_ascii_value <= 61) {
        //cast ascii value 97-122(char a-z) to 36-61
        this_ascii_value = this_ascii_value + 61;
      } //otherwise, output 'illegal character' and assign the value as 63(?)
      else {
        console.log('illegal character');
        this_ascii_value = 63;
      }
      //convert ascii value to char string
      decoded_msg = decoded_msg + String.fromCharCode(this_ascii_value);
    }
  }

  //return decoded message
  return decoded_msg;
}

/*
function to add end flag tail to the encoded message
@inputs:
    encoded_message(str of '0' and '1'): encoded message
    q(number > 1, default as 7): RA coding rate
    code_type('ascii', 'utf8'..., default as 'ascii'): code type for message encoding
@output:
    encoded_message_with_tail(string): encoded message with tail
@example:
*/
export function addMessageTail(
  encoded_msg: string,
  q: number,
  code_type: string = 'ascii'
): string {
  var encoded_message_with_tail = '';
  let end_flag_tire: string;
  if (code_type == 'ascii') {
    end_flag_tire = '1'.repeat(q * 8);
  } else if (code_type == 'ipfs') {
    end_flag_tire = '1'.repeat(q * 6);
  } else {
    throw Error('Code does not exist');
  }

  encoded_message_with_tail = encoded_msg + end_flag_tire;
  return encoded_message_with_tail;
}

/*
function to get threshold for data hiding end judge
@inputs:
    q(number > 1, default as 7): RA coding rate
    code_type('ascii', 'utf8'..., default as 'ascii'): code type for message encoding
@output(json):
    threshold(number): length threshold for message tail
    LCM(number): LCM of q and code_type unit length
@example:
*/
export function getMessageTail(
  q: number = 7,
  code_type: string = 'ascii'
): { threshold: number; LCM: number } {
  var threshold = q;
  var LCM = q;
  if (code_type == 'ascii') {
    threshold = Math.floor((q * 8) / 3);
    LCM = q * 8;
  } else if (code_type == 'ipfs') {
    threshold = Math.floor((q * 6) / 3);
    LCM = q * 6;
  }
  var output = { threshold: threshold, LCM: LCM };
  return output;
}
