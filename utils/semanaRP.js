function getSemanaRP(date = new Date()) {
  const current = new Date(date);
  const day = current.getDay();

  const saturday = new Date(current);
  saturday.setHours(22, 0, 0, 0);

  const diffToSaturday = (day + 1) % 7;
  saturday.setDate(current.getDate() - diffToSaturday);

  if (current < saturday) {
    saturday.setDate(saturday.getDate() - 7);
  }

  const friday = new Date(saturday);
  friday.setDate(saturday.getDate() + 6);
  friday.setHours(23, 59, 59, 999);

  const semanaId = `${saturday.toISOString().slice(0, 10)}_${friday
    .toISOString()
    .slice(0, 10)}`;

  return {
    inicio: saturday,
    fim: friday,
    semanaId
  };
}

module.exports = getSemanaRP;