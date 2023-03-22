export function lFill(str, fill=" ", len=2) { // add fill to right
  str = str.toString(); // ensure 'str' is a string
  for (let i = str.length; i < len; i++) { str = fill + str; }
  return str;
}

export function rFill(str, fill=" ", len=2) { // add fill to left
  str = str.toString(); // ensure 'str' is a string
  for (let i = str.length; i < len; i++) { str += fill; }
  return str;
}