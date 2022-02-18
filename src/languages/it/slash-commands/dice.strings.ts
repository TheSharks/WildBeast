export default {
  metadata: {
    description: "Tira qualche dado",
    options: {
      dice: "Il numero di dadi da lanciare (predefinito: 1)",
      sides: "Il numero di facce del dado (predefinito: 6)"
    }
  },
  response: "{username} ha rotolato {diceCount}d{diceSides} e ha ottenuto {total}"
};