export default {
  metadata: {
    description: "Aruncă niște zaruri",
    options: {
      dice: "Numărul de zaruri de aruncat (implicit: 1)",
      sides: "Numărul de fețe ale zarurilor (implicit: 6)"
    }
  },
  response: "{username} a rulat {diceCount}d{diceSides} și a obținut {total}."
};