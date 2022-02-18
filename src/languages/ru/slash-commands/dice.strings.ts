export default {
  metadata: {
    description: "Бросьте кости",
    options: {
      dice: "Количество игральных костей для броска (по умолчанию: 1)",
      sides: "Количество сторон игральной кости (по умолчанию: 6)"
    }
  },
  response: "{username} бросил {diceCount}d{diceSides} и получил {total}"
};