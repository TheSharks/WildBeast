export default {
  metadata: {
    description: "Házení kostkou",
    options: {
      dice: "Počet kostek, kterými se hází (výchozí: 1)",
      sides: "Počet stran kostky (výchozí: 6)"
    }
  },
  response: "{username} hodil {diceCount}d{diceSides} a dostal {total}"
};