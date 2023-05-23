const modifiers = {};

// %d = time based id
// %m = modifier (to prevent any chance of duplicates)

function genId(directory="home") {
  if (!(directory in modifiers)) modifiers[directory] = 0;
  else modifiers[directory]++;

  const time = (new Date()).getTime();
  const modifier = modifiers[directory];
  return `${time}-${modifier}`;
}

exports.genId = genId;