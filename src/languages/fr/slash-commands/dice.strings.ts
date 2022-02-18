export default {
  metadata: {
    description: "Lancez des dés",
    options: {
      dice: "Le nombre de dés à lancer (par défaut : 1)",
      sides: "Le nombre de faces du dé (par défaut : 6)"
    }
  },
  response: "{username} a lancé {diceCount}d{diceSides} et obtenu {total}"
};