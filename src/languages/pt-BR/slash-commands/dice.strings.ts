export default {
  metadata: {
    description: "Lançar alguns dados",
    options: {
      dice: "O número de dados a lançar (padrão: 1)",
      sides: "O número de lados nos dados (padrão: 6)"
    }
  },
  response: "{username} rolou {diceCount}d{diceSides} e obteve {total}"
};