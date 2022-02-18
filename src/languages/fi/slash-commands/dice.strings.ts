export default {
  metadata: {
    description: "Heitä noppaa",
    options: {
      dice: "Heitettävien noppien määrä (oletus: 1)",
      sides: "Nopan sivujen lukumäärä (oletus: 6)."
    }
  },
  response: "{username} heitti {diceCount}d{diceSides} ja sai {total}"
};